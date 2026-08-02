import { Redirect } from 'expo-router';

import { useLaunchDecision } from '../src/features/onboarding/use-launch-decision';

export { ErrorBoundary } from 'expo-router';

/**
 * Real first-launch gate (implementation plan for issue #8, Decision 1, Decision 15; spec
 * Business Rule 13, AC1). Reads `app_settings.onboarding_completed` through
 * `useLaunchDecision()` and redirects to `/(onboarding)/intro` or `/(tabs)/home`.
 *
 * Renders `null` while `status === 'pending'` — on a warm launch this is imperceptible; on a
 * first launch it is the database migration + seed window (Decision 15). No splash screen and
 * no launch-failure screen are drawn in the mockups, so a bootstrap failure is surfaced through
 * the re-exported `expo-router` `ErrorBoundary` above instead of invented branded copy
 * (Assumption A3).
 *
 * There is no sign-in in this product (non-negotiable 7, BR0) — this file never redirects to an
 * `(auth)` route, which does not exist anywhere in this app.
 */
export default function Index() {
  const decision = useLaunchDecision();
  if (decision.status === 'pending') return null;
  return <Redirect href={decision.href} />;
}
