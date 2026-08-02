# SQLite + Drizzle

Everything the app knows lives in one SQLite file on the user's phone. There is no server to
repair a mistake from. That single fact drives every rule here.

Schema reference: [`../../project/4-database-model.md`](../../project/4-database-model.md).

## Migrations

**Additive only.** New tables, new nullable columns, new indexes. Never drop a column, never
rename one, never tighten a constraint on existing data.

To "remove" a column: stop writing it, stop reading it, leave it. To "rename" one: add the new
column, backfill in the migration, write both for one release, then stop reading the old one.

Every migration ships with a test that opens a fixture database at the previous schema version
and migrates it:

```ts
it('migrates 0003 → 0004 without data loss', async () => {
  const db = await openFixture('v0003-with-transactions.db');
  await migrate(db);
  expect(await countTransactions(db)).toBe(57);
});
```

A migration that throws on a user's device leaves the app permanently unusable for them.
`pnpm --filter @finanzas/mobile db:check` runs this suite; it is a required check, in four modes:
journal integrity, history-vs-declared-shape (with no pending `drizzle-kit generate` diff),
additive-only across every consecutive snapshot pair, and preservation against the committed
store snapshot.

**There is no suppression directive for a non-additive change, by design.** No comment, pragma or
allowlist file lets a change that removes a column, tightens a constraint, or adds a mandatory
column to an existing table pass the additivity check — that is exactly the one class of change
that cannot be repaired on a user's phone. The recovery path is always the "remove" / "rename"
recipe above, never an inline exception.

## Money

`INTEGER`, minor units, always. CLP has no cents, so the minor unit is the peso.

```ts
// ✅
amount: integer('amount').notNull(),
// ❌ never
amount: real('amount'),
```

Amounts are stored **positive**; direction comes from `type` (`debit` | `credit`). A negative
value in `amount` means a parser bug upstream.

Format only at the edge, in `src/components/ui`. A formatted string never travels back into a
calculation.

## The inclusion rule

Totals and charts count a transaction when `excluded_at IS NULL`, at
`COALESCE(included_amount, amount)`. In SQL, this exists exactly once — as the shared query
fragment below. (The same rule has a second, independently-verified statement over in-memory
plain objects: `@finanzas/shared-domain`'s `isIncludedInAnalysis` / `effectiveAmount` /
`contributedAmount`, used by code that already has a `Movement` object instead of a query to
write. Those are the only two sanctioned statements; a third anywhere is a review blocker.)

```ts
// apps/mobile/src/db/fragments.ts
export const includedAmount = sql`COALESCE(${transactions.includedAmount}, ${transactions.amount})`;
export const isIncluded = sql`${transactions.excludedAt} IS NULL`;
```

Every aggregate imports these. A hand-written `WHERE excluded_at IS NULL` scattered across
queries is how the numbers on `home` and `dashboard` start disagreeing.

## Idempotent sync

The scraper re-reads the same movements on every run. SQLite's `ON CONFLICT` takes a single
conflict target, and there are genuinely two identity routes — `(user_financial_product_id,
external_id)` when the bank supplies an identifier, `dedup_hash` when it does not — so the upsert
is **lookup-then-write inside one transaction**, not `onConflictDoUpdate`:

```ts
// Per row, inside one transaction:
const existing = row.externalId
  ? await findByExternalId(tx, row.userFinancialProductId, row.externalId)
  : await findByDedupHash(tx, row.dedupHash);

const write = existing
  ? tx
      .update(transactions)
      .set({
        amount: row.amount,
        type: row.type,
        currencyCode: row.currencyCode,
        occurredAt: row.occurredAt,
        dateLocal: row.dateLocal,
        rawDescription: row.rawDescription,
        metadata: row.metadata,
        dedupHash: row.dedupHash,
        updatedAt: now(),
      })
      .where(eq(transactions.id, existing.id))
  : tx.insert(transactions).values(row);

await write;
```

**Never overwrite person-owned columns on conflict**: `transaction_category_id`,
`category_source`, `note`, `review_flag`, `excluded_at`, `exclusion_reason`, `exclusion_note`,
`included_amount`, `merchant_id` — plus `is_manual`, which a sync row never sets. None of these
appear in the update statement's `set` object under any circumstance. The bank owns
`amount`, `type`, `currency_code`, `occurred_at`, `date_local`, `raw_description`, `metadata`,
`dedup_hash`, `updated_at`; the person owns everything else. The unique indexes on
`(user_financial_product_id, external_id)` and `(dedup_hash)` are the store-level backstop: a raw
insert that bypasses the repository is rejected too, not only a call through it.

## Queries

- Aggregate in SQL, not in JS. `home` and `dashboard` must not `SELECT *` and reduce in
  JavaScript — these tables grow unbounded.
- The "por categorizar" count runs on every app open. It has a partial index; keep the
  predicate matching it exactly (`category_id IS NULL AND excluded_at IS NULL`).
- Repository functions return domain types, not Drizzle rows. Screens must not know a column
  name.
- Wrap multi-table writes (a sync run touches `user_financial_products`, `transactions`,
  `user_financial_institutions`) in a transaction.
- `PRAGMA foreign_keys = ON` must be set on every connection, in every environment (the runtime
  client and the test client both issue it immediately after opening). SQLite disables
  foreign-key enforcement by default; without this pragma, every `ON DELETE CASCADE` in the data
  model is decorative and the deletion guarantees would pass in review and fail on a device.

## Dates

Store `occurred_at` as ISO-8601 UTC and `date_local` as `YYYY-MM-DD` from the bank's calendar
day. Group and filter by `date_local`. Deriving the local day from the UTC timestamp at query
time reintroduces the timezone bug the column exists to prevent.

`deriveDateLocal` from `@finanzas/shared-utils` is the one sanctioned way to produce a
`date_local` value from an instant — it converts a UTC instant to Chilean wall-clock fields via
`Intl.DateTimeFormat(...).formatToParts` (`SANTIAGO_TIME_ZONE`), correctly across both DST
transitions and month/year boundaries. Do not hand-roll a UTC-offset calculation at the call
site.

## What never goes in the database

Credentials — including **the RUT**, which is half of what logs into the bank. Not encrypted,
not hashed, not "just the RUT". `user_financial_institutions` stores a keychain **key**; every
value lives in `expo-secure-store`. There is no `national_id_value` column, by design: with
~30M valid Chilean RUTs and a derivable check digit, an unsalted hash is a rainbow table away
from plaintext.
