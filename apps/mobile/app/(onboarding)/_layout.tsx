import { Stack } from 'expo-router';

/**
 * The mockups draw their own top bars (or none) on every onboarding frame — no native header
 * exists anywhere in `#s-onboarding-*` (implementation plan Assumption A9). Adds no literal
 * string, so the `i18next/no-literal-string` exception recorded for `app/(tabs)/_layout.tsx` is
 * not repeated here.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
