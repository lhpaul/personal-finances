import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import { readStageData, type StageData, type StageDataParams } from './read-stage-data';

export type StageDataState =
  | { status: 'pending' }
  | { status: 'ready'; data: StageData }
  | { status: 'error'; error: unknown };

/**
 * The async load, factored out of the hook so it can be exercised as a plain function over a
 * stubbed `getAppDatabase` **and** a stubbed `readStageData` (implementation plan Testing
 * Strategy Scenario 22; item #2's no-renderer precedent — this repository has no React
 * hook-testing renderer installed). Both dependencies default to the real implementations, so
 * `useStageData` below calls this with no arguments beyond `params`.
 */
export async function loadStageData(
  params: StageDataParams,
  deps: {
    getAppDatabase: () => Promise<AppDatabase>;
    readStageData: (db: AppDatabase, params: StageDataParams) => StageData;
  } = { getAppDatabase, readStageData },
): Promise<StageDataState> {
  try {
    const db = await deps.getAppDatabase();
    return { status: 'ready', data: deps.readStageData(db, params) };
  } catch (error: unknown) {
    return { status: 'error', error };
  }
}

/**
 * `useStageData(params)` (implementation plan Decision 16): awaits `getAppDatabase()` once
 * behind a cancellation guard, calls `readStageData`, and re-reads whenever the screen regains
 * focus (`useFocusEffect` bumps `reloadToken`) — the same shape `useOnboardingSummary` /
 * `useLaunchDecision` already use in this codebase. A superseded effect's cleanup sets
 * `cancelled = true` before the next effect runs, so an in-flight read from a stale focus event
 * is discarded rather than racing the newer one into state (concurrent-event-source addendum).
 *
 * The cancellation-guard mechanics themselves are not independently unit-tested here, consistent
 * with the existing, shipped `useOnboardingSummary` / `useLaunchDecision` hooks in this
 * repository — none of which has a dedicated hook test either, because no React hook-testing
 * renderer is installed (Verification Log). `loadStageData` above is the part of this hook's
 * behavior that *is* independently testable, and is covered by `use-stage-data.test.ts`.
 */
export function useStageData(params: StageDataParams): StageDataState {
  const [state, setState] = useState<StageDataState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;

    loadStageData(params).then((result) => {
      if (cancelled) return;
      setState(result);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `params.locale` is the only field readStageData reads that can change; re-deriving `params` each render would defeat this effect's dependency stability.
  }, [params.locale, reloadToken]);

  return state;
}
