import type { AppDatabase, BankConnectionSummary } from '../../../db/types';
import { loadBankConnections } from '../use-bank-connections';

/** `loadBankConnections` called directly with a stubbed `getAppDatabase` and a manually-flipped
 * `isCancelled` — item #12's `loadHomeData` no-renderer precedent, applied here (concurrency
 * addendum, "Race conditions at teardown"). */
jest.mock('../../../db/repositories/institutions', () => ({
  listSettingsBankConnections: jest.fn(
    (): BankConnectionSummary[] => [
      {
        id: 'conn-1',
        institutionId: 'banco-de-chile',
        name: 'Banco de Chile',
        shortName: 'BCH',
        brandColor: '#003da5',
        logoUrl: undefined,
        status: 'active',
        syncStatus: 'ok',
        lastSyncAt: null,
        lastSuccessAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        productCount: 0,
      },
    ],
  ),
}));

describe('loadBankConnections', () => {
  it('resolves ready with the repository result when isCancelled never flips', async () => {
    const fakeDb = {} as AppDatabase;
    const result = await loadBankConnections({
      getAppDatabase: () => Promise.resolve(fakeDb),
      isCancelled: () => false,
    });
    expect(result?.status).toBe('ready');
    if (result?.status === 'ready') {
      expect(result.connections).toHaveLength(1);
    }
  });

  it('returns undefined once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true;
      return Promise.resolve({} as AppDatabase);
    });
    const result = await loadBankConnections({ getAppDatabase, isCancelled: () => cancelled });
    expect(result).toBeUndefined();
  });

  it('resolves to an error state when getAppDatabase rejects', async () => {
    const rejection = new Error('bootstrap failed');
    const result = await loadBankConnections({
      getAppDatabase: () => Promise.reject(rejection),
      isCancelled: () => false,
    });
    expect(result).toEqual({ status: 'error', error: rejection });
  });

  it('discards a rejected getAppDatabase once cancelled', async () => {
    const result = await loadBankConnections({
      getAppDatabase: () => Promise.reject(new Error('bootstrap failed')),
      isCancelled: () => true,
    });
    expect(result).toBeUndefined();
  });
});
