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
`pnpm --filter @finanzas/mobile db:check` runs this suite; it is a required check.

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
`COALESCE(included_amount, amount)`. This exists exactly once:

```ts
// apps/mobile/src/db/fragments.ts
export const includedAmount = sql`COALESCE(${transactions.includedAmount}, ${transactions.amount})`;
export const isIncluded = sql`${transactions.excludedAt} IS NULL`;
```

Every aggregate imports these. A hand-written `WHERE excluded_at IS NULL` scattered across
queries is how the numbers on `home` and `dashboard` start disagreeing.

## Idempotent sync

The scraper re-reads the same movements on every run. All writes from sync go through the
repository upsert:

```ts
await db.insert(transactions).values(rows)
  .onConflictDoUpdate({
    target: [transactions.accountId, transactions.externalId],
    set: { balanceFields… },      // never overwrite user decisions
  });
```

**Never overwrite user-owned columns on conflict**: `category_id`, `category_source`, `note`,
`excluded_at`, `exclusion_reason`, `included_amount`, `review_flag`, `merchant_id`. The bank
owns `raw_description`, `amount`, `type`, `occurred_at`; the user owns everything else.

## Queries

- Aggregate in SQL, not in JS. `home` and `dashboard` must not `SELECT *` and reduce in
  JavaScript — these tables grow unbounded.
- The "por categorizar" count runs on every app open. It has a partial index; keep the
  predicate matching it exactly (`category_id IS NULL AND excluded_at IS NULL`).
- Repository functions return domain types, not Drizzle rows. Screens must not know a column
  name.
- Wrap multi-table writes (a sync run touches `accounts`, `transactions`, `bank_connections`)
  in a transaction.

## Dates

Store `occurred_at` as ISO-8601 UTC and `date_local` as `YYYY-MM-DD` from the bank's calendar
day. Group and filter by `date_local`. Deriving the local day from the UTC timestamp at query
time reintroduces the timezone bug the column exists to prevent.

## What never goes in the database

Credentials. Not encrypted, not hashed, not "just the RUT plus a token". `bank_connections`
stores a keychain **key**; the value lives in `expo-secure-store`.
