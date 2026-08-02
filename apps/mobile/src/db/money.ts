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
