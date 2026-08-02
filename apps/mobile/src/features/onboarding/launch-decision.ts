/**
 * The pure half of the launch gate (implementation plan Decision 1). Kept separate from
 * `use-launch-decision.ts` so the branch is unit-testable without a renderer (Decision 14).
 */
export type LaunchHref = '/(onboarding)/intro' | '/(tabs)/home';

export function resolveLaunchHref(onboardingCompleted: boolean): LaunchHref {
  return onboardingCompleted ? '/(tabs)/home' : '/(onboarding)/intro';
}
