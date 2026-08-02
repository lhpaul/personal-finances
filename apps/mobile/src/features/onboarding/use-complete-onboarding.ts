import { useRef } from 'react';
import { router } from 'expo-router';

import { markOnboardingCompleted } from '../../db/repositories/settings';
import { countUncategorized } from '../../db/repositories/transactions';
import { getAppDatabase } from '../../db/runtime';

export type UseCompleteOnboardingResult = {
  complete: () => void;
};

/**
 * `onboarding-ready`'s CTA (implementation plan Decisions 5 and 6). Writes
 * `app_settings.onboarding_completed` exactly once, **before** navigation, then reads
 * `countUncategorized(db)` at press time (not at mount, so a sync that finished while the screen
 * was open is reflected) and `router.replace`s to `/categorize/intro` or `/(tabs)/home` —
 * `replace`, not `push`, so the hardware back button cannot walk back into `(onboarding)`
 * (Decision 5, `BEHAVIOR.md`: "no se vuelve a entrar a `(onboarding)`").
 *
 * Re-entrancy guarded (concurrent-event-source addendum): a double tap can fire `complete()`
 * twice before the first call's promise resolves. `markOnboardingCompleted` is idempotent
 * regardless (Decision 5), so this guard protects navigation — a double `router.replace` — not
 * data.
 */
export function useCompleteOnboarding(): UseCompleteOnboardingResult {
  const inFlight = useRef(false);

  function complete(): void {
    if (inFlight.current) return;
    inFlight.current = true;

    getAppDatabase()
      .then((db) => {
        markOnboardingCompleted(db);
        const href = countUncategorized(db) > 0 ? '/categorize/intro' : '/(tabs)/home';
        router.replace(href);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }

  return { complete };
}
