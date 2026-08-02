import { isValidMoneyMinorUnits } from '@finanzas/shared-utils';
import type { MovementInclusionFields } from './types';

/**
 * Business Rule 4 (`docs/project/1-business-domain.md`, verbatim): "A transaction counts toward
 * totals and charts when `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`."
 *
 * **SQL twin**: `apps/mobile/src/db/fragments.ts` (item #3), `isIncluded` / `includedAmount`.
 * These are the **two** — and only two — sanctioned statements of this rule in the codebase. A
 * third statement anywhere (a hand-rolled `WHERE`, a hand-rolled JavaScript restatement of
 * `excludedAt` / `includedAmount`) is a review blocker.
 *
 * Clause-by-clause equivalence:
 *
 * | SQL fragment (`apps/mobile/src/db/fragments.ts`)                                    | Domain function (here)                                    |
 * | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
 * | `isIncluded = sql\`${t.excludedAt} is null\``                                        | `isIncludedInAnalysis(m) => m.excludedAt === null`          |
 * | `includedAmount = sql\`coalesce(${t.includedAmount}, ${t.amount})\``                 | `effectiveAmount(m) => m.includedAmount ?? m.amount`        |
 * | `where(isIncluded)` + `sum(includedAmount)`                                          | `contributedAmount(m) => isIncludedInAnalysis(m) ? effectiveAmount(m) : 0` |
 *
 * SQL `COALESCE` returns the first non-`NULL` argument, so its JavaScript twin is `??`
 * (nullish coalescing), **never** `||`. `||` would return `amount` when `includedAmount` is
 * `0`, which is a real value, not an absence — see the `partial-zero` case below.
 *
 * **The two implementations are kept honest by `INCLUSION_RULE_CASES`, never by comparing them
 * to each other.** Two implementations wrong in the same way would still agree; each side
 * (this package, and item #3's `transactions.test.ts`) asserts against these hand-derived
 * literals independently.
 */
export function isIncludedInAnalysis(m: MovementInclusionFields): boolean {
  return m.excludedAt === null;
}

/**
 * `??`, never `||`: an `includedAmount` of `0` is a real partial amount, not an absence.
 *
 * Business Rule 8 (amounts are integers in minor units): both `amount` and a non-null
 * `includedAmount` are validated with `@finanzas/shared-utils`'s `isValidMoneyMinorUnits` before
 * any arithmetic, and rejected if negative — `docs/project/4-database-model.md`'s
 * `transactions.amount` is "always positive" (zero is a valid, included movement; see the
 * `zero-amount` case in `INCLUSION_RULE_CASES`, so "positive" is read as "non-negative" here).
 * Rejecting a negative amount at this domain boundary, rather than letting it reach
 * `apportionTenths`'s negative-weight guard as a confusing downstream failure, is what a caller
 * (e.g. `buildCategoryBreakdown`) actually needs (CodeRabbit finding on PR #44). Throws with a
 * fixed sentence — Business Rule 1 requires that no thrown message in this module interpolates
 * its input, so the received value is deliberately not echoed. `TypeError` for a non-safe-integer
 * value, `RangeError` for a safe-integer value that is negative — mirroring `apportionment.ts`'s
 * convention.
 */
export function effectiveAmount(m: MovementInclusionFields): number {
  if (!isValidMoneyMinorUnits(m.amount)) {
    throw new TypeError('effectiveAmount: amount must be a safe-integer minor-unit value');
  }
  if (m.amount < 0) {
    throw new RangeError('effectiveAmount: amount must not be negative');
  }
  if (m.includedAmount !== null) {
    if (!isValidMoneyMinorUnits(m.includedAmount)) {
      throw new TypeError('effectiveAmount: includedAmount must be a safe-integer minor-unit value');
    }
    if (m.includedAmount < 0) {
      throw new RangeError('effectiveAmount: includedAmount must not be negative');
    }
  }
  return m.includedAmount ?? m.amount;
}

/** `0` when excluded; `effectiveAmount(m)` otherwise. What every aggregate must sum over. */
export function contributedAmount(m: MovementInclusionFields): number {
  return isIncludedInAnalysis(m) ? effectiveAmount(m) : 0;
}

export interface InclusionRuleCase {
  key: string;
  amount: number;
  includedAmount: number | null;
  excludedAt: string | null;
  expectedIsIncluded: boolean;
  expectedEffectiveAmount: number;
  expectedContribution: number;
  /** Why this case exists — from the implementation plan's AC2 table, copied verbatim. */
  reason: string;
}

/**
 * Hand-derived expected-value table (implementation plan, Decision 2 / AC2). Every value is
 * derived from `COALESCE(included_amount, amount)` gated by `excluded_at IS NULL`, by hand, at
 * plan time — never computed from this module. Copied verbatim into the tests below, and
 * exported so a later item's SQL-side test (`apps/mobile/src/db/__tests__/transactions.test.ts`)
 * can assert against the same literals.
 */
export const INCLUSION_RULE_CASES: readonly InclusionRuleCase[] = Object.freeze(
  [
    {
      key: 'full',
      amount: 42000,
      includedAmount: null,
      excludedAt: null,
      expectedIsIncluded: true,
      expectedEffectiveAmount: 42000,
      expectedContribution: 42000,
      reason: 'The ordinary MVP case',
    },
    {
      key: 'partial',
      amount: 42000,
      includedAmount: 21000,
      excludedAt: null,
      expectedIsIncluded: true,
      expectedEffectiveAmount: 21000,
      expectedContribution: 21000,
      reason:
        'The blocking gate: a non-null, computed included_amount contributing its own value, ' +
        'not the full one',
    },
    {
      key: 'partial-zero',
      amount: 42000,
      includedAmount: 0,
      excludedAt: null,
      expectedIsIncluded: true,
      expectedEffectiveAmount: 0,
      expectedContribution: 0,
      reason: '?? vs ||: 0 is a real partial amount, not an absence. || would wrongly yield 42000',
    },
    {
      key: 'partial-equal',
      amount: 42000,
      includedAmount: 42000,
      excludedAt: null,
      expectedIsIncluded: true,
      expectedEffectiveAmount: 42000,
      expectedContribution: 42000,
      reason: 'A partial equal to the full amount must not be special-cased',
    },
    {
      key: 'excluded',
      amount: 15000,
      includedAmount: null,
      excludedAt: '2025-01-21T10:00:00Z',
      expectedIsIncluded: false,
      expectedEffectiveAmount: 15000,
      expectedContribution: 0,
      reason: 'Exclusion zeroes the contribution while effectiveAmount is still well-defined',
    },
    {
      key: 'excluded-partial',
      amount: 42000,
      includedAmount: 21000,
      excludedAt: '2025-01-21T10:00:00Z',
      expectedIsIncluded: false,
      expectedEffectiveAmount: 21000,
      expectedContribution: 0,
      reason: 'Exclusion wins over a set partial — the two clauses are independent',
    },
    {
      key: 'zero-amount',
      amount: 0,
      includedAmount: null,
      excludedAt: null,
      expectedIsIncluded: true,
      expectedEffectiveAmount: 0,
      expectedContribution: 0,
      reason: 'A zero movement is included and contributes nothing; isIncludedInAnalysis must not ' +
        'be inferred from the amount',
    },
  ].map((c) => Object.freeze(c)),
);
