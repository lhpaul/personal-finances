/**
 * The dedup-hash input (implementation plan Decisions 1 and 2, issue #10; superseding issue #3's
 * `v1` shape).
 *
 * `docs/project/4-database-model.md` states
 * `dedup_hash = sha256(user_financial_product_id, date_local, amount, raw_description)` and
 * `UNIQUE(dedup_hash)`. Those two together would reject a second genuinely-distinct movement
 * that happens to share a product, day, amount and description — two identical coffees on the
 * same day, each with its own bank identifier. This input therefore also folds in `external_id`
 * (when the bank supplies one) and, for a manual entry, the row's own id (so two manual entries
 * with otherwise-identical fields never collide either).
 *
 * Issue #10 adds two more facts, because Banco de Chile supplies no bank identifier at all
 * (spec Conflict 2), so in practice every one of its movements is recognised by this fallback
 * route:
 *
 * - **`direction`** — a charge and its identically-described refund on the same day for the same
 *   amount must never collide (spec Business Rule 9, AC5's second sentence).
 * - **`occurrenceIndex`** — the index of a row within its group of otherwise-identical rows in
 *   *this* read (see {@link assignOccurrenceIndexes}), so N indistinguishable movements in one
 *   read produce N distinct hashes and stay N on a repeat (spec Business Rule 10, AC5's first
 *   sentence). This is never `positionInReadSnapshot` — Business Rule 11 forbids putting a read's
 *   raw listing position in a cross-read identity — it is a value computed from a stable identity
 *   tuple, independent of listing order (Business Rule 11, AC6).
 *
 * `DEDUP_INPUT_VERSION` (`'v2'`) leads the joined string so a future identity scheme can be
 * introduced without ever colliding with a stored `v2` value. For a bank that supplies no
 * identifier and for a non-manual row, this still reduces to the data model's documented formula
 * plus direction and occurrence index; for a bank that does supply one, identity is effectively
 * the identifier and the fingerprint stops colliding regardless.
 *
 * The result is the pre-hash string; callers pass it through the `digestSha256` port
 * (`src/db/ids.ts`) to produce the stored `dedup_hash` value.
 */

/** `U+241F SYMBOL FOR UNIT SEPARATOR` — chosen because it cannot appear in a bank description or
 * a UUID, so the joined fields can never collide across a field boundary. */
export const DEDUP_INPUT_SEPARATOR = '␟';

/** Leads every `dedup_hash` input string (Decision 1). Bumped only if the identity formula ever
 * changes again; a `v1`-shaped hash computed before this item shipped is never recomputed
 * (spec Conflict 2 — nothing has shipped to a device, so there is nothing to migrate). */
export const DEDUP_INPUT_VERSION = 'v2';

export interface DedupInputRow {
  userFinancialProductId: string;
  dateLocal: string;
  amount: number;
  direction: 'debit' | 'credit';
  rawDescription: string;
  externalId?: string | null;
  occurrenceIndex: number;
  isManual: boolean;
  id: string;
}

export function buildDedupInput(row: DedupInputRow): string {
  return [
    DEDUP_INPUT_VERSION,
    row.userFinancialProductId,
    row.dateLocal,
    String(row.amount),
    row.direction,
    row.rawDescription,
    row.externalId ?? '',
    String(row.occurrenceIndex),
    row.isManual ? row.id : '',
  ].join(DEDUP_INPUT_SEPARATOR);
}

/**
 * The identity tuple that groups otherwise-indistinguishable movements *within one read*
 * (Decision 2). Every field named here is a fact the bank stated — never a listing position.
 */
export interface MovementIdentityFields {
  dateLocal: string;
  amount: number;
  direction: 'debit' | 'credit';
  rawDescription: string;
  externalId?: string | null;
}

function identityKey(row: MovementIdentityFields): string {
  return [row.dateLocal, String(row.amount), row.direction, row.rawDescription, row.externalId ?? ''].join(
    DEDUP_INPUT_SEPARATOR,
  );
}

/**
 * Assigns each row an index (`0, 1, 2, …`) within its group of identity-identical rows, in the
 * order the rows are given (Decision 2, spec Business Rules 9-11, AC5, AC6).
 *
 * Every member of a group is, by construction, byte-identical in every field
 * {@link identityKey} names. So the **multiset** of `(identityKey, occurrenceIndex)` pairs a call
 * produces is independent of the order `rows` arrives in: permuting the input permutes which
 * element receives which index, but never which `(key, index)` pairs exist. Callers order a
 * group's members by `positionInReadSnapshot` before calling this function so that, when two
 * members of a group differ only in a field this tuple does not name (only `extras`/`metadata`
 * can), the assignment is at least deterministic for one given read — but this function itself
 * takes no position and does not need one for its own guarantee to hold.
 *
 * Pure: no I/O, no `Date`, no randomness. Unit-tested independently of SQLite.
 */
export function assignOccurrenceIndexes(rows: readonly MovementIdentityFields[]): number[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = identityKey(row);
    const next = seen.get(key) ?? 0;
    seen.set(key, next + 1);
    return next;
  });
}
