/**
 * Money guards (implementation plan Decision 4).
 *
 * Money is stored as whole minor units, always (spec Business Rule 3) — for CLP that unit is
 * the peso. No column in `schema.ts` uses `real()`; every write path that carries money goes
 * through one of these guards instead of writing a raw number.
 */

/**
 * Throws unless `value` is a whole number. Does not constrain sign — some money fields
 * (`user_financial_products.metadata.balance` / `available_credit`) are read-only presentational
 * values that may legitimately be negative (an overdraft), and this item does not attempt to
 * validate or promote them (see `docs/project/4-database-model.md`'s "read one row at a time"
 * rationale).
 */
export function assertMinorUnits(value: number, field: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be a whole number of minor units, got ${value}`);
  }
  return value;
}

/**
 * Throws unless `value` is a whole, strictly positive number of minor units. Spec Business Rule
 * 4: "amounts are stored unsigned; direction comes from the movement type." `assertMinorUnits`
 * alone does not enforce that — `Number.isInteger(-1000)` is `true` — so this is the guard used
 * specifically for `transactions.amount`, the one field the data model documents as always
 * positive.
 */
export function assertPositiveMinorUnits(value: number, field: string): number {
  assertMinorUnits(value, field);
  if (value <= 0) {
    throw new Error(`${field} must be a positive number of minor units, got ${value}`);
  }
  return value;
}

/**
 * Canonicalizes a currency code to its trimmed, upper-case form (issue #10) — `' clp '` becomes
 * `'CLP'` — defaulting to `'CLP'` when absent or empty after trimming. `isPesoDenominated`
 * (`fragments.ts`) and `countForeignCurrencyMovements` (`src/features/sync/map-read-result.ts`)
 * both compare a stored/reported currency code against the exact literal `'CLP'`; a read that
 * reported a differently-cased or padded value must never silently bypass either check by
 * comparing unequal to a value that is, in fact, pesos. Both call sites canonicalize through this
 * one function so a write and a summary count can never disagree about what "peso" means.
 */
export function canonicalizeCurrencyCode(code: string | null | undefined): string {
  const trimmed = (code ?? '').trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : 'CLP';
}
