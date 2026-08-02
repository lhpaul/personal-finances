/**
 * `__DEV__`-only design-system gallery. Manifest-style path `/(dev)/gallery`; runtime URL
 * `/gallery` (Expo Router group segments do not appear in the URL). No product screen links
 * here, so a release build has no reachable entry point — and this guard makes the route
 * inert even if one is manufactured.
 *
 * Hook-free before the guard, so `DevGalleryRoute()` can be called directly in a plain Jest
 * test with `__DEV__` forced to `false` — no renderer needed.
 *
 * `DesignSystemGallery` is `require()`d **inside** the `__DEV__` branch rather than imported
 * at the top of the module. A static top-level `import` would add `DesignSystemGallery` (and
 * everything it pulls in) to Metro's dependency graph unconditionally, so `src/dev/` would
 * still ship in a release bundle even though the route renders nothing — found in review.
 * Metro's dead-code elimination can drop an unreachable `require()` call at build time because
 * `__DEV__` is statically known; a static `import` cannot be eliminated the same way.
 */
export default function DevGalleryRoute() {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module doc comment
  const { DesignSystemGallery } = require('../../src/dev/DesignSystemGallery');
  return <DesignSystemGallery />;
}
