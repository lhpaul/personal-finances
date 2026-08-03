import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import type { HomeData, HomeDataParams } from './read-home-data';
import { readHomeData } from './read-home-data';

export type HomeDataState =
  | { status: 'pending' }
  | { status: 'ready'; data: HomeData }
  | { status: 'error'; error: unknown };

export interface LoadHomeDataArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  params: HomeDataParams;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable without
 * a renderer (implementation plan Decision 7, Scenario 26 — the same hook/pure split item #8
 * established between `use-launch-decision.ts` and `launch-decision.ts`). Returns `undefined`
 * once `isCancelled()` flips true, so the caller never `setState`s a superseded run's result.
 */
export async function loadHomeData({
  getAppDatabase,
  params,
  isCancelled,
}: LoadHomeDataArgs): Promise<HomeDataState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined; // teardown raced the handle — discard, do not setState
    return { status: 'ready', data: readHomeData(db, params) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/**
 * `home`'s single feature hook (implementation plan Decision 7). Re-reads when `useFocusEffect`
 * bumps its `reloadToken`, and delegates the cancellation-guarded read to {@link loadHomeData},
 * which awaits `getAppDatabase()` (item #8's memoized runtime handle) and then calls
 * `readHomeData`. No TanStack Query, no provider — every screen reads the database the same way
 * item #8 established.
 *
 * A stored rejection is re-thrown **during render**, not inside the async callback — throwing
 * inside the callback would produce an unhandled rejection instead of reaching the route's
 * `ErrorBoundary` (concurrency addendum).
 */
export function useHomeData({ period, previousPeriod, locale }: HomeDataParams): HomeDataState {
  const [state, setState] = useState<HomeDataState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);
  const hasFocusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // The mount effect below already performs the first read; without this guard, the first
      // focus event (which also fires on mount) would bump reloadToken immediately after and
      // force a second, redundant read on every mount (found in review). Only a later re-focus
      // should trigger a re-read.
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    loadHomeData({
      getAppDatabase,
      params: { period, previousPeriod, locale },
      isCancelled: () => cancelled,
    }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // `period` / `previousPeriod` are expected to be referentially stable across renders (the
    // route computes them once with `useMemo`, Decision 8) — an unmemoized caller would re-read
    // on every render, which is wasteful but not incorrect (every read is idempotent).
  }, [period, previousPeriod, locale, reloadToken]);

  // Surfaces a bootstrap or read failure to the route's `ErrorBoundary` (concurrency addendum,
  // "Error propagation across async boundaries").
  if (state.status === 'error') throw state.error;
  return state;
}
