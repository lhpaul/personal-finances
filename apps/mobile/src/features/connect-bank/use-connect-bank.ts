import { useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { connectBank, ConnectBankError, type ConnectBankErrorReason } from './connect-bank.service';
import { buildSyncRequest, setPendingSyncHandoff, SYNCING_ROUTE } from './sync-handoff';

export type ConnectBankUiState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'error'; reason: ConnectBankErrorReason };

export interface ConnectBankFormInput {
  institutionId: string;
  rut: string;
  password: string;
}

/**
 * The React wrapper around `connectBank` (implementation plan Layer-by-Layer). Builds `deps`
 * from `getAppDatabase()` and the Expo secure-store adapter, guards re-entrancy against a double
 * tap on *Conectar* (concurrency addendum), and never retains the plaintext beyond this closure —
 * `input` goes out of scope the moment this function returns.
 *
 * Navigates with `router.replace` (not `push`) so the credential form is not reachable via the
 * system back gesture from the syncing screen (spec: confirming credentials always leads forward,
 * AC23). The navigation call is deliberately **outside** the `try`/`catch` (found in review —
 * CodeRabbit PR #80): the database write already succeeded once `connectBank` resolves, so a
 * navigation-time throw must never be reported as `'connection_write_failed'` — doing so would
 * show the rejection hint and invite a resubmit that could create a second connection for the
 * same institution.
 */
export function useConnectBank(): {
  state: ConnectBankUiState;
  connect: (input: ConnectBankFormInput) => Promise<void>;
  dismissError: () => void;
} {
  const router = useRouter();
  const [state, setState] = useState<ConnectBankUiState>({ status: 'idle' });
  const inFlight = useRef(false);

  async function connect(input: ConnectBankFormInput): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: 'connecting' });

    let result: { userFinancialInstitutionId: string; credentialsKey: string };
    try {
      const db = await getAppDatabase();
      result = await connectBank(
        {
          db,
          secureStore: expoSecureStoreAdapter,
          newId: () => Crypto.randomUUID(),
          now: () => new Date().toISOString(),
        },
        input,
      );
    } catch (error: unknown) {
      const reason: ConnectBankErrorReason =
        error instanceof ConnectBankError ? error.reason : 'connection_write_failed';
      setState({ status: 'error', reason });
      inFlight.current = false;
      return;
    }

    // The write succeeded — hand the key (never a value) to item #11's syncing screen, then
    // navigate. Neither step can turn a successful write back into a reported failure.
    setPendingSyncHandoff(buildSyncRequest(result, input.institutionId));
    inFlight.current = false;
    router.replace(SYNCING_ROUTE);
  }

  /** Clears a stale rejection hint once the person starts correcting the form (found in review —
   * CodeRabbit PR #80): without this, `state.status === 'error'` — and the hint it drives on
   * `bank-credentials` — would otherwise persist under the password field until the next connect
   * attempt resolves, even after the person has already changed the input. */
  function dismissError(): void {
    setState((current) => (current.status === 'error' ? { status: 'idle' } : current));
  }

  return { state, connect, dismissError };
}
