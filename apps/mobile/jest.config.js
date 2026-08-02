/**
 * Two-project Jest config (implementation plan Decision 3, item #3).
 *
 * - `app`: the existing `jest-expo` preset, unchanged, but ignoring everything under `src/db`
 *   so React Native's module mocks and RN-flavoured test environment never load for the
 *   Node-only database tier — a native Node addon (`better-sqlite3`) and a Node-only test tier
 *   do not need them and can be destabilised by them.
 * - `db`: `testEnvironment: 'node'` with `babel-jest` + `babel-preset-expo`, matching only
 *   `*.test.ts` files under `src/db`. This is what lets the whole database test suite run
 *   against `better-sqlite3` in memory, with no simulator and no device (AC24).
 *
 * `pnpm --filter @finanzas/mobile test` runs both projects, so AC24's "runs as part of the
 * repository's existing test command" holds with no new command.
 */
/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/', '<rootDir>/src/db/'],
    },
    {
      displayName: 'db',
      testEnvironment: 'node',
      rootDir: __dirname,
      testMatch: ['<rootDir>/src/db/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.expo/'],
    },
  ],
};
