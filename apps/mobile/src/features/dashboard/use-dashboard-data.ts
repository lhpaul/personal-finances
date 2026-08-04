import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import type { DashboardData, DashboardDataParams } from './read-dashboard-data';
import { readDashboardData } from './read-dashboard-data';

export type DashboardDataState =
  | { status: 'pending' }
  | { status: 'ready'; data: DashboardData }
  | { status: 'error'; error: unknown };

export interface LoadDashboardDataArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  params: DashboardDataParams;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable without
 * a renderer — item #12's `loadHomeData` shape (implementation plan Decision 12), adopted here on
 * its merits (Scenario 26). Returns `undefined` once `isCancelled()` flips true, so the caller
 * never `setState`s a superseded run's result.
 */
export async function loadDashboardData({
  getAppDatabase,
  params,
  isCancelled,
}: LoadDashboardDataArgs): Promise<DashboardDataState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined; // teardown raced the handle — discard, do not setState
    return { status: 'ready', data: readDashboardData(db, params) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/**
 * `dashboard`'s single feature hook (implementation plan Decision 12). Re-reads when
 * `useFocusEffect` bumps its `reloadToken`, or when `params` (recomputed by the route whenever
 * `periodType` changes) gets a new identity, and delegates the cancellation-guarded read to
 * {@link loadDashboardData}, which awaits `getAppDatabase()` (item #8's memoized runtime handle)
 * and then calls `readDashboardData`. No TanStack Query, no provider — the same shape every
 * screen in this campaign reads the database with.
 *
 * A stored rejection is re-thrown **during render**, not inside the async callback — throwing
 * inside the callback would produce an unhandled rejection instead of reaching the route's
 * `ErrorBoundary` (Concurrent-event-source addendum).
 */
export function useDashboardData(params: DashboardDataParams): DashboardDataState {
  const [state, setState] = useState<DashboardDataState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);
  const hasFocusedOnce = useRef(false);
  const { period, previousPeriod, trendWindow, locale } = params;

  useFocusEffect(
    useCallback(() => {
      // The mount effect below already performs the first read; without this guard, the first
      // focus event (which also fires on mount) would bump reloadToken immediately after and
      // force a second, redundant read on every mount (item #12's found-in-review fix, reused
      // here).
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    loadDashboardData({
      getAppDatabase,
      params: { period, previousPeriod, trendWindow, locale },
      isCancelled: () => cancelled,
    }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // `period` / `previousPeriod` / `trendWindow` are expected to be referentially stable across
    // renders (the route recomputes them with `useMemo`, keyed on the local day and the
    // month/week segment) — an unmemoized caller would re-read on every render, which is wasteful
    // but not incorrect (every read is idempotent).
  }, [period, previousPeriod, trendWindow, locale, reloadToken]);

  // Surfaces a bootstrap or read failure to the route's `ErrorBoundary` (Concurrent-event-source
  // addendum, "Error propagation across async boundaries").
  if (state.status === 'error') throw state.error;
  return state;
}
