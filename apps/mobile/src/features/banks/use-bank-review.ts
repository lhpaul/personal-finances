import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getBankConnectionSummary } from '../../db/repositories/institutions';
import { listProductsForConnection } from '../../db/repositories/products';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, BankConnectionSummary, BankProductSummary } from '../../db/types';

export type BankReviewDataState =
  | { status: 'pending' }
  | { status: 'ready'; connection: BankConnectionSummary; products: BankProductSummary[] }
  /** No connection for this institution, or one that exists but is `'disconnected'` — the route
   * redirects to `/settings/banks` on this status (Decision 13). */
  | { status: 'not_found' }
  | { status: 'error'; error: unknown };

export interface LoadBankReviewArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  institutionId: string;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable without
 * a renderer (implementation plan for issue #20, Decision 3). Composes
 * `getBankConnectionSummary` + `listProductsForConnection`. Returns `undefined` once
 * `isCancelled()` flips true.
 */
export async function loadBankReview({
  getAppDatabase,
  institutionId,
  isCancelled,
}: LoadBankReviewArgs): Promise<BankReviewDataState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined;

    const connection = getBankConnectionSummary(db, institutionId);
    if (connection === undefined || connection.status === 'disconnected') {
      return { status: 'not_found' };
    }
    const products = listProductsForConnection(db, connection.id);
    return { status: 'ready', connection, products };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/**
 * `bank-review`'s single feature hook (Decision 3, Decision 13). Re-reads on focus, exactly like
 * `useBankConnections` — this is how the "Sincronizar ahora" / "Actualizar credenciales" round
 * trip through item #11's syncing screen lands back with a freshly re-read state.
 */
export function useBankReview(institutionId: string): BankReviewDataState {
  const [state, setState] = useState<BankReviewDataState>({ status: 'pending' });
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
    loadBankReview({ getAppDatabase, institutionId, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [institutionId, reloadToken]);

  if (state.status === 'error') throw state.error;
  return state;
}
