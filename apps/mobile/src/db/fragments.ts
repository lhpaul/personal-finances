import { sql } from 'drizzle-orm';

import { transactions } from './schema';

/**
 * The inclusion rule — exactly one place it exists in the codebase (implementation plan
 * Decision 9, spec Business Rule 6, Use Case 6, AC20).
 *
 * A movement counts toward totals and charts when it has not been excluded, and it counts at
 * its partial amount when the person set one, otherwise at its full amount. Every aggregate in
 * this item, and every later item that sums, counts or charts money, imports these two values
 * instead of restating the condition. A second statement of this rule anywhere else in the
 * codebase is a review blocker — `src/db/checks/inclusion-rule-scan.ts` and
 * `src/db/__tests__/inclusion-rule-single-definition.test.ts` enforce that mechanically.
 */

/** A movement counts toward totals and charts when it has not been excluded. */
export const isIncluded = sql`${transactions.excludedAt} is null`;

/** …and it counts at its partial amount when one is set, otherwise at its full amount. */
export const includedAmount = sql`coalesce(${transactions.includedAmount}, ${transactions.amount})`;

/**
 * The currency guard (issue #10 implementation plan Decision 15, spec Business Rule 17, Deferral
 * Note 3, AC22). Every total and chart in the MVP is a peso total; a movement stored in another
 * currency (Business Rule 17 stores it, unconverted, because the app has no exchange rate and no
 * server to obtain one) must never be added into one as though it were pesos. This is the **only**
 * place that condition may exist — a `sum(...)` over `includedAmount` anywhere else in the
 * codebase without also naming `isPesoDenominated` is a finding of
 * `src/db/checks/peso-total-scan.ts`, enforced by `src/db/__tests__/peso-total-guard.test.ts`.
 * A `count(...)` (e.g. `countUncategorized`) is not a total and is deliberately not guarded —
 * a foreign-currency movement still needs a category.
 */
export const isPesoDenominated = sql`${transactions.currencyCode} = 'CLP'`;
