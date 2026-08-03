# Database Best Practices

This product has **no server database**. Everything lives in one SQLite file on the user's
phone, and there is no operator who can repair a mistake after the fact. That single fact
drives every rule here.

Schema: [`../project/4-database-model.md`](../project/4-database-model.md).
Implementation detail: [`stack/sqlite-drizzle.md`](stack/sqlite-drizzle.md).

---

## What does not apply here

This file replaced the framework template's generic database guidance, which covered
row-level security, connection pooling and staged production migrations. None of it applies:

- **No RLS.** One local profile, no multi-tenancy. Authorization has no surface.
- **No migration window.** Migrations run on a user's device, on app launch, unattended.
- **No rollback.** There is no snapshot, no replica, and no support engineer with a console.

## Migrations

- **Additive only.** New tables, new nullable columns, new indexes. Never drop a column, never
  rename one, never tighten a constraint on existing data.
- Every migration ships with a test that opens a fixture database at the previous schema
  version and migrates it, asserting no data loss.
- `db:check` is a required check, in four modes: **journal integrity** (`drizzle-kit check`),
  **history vs. declared shape** (an empty store migrated and introspected must match the newest
  snapshot with no pending diff), **additive-only** (every consecutive committed snapshot pair is
  mechanically checked — no removed table or column, no type change, no column made mandatory, no
  new mandatory column on an existing table even with a default, no tightened uniqueness or check
  constraint, no foreign key added to an existing table), and **preservation** (the committed
  store snapshot survives the full migration history with nothing lost or altered). A migration
  that throws on a user's device leaves the app permanently unusable for that user.
- To "remove" a column: stop writing it, stop reading it, leave it. To "rename" one: add the
  new column, backfill in the migration, write both for one release, then stop reading the old.

## Data integrity

- **Money is `INTEGER` minor units.** CLP has no cents. A decimal in an amount is a bug —
  including inside a JSON column.
- **The inclusion rule is written once per layer.** Totals count a transaction when
  `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`. In SQL, import the shared query
  fragment from `apps/mobile/src/db`; in-memory code that already has a `Movement` object uses
  `@finanzas/shared-domain`'s `isIncludedInAnalysis` / `effectiveAmount` / `contributedAmount`
  instead. A hand-written filter — SQL or JavaScript — that forgets exclusions is a review
  blocker, not a nit.
- **Writes from sync are idempotent.** Upsert on `(user_financial_product_id, external_id)`,
  falling back to `dedup_hash` — whose input carries direction and an occurrence-index-within-
  identity-group, never a read's listing position (item #10). Never overwrite user-owned columns
  on conflict.
- Wrap multi-table writes in a transaction — a sync run touches three tables.
- Aggregate in SQL, not in JavaScript. These tables grow unbounded.

## What never goes in the database

Credentials, including **the RUT** — it is half of what logs into the bank. Not encrypted, not
hashed, not "just the identifier". `user_financial_institutions` stores a keychain *key*; every
value lives in `expo-secure-store`.

## Access boundaries

- `src/db` is the only module that emits SQL.
- Repository functions return domain types, not Drizzle rows. Screens never import Drizzle.
- Enum-like values are stored as **stable codes** (`personal_transfer`, `invalid_credentials`),
  never as display strings. The i18n catalogue resolves them — see
  [`stack/i18n.md`](stack/i18n.md).

## Seed data

A `seed_ledger` table records what each seed run last wrote, per stable seed key. That is a
stronger guarantee than "never overwrite a row where `user_id` is set": re-running the seeds
after an app update inserts a genuinely new starter record, corrects a starter row nobody has
touched, and **never** overwrites a starter row the person edited or resurrects one they deleted
— even though both of those rows have `user_id IS NULL`, same as an untouched starter row. Rows
the person created are never read by the seeder at all; it only ever touches ids in its own
ledger.
