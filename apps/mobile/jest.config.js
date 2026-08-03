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
 * `pnpm --filter @finanzas/mobile test` runs all three projects, so AC24's "runs as part of the
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
  ],
};
