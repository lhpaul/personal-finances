/**
 * `__DEV__`-only bank-syncing fixtures panel (implementation plan Decision 10). Manifest-style
 * path `/(dev)/sync-fixtures`; runtime URL `/sync-fixtures` (Expo Router group segments do not
 * appear in the URL). No product screen links here, so a release build has no reachable entry
 * point — and this guard makes the route inert even if one is manufactured.
 *
 * Hook-free before the guard, so `DevSyncFixturesRoute()` can be called directly in a plain Jest
 * test with `__DEV__` forced to `false` — no renderer needed. `SyncFixtures` is `require()`d
 * **inside** the `__DEV__` branch, exactly like `app/(dev)/connect-fixtures.tsx` — a static
 * top-level `import` would add it to Metro's dependency graph unconditionally, so `src/dev/`
 * would still ship in a release bundle even though the route renders nothing.
 */
export default function DevSyncFixturesRoute() {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module doc comment
  const { SyncFixtures } = require('../../src/dev/SyncFixtures');
  return <SyncFixtures />;
}
