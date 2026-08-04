import type { AppDatabase, BankConnectionSummary } from '../../../db/types';
import { loadBankReview } from '../use-bank-review';

const ACTIVE_CONNECTION: BankConnectionSummary = {
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
};

let mockConnectionResult: BankConnectionSummary | undefined = ACTIVE_CONNECTION;

jest.mock('../../../db/repositories/institutions', () => ({
  getBankConnectionSummary: jest.fn(() => mockConnectionResult),
}));
jest.mock('../../../db/repositories/products', () => ({
  listProductsForConnection: jest.fn(() => []),
}));

/** Implementation plan (issue #20) Testing Strategy, Scenario 18. `loadBankReview` called
 * directly — item #12's no-renderer precedent. */
describe('loadBankReview', () => {
  beforeEach(() => {
    mockConnectionResult = ACTIVE_CONNECTION;
  });

  it('resolves ready when a live connection exists', async () => {
    const result = await loadBankReview({
      getAppDatabase: () => Promise.resolve({} as AppDatabase),
      institutionId: 'banco-de-chile',
      isCancelled: () => false,
    });
    expect(result).toEqual({ status: 'ready', connection: ACTIVE_CONNECTION, products: [] });
  });

  it('resolves not_found when no connection exists (Decision 13)', async () => {
    mockConnectionResult = undefined;
    const result = await loadBankReview({
      getAppDatabase: () => Promise.resolve({} as AppDatabase),
      institutionId: 'banco-estado',
      isCancelled: () => false,
    });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('resolves not_found when the connection is disconnected (Decision 13)', async () => {
    mockConnectionResult = { ...ACTIVE_CONNECTION, status: 'disconnected' };
    const result = await loadBankReview({
      getAppDatabase: () => Promise.resolve({} as AppDatabase),
      institutionId: 'banco-de-chile',
      isCancelled: () => false,
    });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns undefined once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true;
      return Promise.resolve({} as AppDatabase);
    });
    const result = await loadBankReview({
      getAppDatabase,
      institutionId: 'banco-de-chile',
      isCancelled: () => cancelled,
    });
    expect(result).toBeUndefined();
  });

  it('resolves to an error state when getAppDatabase rejects', async () => {
    const rejection = new Error('bootstrap failed');
    const result = await loadBankReview({
      getAppDatabase: () => Promise.reject(rejection),
      institutionId: 'banco-de-chile',
      isCancelled: () => false,
    });
    expect(result).toEqual({ status: 'error', error: rejection });
  });
});
