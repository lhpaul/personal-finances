import { useEffect, useState } from 'react';

import { isOnboardingCompleted } from '../../db/repositories/settings';
import { getAppDatabase } from '../../db/runtime';
import { resolveLaunchHref, type LaunchHref } from './launch-decision';

export type LaunchDecision = { status: 'pending' } | { status: 'resolved'; href: LaunchHref };

type InternalState = LaunchDecision | { status: 'error'; error: unknown };

/**
 * `app/index.tsx`'s launch gate (implementation plan Decision 1, Decision 15). Awaits
 * `getAppDatabase()` (the memoized Expo runtime bootstrap), reads
 * `app_settings.onboarding_completed`, and resolves the destination route.
 *
 * Cancellation-guarded (concurrent-event-source addendum): a screen can mount and unmount before
 * the bootstrap resolves; the cleanup flag drops a late result instead of calling `setState` on
 * an unmounted component. A rejected bootstrap arriving after unmount is also discarded rather
 * than re-thrown, because throwing from a cleaned-up effect would produce an unhandled rejection
 * with no `ErrorBoundary` still mounted to catch it — the failure is re-observed on the next
 * mount because `getAppDatabase()` clears its memo on failure.
 *
 * Bootstrap failures are re-thrown **during render**, not caught here, so `app/index.tsx`'s
 * re-exported `expo-router` `ErrorBoundary` can see them (Decision 15) — throwing inside the
 * async effect callback itself would not be caught by any `ErrorBoundary`.
 */
export function useLaunchDecision(): LaunchDecision {
  const [state, setState] = useState<InternalState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    getAppDatabase()
      .then((db) => {
        if (cancelled) return;
        const href = resolveLaunchHref(isOnboardingCompleted(db));
        setState({ status: 'resolved', href });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', error });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'error') {
    throw state.error;
  }
  return state;
}
