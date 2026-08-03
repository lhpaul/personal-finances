/** @type {import('jest').Config} */
const sharedConfig = {
  preset: 'ts-jest',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

module.exports = {
  projects: [
    {
      ...sharedConfig,
      displayName: 'engine',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testPathIgnorePatterns: [...sharedConfig.testPathIgnorePatterns, '\\.dom\\.test\\.ts$'],
    },
    {
      ...sharedConfig,
      displayName: 'dom',
      testEnvironment: 'jsdom',
      // Matches the single registered bank's real sign-in origin (its config's
      // `credentialEntryOrigin`) so window.location.origin inside an executed script naturally
      // passes the in-page origin gate (Decision 4, checkpoint 3) for the common case. The one
      // test that must observe checkpoint 3 rejecting a mismatched origin asserts the generated
      // source string's shape instead of relying on a different jsdom navigation, which Jest
      // does not support per-test without a separate test file.
      //
      // This literal is an intentional, named exception to the bank-containment scan
      // (testing/bank-containment.test.ts): Jest project configuration cannot import a
      // TypeScript source file's exported constant without a compiler step, so the concrete
      // origin value is duplicated here rather than referenced by name.
      testEnvironmentOptions: { url: 'https://login.portales.bancochile.cl/login' },
      testMatch: ['<rootDir>/src/**/*.dom.test.ts'],
    },
  ],
};
