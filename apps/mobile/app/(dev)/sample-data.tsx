/**
 * `__DEV__`-only sample-data panel (implementation plan for issue #12, Decision 11). Manifest-
 * style path `/(dev)/sample-data`; runtime URL `/sample-data` (Expo Router group segments do not
 * appear in the URL). No product screen links here, so a release build has no reachable entry
 * point — and this guard makes the route inert even if one is manufactured.
 *
 * Hook-free before the guard, so `DevSampleDataRoute()` can be called directly in a plain Jest
 * test with `__DEV__` forced to `false` — no renderer needed. `SampleDataPanel` is `require()`d
 * **inside** the `__DEV__` branch, exactly like `app/(dev)/gallery.tsx` — a static top-level
 * `import` would add it (and the inlined `store-v1.sql` fixture text it pulls in) to Metro's
 * dependency graph unconditionally, so `src/dev/` would still ship in a release bundle even
 * though the route renders nothing.
 */
export default function DevSampleDataRoute() {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module doc comment
  const { SampleDataPanel } = require('../../src/dev/SampleDataPanel');
  return <SampleDataPanel />;
}
