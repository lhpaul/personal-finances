# Smoke Test Runbook: Sync Engine

**Feature**: The sync engine — idempotent persistence of products and movements, plus the
connection's sync bookkeeping
**Spec**: [`../../specs/developments/20260802131441_10-sync-engine/1_10-sync-engine_specs.md`](../../specs/developments/20260802131441_10-sync-engine/1_10-sync-engine_specs.md)
**Implementation plan**: [`../../specs/developments/20260802131441_10-sync-engine/2_10-sync-engine_implementation-plan.md`](../../specs/developments/20260802131441_10-sync-engine/2_10-sync-engine_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

This item renders nothing: no screen, no route, no component. The whole runbook runs on the
command line against the in-memory SQLite tier, with no simulator, no device and no network.

- [ ] Node 22 active (`nvm use`; the repository pins Node 22 via `.nvmrc`)
- [ ] `pnpm install` has been run from the repository root and `pnpm check:layout` passes
- [ ] You are on the implementation branch for issue #10, with a clean working tree
- [ ] `@finanzas/bank-scraper` (#6) and `@finanzas/shared-domain` (#5) are merged into `develop` and
      present in this branch — the engine imports their types and their matching functions
- [ ] No design assets exist for this item (the tracker issue declares none and the item draws
      nothing), so this runbook has no design-fidelity step

---

## Test Data

Everything below is a fixture committed with the implementation; nothing is captured from a real
bank and no real credential is involved.

| Item | Value |
| --- | --- |
| Command prefix | `pnpm --filter @finanzas/mobile` |
| Recorded reads | `apps/mobile/src/db/__fixtures__/reads/*.json` — one whole `ScrapeResult` per file |
| Complete read | `read-complete.json` — 2 accounts + 1 card, movements on each, `outcome: 'complete'` |
| Reordered read | `read-repeat-shuffled.json` — the same movements, shuffled, with `positionInReadSnapshot` renumbered |
| Duplicates read | `read-duplicates.json` — two identical coffees on one day, plus a charge and its identically-described refund |
| Partial read | `read-partial.json` — two products read, one `productFailures` entry with `parse_failed` |
| Failed read | `read-failed.json` — `outcome: 'failed'`, `readFailure.reasonCode: 'invalid_credentials'`, no products, no movements |
| Cancelled read | `read-cancelled.json` — `outcome: 'cancelled'`, partial movements, `readFailure: null` |
| Foreign-currency read | `read-foreign-currency.json` — one `USD` card movement |
| Bad-amount read | `read-bad-amount.json` — one movement with `amountMinorUnits: 1500.5` |
| Sentinel credential | `SENTINEL-CREDENTIAL-DO-NOT-STORE` — planted in the fake secure store and in the fake runner's traces |
| Automatic-sync interval | `AUTOMATIC_SYNC_INTERVAL_MS = 21600000` (six hours) |
| Failure message keys | `sync.errors.invalid_credentials`, `sync.errors.session_closed`, `sync.errors.network`, `sync.errors.parse_failed` |

---

## Smoke Test Steps

### Step 0: Clean baseline

1. From the repository root, run `pnpm install`.
2. Run `git status --short` and confirm nothing is modified beyond this item's own changes.
3. Run `pnpm --filter @finanzas/mobile test` and confirm three Jest projects report: `app`, `db`
   and `sync`.

**Expected result**: the suite is green and every project runs. No sync test appears twice in the
output.

### Step 1: A first sync stores what the bank showed

**Maps to**: AC1, AC7, AC16, AC17, AC18

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/transactions.test.ts src/db/__tests__/products.test.ts src/db/__tests__/enrichment.test.ts`.
2. Read the test names in the output.

**Expected result**: the complete read stores every reported product under its connection and every
reported movement under its product, with the reported amount, direction, currency, calendar day and
description. Two products of the same kind are two rows. A description matching a seeded merchant
stores that merchant with its default category marked `auto`; the same description matching a
person-created merchant is marked `rule`; a description matching nothing stores neither and is
counted by `countUncategorized`.

### Step 2: The same read applied twice changes nothing

**Maps to**: AC2, AC3, AC4, AC6, AC19, AC20, AC21

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/transactions.test.ts`.
2. Confirm the replay cases pass, including the shuffled read.

**Expected result**: the product count and the movement count are unchanged and the summary reports
nothing stored for the first time. A movement the person categorized, noted, flagged, excluded with
a reason or attached to a merchant keeps every one of those values byte for byte, while a restated
amount, direction or day is refreshed. A movement stored with no merchant still has none after a
matching merchant is created. The set of `user`-sourced categories and the set of excluded movements
never shrink.

### Step 3: Two indistinguishable movements stay two

**Maps to**: AC5

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/dedup.test.ts src/db/__tests__/transactions.test.ts`.
2. Find the cases named for the duplicates fixture.

**Expected result**: two identical coffees on one day are stored as two movements and stay two after
the same read is applied again. A charge and its identically-described refund — alike in product,
day, amount and description, differing only in direction — are likewise two, and stay two.

### Step 4: A read that no longer lists a product

**Maps to**: AC8

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/products.test.ts`.

**Expected result**: the product the second read omits keeps its row and every movement attached to
it. Nothing is deleted.

### Step 5: A failed read leaves the store exactly as it was

**Maps to**: AC9, AC10

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/sync-write.test.ts src/db/__tests__/connections-sync.test.ts`.

**Expected result**: after the failed read no product and no movement is stored, and a column-by-column
dump of the store taken before and after is identical. The connection records the attempt time and
`invalid_credentials`, leaves the last-success time at its earlier value, and is in `error`.

### Step 6: A partial read keeps what it gathered

**Maps to**: AC11

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/connections-sync.test.ts`.

**Expected result**: everything the partial read gathered is stored; the connection is in `error`;
the last-success time is not advanced.

### Step 7: A successful read, and a stopped one

**Maps to**: AC12, AC13

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/connections-sync.test.ts`.

**Expected result**: after the complete read the connection is `ok`, its last-success time equals
its last-attempt time exactly, and any previous failure code and message are cleared. After the
cancelled read whatever was gathered is stored, the connection is `idle`, no failure reason is
recorded and the last-success time is not advanced.

### Step 8: A sync is all or nothing

**Maps to**: AC14, AC15

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/sync-write.test.ts`.

**Expected result**: the injected driver failure partway through the write leaves no product, no
movement and no connection column half-written. The bad-amount read stores nothing at all and the
connection records `parse_failed`.

### Step 9: Currency is stored as stated, and never summed into a peso total

**Maps to**: AC22, and the plan's Decision 15

1. Run `pnpm --filter @finanzas/mobile test -- src/db/__tests__/transactions.test.ts src/db/__tests__/peso-total-guard.test.ts src/db/checks/__tests__/peso-total-scan.test.ts`.
2. Plant a defect: add a `sum` over `includedAmount` without `isPesoDenominated` to a repository
   function, re-run the guard test, then revert.

**Expected result**: the `USD` movement is stored with its stated currency and amount, with no
conversion. It is absent from `totalForCategoryInPeriod` and present in `countUncategorized`. The
planted defect fails the guard test, naming the file and the line; after reverting, `git diff --stat`
is empty.

### Step 10: The calendar day survives the device's time zone

**Maps to**: AC23

1. Run `TZ=Pacific/Auckland pnpm --filter @finanzas/mobile test`.
2. Run `TZ=America/Anchorage pnpm --filter @finanzas/mobile test`.

**Expected result**: both runs are green. A movement's stored calendar day equals the day the read
stated in both, and the derived instant converts back to that same day in Santiago.

### Step 11: Automatic sync on app open

**Maps to**: AC24, AC25, AC26, AC27

1. Run `pnpm --filter @finanzas/mobile test -- src/features/sync/__tests__/auto-sync.test.ts src/features/sync/__tests__/app-open.test.ts`.

**Expected result**: a connection whose last success and last attempt are both older than six hours
starts a sync; one more recent than that does not. A connection whose last failure was a credential
rejection is skipped automatically but syncs when asked explicitly. A connection left at `syncing`
is returned to `idle` with no failure recorded, before the eligibility check runs. Connections that
are `inactive` or `disconnected` are never swept.

### Step 12: One read at a time

**Maps to**: AC28

1. Run `pnpm --filter @finanzas/mobile test -- src/features/sync/__tests__/sync-lock.test.ts`.

**Expected result**: a second request for the same connection, and a request for a different
connection while a read is running, both return a refusal. Exactly one read runs, and the refused
request changes no column of any connection.

### Step 13: No credential, and no bank text, anywhere

**Maps to**: AC29, AC30

1. Run `pnpm --filter @finanzas/mobile test -- src/features/sync/__tests__/sync-engine.test.ts src/features/sync/__tests__/no-secure-store.test.ts`.
2. Read the assertion that dumps every column of every table after a full sync.

**Expected result**: the sentinel credential appears in no column of any table and in no recorded
failure message. `last_error_message` is one of the four `sync.errors.*` keys, even for a read whose
traces and product failures carry bank-flavoured text. No file under `src/features/sync/` imports
`expo-secure-store`.

### Last Step: Validate & Shut Down

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm --filter @finanzas/mobile db:check`.
4. Run `pnpm test` from the repository root.
5. Run `git status --short` and confirm no stray fixture or database file was left behind.

---

## Checklist

- [ ] AC1 — a complete read stores every product and movement, with the reported facts
- [ ] AC2 — the same read applied twice changes no count and reports nothing new
- [ ] AC3 — the person's category, note, review flag, exclusion and merchant survive a replay
- [ ] AC4 — a restated amount, direction or day is refreshed; the decision layer is not
- [ ] AC5 — two indistinguishable movements are two, and a charge and its refund are two
- [ ] AC6 — a reordered read stores nothing new
- [ ] AC7 — two products of the same kind are two products, re-matched on replay
- [ ] AC8 — a product the read stops listing keeps its row and its movements
- [ ] AC9 — a failed read stores nothing and leaves the store byte-identical
- [ ] AC10 — a failed read records the attempt and the reason, and does not advance last success
- [ ] AC11 — a partial read stores what it gathered, is `error`, and does not advance last success
- [ ] AC12 — a successful read is `ok`, with last success equal to last attempt and errors cleared
- [ ] AC13 — a stopped read stores what it gathered, is `idle`, and records no failure
- [ ] AC14 — a throw partway through the write leaves nothing half-written
- [ ] AC15 — a bad amount stores nothing and records `parse_failed`
- [ ] AC16 — a starter-merchant match stores the merchant and an `auto` category
- [ ] AC17 — a person-created merchant match stores a `rule` category
- [ ] AC18 — no match stores no merchant and no category, and counts as uncategorized
- [ ] AC19 — a movement stored without a merchant is never enriched later
- [ ] AC20 — a sync never writes a `user` category
- [ ] AC21 — no movement is deleted or excluded by a sync
- [ ] AC22 — a non-peso movement is stored unconverted, and stays out of the peso total
- [ ] AC23 — the stored calendar day is the read's day, east and west of Santiago
- [ ] AC24 — the six-hour interval decides automatic syncing
- [ ] AC25 — a credential rejection suspends automatic syncing but not an explicit request
- [ ] AC26 — a stuck `syncing` connection is returned to `idle` before the eligibility check
- [ ] AC27 — inactive and disconnected connections are never synced automatically
- [ ] AC28 — at most one read runs on the device, and a refusal writes nothing
- [ ] AC29 — no credential value appears anywhere in the store
- [ ] AC30 — no bank text and no trace value appears in a recorded failure message
