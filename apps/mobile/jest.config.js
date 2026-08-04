/**
 * Three-project Jest config (implementation plan Decision 3 (item #3); Decision 17 (item #10)).
 *
 * - `app`: the existing `jest-expo` preset, unchanged, but ignoring everything under `src/db`
 *   and `src/features/sync` (issue #10 Decision 17) so React Native's module mocks and
 *   RN-flavoured test environment never load for either Node-only tier — a native Node addon
 *   (`better-sqlite3`) and a Node-only test tier do not need them and can be destabilised by
 *   them. Also ignores `*.db.test.ts` anywhere under `src/features/` (home-screen implementation
 *   plan for issue #12, Infrastructure) — those files run under the `db` project instead, so the
 *   same file never runs twice.
 * - `db`: `testEnvironment: 'node'` with `babel-jest` + `babel-preset-expo`, matching
 *   `*.test.ts` files under `src/db` **and** `*.db.test.ts` files under `src/features/` — the
 *   latter lets a repository **composition** that lives outside `src/db/` still be tested
 *   against real SQLite (issue #12, Scenario 25). This is what lets the whole database test
 *   suite run against `better-sqlite3` in memory, with no simulator and no device (AC24).
 * - `sync`: `testEnvironment: 'node'`, matching only `*.test.ts` files under `src/features/sync`
 *   (issue #10 Decision 17). The sync-engine tests need the same `better-sqlite3` access as the
 *   `db` tier and no React Native module mocks, so it is the same shape as `db` rather than
 *   `app`. Both halves — this project and the `app` project's added ignore entry — are required:
 *   adding the project without the ignore makes every sync test run twice, once under a preset
 *   that cannot load the native driver.
 *
 * - `feature`: `testEnvironment: 'node'`, matching only `*.node.test.ts` files under
 *   `src/features/` (implementation plan for issue #19, Decision 17; Resolution R1's
 *   re-verification step 6 confirmed this project did not already exist at implementation time).
 *   Same shape as `db`/`sync` — the settings wipe's proof (`wipe-local-data.node.test.ts`) runs
 *   the real `wipeLocalData` against a real `better-sqlite3` store and an in-memory secure-store
 *   fake, so it needs the native driver with no React Native module mocks, exactly like the other
 *   two Node-tier projects.
 *
 * `pnpm --filter @finanzas/mobile test` runs all four projects, so AC24's "runs as part of the
 * repository's existing test command" holds with no new command.
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/.expo/',
        '<rootDir>/src/db/',
        '<rootDir>/src/features/sync/',
        '\\.db\\.test\\.ts$',
        '\\.node\\.test\\.ts$',
      ],
    },
    {
      displayName: 'db',
      testEnvironment: 'node',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/db/**/*.test.ts', '<rootDir>/src/features/**/*.db.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
    },
    {
      displayName: 'sync',
      testEnvironment: 'node',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/features/sync/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
    },
    {
      displayName: 'feature',
      testEnvironment: 'node',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/features/**/*.node.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
    },
  ],
};
