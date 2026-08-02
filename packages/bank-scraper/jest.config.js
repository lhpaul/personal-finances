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
      testMatch: ['<rootDir>/src/**/*.dom.test.ts'],
    },
  ],
};
