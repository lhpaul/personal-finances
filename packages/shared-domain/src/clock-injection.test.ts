import { summarizePeriod } from './aggregates';
import type { Movement } from './types';

/**
 * AC3, behavioural layer: every exported function is a pure function of its arguments, so the
 * strongest available evidence that the clock is truly injected (never read from the host) is
 * that the full aggregate output is byte-identical under deliberately hostile fake system times
 * — and identical again with no fake timers at all. Epoch-millisecond **numbers** are used with
 * `jest.setSystemTime`, never `new Date(...)`, so this test itself complies with the `Date` ban
 * it exists to support.
 */

const JAN_2025 = { start: '2025-01-01', end: '2025-01-31' };

function movement(overrides: Partial<Movement> & Pick<Movement, 'id'>): Movement {
  return {
    dateLocal: '2025-01-01',
    amount: 0,
    type: 'debit',
    merchantId: null,
    transactionCategoryId: null,
    categorySource: null,
    reviewFlag: null,
    excludedAt: null,
    exclusionReason: null,
    includedAmount: null,
    ...overrides,
  };
}

const fixture: Movement[] = [
  movement({ id: 'm1', dateLocal: '2025-01-05', transactionCategoryId: 'comida', amount: 42000 }),
  movement({
    id: 'm2',
    dateLocal: '2025-01-12',
    transactionCategoryId: 'compras',
    amount: 42000,
    includedAmount: 21000,
  }),
  movement({
    id: 'm3',
    dateLocal: '2025-01-20',
    transactionCategoryId: 'salud',
    amount: 15000,
    excludedAt: '2025-01-21T10:00:00Z',
  }),
  movement({ id: 'm4', dateLocal: '2025-01-25', transactionCategoryId: null, amount: 21000 }),
];

function runFixture() {
  return summarizePeriod(fixture, JAN_2025, '2025-01-29');
}

describe('clock injection — AC3 behavioural proof', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('produces byte-identical output under two wildly different fake system times', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1735689600000); // 2025-01-01T00:00:00Z
    const resultA = runFixture();

    jest.setSystemTime(2208988800000); // 2040-01-01T00:00:00Z
    const resultB = runFixture();

    expect(resultA).toEqual(resultB);
  });

  it('produces byte-identical output with no fake timers at all', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1735689600000);
    const withFakeTimer = runFixture();

    jest.useRealTimers();
    const withoutFakeTimer = runFixture();

    expect(withFakeTimer).toEqual(withoutFakeTimer);
  });

  it('the full summary shape is stable across both proofs (regression guard for the assertion above)', () => {
    const summary = runFixture();
    expect(summary.totals.expenseTotal).toBe(84000);
    expect(summary.dailyAverageExpense).toBe(2897);
  });
});
