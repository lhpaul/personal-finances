/**
 * The dedup-hash input (implementation plan Decision 14).
 *
 * `docs/project/4-database-model.md` states
 * `dedup_hash = sha256(user_financial_product_id, date_local, amount, raw_description)` and
 * `UNIQUE(dedup_hash)`. Those two together would reject a second genuinely-distinct movement
 * that happens to share a product, day, amount and description — two identical coffees on the
 * same day, each with its own bank identifier. This input therefore also folds in `external_id`
 * (when the bank supplies one) and, for a manual entry, the row's own id (so two manual entries
 * with otherwise-identical fields never collide either).
 *
 * For a bank that supplies no identifier and for a non-manual row this reduces exactly to the
 * data model's documented formula, so the fallback route's meaning is unchanged; for a bank that
 * does supply one, identity is effectively the identifier and the fingerprint stops colliding.
 * This is an intentional difference from the data model, reflected there in the same change
 * (Documentation Updates).
 *
 * The result is the pre-hash string; callers pass it through the `digestSha256` port
 * (`src/db/ids.ts`) to produce the stored `dedup_hash` value.
 */

/** `U+241F SYMBOL FOR UNIT SEPARATOR` — chosen because it cannot appear in a bank description or
 * a UUID, so the joined fields can never collide across a field boundary. */
const DEDUP_INPUT_SEPARATOR = '␟';

export interface DedupInputRow {
  userFinancialProductId: string;
  dateLocal: string;
  amount: number;
  rawDescription: string;
  externalId?: string | null;
  isManual: boolean;
  id: string;
}

export function buildDedupInput(row: DedupInputRow): string {
  return [
    row.userFinancialProductId,
    row.dateLocal,
    String(row.amount),
    row.rawDescription,
    row.externalId ?? '',
    row.isManual ? row.id : '',
  ].join(DEDUP_INPUT_SEPARATOR);
}
