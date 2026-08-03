import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listConnectedBankSummaries } from '../../db/repositories/institutions';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, ConnectedBankSummary } from '../../db/types';

export type ConnectedBanksState =
  | { status: 'pending' }
  | { status: 'ready'; connections: ConnectedBankSummary[] }
  | { status: 'error'; error: unknown };

export interface LoadConnectedBanksArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  isCancelled: () => boolean;
}

export async function loadConnectedBanks({
  getAppDatabase,
  isCancelled,
}: LoadConnectedBanksArgs): Promise<ConnectedBanksState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined;
    return { status: 'ready', connections: listConnectedBankSummaries(db) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/** `bank-connected`'s data read (implementation plan Decision 9, Decision 17). Refreshes on
 * focus — "Agregar otro banco" can return here after a second connection was made, and the
 * re-entered screen must show the newly-added row. */
export function useConnectedBanks(): ConnectedBanksState {
  const [state, setState] = useState<ConnectedBanksState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);
  const hasFocusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    loadConnectedBanks({ getAppDatabase, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (state.status === 'error') throw state.error;
  return state;
}
