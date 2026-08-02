/**
 * Deterministic seed-id builders and the injected-port types (implementation plan Decisions 11
 * and 13).
 *
 * A seeded row's `id` is its stable identifier, so the committed store snapshot
 * (`src/db/__fixtures__/store-v1.sql`) is a text file whose primary keys stay stable across
 * regeneration — a random id would make every `db:seed` produce a spurious diff. Person-created
 * rows get a generated UUID from the `newId` port instead.
 */

/** `financial_institutions.id` is the institution slug — already normative in the data model,
 * and `banco-de-chile` must match the scraper's `bankId`. */
export function institutionSeedId(slug: string): string {
  return slug;
}

/** `transaction_categories.id` is the category slug. */
export function categorySeedId(slug: string): string {
  return slug;
}

/** `merchants.id` is the merchant slug. */
export function merchantSeedId(slug: string): string {
  return slug;
}

/** `merchant_aliases.id` is `<merchant-slug>:<normalised-pattern>`. The pattern is normalised
 * (trimmed, upper-cased) so the same alias text always produces the same id regardless of the
 * catalogue entry's original casing/whitespace. */
export function merchantAliasSeedId(merchantSlug: string, rawPattern: string): string {
  return `${merchantSlug}:${rawPattern.trim().toUpperCase()}`;
}

/**
 * Hashing and id generation are injected ports, not imports (Decision 13) — `expo-crypto` is a
 * native module the test tier must not load. The runtime supplies `expo-crypto`'s
 * `digestStringAsync` and `randomUUID`; tests supply `node:crypto` and a deterministic counter,
 * which is also what makes the committed fixture reproducible.
 */
export type NewId = () => string;
export type DigestSha256 = (input: string) => Promise<string>;
export type Now = () => string;

export interface DbPorts {
  digestSha256: DigestSha256;
  newId: NewId;
  now: Now;
}
