import { DesignSystemGallery } from '../../src/dev/DesignSystemGallery';

/**
 * `__DEV__`-only design-system gallery. Manifest-style path `/(dev)/gallery`; runtime URL
 * `/gallery` (Expo Router group segments do not appear in the URL). No product screen links
 * here, so a release build has no reachable entry point — and this guard makes the route
 * inert even if one is manufactured.
 *
 * Hook-free before the guard, so `DevGalleryRoute()` can be called directly in a plain Jest
 * test with `__DEV__` forced to `false` — no renderer needed.
 */
export default function DevGalleryRoute() {
  if (!__DEV__) return null;
  return <DesignSystemGallery />;
}
