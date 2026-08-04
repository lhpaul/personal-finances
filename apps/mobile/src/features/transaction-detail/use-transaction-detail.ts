import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import {
  readTransactionDetail,
  type TransactionDetailParams,
  type TransactionDetailSnapshot,
} from './read-detail';

export type TransactionDetailState =
  | { status: 'pending' }
  | { status: 'ready'; data: TransactionDetailSnapshot }
  /** The route's `transactionId` resolved to nothing — a bad or stale deep link (Assumption A7). */
  | { status: 'missing' }
  | { status: 'error'; error: unknown };

/**
 * The async load, factored out of the hook so it can be exercised as a plain function over a
 * stubbed `getAppDatabase` **and** a stubbed `readTransactionDetail` (implementation plan
 * Testing Strategy Scenario 19; item #2's no-renderer precedent, the same shape #13's
 * `loadStageData` uses). Both dependencies default to the real implementations.
 */
export async function loadTransactionDetail(
  params: TransactionDetailParams,
  deps: {
    getAppDatabase: () => Promise<AppDatabase>;
    readTransactionDetail: (
      db: AppDatabase,
      params: TransactionDetailParams,
    ) => TransactionDetailSnapshot | undefined;
  } = { getAppDatabase, readTransactionDetail },
): Promise<TransactionDetailState> {
  try {
    const db = await deps.getAppDatabase();
    const data = deps.readTransactionDetail(db, params);
    if (!data) return { status: 'missing' };
    return { status: 'ready', data };
  } catch (error: unknown) {
    return { status: 'error', error };
  }
}

/**
 * `useTransactionDetail(params)` (implementation plan Decision 2): awaits `getAppDatabase()` once
 * behind a cancellation guard, calls `readTransactionDetail`, and re-reads whenever the screen
 * regains focus (`useFocusEffect` bumps `reloadToken`) — the same shape `useStageData` /
 * `useOnboardingSummary` / `useLaunchDecision` already use in this codebase, so a category
 * confirmed in #13's flow or a movement excluded elsewhere is reflected on return. A superseded
 * effect's cleanup sets `cancelled = true` before the next effect runs, so an in-flight read from
 * a stale focus event is discarded rather than racing the newer one into state
 * (concurrent-event-source addendum).
 *
 * The cancellation-guard mechanics themselves are not independently unit-tested, consistent with
 * every other `getAppDatabase()`-awaiting hook in this repository (no React hook-testing renderer
 * is installed — Verification Log). `loadTransactionDetail` above is the part of this hook's
 * behavior that *is* independently testable.
 */
export function useTransactionDetail(params: TransactionDetailParams): TransactionDetailState {
  const [state, setState] = useState<TransactionDetailState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;

    loadTransactionDetail(params).then((result) => {
      if (cancelled) return;
      setState(result);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `transactionId`/`locale` are the only fields loadTransactionDetail reads that can change; re-deriving `params` each render would defeat this effect's dependency stability.
  }, [params.transactionId, params.locale, reloadToken]);

  return state;
}
