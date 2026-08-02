import {
  buildCategoryBreakdown,
  computePeriodDelta,
  countDaysInPeriod,
  countElapsedDaysInPeriod,
  dailyAverage,
  movementDirection,
  summarizePeriod,
} from './aggregates';
import type { CategoryBreakdownInput } from './aggregates';
import { PERCENTAGE_TENTHS_TOTAL } from './apportionment';
import type { Movement } from './types';

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

const JAN_2025 = { start: '2025-01-01', end: '2025-01-31' };

// Fixture A — the aggregate-level blocking-gate assertion.
const fixtureA: Movement[] = [
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
];

describe('movementDirection — Decision 9', () => {
  it('debit -> expense', () => {
    expect(movementDirection({ type: 'debit' })).toBe('expense');
  });

  it('credit -> income', () => {
    expect(movementDirection({ type: 'credit' })).toBe('income');
  });
});

describe('summarizePeriod — Fixture A (the blocking gate)', () => {
  const summary = summarizePeriod(fixtureA, JAN_2025, '2025-01-29');

  it('expenseTotal is 63000 (42000 full + 21000 partial; excluded 15000 contributes nothing)', () => {
    expect(summary.totals.expenseTotal).toBe(63000);
  });

  it('includedCount is 2, excludedCount is 1, incomeTotal is 0', () => {
    expect(summary.totals.includedCount).toBe(2);
    expect(summary.totals.excludedCount).toBe(1);
    expect(summary.totals.incomeTotal).toBe(0);
  });

  it('expenseBreakdown has exactly 2 buckets, and none for the excluded salud category', () => {
    expect(summary.expenseBreakdown.buckets).toHaveLength(2);
    expect(summary.expenseBreakdown.buckets.some((b) => b.transactionCategoryId === 'salud')).toBe(false);
  });

  it('comida: 42000 / 1 movement / 667 tenths; compras: 21000 (partial) / 1 movement / 333 tenths', () => {
    const comida = summary.expenseBreakdown.buckets.find((b) => b.transactionCategoryId === 'comida');
    const compras = summary.expenseBreakdown.buckets.find((b) => b.transactionCategoryId === 'compras');
    expect(comida).toEqual({ transactionCategoryId: 'comida', total: 42000, movementCount: 1, percentageTenths: 667 });
    expect(compras).toEqual({
      transactionCategoryId: 'compras',
      total: 21000,
      movementCount: 1,
      percentageTenths: 333,
    });
  });

  it('dailyAverageExpense is 2172 (63000 / 29 elapsed days, half-up)', () => {
    expect(summary.dailyAverageExpense).toBe(2172);
  });
});

describe('summarizePeriod — Fixture B (no partial, proves the partial branch is not load-bearing)', () => {
  const fixtureB = fixtureA.map((m) => (m.id === 'm2' ? { ...m, includedAmount: null } : m));
  const summary = summarizePeriod(fixtureB, JAN_2025, '2025-01-29');

  it('expenseTotal becomes 84000 (both movements now contribute their full amount)', () => {
    expect(summary.totals.expenseTotal).toBe(84000);
  });

  it('comida and compras both apportion to 500 tenths', () => {
    const comida = summary.expenseBreakdown.buckets.find((b) => b.transactionCategoryId === 'comida');
    const compras = summary.expenseBreakdown.buckets.find((b) => b.transactionCategoryId === 'compras');
    expect(comida?.percentageTenths).toBe(500);
    expect(compras?.percentageTenths).toBe(500);
  });
});

describe('summarizePeriod — Fixture C (the uncategorized bucket, Business Rule 6)', () => {
  const fixtureC: Movement[] = [
    ...fixtureA,
    movement({ id: 'm4', dateLocal: '2025-01-25', transactionCategoryId: null, amount: 21000 }),
  ];
  const summary = summarizePeriod(fixtureC, JAN_2025, '2025-01-29');

  it('expenseTotal is 84000', () => {
    expect(summary.totals.expenseTotal).toBe(84000);
  });

  it('three buckets: comida 500, compras 250, null 250 — all exact, no leftover', () => {
    expect(summary.expenseBreakdown.buckets).toHaveLength(3);
    const byId = Object.fromEntries(
      summary.expenseBreakdown.buckets.map((b) => [b.transactionCategoryId ?? 'null', b.percentageTenths]),
    );
    expect(byId).toEqual({ comida: 500, compras: 250, null: 250 });
  });

  it('the null bucket sorts last among the tied 21000 totals', () => {
    const tied = summary.expenseBreakdown.buckets.filter((b) => b.total === 21000);
    expect(tied.map((b) => b.transactionCategoryId)).toEqual(['compras', null]);
  });

  it('uncategorizedCount is 1', () => {
    expect(summary.totals.uncategorizedCount).toBe(1);
  });

  it('dailyAverageExpense is 2897 (84000 / 29 elapsed days, half-up)', () => {
    expect(summary.dailyAverageExpense).toBe(2897);
  });
});

describe('buildCategoryBreakdown — Fixture D (apportionment tie-break determinism)', () => {
  const fixtureD: CategoryBreakdownInput[] = [
    { transactionCategoryId: 'comida', amount: 1000, includedAmount: null, excludedAt: null },
    { transactionCategoryId: 'compras', amount: 1000, includedAmount: null, excludedAt: null },
    { transactionCategoryId: 'salud', amount: 1000, includedAmount: null, excludedAt: null },
  ];

  it('comida wins the leftover tenth by key-ascending tie-break: 334 / 333 / 333', () => {
    const { buckets } = buildCategoryBreakdown(fixtureD);
    const byId = Object.fromEntries(buckets.map((b) => [b.transactionCategoryId, b.percentageTenths]));
    expect(byId).toEqual({ comida: 334, compras: 333, salud: 333 });
  });

  it('every permutation of the three movements yields byte-identical percentages', () => {
    const permutations = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    const expected = { comida: 334, compras: 333, salud: 333 };
    for (const order of permutations) {
      const permuted = order.map((i) => fixtureD[i] as (typeof fixtureD)[number]);
      const { buckets } = buildCategoryBreakdown(permuted);
      const byId = Object.fromEntries(buckets.map((b) => [b.transactionCategoryId, b.percentageTenths]));
      expect(byId).toEqual(expected);
    }
  });
});

describe('computePeriodDelta — Fixture E', () => {
  it.each([
    [88000, 100000, -12000, -120],
    [3200, 3000, 200, 67],
    [2001, 2000, 1, 1],
    [0, 80000, -80000, -1000],
  ])('computePeriodDelta(%p, %p) -> absoluteDelta %p, percentageTenths %p', (current, previous, absoluteDelta, percentageTenths) => {
    expect(computePeriodDelta(current, previous)).toEqual({
      currentTotal: current,
      previousTotal: previous,
      absoluteDelta,
      percentageTenths,
    });
  });

  it('previousTotal 0 with a positive current -> percentageTenths null', () => {
    expect(computePeriodDelta(50000, 0)).toEqual({
      currentTotal: 50000,
      previousTotal: 0,
      absoluteDelta: 50000,
      percentageTenths: null,
    });
  });

  it('(0, 0) -> percentageTenths null, absoluteDelta 0', () => {
    expect(computePeriodDelta(0, 0)).toEqual({
      currentTotal: 0,
      previousTotal: 0,
      absoluteDelta: 0,
      percentageTenths: null,
    });
  });
});

describe('countDaysInPeriod / countElapsedDaysInPeriod — Fixture F', () => {
  it('countDaysInPeriod(January 2025) -> 31', () => {
    expect(countDaysInPeriod(JAN_2025)).toBe(31);
  });

  it('countDaysInPeriod(February 2024, leap) -> 29', () => {
    expect(countDaysInPeriod({ start: '2024-02-01', end: '2024-02-29' })).toBe(29);
  });

  it('countDaysInPeriod(February 2025, non-leap) -> 28', () => {
    expect(countDaysInPeriod({ start: '2025-02-01', end: '2025-02-28' })).toBe(28);
  });

  it('countElapsedDaysInPeriod(January 2025, "2025-01-29") -> 29', () => {
    expect(countElapsedDaysInPeriod(JAN_2025, '2025-01-29')).toBe(29);
  });

  it('countElapsedDaysInPeriod(January 2025, "2025-02-14") -> 31 (clamped to period end)', () => {
    expect(countElapsedDaysInPeriod(JAN_2025, '2025-02-14')).toBe(31);
  });

  it('countElapsedDaysInPeriod(January 2025, "2024-12-31") -> 0 (before the period starts)', () => {
    expect(countElapsedDaysInPeriod(JAN_2025, '2024-12-31')).toBe(0);
  });

  it('dailyAverage(63000, 0) throws RangeError', () => {
    expect(() => dailyAverage(63000, 0)).toThrow(RangeError);
  });

  it('summarizePeriod with asOf before the period start returns dailyAverageExpense null', () => {
    const summary = summarizePeriod(fixtureA, JAN_2025, '2024-12-31');
    expect(summary.dailyAverageExpense).toBeNull();
  });
});

describe('period-boundary filtering', () => {
  const boundaryMovements: Movement[] = [
    movement({ id: 'before', dateLocal: '2024-12-31', amount: 1000 }),
    movement({ id: 'start', dateLocal: '2025-01-01', amount: 2000 }),
    movement({ id: 'end', dateLocal: '2025-01-31', amount: 3000 }),
    movement({ id: 'after', dateLocal: '2025-02-01', amount: 4000 }),
  ];

  it('includes movements on period.start and period.end; excludes movements outside the period', () => {
    const summary = summarizePeriod(boundaryMovements, JAN_2025, '2025-01-31');
    expect(summary.totals.expenseTotal).toBe(5000); // 2000 (start) + 3000 (end)
    expect(summary.totals.includedCount).toBe(2);
  });
});

describe('buildCategoryBreakdown — a category whose every movement is excluded produces no bucket (Decision 11)', () => {
  it('an all-excluded category is invisible as a bucket', () => {
    const { buckets } = buildCategoryBreakdown([
      { transactionCategoryId: 'salud', amount: 15000, includedAmount: null, excludedAt: '2025-01-01T00:00:00Z' },
      { transactionCategoryId: 'salud', amount: 5000, includedAmount: null, excludedAt: '2025-01-02T00:00:00Z' },
    ]);
    expect(buckets).toHaveLength(0);
  });
});

describe('Business Rule 8 — amounts are integers in minor units', () => {
  it('buildCategoryBreakdown propagates inclusion.ts\'s TypeError for a non-integer movement amount', () => {
    expect(() =>
      buildCategoryBreakdown([{ transactionCategoryId: 'comida', amount: 1.5, includedAmount: null, excludedAt: null }]),
    ).toThrow(TypeError);
  });

  it('summarizePeriod propagates the same guard for a non-integer movement amount', () => {
    const badMovement = movement({ id: 'bad', dateLocal: '2025-01-05', amount: 1.5 });
    expect(() => summarizePeriod([badMovement], JAN_2025, '2025-01-29')).toThrow(TypeError);
  });

  it.each([1.5, NaN, Infinity])('dailyAverage throws TypeError when total is %p', (total) => {
    expect(() => dailyAverage(total, 10)).toThrow(TypeError);
  });

  it.each([1.5, NaN, Infinity])('computePeriodDelta throws TypeError when currentTotal is %p', (currentTotal) => {
    expect(() => computePeriodDelta(currentTotal, 1000)).toThrow(TypeError);
  });

  it.each([1.5, NaN, Infinity])('computePeriodDelta throws TypeError when previousTotal is %p', (previousTotal) => {
    expect(() => computePeriodDelta(1000, previousTotal)).toThrow(TypeError);
  });

  it('regression: a fractional delta that would cancel out through the *1000 scale still throws', () => {
    // 1000.5 - 2000 = -999.5; (-999.5) * 1000 = -999500, an exact integer — this is the specific
    // shape that would otherwise slip past divideRoundHalfUp's internal BigInt conversion
    // undetected. The explicit isValidMoneyMinorUnits guard on currentTotal catches it up front.
    expect(() => computePeriodDelta(1000.5, 2000)).toThrow(TypeError);
  });

  it('CodeRabbit finding on PR #44: a scaled numerator that would exceed Number.MAX_SAFE_INTEGER throws RangeError instead of silently losing precision', () => {
    // |currentTotal - previousTotal| * PERCENTAGE_TENTHS_TOTAL can exceed Number.MAX_SAFE_INTEGER
    // even though both totals individually satisfy isValidMoneyMinorUnits. The multiplication is
    // performed in BigInt so the check itself is exact (never silently truncated).
    expect(() => computePeriodDelta(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });

  it('a scaled numerator just at the Number.MAX_SAFE_INTEGER boundary does not throw', () => {
    // Number.MAX_SAFE_INTEGER / PERCENTAGE_TENTHS_TOTAL, floored, keeps the scaled numerator
    // within bounds — the negative control proving the guard does not over-fire.
    const previousTotal = 1;
    const currentTotal = previousTotal + Math.floor(Number.MAX_SAFE_INTEGER / PERCENTAGE_TENTHS_TOTAL);
    expect(() => computePeriodDelta(currentTotal, previousTotal)).not.toThrow();
  });

  it('every numeric value in Fixture A and Fixture C summaries is a safe integer', () => {
    const fixtureC: Movement[] = [
      ...fixtureA,
      movement({ id: 'm4', dateLocal: '2025-01-25', transactionCategoryId: null, amount: 21000 }),
    ];
    for (const summary of [summarizePeriod(fixtureA, JAN_2025, '2025-01-29'), summarizePeriod(fixtureC, JAN_2025, '2025-01-29')]) {
      expect(Number.isSafeInteger(summary.totals.expenseTotal)).toBe(true);
      expect(Number.isSafeInteger(summary.totals.incomeTotal)).toBe(true);
      expect(Number.isSafeInteger(summary.dailyAverageExpense as number)).toBe(true);
      for (const bucket of summary.expenseBreakdown.buckets) {
        expect(Number.isSafeInteger(bucket.total)).toBe(true);
        expect(Number.isSafeInteger(bucket.percentageTenths)).toBe(true);
      }
    }
  });
});
