# Smoke Test Runbook: Local Database — Schema, Migrations and Seed Data

**Feature**: Local SQLite store, migrations and starter content (issue #3)
**Spec**: [`../../specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/1_3-local-database-schema-migrations-seed-data_specs.md`](../../specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/1_3-local-database-schema-migrations-seed-data_specs.md)
**Implementation plan**: [`../../specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/2_3-local-database-schema-migrations-seed-data_implementation-plan.md`](../../specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/2_3-local-database-schema-migrations-seed-data_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## What this runbook is, and why it has no screens in it

This item builds no UI. The spec puts it plainly under *Out of Scope*: "Any UI. No screen, sheet,
list or setting is built here", and "Device end-to-end coverage for this item. Its verification is
entirely in the automated test suite." AC24 goes further and **requires** the suite to run
"entirely against an in-memory store, needs no simulator and no device".

So there is no flow to walk and no screen to compare against a mockup. This runbook instead walks
a person through the contributor-facing surface the item actually ships — the four verification
commands, the generated migration, the committed store snapshot, and the two negative controls
that prove the guards are live rather than vacuous — and through a direct inspection of the store
those commands produce.

Every step is **agent-runnable**. There is no `PENDING HUMAN` step in this runbook, and inventing
one would misrepresent the item: nothing here needs a macOS session, a simulator or a phone. The
one part of the item that genuinely cannot be proven from Node — that Metro can bundle the
generated migration files onto a device — is covered by Step 5 and is recorded as a residual in
the implementation plan rather than dressed up as a device test.

There is also **no design-fidelity step**. Design assets were searched for at plan time (issue
body `## Design assets` section, tracker attachments, a `<dev-folder>/assets/` directory) and none
exist, which is expected for an item with no visual surface.

---

## Prerequisites

Before running this smoke test:

- [ ] A checkout of the branch under test, with dependencies installed (`pnpm install` from the
      repository root).
- [ ] The Node version named in `.nvmrc` is active (`nvm use`) and `pnpm --version` reports
      11.12.0 or newer.
- [ ] A clean working tree (`git status` reports no modified files). Several steps below check
      that a command wrote nothing it should not have, and a dirty tree makes that check
      meaningless.
- [ ] The `sqlite3` command-line tool, **optional** — used only by Step 9's manual inspection.
      Step 9 gives a Node-based alternative for machines without it.

There is **no login step**: the product has no sign-in. There is **no database to seed before
starting**: creating and seeding the database is what this item does, and every step below builds
its store from scratch.

---

## Test Data

| Item | Value |
| --- | --- |
| Workspace under test | `@finanzas/mobile` |
| Declared shape | `apps/mobile/src/db/schema.ts` |
| Migration output | `apps/mobile/drizzle/` |
| Committed store snapshot | `apps/mobile/src/db/__fixtures__/store-v1.sql` |
| Recorded bank responses | `apps/mobile/src/db/__fixtures__/bank-response-with-ids.json`, `apps/mobile/src/db/__fixtures__/bank-response-without-ids.json` |
| Seed source of truth | `design/tokens.json` → `categoryIcons`, `categoryLabels` |
| Fallback category slugs | `otros-gasto` (spending), `otros-ingreso` (income) |
| Available bank | `banco-de-chile` — the only one of the six that is `available` |
| Expected `schema_version` after this item | `1` |

---

## Smoke Test Steps

### Step 1: The command surface exists and is documented

**Maps to**: AC25

1. Run `pnpm --filter @finanzas/mobile run` and read the listed scripts.
2. Open `AGENTS.md`, `docs/project/2-repo-architecture.md` and `docs/project/4-database-model.md`
   and find their command lists.

**Expected result**: `db:generate`, `db:check` and `db:seed` are all present as scripts on
`@finanzas/mobile`. All three appear in the documented command lists, and **none** of them is
still marked "arrives with the database item, #3" — that marker was written by item #1 and this
item removes it.

### Step 2: The full test suite runs with no simulator and no device

**Maps to**: AC24

1. Make sure no simulator or emulator is running.
2. Run `pnpm --filter @finanzas/mobile test`.
3. Run `grep -rn "expo-sqlite" apps/mobile/src/db/` and read the output.

**Expected result**: The suite passes. Its output names two Jest projects, `app` and `db`. No step
prompts for a device, opens a simulator, or times out waiting for one. The only `expo-sqlite`
reference anywhere under `src/db/` is in `src/db/client.ts` — no test file imports it.

### Step 3: The repository-wide test command still passes

**Maps to**: AC24

1. From the repository root, run `pnpm test`.

**Expected result**: All four workspaces pass. The new database tier ran as part of the existing
command, with no new command and no new CI entry point needed for it.

### Step 4: The declared shape matches the data model

**Maps to**: AC28, AC4

1. Open `apps/mobile/src/db/schema.ts` and `docs/project/4-database-model.md` side by side.
2. Walk the data model's *Tables* section top to bottom and confirm every table, column, type,
   nullability, default, foreign key and unique constraint has a counterpart in `schema.ts`.
3. Run `grep -n "real(" apps/mobile/src/db/schema.ts`.
4. Run `grep -rn "national_id_value\|auto_sync\|is_system" apps/mobile/src/db/`.

**Expected result**: Every record and field matches. Step 3's grep finds nothing — there is no
`real()` column anywhere, so no money value can be fractional. Step 4's grep finds nothing: there
is no national-ID column, no automatic-sync switch and no system-category flag. Where the declared
shape intentionally differs from the data model — the `seed_ledger` table, the `dedup_hash` input,
the ✨ Otros deletion trigger, and the full column lists for `user_budgets` and
`user_recurring_transactions` — the data model has been updated in this same change, so the two
documents do not disagree.

### Step 5: The generated migration is complete and bundles for the device

**Maps to**: AC12

1. Confirm `apps/mobile/drizzle/` contains `0000_*.sql`, `meta/_journal.json`,
   `meta/0000_snapshot.json` and `migrations.js`.
2. Read `0000_*.sql`. Find the partial unique index on `(user_financial_product_id, external_id)`
   with its `where external_id is not null`, the partial index whose predicate is
   `transaction_category_id is null and excluded_at is null`, the unique expression index that
   allows exactly one `users` row, and the `BEFORE DELETE` trigger protecting the two ✨ Otros
   categories.
3. Read `migrations.js` and confirm it imports the `.sql` file.
4. Run `pnpm --filter @finanzas/mobile exec expo export --platform ios` and watch the bundler
   output.

**Expected result**: All four files exist and the SQL contains all four objects named above. The
Expo bundle completes with no "unable to resolve" error for the `.sql` import, which is what
proves the metro `sourceExts` and Babel inline-import wiring works. This is the only step in the
runbook that exercises the device bundling path; it is a bundle, not a device run.

### Step 6: `db:check` passes all four modes and writes nothing

**Maps to**: AC12, AC13

1. Run `pnpm --filter @finanzas/mobile db:check` and read the whole output.
2. Run `git status`.

**Expected result**: The command reports each mode by name and passes all four: journal integrity,
history-versus-declared-shape (with no pending difference), additive-only across every consecutive
snapshot pair, and preservation against `store-v1.sql`. `git status` reports a clean tree
afterwards — mode 1 copies the migration folder to a temporary directory before running
`drizzle-kit generate`, so it must never leave a stray migration behind.

### Step 7: A non-additive change is rejected, and reverting it makes the check pass

**Maps to**: AC14

This is the standing proof that the additivity guard is live rather than vacuously passing.

1. Open `apps/mobile/src/db/schema.ts` and delete the `note` column from `transactions`.
2. Run `pnpm --filter @finanzas/mobile db:generate`.
3. Run `pnpm --filter @finanzas/mobile db:check` and read the failure.
4. Restore the `note` column, delete the migration file and snapshot that step 2 generated, and
   run `pnpm --filter @finanzas/mobile db:check` again.
5. Run `git status`.

**Expected result**: In step 3 the check **fails**, and its message names `column_removed` on
`transactions.note` — that is, it names what would be lost, not just that something is wrong. In
step 4 the check passes again and `git status` reports a clean tree.

### Step 8: The store answers the questions it must answer efficiently

**Maps to**: AC23

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern indexes --verbose`, which runs
   `apps/mobile/src/db/__tests__/indexes.test.ts`.
2. Read the printed `EXPLAIN QUERY PLAN` output for each of the six questions.

**Expected result**: Six plans are printed — the "por categorizar" count, this month's movements
newest first, the total for one category over a period, one merchant's movements, the connectable
banks, and the categories for one direction in order. Every plan names an index (`USING INDEX` or
`USING COVERING INDEX`), and none of them contains `SCAN transactions`. In particular the
"por categorizar" plan uses the partial index, which means the query predicate and the index
predicate match exactly.

### Step 9: Inspect a real store by hand

**Maps to**: AC1, AC2, AC3, AC15, AC29, AC5

Build a store the way a fresh install would, then look at it directly rather than through an
assertion.

1. Run `pnpm --filter @finanzas/mobile db:seed` to regenerate
   `apps/mobile/src/db/__fixtures__/store-v1.sql`.
2. Run `git status`. Then run `pnpm --filter @finanzas/mobile db:seed` a second time and run
   `git status` again.
3. Load the snapshot into a scratch database and inspect it. With the `sqlite3` CLI:

   ```bash
   rm -f /tmp/finanzas-smoke.db
   sqlite3 /tmp/finanzas-smoke.db < apps/mobile/src/db/__fixtures__/store-v1.sql
   sqlite3 /tmp/finanzas-smoke.db ".tables"
   sqlite3 /tmp/finanzas-smoke.db "select id, scraper_status from financial_institutions order by id;"
   sqlite3 /tmp/finanzas-smoke.db "select slug, income, sort_order from transaction_categories order by income, sort_order;"
   sqlite3 /tmp/finanzas-smoke.db "select m.name, count(a.id) from merchants m left join merchant_aliases a on a.merchant_id = m.id group by m.id;"
   sqlite3 /tmp/finanzas-smoke.db "select key, value from app_settings order by key;"
   ```

   Without the `sqlite3` CLI, run the same queries through
   `apps/mobile/src/db/testing/load-fixture.ts` from a `tsx` one-liner, or read the `.sql` file
   directly — it is plain text and every `INSERT` is on its own line.
4. Read the fixture file itself and search it for anything resembling a credential:

   ```bash
   grep -nEi "password|clave|token|secret|[0-9]{7,8}-[0-9kK]\b" apps/mobile/src/db/__fixtures__/store-v1.sql
   ```

**Expected result**:

- Step 2: the first `db:seed` leaves the tree clean (the committed snapshot is already current),
  and the second run produces a byte-identical file. The dump is deterministic.
- `.tables` lists all twelve tables, including `seed_ledger`, `user_budgets` and
  `user_recurring_transactions`.
- Six institutions, with `banco-de-chile` the only `available` one and the other five
  `coming_soon`.
- Sixteen categories: ten with `income = 0` and `sort_order` 1-10, six with `income = 1` and
  `sort_order` 1-6. The slug list matches the spec's Seed Data Contract exactly, including
  `otros-gasto` and `otros-ingreso`. There is **no** row with slug `uncategorized`.
- Every starter merchant has at least one alias.
- `app_settings` holds exactly two keys, `schema_version` (value `1`) and `first_launch_at`.
- The grep in step 4 finds **nothing**. No national ID, no password, no security answer, no token
  is anywhere in the committed snapshot, and the `user_financial_institutions` row carries only a
  `credentials_key` name.

### Step 10: The inclusion rule exists in exactly one place

**Maps to**: AC20

1. Run `grep -rn "excluded_at\|included_amount" apps/mobile/src apps/mobile/app`.
2. Open `apps/mobile/src/db/fragments.ts` and read it.
3. Add this line to `apps/mobile/src/db/repositories/transactions.ts`:

   ```ts
   const stale = sql`${transactions.excludedAt} is null`;
   ```

4. Run `pnpm --filter @finanzas/mobile test`.
5. Remove the line and re-run the suite.

**Expected result**: Step 1's grep finds those strings only in `schema.ts` (where the columns are
declared) and `fragments.ts` (where the rule is defined). `fragments.ts` exports exactly two
values, `isIncluded` and `includedAmount`, and nothing else. Step 4 **fails**, naming
`repositories/transactions.ts` and the rule it violated. Step 5 passes again. That failure is the
point of the step: without it, "the grep found nothing" would be equally consistent with a scanner
that reads no files at all.

### Step 11: No screen or package can reach the database directly

**Maps to**: AC26

1. Add `import { drizzle } from 'drizzle-orm/expo-sqlite';` to `apps/mobile/app/dashboard.tsx`.
2. Run `pnpm lint`.
3. Remove the import and re-run `pnpm lint`.
4. Run `grep -rln "drizzle-orm\|expo-sqlite\|better-sqlite3" apps/mobile/app apps/mobile/src packages`.

**Expected result**: Step 2 fails with the `dbAccessBoundary` restriction message. Step 3 passes.
Step 4 lists files only under `apps/mobile/src/db/`, plus `apps/mobile/scripts/db/` — no route
file, no feature hook, no component and no shared package.

### Step 12: Re-syncing the same bank response changes nothing a person decided

**Maps to**: AC6, AC7

1. Run the transaction-repository tests with verbose output:
   `pnpm --filter @finanzas/mobile test -- --testPathPattern transactions --verbose`.
2. Read the test names and confirm the four replay scenarios ran: with external ids and without,
   each for a first run and a repeated run.
3. Open `apps/mobile/src/db/repositories/transactions.ts` and read the `set` object of the update
   branch of `upsertBankTransactions`.

**Expected result**: All replay tests pass. The `set` object contains only bank-owned columns —
`amount`, `type`, `currency_code`, `occurred_at`, `date_local`, `raw_description`, `metadata`,
`dedup_hash`, `updated_at`. None of `transaction_category_id`, `category_source`, `note`,
`review_flag`, `excluded_at`, `exclusion_reason`, `exclusion_note`, `included_amount`,
`merchant_id` or `is_manual` appears anywhere in it. Reading that object is the check; the tests
are the proof it stays true.

### Step 13: Deleting a category moves its movements and deletes nothing

**Maps to**: AC8, AC9, AC10, AC22

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern categories --verbose`.
2. Load the snapshot into a scratch database as in Step 9 and attempt a raw delete of a fallback
   category:

   ```bash
   sqlite3 /tmp/finanzas-smoke.db "delete from transaction_categories where slug = 'otros-gasto';"
   ```

**Expected result**: The category tests pass, covering: a spending category's movements moving to
`otros-gasto`; an income category's moving to `otros-ingreso`; the movement count unchanged; a
forced mid-transaction failure leaving everything as it was; a merchant default cleared; budget
and recurring rows removed; and no merchant or movement deleted. Step 2's raw delete is **rejected
by the database** with an abort from the trigger, even though it bypassed the repository entirely.

### Step 14: Identity and uniqueness are enforced by the store, not by the caller

**Maps to**: AC21

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern schema --verbose`.
2. Read the test names.

**Expected result**: Seven raw-insert tests pass, each bypassing the repository and each rejected
by the store: a second connection to the same bank; a second product with the same external id in
one connection; a second category with the same slug; a second alias with the same pattern; a
second movement with the same `(product, external_id)`; a second movement with the same
`dedup_hash`; and a second `users` row.

### Step 15: Starter content refreshes without overwriting or resurrecting

**Maps to**: AC17, AC18, AC19

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern seeds --verbose`.
2. Read the test names and the `seed_ledger` algorithm in `apps/mobile/src/db/seeds/apply.ts`.

**Expected result**: The seed tests pass and cover all four ledger cases: a starter record never
seen before is inserted; one the person deleted is not resurrected; one the person edited is not
overwritten; one the person never touched is corrected to the current catalogue. A run forced to
throw part-way leaves the store exactly as it was. A catalogue with one extra entry inserts
exactly one row and nothing else.

### Step 16: A failed migration does not destroy the store

**Maps to**: AC16

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern migrations --verbose`.
2. Read the test that injects a deliberately failing migration statement.

**Expected result**: The test passes. After the failure: every pre-existing row is still present,
`app_settings.schema_version` still holds the last fully applied version, a typed
`DatabaseMigrationError` was thrown rather than swallowed, and the store was neither deleted nor
recreated. This mirrors what happens on a phone, where there is no way to repair a damaged store
after the fact.

### Step 17: A category's name resolves by locale

**Maps to**: AC11

1. Run `pnpm --filter @finanzas/mobile test -- --testPathPattern labels --verbose`.
2. Read the test cases.

**Expected result**: `toSupportedLocale` maps `en` and `EN` to `en`; maps `es`, `es-CL`, `fr`,
`''`, `null` and `undefined` to `es`. `resolveLabel` returns the English name for `en`, the
Spanish name for `es`, the Spanish name for every unmapped locale, and falls back to `es` when a
row's `labels` has no `en` key at all.

### Step 18: Nothing here leaves the device

**Maps to**: AC27

1. Run `git diff origin/develop...HEAD --stat` and read the file list.
2. Run `grep -rn "fetch(\|XMLHttpRequest\|axios\|sentry\|amplitude\|analytics" apps/mobile/src/db apps/mobile/scripts`.
3. Read the dependency additions in `apps/mobile/package.json`.

**Expected result**: The grep finds nothing. The only dependencies added are `expo-sqlite`,
`expo-crypto`, `drizzle-orm`, `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`, `tsx` and
`babel-plugin-inline-import`. None of them opens a network connection. There is no export, no
remote backup, no crash reporter and no analytics anywhere in the change.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below is met.
- Restore any file you temporarily edited (Steps 7, 10 and 11 each end with a revert) and confirm
  `git status` reports a clean tree.
- Remove the scratch database: `rm -f /tmp/finanzas-smoke.db`.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from the spec.

- [ ] **AC1** — A store built from scratch holds every kind of record and all starter content,
      with no set-up step and no error (Step 9).
- [ ] **AC2** — Six banks with exactly one `available` (`banco-de-chile`), the sixteen starter
      category slugs, and every starter merchant with at least one alias and a default category
      (Step 9).
- [ ] **AC3** — No category row with slug `uncategorized` (Step 9).
- [ ] **AC4** — No `real()` column anywhere; money inside JSON is whole minor units (Step 4).
- [ ] **AC5** — No national ID, password, security answer or token in any stored record, any
      starter content or any committed snapshot (Step 9).
- [ ] **AC6** — Replaying the same recorded bank response twice leaves the movement count
      unchanged, with and without bank-supplied identifiers (Step 12).
- [ ] **AC7** — A replay leaves every person-owned value exactly as set and refreshes only
      bank-owned values (Step 12).
- [ ] **AC8** — Deleting a category re-parents its movements to the ✨ Otros of the same
      direction, all-or-nothing, deleting no movement (Step 13).
- [ ] **AC9** — Neither ✨ Otros category can be deleted, including by a raw delete that bypasses
      the repository (Step 13).
- [ ] **AC10** — Deleting a category clears merchant defaults and removes budget and recurring
      rows, deleting no merchant and no movement (Step 13).
- [ ] **AC11** — A category name resolves by locale and falls back to Spanish (Step 17).
- [ ] **AC12** — The check applies the full history to an empty store with no pending difference
      (Steps 5, 6).
- [ ] **AC13** — The check applies the pending change set to the committed store snapshot and
      asserts nothing is lost or altered (Step 6).
- [ ] **AC14** — A deliberate non-additive change fails the check and names what would be lost;
      reverting it makes the check pass (Step 7).
- [ ] **AC15** — `schema_version` is recorded and equals `1` after a fresh install (Step 9).
- [ ] **AC16** — A failed migration destroys nothing and leaves the recorded version at the last
      fully applied one (Step 16).
- [ ] **AC17** — Re-running starter content over edited, reordered and deleted starter records and
      person-created records changes none of them (Step 15).
- [ ] **AC18** — Re-running starter content with a new starter record inserts that record and
      nothing else (Step 15).
- [ ] **AC19** — A failed starter-content run leaves the store exactly as it was (Step 15).
- [ ] **AC20** — The inclusion rule exists in exactly one place, and a second statement of it
      fails the suite (Step 10).
- [ ] **AC21** — Every identity and uniqueness guarantee is rejected by the store itself, even
      when the caller omits its own check (Step 14).
- [ ] **AC22** — Disconnecting deletes nothing; removing a merchant leaves its movements in place
      (Step 13).
- [ ] **AC23** — Every question the store must answer efficiently is answered through an index,
      with no full scan of the movements table (Step 8).
- [ ] **AC24** — The suite runs entirely in memory, with no simulator and no device, as part of
      the existing test command (Steps 2, 3).
- [ ] **AC25** — `db:generate`, `db:check` and `db:seed` exist on the mobile workspace and are
      documented (Step 1).
- [ ] **AC26** — Nothing outside the database module issues a query or imports the query builder
      (Step 11).
- [ ] **AC27** — No network call, export, remote backup, analytics or crash reporting (Step 18).
- [ ] **AC28** — The declared shape matches the data model record for record and field for field,
      with every intentional difference written back to it (Step 4).
- [ ] **AC29** — Every category has exactly one direction, with the starter directions and
      per-direction orders of the Seed Data Contract, and no operation changes a direction
      (Steps 9, 15).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Starter banks, categories, merchants and aliases | Fresh install: the complete Seed Data Contract | Automatic — `ensureDatabaseReady()` applies it, and the committed snapshot already contains it |
| Committed store at `schema_version` 1 | Starter content plus representative person-owned data: categorized, noted, review-flagged, excluded (all five reasons), partially included and manual movements | `pnpm --filter @finanzas/mobile db:seed` regenerates it; `db:check` mode 3 and Step 9 load it |
| Recorded bank responses | One response carrying external ids, one carrying none; each with a second-run variant that re-states one movement and appends two new ones | Read by the transaction-repository tests from `apps/mobile/src/db/__fixtures__/` |

None of these fixtures contains real bank data, a real national ID or any credential.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `db:check` fails only in mode 1, reporting a pending difference | `schema.ts` was edited without running `db:generate` | Run `pnpm --filter @finanzas/mobile db:generate` and commit the new migration and snapshot |
| `db:check` fails in mode 0 with a "pointing to a parent snapshot" collision | Two branches each generated a migration and both were merged | Regenerate the later migration on top of the merged history; never hand-edit `meta/_journal.json` |
| `db:check` fails in mode 2 naming a column you did not intend to remove | A column was renamed. A rename is a removal plus an addition, and the removal half destroys data on a phone | Add the new column, backfill it in the migration, write both for one release, then stop reading the old one — never drop the old column |
| The `db` Jest project fails to start with a native module error | The `better-sqlite3` prebuilt binary does not match the active Node version | Run `nvm use` so the `.nvmrc` version is active, then `pnpm rebuild better-sqlite3`. If it still fails, the implementation plan's Decision 2 names the fallback driver |
| Metro reports "unable to resolve ./0000_….sql" | `sql` is missing from `resolver.sourceExts`, or `babel-plugin-inline-import` is not configured for `.sql` | Restore both, in `apps/mobile/metro.config.js` and `apps/mobile/babel.config.js` |
| Cascade deletes appear to do nothing in a scratch database | `PRAGMA foreign_keys` defaults to OFF in the `sqlite3` CLI | Run `PRAGMA foreign_keys = ON;` before the delete. The app and the test client both set it on open |
| `db:seed` produces a diff on a second run | The dump is not deterministic, or a seed uses a random id | Both are bugs. Seeded rows use deterministic ids and the dumper sorts tables by name and rows by primary key |
| Step 9's `.tables` is missing `seed_ledger` | The snapshot was regenerated from an older migration history | Re-run `pnpm --filter @finanzas/mobile db:seed` on the current branch |

---

## Known Limitations

- **The device migration path is not exercised by this runbook.** Step 5 proves the generated
  migration files bundle; it does not prove they apply on a phone. That is a deliberate
  consequence of AC24, which forbids a device requirement, and it is recorded as a residual in the
  implementation plan rather than papered over here.
- **No screen is verified, because none exists.** Every guarantee below the surface is checked;
  what a person eventually sees is verified by the items that build the screens.
- **The `en` starter labels are provisional.** The spec's Decision 3 records them as a first pass,
  not yet reviewed by the product owner. This runbook checks that they are read from
  `design/tokens.json` rather than invented — not that they are the final wording.
- **The five `coming_soon` bank identifiers are provisional** (spec Decision 9). Only
  `banco-de-chile` must match the scraper today.
- **Steps 7, 10 and 11 mutate the working tree on purpose.** Each ends with a revert. If a run is
  interrupted part-way, `git checkout -- .` restores the tree before retrying.
