/**
 * `__DEV__`-only connect-bank fixtures panel (implementation plan Decision 13). Manifest-style
 * path `/(dev)/connect-fixtures`; runtime URL `/connect-fixtures` (Expo Router group segments do
 * not appear in the URL). No product screen links here, so a release build has no reachable
 * entry point — and this guard makes the route inert even if one is manufactured.
 *
 * Hook-free before the guard, so `DevConnectFixturesRoute()` can be called directly in a plain
 * Jest test with `__DEV__` forced to `false` — no renderer needed. `ConnectFlowFixtures` is
 * `require()`d **inside** the `__DEV__` branch, exactly like `app/(dev)/sample-data.tsx` — a
 * static top-level `import` would add it to Metro's dependency graph unconditionally, so
 * `src/dev/` would still ship in a release bundle even though the route renders nothing.
 */
export default function DevConnectFixturesRoute() {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module doc comment
  const { ConnectFlowFixtures } = require('../../src/dev/ConnectFlowFixtures');
  return <ConnectFlowFixtures />;
}
