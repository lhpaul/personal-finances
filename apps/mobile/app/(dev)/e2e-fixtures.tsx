/**
 * `__DEV__`-only route for the Maestro E2E fixture panel (implementation plan for issue #22, D6).
 * Manifest-style path `/(dev)/e2e-fixtures`; runtime URL `/e2e-fixtures` (Expo Router group
 * segments do not appear in the URL) — the flows deep-link to it as `finanzas:///e2e-fixtures`
 * (D5, the three-slash form).
 *
 * Hook-free before the guard, so `DevE2eFixturesRoute()` can be called directly in a plain Jest
 * test with `__DEV__` forced to `false` — no renderer needed, mirroring
 * `app/(dev)/sample-data.tsx`. `E2eFixtures` is `require()`d **inside** the `__DEV__` branch — a
 * static top-level `import` would add it, and every inlined `.sql` fixture it pulls in, to
 * Metro's dependency graph unconditionally, so `src/dev/` would still ship in a release bundle
 * even though the route renders nothing (AGENTS.md non-negotiable 7).
 */
export default function DevE2eFixturesRoute() {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see module doc comment
  const { E2eFixtures } = require('../../src/dev/E2eFixtures');
  return <E2eFixtures />;
}
