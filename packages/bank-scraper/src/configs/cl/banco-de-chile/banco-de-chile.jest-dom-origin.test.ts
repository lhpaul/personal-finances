import { BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN } from './banco-de-chile.constants';

/**
 * Guards against drift between `jest.config.js`'s hardcoded `dom` project origin and this bank's
 * real `credentialEntryOrigin` (CodeRabbit finding #2). Jest configuration cannot import a
 * compiled TypeScript constant, so the origin is duplicated there as a literal string; nothing
 * previously verified the two stay in sync. Without this test, a change to
 * `BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN` would leave `jest.config.js` stale, and every DOM test
 * would silently exercise the in-page origin gate (Decision 4, checkpoint 3) against the wrong
 * origin instead of failing loudly.
 */
describe('jest.config.js dom project origin stays in sync with the bank config', () => {
  it('matches BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN', () => {
    // jest.config.js is a plain CommonJS module; requiring it here is the only way to inspect the
    // literal it declares.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jestConfig = require('../../../../jest.config.js') as {
      projects: Array<{ displayName: string; testEnvironmentOptions?: { url?: string } }>;
    };
    const domProject = jestConfig.projects.find((project) => project.displayName === 'dom');
    expect(domProject).toBeDefined();
    expect(domProject?.testEnvironmentOptions?.url).toBe(`${BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN}/login`);
  });
});
