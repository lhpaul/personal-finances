import { useRef, useState } from 'react';

import { getAppDatabase } from '../../db/runtime';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { disconnectBank, type DisconnectBankInput, type DisconnectOutcome } from './disconnect-bank.service';

export type DisconnectBankUiState = 'idle' | 'running' | 'failed';

export interface GuardedDisconnectArgs {
  inFlight: { current: boolean };
  getAppDatabase: () => Promise<Parameters<typeof disconnectBank>[0]['db']>;
  secureStore: Parameters<typeof disconnectBank>[0]['secureStore'];
  input: DisconnectBankInput;
}

/**
 * The re-entrancy guard, extracted from the hook so it is testable without a renderer (mirrors
 * `use-home-data.ts`'s `loadHomeData` / `useHomeData` split). Concurrency addendum, scenario 7: a
 * second call while `inFlight.current` is already `true` is a no-op and returns `undefined`
 * without touching either storage system — the ordered credential-then-status sequence never
 * runs twice concurrently for the same connection.
 */
export async function guardedDisconnect({
  inFlight,
  getAppDatabase,
  secureStore,
  input,
}: GuardedDisconnectArgs): Promise<DisconnectOutcome | undefined> {
  if (inFlight.current) return undefined;
  inFlight.current = true;
  try {
    const db = await getAppDatabase();
    return await disconnectBank({ db, secureStore }, input);
  } finally {
    inFlight.current = false;
  }
}

/**
 * The React wrapper around `disconnectBank` (implementation plan for issue #20, Decision 2's
 * concurrency guard). Builds `deps` from `getAppDatabase()` and the Expo secure-store adapter
 * (mirrors item #9's `useConnectBank`), and guards re-entrancy through {@link guardedDisconnect}:
 * a second press of *Desconectar* while the first is still in flight is a no-op.
 */
export function useDisconnectBank(): {
  status: DisconnectBankUiState;
  run: (input: DisconnectBankInput) => Promise<DisconnectOutcome | undefined>;
  reset: () => void;
} {
  const [status, setStatus] = useState<DisconnectBankUiState>('idle');
  const inFlight = useRef(false);

  async function run(input: DisconnectBankInput): Promise<DisconnectOutcome | undefined> {
    if (inFlight.current) return undefined; // scenario 7: a second press while running is a no-op
    setStatus('running');
    const outcome = await guardedDisconnect({
      inFlight,
      getAppDatabase,
      secureStore: expoSecureStoreAdapter,
      input,
    });
    // `outcome` is `undefined` only when `guardedDisconnect`'s own guard rejected a concurrent
    // call that slipped past the check above between two synchronous event handlers — status is
    // left as whatever the winning call already set it to.
    if (outcome !== undefined) {
      setStatus(outcome.status === 'disconnected' ? 'idle' : 'failed');
    }
    return outcome;
  }

  function reset(): void {
    setStatus((current) => (current === 'failed' ? 'idle' : current));
  }

  return { status, run, reset };
}
