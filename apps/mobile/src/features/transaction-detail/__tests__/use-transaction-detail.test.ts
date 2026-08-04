import { loadTransactionDetail } from '../use-transaction-detail';
import type { TransactionDetailSnapshot } from '../read-detail';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 19 (concurrency
 * addendum, A7). Exercises `loadTransactionDetail` — the async load extracted from
 * `useTransactionDetail` — as a plain function over a stubbed `getAppDatabase` and a stubbed
 * `readTransactionDetail` (item #2's no-renderer precedent; mirrors #13's `use-stage-data.test.ts`).
 */
const SNAPSHOT: TransactionDetailSnapshot = {
  context: {
    transaction: {
      id: 'tx-1',
      userFinancialProductId: 'product-1',
      externalId: null,
      amount: 35000,
      type: 'debit',
      currencyCode: 'CLP',
      occurredAt: '2025-01-24T14:20:00.000Z',
      dateLocal: '2025-01-24',
      rawDescription: 'COMPRA LIDER EXPRESS',
      note: null,
      merchantId: null,
      transactionCategoryId: null,
      categorySource: null,
      reviewFlag: null,
      excludedAt: null,
      exclusionReason: null,
      exclusionNote: null,
      includedAmount: null,
      isManual: false,
      createdAt: '2025-01-24T14:20:00.000Z',
      updatedAt: '2025-01-24T14:20:00.000Z',
    },
    merchantName: null,
    merchant: null,
    product: { id: 'product-1', name: 'Cta. corriente', mask: undefined },
  },
  category: undefined,
  categoryChoices: [],
  taxonomy: [],
  suggestion: null,
};

describe('loadTransactionDetail', () => {
  it('resolves to "ready" carrying whatever readTransactionDetail produced from the resolved handle', async () => {
    const fakeDb = { marker: 'fake-db' } as never;
    const result = await loadTransactionDetail(
      { transactionId: 'tx-1', locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve(fakeDb),
        readTransactionDetail: (db) => {
          expect(db).toBe(fakeDb);
          return SNAPSHOT;
        },
      },
    );
    expect(result).toEqual({ status: 'ready', data: SNAPSHOT });
  });

  it('resolves to "missing" when readTransactionDetail returns undefined (A7 — a bad or stale id)', async () => {
    const result = await loadTransactionDetail(
      { transactionId: 'does-not-exist', locale: 'es' },
      { getAppDatabase: () => Promise.resolve({} as never), readTransactionDetail: () => undefined },
    );
    expect(result).toEqual({ status: 'missing' });
  });

  it('becomes "error" when getAppDatabase rejects, without throwing', async () => {
    const boom = new Error('bootstrap failed');
    const result = await loadTransactionDetail(
      { transactionId: 'tx-1', locale: 'es' },
      { getAppDatabase: () => Promise.reject(boom), readTransactionDetail: () => SNAPSHOT },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });

  it('becomes "error" when readTransactionDetail itself throws, without throwing', async () => {
    const boom = new Error('a repository call failed');
    const result = await loadTransactionDetail(
      { transactionId: 'tx-1', locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve({} as never),
        readTransactionDetail: () => {
          throw boom;
        },
      },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });

  it('never resolves to "pending" — that state exists only before the first load completes', async () => {
    const result = await loadTransactionDetail(
      { transactionId: 'tx-1', locale: 'es' },
      { getAppDatabase: () => Promise.reject(new Error('any failure')), readTransactionDetail: () => SNAPSHOT },
    );
    expect(result.status).not.toBe('pending');
  });
});
