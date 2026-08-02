import { differenceInDays, divideRoundHalfUp, isValidMoneyMinorUnits } from '@finanzas/shared-utils';
import { apportionTenths, PERCENTAGE_TENTHS_TOTAL } from './apportionment';
import { contributedAmount, isIncludedInAnalysis } from './inclusion';
import type { DateLocal, Movement, MovementDirection, MovementInclusionFields, Period } from './types';

/**
 * Period aggregates (implementation plan Decisions 9-13). Every function here takes the instant
 * (as `asOf: DateLocal`) as a parameter — nothing in this module reads the host clock, which is
 * what lets `@finanzas/shared-domain` ban the `Date` global outright (Decision 1).
 */

/** `transactions.type` is immutable bank fact; direction is computed from it, never from a
 * category's `income` flag (Decision 9). A debit filed under an income category is a
 * mis-categorization, not an income — it stays on the expense side. */
export function movementDirection(m: Pick<Movement, 'type'>): MovementDirection {
  return m.type === 'debit' ? 'expense' : 'income';
}

/** Inclusive day count of a period. `{ start: '2025-01-01', end: '2025-01-31' }` -> `31`. */
export function countDaysInPeriod(period: Period): number {
  return differenceInDays(period.start, period.end) + 1;
}

/**
 * Inclusive day count from `period.start` to `min(asOf, period.end)`, clamped to `0` when
 * `asOf < period.start` (Decision 12). `DateLocal` strings (`YYYY-MM-DD`) sort lexicographically,
 * so the clamp and the comparison below are plain string comparisons.
 */
export function countElapsedDaysInPeriod(period: Period, asOf: DateLocal): number {
  if (asOf < period.start) return 0;
  const effectiveEnd = asOf < period.end ? asOf : period.end;
  return differenceInDays(period.start, effectiveEnd) + 1;
}

/**
 * Half-up average of `total` over `dayCount` elapsed days. Throws `RangeError` when
 * `dayCount < 1` — dividing by zero days is a caller bug, not a value (Decision 12). Throws
 * `TypeError` when `total` is not a safe-integer minor-unit value (Business Rule 8) — checked
 * explicitly rather than relying on `divideRoundHalfUp`'s internal `BigInt` conversion to throw,
 * because that throw is not guaranteed for every non-integer input (see `computePeriodDelta`).
 * Throws `RangeError` when `total` is negative (CodeRabbit finding on PR #44):
 * `divideRoundHalfUp`'s documented contract requires a non-negative numerator — passing a
 * negative `total` straight through would truncate toward zero instead of rounding the magnitude
 * away from zero (unlike `computePeriodDelta`, which already takes `Math.abs` and re-signs).
 * `expenseTotal`/`incomeTotal` are always non-negative sums of `contributedAmount`, so a caller
 * hitting this guard has a bug upstream, not a legitimate negative average to compute.
 * `summarizePeriod` guards `dayCount < 1` and returns `null` instead of calling this in that case.
 */
export function dailyAverage(total: number, dayCount: number): number {
  if (!isValidMoneyMinorUnits(total)) {
    throw new TypeError('dailyAverage: total must be a safe-integer minor-unit value');
  }
  if (total < 0) {
    throw new RangeError('dailyAverage: total must be non-negative');
  }
  if (dayCount < 1) {
    throw new RangeError('dailyAverage: dayCount must be at least 1');
  }
  return divideRoundHalfUp(total, dayCount);
}

export interface PeriodDelta {
  currentTotal: number;
  previousTotal: number;
  /** `currentTotal - previousTotal`, signed minor units. */
  absoluteDelta: number;
  /** Signed tenths of a percent, half-away-from-zero. `null` when `previousTotal` is `0` — there
   * is no percentage change from nothing. */
  percentageTenths: number | null;
}

/**
 * Period-over-period delta (Decision 13). `percentageTenths` is the signed half-away-from-zero
 * rounding of `(current - previous) * 1000 / previous`, computed as `divideRoundHalfUp` on the
 * magnitude and then re-signed — the same half-away-from-zero convention
 * `formatClpAbbreviated` already uses. Throws `TypeError` when either total is not a
 * safe-integer minor-unit value (Business Rule 8): a non-integer `absoluteDelta` can otherwise
 * survive the `* PERCENTAGE_TENTHS_TOTAL` multiplication undetected when the fractional parts
 * happen to cancel out (e.g. `1000.5 - 2000` scaled by `1000` lands back on an integer), so this
 * is checked explicitly rather than left to `divideRoundHalfUp`'s internal `BigInt` conversion.
 * Throws `RangeError` when the scaled numerator (`|absoluteDelta| * PERCENTAGE_TENTHS_TOTAL`)
 * would exceed `Number.MAX_SAFE_INTEGER` (CodeRabbit finding on PR #44): the multiplication is
 * performed in `BigInt` so the check itself is exact, turning what would otherwise be a silent
 * precision loss (a `Number` multiplication overflowing before the later `BigInt` conversion)
 * into a loud, explicit failure instead.
 */
export function computePeriodDelta(currentTotal: number, previousTotal: number): PeriodDelta {
  if (!isValidMoneyMinorUnits(currentTotal)) {
    throw new TypeError('computePeriodDelta: currentTotal must be a safe-integer minor-unit value');
  }
  if (!isValidMoneyMinorUnits(previousTotal)) {
    throw new TypeError('computePeriodDelta: previousTotal must be a safe-integer minor-unit value');
  }
  const absoluteDelta = currentTotal - previousTotal;
  if (previousTotal === 0) {
    return { currentTotal, previousTotal, absoluteDelta, percentageTenths: null };
  }
  const ratioIsNegative = absoluteDelta < 0 !== previousTotal < 0;
  const scaledNumeratorBig = BigInt(Math.abs(absoluteDelta)) * BigInt(PERCENTAGE_TENTHS_TOTAL);
  if (scaledNumeratorBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      'computePeriodDelta: |currentTotal - previousTotal| * PERCENTAGE_TENTHS_TOTAL exceeds Number.MAX_SAFE_INTEGER',
    );
  }
  const magnitude = divideRoundHalfUp(Number(scaledNumeratorBig), Math.abs(previousTotal));
  return {
    currentTotal,
    previousTotal,
    absoluteDelta,
    percentageTenths: ratioIsNegative ? -magnitude : magnitude,
  };
}

export interface CategoryBucket {
  transactionCategoryId: string | null;
  total: number;
  movementCount: number;
  percentageTenths: number;
}

export interface CategoryBreakdown {
  buckets: CategoryBucket[];
}

export type CategoryBreakdownInput = Pick<Movement, 'transactionCategoryId'> & MovementInclusionFields;

/** Sentinel apportionment key for the `null` (uncategorized) bucket — never a real category id. */
const UNCATEGORIZED_KEY = '__uncategorized__';

/**
 * Builds the per-category breakdown for one direction's movements (Decisions 10, 11). Only
 * movements that pass `isIncludedInAnalysis` contribute — an excluded movement's category
 * produces no bucket at all if every one of its movements is excluded (Decision 11). An
 * uncategorized movement is its own bucket (`transactionCategoryId: null`), never dropped
 * (Decision 10, Business Rule 6). Buckets sort by total descending, then by
 * `transactionCategoryId` ascending, with the `null` bucket last among ties.
 */
export function buildCategoryBreakdown(movements: readonly CategoryBreakdownInput[]): CategoryBreakdown {
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  const keyToCategoryId = new Map<string, string | null>();

  for (const movement of movements) {
    if (!isIncludedInAnalysis(movement)) continue;
    const key = movement.transactionCategoryId ?? UNCATEGORIZED_KEY;
    keyToCategoryId.set(key, movement.transactionCategoryId);
    totals.set(key, (totals.get(key) ?? 0) + contributedAmount(movement));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const percentages = apportionTenths(
    [...totals.entries()].map(([key, weight]) => ({ key, weight })),
  );

  const buckets: CategoryBucket[] = [...totals.entries()].map(([key, total]) => ({
    transactionCategoryId: keyToCategoryId.get(key) ?? null,
    total,
    movementCount: counts.get(key) ?? 0,
    percentageTenths: percentages.get(key) ?? 0,
  }));

  buckets.sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total;
    if (a.transactionCategoryId === b.transactionCategoryId) return 0;
    if (a.transactionCategoryId === null) return 1;
    if (b.transactionCategoryId === null) return -1;
    return a.transactionCategoryId < b.transactionCategoryId ? -1 : 1;
  });

  return { buckets };
}

export interface PeriodTotals {
  expenseTotal: number;
  incomeTotal: number;
  includedCount: number;
  excludedCount: number;
  /** Included movements (either direction) with no category — Business Rule 6: never dropped,
   * always visible as a bucket rather than silently missing. */
  uncategorizedCount: number;
}

export interface PeriodSummary {
  period: Period;
  asOf: DateLocal;
  totals: PeriodTotals;
  expenseBreakdown: CategoryBreakdown;
  incomeBreakdown: CategoryBreakdown;
  /** `null` when there are zero elapsed days in the period as of `asOf` (Decision 12) — never a
   * misleading `0`. */
  dailyAverageExpense: number | null;
}

/**
 * Summarizes a period's movements (Decisions 9-13). Filters `movements` to the period by
 * lexicographic `DateLocal` comparison (`period.start <= dateLocal <= period.end` — valid
 * because `YYYY-MM-DD` sorts lexicographically), so an over-fetching caller cannot corrupt a
 * total.
 */
export function summarizePeriod(
  movements: readonly Movement[],
  period: Period,
  asOf: DateLocal,
): PeriodSummary {
  const inPeriod = movements.filter((m) => m.dateLocal >= period.start && m.dateLocal <= period.end);

  const expenseMovements = inPeriod.filter((m) => movementDirection(m) === 'expense');
  const incomeMovements = inPeriod.filter((m) => movementDirection(m) === 'income');

  const expenseBreakdown = buildCategoryBreakdown(expenseMovements);
  const incomeBreakdown = buildCategoryBreakdown(incomeMovements);

  const expenseTotal = expenseBreakdown.buckets.reduce((sum, b) => sum + b.total, 0);
  const incomeTotal = incomeBreakdown.buckets.reduce((sum, b) => sum + b.total, 0);

  let includedCount = 0;
  let excludedCount = 0;
  let uncategorizedCount = 0;
  for (const movement of inPeriod) {
    if (isIncludedInAnalysis(movement)) {
      includedCount += 1;
      if (movement.transactionCategoryId === null) uncategorizedCount += 1;
    } else {
      excludedCount += 1;
    }
  }

  const dayCount = countElapsedDaysInPeriod(period, asOf);
  const dailyAverageExpense = dayCount < 1 ? null : dailyAverage(expenseTotal, dayCount);

  return {
    period,
    asOf,
    totals: { expenseTotal, incomeTotal, includedCount, excludedCount, uncategorizedCount },
    expenseBreakdown,
    incomeBreakdown,
    dailyAverageExpense,
  };
}
