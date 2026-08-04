import { useRef, useState } from 'react';

import { getAppDatabase } from '../../db/runtime';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { disconnectBank, type DisconnectBankInput, type DisconnectOutcome } from './disconnect-bank.service';

export type DisconnectBankUiState = 'idle' | 'running' | 'failed';

/**
 * The React wrapper around `disconnectBank` (implementation plan for issue #20, Decision 2's
 * concurrency guard). Builds `deps` from `getAppDatabase()` and the Expo secure-store adapter
 * (mirrors item #9's `useConnectBank`), and guards re-entrancy: a second press of *Desconectar*
 * while the first is still in flight is a no-op, so the ordered credential-then-status sequence
 * never runs twice concurrently for the same connection.
 */
export function useDisconnectBank(): {
  status: DisconnectBankUiState;
  run: (input: DisconnectBankInput) => Promise<DisconnectOutcome | undefined>;
  reset: () => void;
} {
  const [status, setStatus] = useState<DisconnectBankUiState>('idle');
  const inFlight = useRef(false);

  async function run(input: DisconnectBankInput): Promise<DisconnectOutcome | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setStatus('running');

    const db = await getAppDatabase();
    const outcome = await disconnectBank({ db, secureStore: expoSecureStoreAdapter }, input);

    inFlight.current = false;
    setStatus(outcome.status === 'disconnected' ? 'idle' : 'failed');
    return outcome;
  }

  function reset(): void {
    setStatus((current) => (current === 'failed' ? 'idle' : current));
  }

  return { status, run, reset };
}
