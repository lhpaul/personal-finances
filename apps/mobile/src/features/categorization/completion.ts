import { MINUS_SIGN, divideRoundHalfUp } from '@finanzas/shared-utils';

/**
 * Categorization flow (#13) implementation plan Decision 10, Decision 11, spec A6, AC28, AC30,
 * AC31, Assumptions P4, P5.
 */

export type StageOutcome = 'partial' | 'done';

export interface CompletionView {
  outcome: StageOutcome;
  /** `partial`: movements resolved during this stage. `done`: the total categorized on the
   * device (`countCategorized`). */
  resolved: number;
  /** `partial`: the pending count when the stage started. `done`: equal to `resolved` (a full
   * bar with no denominator, spec A6). */
  total: number;
  /** 0-1, clamped. */
  ratio: number;
}

export interface BuildCompletionViewInput {
  /** The live pending count, read fresh on entry (Decision 10). Zero means `done`. */
  pendingNow: number;
  /** Movements that left the pending queue during this stage — categorized or excluded, not
   * skipped or deferred (Decision 10). */
  resolved: number;
  /** The pending count when the stage started. Assumption P5: `0` when entered without
   * parameters (a deep link or a fidelity capture). */
  pendingAtStart: number;
  /** `countCategorized()` — the `done` state's total (spec A6). */
  totalCategorized: number;
}

/**
 * Resolves `partial` vs `done` from the live pending count, and the counter/bar pair for
 * whichever state applies. `pendingAtStart` is clamped to at least 1 for the `partial` ratio so a
 * malformed `0` denominator never divides by zero (Assumption P5's paramless fallback still
 * renders a `0 / 0`-looking bar as empty, not `NaN`).
 */
export function buildCompletionView(input: BuildCompletionViewInput): CompletionView {
  if (input.pendingNow <= 0) {
    return { outcome: 'done', resolved: input.totalCategorized, total: input.totalCategorized, ratio: 1 };
  }

  const total = input.pendingAtStart;
  const safeDenominator = Math.max(total, 1);
  const ratio = Math.min(1, Math.max(0, input.resolved / safeDenominator));
  return { outcome: 'partial', resolved: input.resolved, total, ratio };
}

/** Assumption P1: `dailyAverage = round-half-up(total / elapsedDays)`, with `elapsedDays`
 * clamped to at least 1 so day 1 of the month never divides by zero. */
export function dailyAverage(totalMinorUnits: number, elapsedDays: number): number {
  const days = Math.max(1, Math.trunc(elapsedDays));
  return divideRoundHalfUp(Math.max(0, totalMinorUnits), days);
}

export type MonthOverMonthDirection = 'less' | 'more' | 'same' | 'unknown';

export interface MonthOverMonthChange {
  direction: MonthOverMonthDirection;
  /** A whole-percent label with the mockup's own minus sign (U+2212), e.g. `"−12%"`, `"+8%"`,
   * `"0%"`. `null` when there is no previous-month figure to compare against (Assumption P2's
   * "no-previous-month branch"). */
  percentLabel: string | null;
}

/**
 * Both completion tiles read through the shared inclusion rule before reaching this function
 * (Decision 11); this is the pure formatting/branching layer over the two already-summed totals.
 * Assumption P2: the mockup draws only the "spending less" branch — the "more", "same" and
 * "no previous data" branches are this plan's own, minimal Spanish.
 */
export function formatMonthOverMonthChange(
  currentMinorUnits: number,
  previousMinorUnits: number,
): MonthOverMonthChange {
  if (previousMinorUnits <= 0) {
    if (currentMinorUnits <= 0) return { direction: 'same', percentLabel: '0%' };
    return { direction: 'unknown', percentLabel: null };
  }

  const diff = currentMinorUnits - previousMinorUnits;
  if (diff === 0) return { direction: 'same', percentLabel: '0%' };

  const percent = divideRoundHalfUp(Math.abs(diff) * 100, previousMinorUnits);
  if (diff < 0) return { direction: 'less', percentLabel: `${MINUS_SIGN}${percent}%` };
  return { direction: 'more', percentLabel: `+${percent}%` };
}
