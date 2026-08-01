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
- `db:check` is a required check. A migration that throws on a user's device leaves the app
  permanently unusable for that user.
- To "remove" a column: stop writing it, stop reading it, leave it. To "rename" one: add the
  new column, backfill in the migration, write both for one release, then stop reading the old.

## Data integrity

- **Money is `INTEGER` minor units.** CLP has no cents. A decimal in an amount is a bug —
  including inside a JSON column.
- **The inclusion rule is written once.** Totals count a transaction when `excluded_at IS NULL`,
  at `COALESCE(included_amount, amount)`. Import the shared fragment; a hand-written filter
  that forgets exclusions is a review blocker, not a nit.
- **Writes from sync are idempotent.** Upsert on `(user_financial_product_id, external_id)`,
  falling back to `dedup_hash`. Never overwrite user-owned columns on conflict.
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

Seeds are keyed by `slug` / `id` so re-running them after an app update refreshes seeded rows
without touching user-created ones. A seed must never overwrite a row where `user_id` is set.
