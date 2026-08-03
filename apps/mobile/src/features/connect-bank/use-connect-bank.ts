import { useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { connectBank, ConnectBankError, type ConnectBankErrorReason } from './connect-bank.service';
import { SYNCING_ROUTE } from './sync-handoff';

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
 * AC23).
 */
export function useConnectBank(): { state: ConnectBankUiState; connect: (input: ConnectBankFormInput) => Promise<void> } {
  const router = useRouter();
  const [state, setState] = useState<ConnectBankUiState>({ status: 'idle' });
  const inFlight = useRef(false);

  async function connect(input: ConnectBankFormInput): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: 'connecting' });
    try {
      const db = await getAppDatabase();
      await connectBank(
        {
          db,
          secureStore: expoSecureStoreAdapter,
          newId: () => Crypto.randomUUID(),
          now: () => new Date().toISOString(),
        },
        input,
      );
      router.replace(SYNCING_ROUTE);
    } catch (error: unknown) {
      const reason: ConnectBankErrorReason =
        error instanceof ConnectBankError ? error.reason : 'connection_write_failed';
      setState({ status: 'error', reason });
    } finally {
      inFlight.current = false;
    }
  }

  return { state, connect };
}
