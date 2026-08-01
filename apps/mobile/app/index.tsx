import { Redirect } from 'expo-router';

/**
 * Entry shim (Decision 7, spec Business Rule 13). Expo Router needs a match for `/`.
 *
 * This unconditionally redirects to the onboarding entry until the launch-time gate that
 * reads `app_settings.onboarding_completed` — deciding between `(onboarding)/intro` and
 * `(tabs)/home` — is wired by a separate item (issue #8). There is no sign-in in this
 * product, so this shim never references any `(auth)` route.
 *
 * It renders no UI, implements no mockup screen, and is excluded from route-parity counting:
 * Business Rule 3 ("a route exists only if the manifest declares it") is not weakened by
 * this file, because the shim adds no destination.
 */
export default function Index() {
  return <Redirect href="/(onboarding)/intro" />;
}
