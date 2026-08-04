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
 * A stable string identity for a `DashboardDataParams` value (CodeRabbit review, PR #88,
 * threads on `dashboard.tsx`/`use-dashboard-data.ts`): the fields are plain `DateLocal` strings
 * and a `SupportedLocale` string, so `JSON.stringify` over them is deterministic and
 * value-equal inputs (by content, not by reference) always produce the same key.
 */
export function dashboardDataParamsKey(params: DashboardDataParams): string {
  return JSON.stringify([params.period, params.previousPeriod, params.trendWindow, params.locale]);
}

interface StoredDashboardDataState {
  key: string;
  result: DashboardDataState;
}

/**
 * Guards against exposing a completed read's result under **newer** params (found in CodeRabbit
 * review, PR #88): when the `month`/`week` segment toggles, or the locale changes, `params`
 * changes identity before the in-flight read for the previous params has settled. Without this
 * guard the hook would keep returning the *previous* `ready` (or `error`) result — `dashboard.tsx`
 * would then compose the previous read's `windowDailyTotals` with the *new* `periodStarts`, a
 * genuine data-correctness bug, not merely a stale-UI flash. Returns `pending` whenever `stored`'s
 * key does not match `currentKey`, discarding a stale `ready` or `error` result rather than
 * exposing it under labels/periods it does not describe — the same "renders nothing while
 * transitioning" shape Assumption A13 already establishes for the initial bootstrap case.
 */
export function selectDashboardDataState(
  stored: StoredDashboardDataState,
  currentKey: string,
): DashboardDataState {
  return stored.key === currentKey ? stored.result : { status: 'pending' };
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
  const currentKey = dashboardDataParamsKey(params);
  const [stored, setStored] = useState<StoredDashboardDataState>({
    key: currentKey,
    result: { status: 'pending' },
  });
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
    const key = dashboardDataParamsKey({ period, previousPeriod, trendWindow, locale });
    loadDashboardData({
      getAppDatabase,
      params: { period, previousPeriod, trendWindow, locale },
      isCancelled: () => cancelled,
    }).then((next) => {
      if (next !== undefined) setStored({ key, result: next });
    });
    return () => {
      cancelled = true;
    };
    // `period` / `previousPeriod` / `trendWindow` are expected to be referentially stable across
    // renders (the route recomputes them with `useMemo`, keyed on the local day and the
    // month/week segment) — an unmemoized caller would re-read on every render, which is wasteful
    // but not incorrect (every read is idempotent).
  }, [period, previousPeriod, trendWindow, locale, reloadToken]);

  // `selectDashboardDataState` discards `stored.result` in favour of `pending` whenever `stored`
  // was written for a params identity that is no longer current (found in CodeRabbit review, PR
  // #88) — this is what makes a mid-flight `month`/`week` toggle or locale change render nothing
  // instead of combining a superseded read with the new periods.
  const state = selectDashboardDataState(stored, currentKey);

  // Surfaces a bootstrap or read failure to the route's `ErrorBoundary` (Concurrent-event-source
  // addendum, "Error propagation across async boundaries").
  if (state.status === 'error') throw state.error;
  return state;
}
