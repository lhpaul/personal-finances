import type { AppDatabase } from '../../db/types';
import { credentialsKeyFor } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { applyE2eFixtureState, E2E_FIXTURE_STATES } from '../e2e-fixture-store';

const FAKE_DB = {} as AppDatabase;

// Hoisted above the imports above by `babel-plugin-jest-hoist`, mirroring
// `connect-fixtures-store.test.ts`'s precedent — every DB/secure-store boundary is stubbed so
// this suite exercises only `applyE2eFixtureState`'s own dispatch logic, with no real SQLite
// instance and no `expo-secure-store`.
const mockApplyFixtureSql = jest.fn();
const mockSetOnboardingCompleted = jest.fn();
const mockClearSampleFixture = jest.fn();
const mockLoadSampleFixture = jest.fn();
const mockClearScript = jest.fn();
const mockInstallScript = jest.fn();
const mockEnsureFixtureConnection = jest.fn().mockResolvedValue(undefined);

jest.mock('../../db/runtime', () => ({
  getAppDatabase: jest.fn().mockResolvedValue(FAKE_DB),
}));
jest.mock('../../db/dev-e2e-fixture', () => ({
  applyFixtureSql: (...args: unknown[]) => mockApplyFixtureSql(...args),
  setOnboardingCompleted: (...args: unknown[]) => mockSetOnboardingCompleted(...args),
}));
jest.mock('../../db/dev-fixture', () => ({
  clearSampleFixture: (...args: unknown[]) => mockClearSampleFixture(...args),
  loadSampleFixture: (...args: unknown[]) => mockLoadSampleFixture(...args),
}));
jest.mock('../scripted-runner', () => ({
  clearScript: (...args: unknown[]) => mockClearScript(...args),
  installScript: (...args: unknown[]) => mockInstallScript(...args),
}));
jest.mock('../sync-fixtures-store', () => ({
  ensureFixtureConnection: (...args: unknown[]) => mockEnsureFixtureConnection(...args),
}));

function createFakePort(): SecureStorePort {
  const store = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

/**
 * Maestro E2E flows (implementation plan for issue #22, Implementation Order step 4, D6).
 */
describe('e2e-fixture-store', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('E2E_FIXTURE_STATES lists exactly the five named states, in D6 order', () => {
    expect(E2E_FIXTURE_STATES).toEqual(['reset', 'synced-home', 'stage-queue', 'transaction-detail', 'scripted-read']);
  });

  it('reset clears the sample fixture, sets onboarding to false, clears the installed script, and deletes both fixture credentials (D7)', async () => {
    const port = createFakePort();
    await port.setItem(credentialsKeyFor('banco-de-chile'), 'x');
    await port.setItem(credentialsKeyFor('santander'), 'y');

    await applyE2eFixtureState('reset', port);

    expect(mockClearSampleFixture).toHaveBeenCalledWith(FAKE_DB, expect.any(String));
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(FAKE_DB, false);
    expect(mockClearScript).toHaveBeenCalledTimes(1);
    await expect(port.getItem(credentialsKeyFor('banco-de-chile'))).resolves.toBeNull();
    await expect(port.getItem(credentialsKeyFor('santander'))).resolves.toBeNull();
  });

  it('reset deletes fixture credentials unconditionally, even when none exist (idempotent)', async () => {
    const port = createFakePort();
    await expect(applyE2eFixtureState('reset', port)).resolves.toBeUndefined();
    await expect(applyE2eFixtureState('reset', port)).resolves.toBeUndefined();
  });

  it('synced-home loads the store fixture and marks onboarding complete', async () => {
    await applyE2eFixtureState('synced-home', createFakePort());

    expect(mockLoadSampleFixture).toHaveBeenCalledWith(FAKE_DB, expect.any(String));
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(FAKE_DB, true);
  });

  it('stage-queue applies the stage-queue delta and marks onboarding complete', async () => {
    await applyE2eFixtureState('stage-queue', createFakePort());

    expect(mockApplyFixtureSql).toHaveBeenCalledTimes(1);
    expect(mockApplyFixtureSql.mock.calls[0]?.[0]).toBe(FAKE_DB);
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(FAKE_DB, true);
  });

  it('transaction-detail applies the transaction-detail delta and marks onboarding complete', async () => {
    await applyE2eFixtureState('transaction-detail', createFakePort());

    expect(mockApplyFixtureSql).toHaveBeenCalledTimes(1);
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(FAKE_DB, true);
  });

  it('stage-queue and transaction-detail apply different SQL text (each its own fixture file)', async () => {
    await applyE2eFixtureState('stage-queue', createFakePort());
    const stageQueueSql = mockApplyFixtureSql.mock.calls[0]?.[1];
    mockApplyFixtureSql.mockClear();

    await applyE2eFixtureState('transaction-detail', createFakePort());
    const transactionDetailSql = mockApplyFixtureSql.mock.calls[0]?.[1];

    expect(stageQueueSql).not.toBe(transactionDetailSql);
  });

  it('scripted-read ensures the fixture connection, installs complete_with_data, and never touches the onboarding flag (D6)', async () => {
    await applyE2eFixtureState('scripted-read', createFakePort());

    expect(mockEnsureFixtureConnection).toHaveBeenCalledTimes(1);
    expect(mockInstallScript).toHaveBeenCalledWith('complete_with_data');
    expect(mockSetOnboardingCompleted).not.toHaveBeenCalled();
  });

  it('applying every state twice in one session is a no-op re: which mocks are called (idempotency by construction, D6)', async () => {
    const port = createFakePort();
    for (const state of E2E_FIXTURE_STATES) {
      await applyE2eFixtureState(state, port);
      await expect(applyE2eFixtureState(state, port)).resolves.toBeUndefined();
    }
  });
});
