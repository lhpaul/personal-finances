# Sync Engine: Idempotent Persistence of Products and Movements — Implementation Plan

**Spec**: [`1_10-sync-engine_specs.md`](./1_10-sync-engine_specs.md)
**Smoke test runbook**: [`../../../testing/mobile/10-sync-engine.smoke-test.md`](../../../testing/mobile/10-sync-engine.smoke-test.md)

---

## Summary

**Approach**: The engine is a headless feature module (`apps/mobile/src/features/sync/`) that
takes one `ScrapeResult` from an injected scraper port and turns it into exactly one indivisible
SQLite write, plus the connection's own bookkeeping. The persistence half extends the upsert route
item #3 shipped rather than replacing it: the dedup fingerprint gains the movement's **direction**
and an **occurrence index within the read**, which is what makes the spec's two identity
guarantees — direction is a recognised fact (Business Rule 9), and N indistinguishable movements
in one read stay N on repeat (Business Rule 10) — fall out of the existing
`(user_financial_product_id, external_id)` → `dedup_hash` lookup with no new lookup route and no
deletion. Products are recognised by the read's opaque instance identity, which is what
`user_financial_products.external_id` now holds (spec Conflict 3). Nothing about the person's
decision layer is ever named in an `UPDATE`.

**Estimated complexity**: L

**Rationale**: Three separate hard parts. (1) The identity change touches a shipped, tested
fingerprint and has to satisfy two guarantees that pull in opposite directions — never duplicate,
never merge — under reordering. (2) Atomicity across products, movements and the connection record
has to survive the codebase's constraint that SQLite transactions here are **synchronous** while
hashing is **asynchronous**, so every await has to happen before the transaction opens. (3) The
connection lifecycle has five exits (`ok`, `error` from a failed read, `error` from a partial read,
`idle` from a stop, `idle` from crash recovery) each with a different bookkeeping rule, plus a
device-wide single-read constraint. Thirty acceptance criteria, no UI, and the whole thing has to
be provable in Node with no device.

**Dependencies**:

- **#3 local database (merged)** — `schema.ts`, `dedup.ts`, `repositories/transactions.ts`,
  `fragments.ts`, `json.ts`, `money.ts`, `ids.ts` and the in-memory test tier are all in `develop`.
- **#6 bank scraper (implementation in review on another lane — PR #46)**. This plan is written
  against the `ScrapeResult` / `ScrapedProduct` / `ScrapedMovement` shapes as they exist on that
  PR's head (see [Verification Log](#verification-log)). Implementation of this item **must not
  start before PR #46 is merged**: the types it imports do not exist on `develop` today
  (`packages/bank-scraper/src/index.ts` currently exports only `PACKAGE_NAME`).
- **#5 shared-domain (implementation in review on another lane — PR #44)**. `resolveMerchant`,
  `suggestCategory`, `Merchant` and `MerchantAlias` come from there. Same gate: merge #44 first.
- Neither dependency is *modified* by this item.

---

## Verification Log

All commands run from the worktree root
(`.claude/worktrees/item-10`, branch `implementation-plan/10-sync-engine`).

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `4fc495a` (branch base; `origin/develop` was `be6a45d` at plan time) |
| Scraper contract this plan encodes | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/types/scrape-result.types.ts` | Branch head `8264a09`. `ScrapedMovement` = `productInstanceId`, `dateLocal`, `amountMinorUnits`, `direction`, `currencyCode`, `rawDescription`, `bankSuppliedId`, `positionInReadSnapshot`, `extras`. `ScrapeResult` = `outcome`, `countryCode`, `bankId`, `products`, `movements`, `readFailure`, `productFailures`, `skippedProductKinds`, `traces` |
| Matching contract this plan calls | `git show origin/feature/5-shared-domain-rules-matching-aggregates:packages/shared-domain/src/merchant-matching.ts` and `.../category-suggestion.ts` | Branch head `aceb215`. `resolveMerchant(rawDescription, aliases): MerchantMatch \| null`; `suggestCategory({ currentCategorySource, merchant }): CategorySuggestion \| null`; `Merchant.isUserDefined` is the `auto` / `rule` discriminator |
| Who computes a dedup input today | `git grep -ln buildDedupInput -- apps packages docs` | Three paths: `apps/mobile/src/db/dedup.ts`, `apps/mobile/src/db/repositories/transactions.ts`, and item #3's implementation plan. One production caller — so the input change has exactly one code call site |
| Whether stored fingerprints need re-computing | `git grep -n dedupHash -- apps/mobile/scripts/db/build-fixture.ts` | Every value in the committed fixture is a hand-written literal (`'seed-dedup-auto'`, …), never a `buildDedupInput` result. Nothing in the repo derives a stored hash from the formula, and per spec Conflict 2 nothing has shipped to a device — **no re-fingerprinting migration is needed** |
| Which docs state the dedup formula or the sync contract | `git grep -ln 'dedup_hash\|dedupHash' -- docs AGENTS.md` | `docs/project/4-database-model.md`, `docs/best-practices/STACK-SPECIFIC.md`, `docs/best-practices/stack/sqlite-drizzle.md`, `docs/best-practices/4-database.md`, `AGENTS.md`, plus three items' own spec/plan/runbook documents (historical records, not updated) |
| Whether the feature layer exists | `ls apps/mobile/src/features` | Does not exist. This item creates `apps/mobile/src/features/sync/`, the first folder under it |
| Whether a movement can be deleted | `git grep -n deleteTransaction -- apps/mobile/src` | Four hits, all in doc comments or in `merchants.test.ts`'s assertion that no such export exists. Confirmed: no delete path exists, and this plan adds none |
| Open pull requests at plan time | `gh pr list --state open --json number,title,headRefName` | `#56` plan/12, `#55` plan/8, `#46` feature/6, `#44` feature/5 |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact owner and base branch | This repository owns the plan; base is `develop` | `.ai-dev-workflow.yaml` (`vcs.provider: github`, no `repository_mode` key → single repo), `AGENTS.md` "Git & Branching" | 2026-08-02, repo `4fc495a` | This invocation (item #10) only | `Verified` |
| Scraper read contract (`ScrapeResult`, `ScrapedProduct`, `ScrapedMovement`) | As quoted in the Verification Log | `packages/bank-scraper/src/types/scrape-result.types.ts` on `origin/feature/6-port-bank-scraper-banco-de-chile` (`8264a09`) | 2026-08-02, dependency head `8264a09` | Open PRs touching `packages/bank-scraper`: PR #46 only | `Verified` |
| Merchant-matching contract (`resolveMerchant`, `suggestCategory`, `Merchant.isUserDefined`) | As quoted in the Verification Log | `packages/shared-domain/src/merchant-matching.ts`, `category-suggestion.ts`, `types.ts` on `origin/feature/5-shared-domain-rules-matching-aggregates` (`aceb215`) | 2026-08-02, dependency head `aceb215` | Open PRs touching `packages/shared-domain`: PR #44 only | `Verified` |
| Ownership of the peso-total surface | `apps/mobile/src/db/fragments.ts` is the single place a totals predicate may exist; `packages/shared-domain/src/aggregates.ts` is its TypeScript twin | `apps/mobile/src/db/fragments.ts` header comment and `src/db/checks/inclusion-rule-scan.ts`; item #5 plan's `src/aggregates.ts` entry | 2026-08-02, repo `4fc495a` + dependency head `aceb215` | Open PRs that add or change a money aggregate: PR #44 only. PR #44's `summarizePeriod` has **no currency field on `Movement`** and therefore no currency filter | `Verified` — no conflict; the gap is real and is carried as an explicit cross-item obligation (Decision 15, [Cross-item obligations](#cross-item-obligations)) |

Both dependency contracts are read from open PR heads rather than from `develop`. That is a
**sequencing** constraint, not a conflict: no other open PR changes these surfaces, and Protocol 03's
implementation-start re-verification must re-read all four rows before the first file edit. If a
dependency merged with a different shape, stop and return the evidence rather than adapting the
plan silently.

---

## Architecture and Decisions

### Decision 1 — The movement fingerprint gains direction and an occurrence index

*(Spec Business Rules 9-11, Conflict 2, AC5, AC6.)*

`buildDedupInput` today folds in product, `date_local`, amount, description, `external_id`, and —
for a manual entry only — the row id. Two facts the spec requires are missing, and each has a
concrete failure today:

- **Direction is absent.** A charge and its identically-described refund on the same day for the
  same amount produce the same input, so the second is recognised as the first and overwrites it.
  AC5's second sentence fails.
- **Nothing separates indistinguishable movements.** Two identical coffees in one read produce the
  same input, so the second collapses onto the first. AC5's first sentence fails, and Business Rule
  10's "never fewer" is violated in the *fewer* direction.

The input becomes:

```text
v2 ␟ userFinancialProductId ␟ dateLocal ␟ amount ␟ direction ␟ rawDescription ␟ externalId ?? ''
   ␟ occurrenceIndex ␟ isManual ? id : ''
```

`DEDUP_INPUT_VERSION = 'v2'` leads the string so a future identity scheme can be introduced
without colliding with a stored `v2` value. `DEDUP_INPUT_SEPARATOR` (`U+241F`) is unchanged.
Everything else keeps its current position and meaning, so the data model's documented formula is
still recognisable as the core of this one.

### Decision 2 — The occurrence index is derived from within-read grouping, never from position

*(Spec Business Rule 11, AC6. This is the constraint item #6 handed over.)*

`ScrapedMovement.positionInReadSnapshot` exists, and Business Rule 11 forbids putting it in a
cross-read identity. So the engine does not use it as one. Instead, for the movements of **one
product in one read**:

1. Group the read's movements by the identity tuple
   `(dateLocal, amount, direction, rawDescription, externalId ?? '')`.
2. Within each group, assign `occurrenceIndex` `0, 1, 2, …`.

Every member of a group is, by construction, byte-identical in every field the tuple names. So the
**multiset** of `(tuple, occurrenceIndex)` pairs a read produces is independent of the order the
movements arrive in: reordering the read permutes which JavaScript object gets index 0, but not
which hashes exist. That is exactly AC6 ("a read whose movements come back in a different order
stores no new movement"), and it holds *by construction* rather than by a sort.

`assignOccurrenceIndexes` is a pure function in `src/db/dedup.ts`, unit-tested independently of
SQLite. `positionInReadSnapshot` is used for exactly one thing: ordering a group's members before
index assignment, so that when two members of a group differ in a field that is **not** part of the
tuple (only `extras`/`metadata` can), the assignment is deterministic for a given read. It is never
hashed, never stored, and never compared across reads.

### Decision 3 — The "never fewer, never the sum" rule falls out of the lookup

*(Spec Business Rule 10, AC5, AC21.)*

With Decision 2 in place, no new lookup route is needed. Per movement, the existing route runs
unchanged: by `(user_financial_product_id, external_id)` when the bank supplied an identifier,
otherwise by `dedup_hash`; hit → refresh bank-owned columns; miss → insert.

For a group of indistinguishable movements with `S` already stored (indexes `0…S-1`) and `R` in
this read (indexes `0…R-1`), the read visits indexes `0…R-1`:

- `min(S, R)` of them hit and are refreshed.
- `max(0, R - S)` of them miss and are inserted.
- `max(0, S - R)` stored rows are simply never visited — untouched, not deleted.

The resulting count is `max(S, R)`. Never fewer (nothing is deleted), never `S + R` (the first
`min(S, R)` matched). That is Business Rule 10 verbatim, and it is a consequence of the identity
function rather than a special case in the writer.

### Decision 4 — A product is recognised by the read's opaque instance identity

*(Spec Business Rule 5, Conflict 3, AC7, AC8. This claims item #6's follow-up F2.)*

`user_financial_products.external_id` stores `ScrapedProduct.instanceId` — the 32-hex opaque value
item #6 computes inside the page. It is not the product kind, so two cuentas corrientes are two
products under the same connection (AC7), and it is not the account or card number, which a read
never reports (Business Rule 5).

The existing `user_financial_products_institution_external_unique` index on
`(user_financial_institution_id, external_id)` is the store-level backstop, unchanged. A product the
read no longer lists is not visited, so it and its movements stay exactly as they are (AC8) — the
same mechanism as Decision 3, one level up. `ScrapedProduct.kind` maps 1:1 onto the `type` column
(`checking`, `sight`, `savings`, `credit_card`, `credit_line` — the same five tokens in both
places, verified in the Verification Log's contract row).

### Decision 5 — One indivisible write, with every `await` before the transaction opens

*(Spec Business Rule 21, AC14.)*

`db.transaction(...)` in this codebase runs against `BaseSQLiteDatabase<'sync', …>` drivers: the
callback **cannot await**. Hashing (`ports.digestSha256`) is asynchronous. The shipped
`upsertBankTransactions` already resolves this by precomputing hashes before the transaction; this
item extends the same shape to the whole sync:

**Phase A — precompute (async, no writes).** In order:

1. `listProductIdsByExternalId(db, userFinancialInstitutionId)` — the ids of the products already
   stored under this connection, keyed by their `external_id` (the read's instance identity).
2. For every product the read reports that is **not** in that map, reserve an id with
   `ports.newId()`. The reserved id is the one Phase B inserts, so the mapping
   `instanceId → userFinancialProductId` is total before any hashing happens. This step exists
   because `dedup_hash` folds in the product id (Decision 1) and a brand-new product has no id yet;
   deferring id generation into the transaction would make the movement hashes uncomputable.
3. Validate every amount, assign occurrence indexes per product, and build every dedup hash against
   the resolved product id.
4. Resolve one `now` from `ports.now()`.

The Phase A read runs outside the transaction. That is safe because a product row is only ever
created by a sync and the device lock allows one sync at a time (Decision 13); if a race did occur
anyway, `user_financial_products_institution_external_unique` rejects the duplicate insert and
Phase B rolls back whole, which is the same outcome as any other failed write.

**Phase B — one transaction (sync).** Products upsert → per-product movement upsert (with
enrichment on insert) → connection record. One `db.transaction`, one commit. A throw anywhere
inside rolls the whole thing back, including the connection record (AC14).

There is no nested `db.transaction` call: `writeBankTransactionsInTx` and
`upsertBankProductsInTx` take the transaction handle. The existing public
`upsertBankTransactions(db, …)` stays, and becomes a thin wrapper that opens its own transaction
around the same in-transaction writer, so item #3's tests keep passing unchanged.

### Decision 6 — A rejected amount fails the whole sync, and the failure record is a second write

*(Spec Business Rule 12, Decision 8, AC15.)*

`assertPositiveMinorUnits` runs in Phase A. A fractional, zero, negative or non-numeric amount
throws `MovementValidationError` before any row is written — the store is untouched, which is the
"stores nothing at all" half of AC15.

The other half ("and the connection records a parsing failure") is a write, and it cannot be in the
transaction that just did not happen. So the engine catches `MovementValidationError` and performs
the connection-record write on its own, with `last_error_code = 'parse_failed'`. Business Rule 21's
indivisibility is about *what a read reported* — the failure bookkeeping is the branch in which
none of it was stored, and it writes only `user_financial_institutions` columns. The error object
carries the offending **field name and row index only**, never the value and never the description
(Business Rules 3, 30).

The same treatment covers one other structural defect: a movement whose `productInstanceId`
matches neither a product in this read nor a product already stored under this connection. Silently
dropping it would hide a movement the person made, so it is a `parse_failed` defect too.

### Decision 7 — Enrichment happens on insert only, inside the transaction

*(Spec Business Rules 18-20, AC16-AC20.)*

The merchant set is loaded once per sync, in Phase B, through
`loadMerchantMatchingSet(tx)` → `{ merchants, aliases }` in shared-domain shapes. For each movement
that **misses** (i.e. is being inserted):

```text
match      = resolveMerchant(rawDescription, aliases)             // null when nothing matches
merchant   = match ? merchantsById.get(match.merchantId) : null
suggestion = suggestCategory({ currentCategorySource: null, merchant })
```

`merchant_id`, `transaction_category_id` and `category_source` appear **only in the `INSERT`
values object**, never in the `UPDATE` set object — the same structural guarantee item #3 built for
the other person-owned columns. `category_source` is whatever `suggestCategory` returns (`auto` for
seeded merchants, `rule` for person-created ones); `user` is unreachable from this code path because
`suggestCategory` only ever returns `auto` or `rule` when `currentCategorySource` is `null`
(AC17, AC20). No match → all three stay null, and the movement is counted by `countUncategorized`
(AC18). A movement that already exists is never re-examined, because enrichment is only computed on
the miss branch (AC19).

`merchant_aliases.match_count` is **not** written by a sync — see
[Assumption A6](#assumptions-taken-in-this-plan).

### Decision 8 — The connection's record, and the single `now`

*(Spec Business Rules 23-25, AC10-AC13, AC26.)*

`beginSync` writes exactly one column: `sync_status = 'syncing'`. It does **not** write
`last_sync_at`. Every exit writes the attempt time from the **same** `now` value the write phase
uses:

| Exit | `sync_status` | `last_sync_at` | `last_success_at` | `last_error_code` / `last_error_message` |
| --- | --- | --- | --- | --- |
| `complete` | `ok` | `now` | `now` | cleared to `null` |
| `failed` (nothing gathered) | `error` | `now` | untouched | the read's reason + composed message |
| `partial` (something gathered) | `error` | `now` | untouched | the read's reason + composed message |
| `cancelled` (stopped) | `idle` | `now` | untouched | untouched (Decision 10) |
| crash recovery at app open | `idle` | `now` | untouched | untouched (Decision 11) |

Writing `last_sync_at` at the exit rather than at the start is what makes AC12's
"last-success time equals last-attempt time" exactly true rather than approximately true: on a
success both columns receive the identical string.

### Decision 9 — Failure-reason precedence, and a message that cannot contain bank text

*(Spec Business Rules 3, Recorded failure reason, AC10, AC11, AC30.)*

`selectFailureReason(result)`:

1. `result.readFailure?.reasonCode` when present — a read-level failure outranks any product-level
   one, because it means the read never got started.
2. Otherwise, the highest-precedence code among `result.productFailures`, using
   `SYNC_FAILURE_PRECEDENCE = ['invalid_credentials', 'session_closed', 'network', 'parse_failed']`.

`invalid_credentials` leads the precedence deliberately: it is the one code that suspends automatic
syncing (Business Rule 24), and losing it behind a `parse_failed` from an unrelated product would
silently re-enable sign-in attempts against a bank that just rejected the credential.

`composeFailureMessageKey(code)` is a total function from the four-value enum to the four fixed
strings `sync.errors.invalid_credentials`, `sync.errors.session_closed`, `sync.errors.network`,
`sync.errors.parse_failed`. Its input is a code, never a `ScraperTrace`, never a caught error's
message. AC30 is therefore true by construction — the set of values `last_error_message` can hold is
four literals — and the test asserts exactly that, over a read whose traces and product failures
carry planted bank-flavoured text. The catalogue entry that renders these keys belongs to the bank
detail screen item; the store holds the key.

### Decision 10 — A stopped read leaves a previous failure record alone

*(Spec Use Case 5, Business Rule 23, Decision 5, AC13.)*

AC13 requires that a stopped read record no failure reason. It does not say whether an *older*
failure is cleared. Clearing it would be actively harmful: a connection that failed with
`invalid_credentials`, then had a stop, would silently become eligible for automatic syncing again
(Business Rule 24 keys on the last failure code) and would start attempting sign-ins against a bank
that already rejected the credential. So a stop writes `sync_status` and `last_sync_at` and touches
nothing else. Only a success clears the failure (Business Rule 23).

### Decision 11 — Crash recovery returns the connection to idle **and** records the attempt

*(Spec Business Rule 25, Decision 6, AC26.)*

`clearStuckSyncingConnections(db, now)` runs before the automatic-sync check on every app open. Any
connection whose `sync_status` is `syncing` is set to `idle` with `last_sync_at = now`, no failure
recorded, `last_success_at` untouched. The device lock (Decision 13) is in-process, so at app open it
is always free — a `syncing` row can only be a leftover.

Recording the attempt time is the judgement call. The alternative — leaving `last_sync_at` alone —
makes a connection that crashes the app mid-sync immediately eligible again on the next open, which
is a loop that re-reads the bank on every launch. That is precisely the failure spec Decision 2
introduced the last-attempt half of the interval to prevent. "Sincronizar ahora" is never subject to
the interval, so the person always has an immediate way out. Recorded as
[Assumption A1](#assumptions-taken-in-this-plan).

### Decision 12 — Automatic-sync eligibility is a pure predicate

*(Spec Business Rule 24, Decisions 1-3, AC24, AC25, AC27.)*

```text
AUTOMATIC_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000
```

`isDueForAutomaticSync(connection, nowIso)` is true when **all** hold:

- `connection.status === 'active'` (AC27 — `inactive` and `disconnected` are never automatic)
- `connection.syncStatus !== 'syncing'`
- `connection.lastErrorCode !== 'invalid_credentials'` (AC25)
- `lastSuccessAt` is null, or `now - lastSuccessAt > AUTOMATIC_SYNC_INTERVAL_MS` (AC24)
- `lastSyncAt` is null, or `now - lastSyncAt > AUTOMATIC_SYNC_INTERVAL_MS` (spec Decision 2)

Strictly greater, matching "more than six hours". Elapsed time is computed as
`Date.parse(nowIso) - Date.parse(storedIso)` over two ISO-8601 UTC instants; this is *duration*
arithmetic, not calendar-day derivation, so the "never derive a day from the device clock" rule
(Business Rule 16) is not in play — and `nowIso` comes from the injected `ports.now()`, so tests set
the clock rather than mocking `Date`. The predicate takes no database handle, so every AC24/AC25/AC27
case is a table-driven unit test.

The constant lives in `apps/mobile/src/features/sync/auto-sync.ts`, not in `@finanzas/shared-domain`:
#5's package surface is frozen in review, and this value is an app-scheduling policy rather than a
rule about a movement.

### Decision 13 — One read on the device, enforced in memory; the DB flag is the crash marker

*(Spec Business Rule 22, Decision 11, AC28.)*

`sync-lock.ts` holds a module-level `activeConnectionId: string | null`.
`acquireReadLock(connectionId)` returns a release handle or `null` when the lock is held — for the
same connection **or a different one** (AC28's second sentence). The lock is released in a `finally`
that runs on every path, including a throw from the scraper port.

A refused request writes **nothing**: `beginSync` runs only after the lock is acquired, so a refusal
cannot touch `sync_status` (AC28's "does not change the connection's record"). `runSync` returns
`{ status: 'refused', reason: 'read_in_progress' }` rather than throwing, so a caller can render a
message without an exception path.

The durable `sync_status = 'syncing'` value is **not** the mutex — it is the marker Decision 11
recovers from, and the value the syncing screen reads. When the lock is free but a row says
`syncing`, the row is stale by definition and `runSync` proceeds; refusing would strand the
connection until the next app open.

### Decision 14 — `occurred_at` is derived from the day the bank stated

*(Spec Business Rule 16, AC23.)*

`ScrapedMovement` carries `dateLocal` and no instant. `transactions.occurred_at` is
`TEXT NOT NULL`, documented as ISO-8601 UTC. The engine therefore derives it, and must derive it so
that anyone who later converts it back to a Santiago local day gets the day the bank stated.

`canonicalInstantForDateLocal(dateLocal)` is added to `packages/shared-utils/src/dates.ts` and
returns `` `${dateLocal}T12:00:00.000Z` ``, after validating the input through the existing
`isValidDateLocal`. Midday UTC is chosen because Santiago is `UTC-3`/`UTC-4` year-round, so
`deriveDateLocal(canonicalInstantForDateLocal(d)) === d` for every `d`, on both sides of both DST
transitions — and the round-trip is asserted as a property test over a full year rather than a
spot check. `date_local` itself is copied verbatim from the read and is never derived from an
instant, which is what AC23 actually measures; this decision is about not leaving a latent
wrong-month bug in the column next to it.

The helper goes in `shared-utils` because that package owns date helpers
(`docs/project/2-repo-architecture.md`) and because `shared-domain` may not touch `Date` at all. It
is an additive export; note that PR #44 also appends to `dates.ts`, so expect a trivial
append-order conflict if that PR has not merged first.

### Decision 15 — The currency guard lands in `fragments.ts`, and a scan keeps it there

*(Spec Business Rule 17, Deferral Note 3, AC22. This is the cross-item obligation the spec asked to
be carried explicitly rather than absorbed.)*

The engine stores a foreign-currency movement in the currency the read stated, unconverted (AC22).
That leaves the exposure Deferral Note 3 names: every total in the MVP is a peso total, and the
inclusion rule counts a movement whenever it is not excluded — it does not look at currency. This
plan does not defer *where the guard lives*; it places it, in the one file that already owns
predicates over `transactions`:

- **`apps/mobile/src/db/fragments.ts` gains a third fragment**,
  `isPesoDenominated = sql\`${transactions.currencyCode} = 'CLP'\``, with a header comment that
  states it is the only place the condition may exist.
- **`totalForCategoryInPeriod` adds it** to its `WHERE`. That is the only money aggregate shipped
  today, no screen consumes it yet, and its existing test rows are all `CLP`, so the change is
  behaviour-correct and blast-radius-free.
- **`countUncategorized` deliberately does not filter on it.** A dollar movement still needs a
  category; keeping it out of the "por categorizar" count would hide it from the person entirely.
- **`apps/mobile/src/db/checks/peso-total-scan.ts` makes "never silently" mechanical**: any file
  outside the allowlist whose source sums `includedAmount` without also naming `isPesoDenominated`
  is a finding, driven over the real tree by
  `apps/mobile/src/db/__tests__/peso-total-guard.test.ts`. A future aggregate cannot quietly add a
  dollar into a peso total; it fails a test that names the file and line.

What stays deferred is what the **person sees**: a separate foreign-currency line, a badge, a
converted figure. That belongs to the item that owns the aggregates and the dashboard. The
TypeScript twin of the guard (`packages/shared-domain/src/aggregates.ts`, whose `Movement` type has
no currency field today) is recorded in [Cross-item obligations](#cross-item-obligations). Meanwhile
the sync summary reports `foreignCurrencyMovementsStored`, so a caller can already tell that a
non-peso movement arrived.

### Decision 16 — The scraper is an injected port, and the engine never sees a credential

*(Spec Business Rules 1-2, AC29.)*

```ts
// Illustrative — adapt during implementation.
export interface ScraperRunner {
  run(request: {
    connectionId: string;
    countryCode: string;
    bankId: string;
    credentialsKey: string; // the secure-store *key name*, never a value
    signal?: AbortSignal;
  }): Promise<ScrapeResult>;
}
```

The engine passes the connection's `credentials_key` — a name, which the schema already stores in
plaintext — and nothing else. Reading `expo-secure-store` and handing the plaintext to
`ScrapeSession.start()` is the runner's job, and the runner is implemented by the item that mounts
the hidden WebView (connect flow / syncing screen). `packages/bank-scraper` is imported by this
feature **type-only**, so no React and no `react-native-webview` is pulled into the engine's module
graph.

`apps/mobile/src/features/sync/__tests__/no-secure-store.test.ts` scans every file under
`src/features/sync/` for the module specifiers `expo-secure-store` and `expo-crypto`, mirroring the
same guard item #6 built for its package. AC29 is asserted separately and end-to-end: run a full
sync with a recognisable sentinel string in a fake secure store and in the fake runner's traces,
then dump every column of every table and assert the sentinel appears nowhere.

Cancellation is the runner's: the engine forwards an optional `AbortSignal` and then handles
whatever outcome comes back. `outcome === 'cancelled'` is a stored-partial plus an `idle`
connection (Decision 8), never a failure.

### Decision 17 — A third Jest project for the feature tier

*(Testing Strategy; `apps/mobile/jest.config.js`.)*

`jest.config.js` has two projects: `app` (`jest-expo`, ignoring `src/db`) and `db`
(`testEnvironment: 'node'`, matching `src/db/**/*.test.ts`). Sync-engine tests need `better-sqlite3`
and no React Native module mocks, exactly like the `db` tier. A third project `sync` is added
(`testEnvironment: 'node'`, matching `src/features/sync/**/*.test.ts`), and
`<rootDir>/src/features/sync/` is added to the `app` project's `testPathIgnorePatterns`. Both halves
are required: adding the project without the ignore makes every sync test run twice, once under a
preset that cannot load the native driver.

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **No migration, no schema change.** Every column this item writes exists
      (`user_financial_institutions.sync_status` / `last_sync_at` / `last_success_at` /
      `last_error_code` / `last_error_message`; `user_financial_products.*`; `transactions.*`).
      `schema.ts` changes only in a doc comment, to restate the `dedup_hash` input.
- [ ] `apps/mobile/src/db/dedup.ts` — add `DEDUP_INPUT_VERSION`, extend `DedupInputRow` with
      `direction` and `occurrenceIndex`, extend `buildDedupInput` per Decision 1, and add the pure
      `assignOccurrenceIndexes(rows): number[]` per Decision 2.
- [ ] `apps/mobile/src/db/repositories/transactions.ts` — split the shipped upsert into
      `prepareBankTransactions(userFinancialProductId, rows, ports)` (async, Phase A) and
      `writeBankTransactionsInTx(tx, userFinancialProductId, prepared, now, enricher)` (sync, Phase B,
      accepts an optional `MovementEnricher` used on the insert branch only); keep
      `upsertBankTransactions` as the wrapper that opens its own transaction, now returning
      `BankTransactionWriteCounts`. Add `MovementValidationError`. Add `isPesoDenominated` to
      `totalForCategoryInPeriod`'s `WHERE`.
- [ ] `apps/mobile/src/db/repositories/products.ts` — **new**. `BankProductInput`,
      `listProductIdsByExternalId(db, userFinancialInstitutionId)` (Phase A's id resolution) and
      `upsertBankProductsInTx(tx, userFinancialInstitutionId, products, productIdByExternalId, now)`
      returning `{ discovered, refreshed }`. Refreshes `type`, `name`, `currency_code`, `metadata`
      (through `mergeProductMetadata`, so the money guards run) and `updated_at`. Ids are never
      generated inside the transaction — they arrive reserved from Phase A. No delete path.
- [ ] `apps/mobile/src/db/repositories/institutions.ts` — add `SyncConnection` reads
      (`getConnection`, `listSyncableConnections`) and the four writes `markConnectionSyncing`,
      `recordSyncOutcomeInTx`, `recordSyncOutcome` (standalone, for Decision 6's failure branch) and
      `clearStuckSyncingConnections`. `disconnectInstitution` is unchanged.
- [ ] `apps/mobile/src/db/repositories/merchants.ts` — add `loadMerchantMatchingSet(db)` returning
      `{ merchants: Merchant[]; aliases: MerchantAlias[] }` in `@finanzas/shared-domain` shapes,
      with `isUserDefined = user_id !== null`.
- [ ] `apps/mobile/src/db/repositories/sync.ts` — **new**. `applySyncWrite(db, ports, input)`: the
      whole Phase A/Phase B sequence of Decision 5, returning `SyncWriteResult`.
- [ ] `apps/mobile/src/db/fragments.ts` — add `isPesoDenominated` (Decision 15).
- [ ] `apps/mobile/src/db/checks/peso-total-scan.ts` — **new**, `findUnguardedPesoTotals(source,
      filePath)`.
- [ ] `apps/mobile/src/db/types.ts` — add `SyncConnection`, `ConnectionSyncRecord`,
      `BankProductInput`, `BankMovementInput`, `SyncWriteInput`, `SyncWriteResult`,
      `BankTransactionWriteCounts`. `SupportedCurrency` stays `'CLP'`; movement currency is a plain
      `string`, because the store must accept what the read stated (AC22).
- [ ] **Seed data: none.** Products, movements and connections are discovered by a sync and are
      never seeded — see [Seed Data](#seed-data).

### Backend / API

- [ ] **None — there is no backend.** The engine's input is a result produced on the device and its
      output is rows in the device's own store. Nothing in this item opens a socket. See the spec's
      Escalation check.

### Shared Packages / Libraries

- [ ] `packages/shared-utils/src/dates.ts` — add `canonicalInstantForDateLocal(dateLocal)`
      (Decision 14). Additive; no existing export changes.
- [ ] `packages/shared-domain` — **not modified.** `resolveMerchant` and `suggestCategory` are
      consumed as they are.
- [ ] `packages/bank-scraper` — **not modified.** Consumed type-only (Decision 16).

### Application — the headless feature module

All of these are new, under `apps/mobile/src/features/sync/` (the first folder under
`src/features/`). None of them imports `drizzle-orm`, `expo-sqlite`, `better-sqlite3`,
`expo-secure-store` or any React module; the database is reached only through
`src/db/repositories/*`, and `@finanzas/bank-scraper` is imported type-only (Decision 16).

- [ ] `types.ts` — `ScraperRunner` (Decision 16), `SyncDeps`
      (`{ db, ports, runner, ready }`), `SyncRequest`, `SyncRunResult` and `SyncSummary`. The
      summary is the spec's Operational Visibility list, exactly:
      `{ productsDiscovered, productsRefreshed, movementsStored, movementsAlreadyKnown,
      foreignCurrencyMovementsStored, failedProductInstanceIds }`. `SyncRunResult` is
      `{ status: 'completed'; summary; connectionState }` or
      `{ status: 'refused'; reason: 'read_in_progress' }`. The summary is returned, never
      persisted (spec Decision 12).
- [ ] `sync-lock.ts` — `acquireReadLock`, `isReadInProgress`, `__resetReadLockForTests`
      (Decision 13).
- [ ] `auto-sync.ts` — `AUTOMATIC_SYNC_INTERVAL_MS`, `isDueForAutomaticSync`,
      `selectConnectionsDueForAutomaticSync` (Decision 12). Pure; takes no database handle.
- [ ] `map-read-result.ts` — pure mapping from `ScrapeResult` to `SyncWriteInput`: product and
      movement field mapping, `occurred_at` derivation via `canonicalInstantForDateLocal`
      (Decision 14), `extras` → `metadata`, the `foreignCurrencyMovementsStored` tally, plus
      `selectFailureReason`, `SYNC_FAILURE_PRECEDENCE` and `composeFailureMessageKey`
      (Decision 9) and the connection record each outcome implies (Decision 8).
- [ ] `sync-engine.ts` — `runSync(deps, request)`: await `deps.ready`, acquire the lock, load the
      connection, `markConnectionSyncing`, run the injected scraper, map the result, call
      `applySyncWrite`, release the lock in `finally`. Catches `MovementValidationError` and a
      runner rejection into the standalone failure-record branch (Decisions 5, 6, 13).
- [ ] `app-open.ts` — `runAppOpenSync(deps)`: `clearStuckSyncingConnections` first, then
      `selectConnectionsDueForAutomaticSync`, then `runSync` per connection in sequence
      (Decisions 11, 12).
- [ ] `index.ts` — the feature barrel: `runSync`, `runAppOpenSync`, the types, and nothing else.

### Frontend / UI

- [ ] **None.** This item renders nothing, adds no route, no screen state and no i18n catalogue
      entry. `composeFailureMessageKey` returns catalogue *keys* for the bank detail screen item to
      resolve later; it does not add the entries. No mockup screen is implemented here.

### Infrastructure / Configuration

- [ ] `apps/mobile/jest.config.js` — third project `sync` plus the matching `app`
      `testPathIgnorePatterns` entry (Decision 17).
- [ ] No new dependency, no lockfile change, no CI workflow change.

### Executable workflow shell snippets

- [ ] **None.** This plan adds no executable shell guidance to a framework-owned surface; the
      commands it names are existing `pnpm` scripts run verbatim.

---

## Concurrency Safety Checklist

The classifier applies: the app-open sweep, an explicit "Sincronizar ahora", the scraper's own
async callbacks and a cancellation can all be in flight against the same module-level lock and the
same connection row.

- **Shared mutable state guards** — the only shared mutable state is
  `sync-lock.ts`'s `activeConnectionId`. It is module-private, mutated only by `acquireReadLock` and
  the release handle, and JavaScript's single-threaded event loop makes the
  test-and-set in `acquireReadLock` atomic (no `await` between the read and the write — this is
  stated as a code requirement, and the test that proves it starts two `runSync` calls without
  awaiting the first). Database state is guarded by the single transaction (Decision 5).
- **Re-entrancy / in-flight tracking** — yes, a second request can arrive mid-read: that is AC28.
  In-flight state is the lock; the second request is refused without a write and without disturbing
  the first (Decision 13).
- **Event deduplication** — the app-open sweep is the one event that can fire more than once (fast
  background/foreground cycling). `runAppOpenSync` acquires the lock per connection, so a second
  sweep that overlaps the first finds the lock held and skips; it also re-reads each connection row
  immediately before deciding, so a connection the first sweep just finished is no longer due.
- **Listener and resource cleanup** — this feature registers no listener and no timer. The
  scraper's WebView, its message handler and its teardown are owned by the runner and by item #6's
  `finalize()`. The engine's own cleanup is the `finally` that releases the lock, which runs on
  success, failure, refusal and throw.
- **Race conditions at initialization** — a sync requested before `ensureDatabaseReady()` resolves
  would query tables that may not exist. `runSync` therefore awaits the caller-supplied
  `deps.ready` promise before touching the database. That promise is whatever the app shell got
  back from its own `ensureDatabaseReady(deps)` call: `src/db/bootstrap.ts` keeps its single-flight
  promise module-private and returns it from that function, so the caller holds it and this feature
  does not re-derive it.
- **Race conditions at teardown** — a result that arrives after cancellation is item #6's problem
  and it already drops it (`isFinalized()` guard). On this side, a cancelled read still returns a
  `ScrapeResult`, so the engine has exactly one code path: store what was gathered, set `idle`. There
  is no "the promise never settles" branch to leak the lock, because the runner's read deadline
  (`READ_DEADLINE_MS`) guarantees settlement; the engine additionally releases the lock in `finally`
  if the runner rejects.
- **Error propagation across async boundaries** — a rejection from `ScraperRunner.run` is caught and
  mapped to a `network` failure record rather than being swallowed, because a runner that throws has
  not produced a `ScrapeResult` and the connection must not be left `syncing`. The caught error's
  message is **never** stored (Decision 9): only the code-derived message key is. `runSync` never
  returns a rejected promise for an expected outcome; it rejects only for a programming error
  (unknown connection id), which the tests assert.
- **New concurrent patterns** — the module-level lock is the first in this codebase. It is
  deliberately not a queue: spec Decision 11 says one read at a time and one bank in the MVP, so a
  refusal is the correct behaviour, not a wait. `__resetReadLockForTests()` is exported for the same
  reason `__resetBootstrapForTests` exists.

---

## Testing Strategy

**Test types**: Unit (pure functions), integration (repositories and the engine against
`better-sqlite3` in memory), smoke (command-line runbook). No device, no simulator, no network.

### Test files

| File | Tier | Covers |
| --- | --- | --- |
| `apps/mobile/src/db/__tests__/dedup.test.ts` (new) | `db` | Decisions 1-2: input composition, occurrence-index assignment, reordering invariance |
| `apps/mobile/src/db/__tests__/transactions.test.ts` (extended) | `db` | AC1-AC6, AC15, AC21, AC22; existing item #3 cases keep passing unchanged |
| `apps/mobile/src/db/__tests__/products.test.ts` (new) | `db` | AC7, AC8 |
| `apps/mobile/src/db/__tests__/sync-write.test.ts` (new) | `db` | AC9, AC14, AC15 — atomicity and rollback |
| `apps/mobile/src/db/__tests__/connections-sync.test.ts` (new) | `db` | AC10-AC13, AC26 |
| `apps/mobile/src/db/__tests__/enrichment.test.ts` (new) | `db` | AC16-AC20 |
| `apps/mobile/src/db/checks/__tests__/peso-total-scan.test.ts` (new) | `db` | The scanner's own edge cases (below) |
| `apps/mobile/src/db/__tests__/peso-total-guard.test.ts` (new) | `db` | The scanner over the real tree |
| `apps/mobile/src/features/sync/__tests__/sync-engine.test.ts` (new) | `sync` | End-to-end per read outcome; AC29, AC30 |
| `apps/mobile/src/features/sync/__tests__/auto-sync.test.ts` (new) | `sync` | AC24, AC25, AC27 — table-driven |
| `apps/mobile/src/features/sync/__tests__/sync-lock.test.ts` (new) | `sync` | AC28 |
| `apps/mobile/src/features/sync/__tests__/app-open.test.ts` (new) | `sync` | AC24, AC26, AC27 in sequence |
| `apps/mobile/src/features/sync/__tests__/no-secure-store.test.ts` (new) | `sync` | Decision 16's module-specifier scan |
| `packages/shared-utils/src/dates.test.ts` (extended) | package | Decision 14's round-trip property |

### Scenario-to-criterion map

| # | Scenario | Criterion |
| --- | --- | --- |
| 1 | A recorded complete read against an empty store stores every product and movement with the reported amount, direction, currency, day and description | AC1 |
| 2 | The same recorded read applied twice: product count, movement count and `movementsStored` summary field | AC2 |
| 3 | Categorize / note / review-flag / exclude / attach a merchant, replay, compare all nine person-owned columns byte-for-byte | AC3 |
| 4 | Replay with a restated amount, direction and day; bank columns move, person columns do not | AC4 |
| 5 | Two identical coffees in one read → 2 rows; replay → still 2; a charge and its identically-described refund → 2 rows; replay → still 2 | AC5 |
| 6 | The same read shuffled (including `positionInReadSnapshot` renumbered) stores nothing new | AC6 |
| 7 | A read with two `checking` products under one connection → 2 product rows, both re-matched on replay | AC7 |
| 8 | A second read that omits a previously stored product leaves it and its movements | AC8 |
| 9 | `outcome: 'failed'` with empty `products`/`movements`: a full column dump before and after is identical | AC9 |
| 10 | After that failed read: `sync_status`, `last_sync_at`, `last_success_at`, `last_error_code` | AC10 |
| 11 | `outcome: 'partial'` with two products read and one `productFailures` entry | AC11 |
| 12 | After `complete`: `ok`, `last_success_at === last_sync_at`, error columns null | AC12 |
| 13 | After `cancelled`: gathered rows present, `idle`, no failure recorded, `last_success_at` unchanged | AC13 |
| 14 | A driver stub that throws on the third `INSERT`: no product, no movement, no connection column changed | AC14 |
| 15 | Amounts `1500.5`, `-1500`, `0`, `NaN`: nothing stored, `last_error_code = 'parse_failed'` | AC15 |
| 16 | A description matching a seeded merchant alias → merchant set, category set, `category_source = 'auto'` | AC16 |
| 17 | The same description when the matching merchant has `user_id` set → `category_source = 'rule'` | AC17 |
| 18 | A description matching nothing → no merchant, no category, and `countUncategorized` includes it | AC18 |
| 19 | Store an unmatched movement, create a matching merchant and alias, replay → still no merchant and no category | AC19 |
| 20 | Set `category_source = 'user'` on a row, replay every fixture read → the set of `user` rows is unchanged | AC20 |
| 21 | Replay every fixture read over a populated store → excluded-row set and total row count never shrink | AC21 |
| 22 | A `USD` movement stores `currency_code = 'USD'` with the stated amount, and does not enter `totalForCategoryInPeriod` | AC22, Decision 15 |
| 23 | The whole suite run under `TZ=Pacific/Auckland` and `TZ=America/Anchorage`: stored `date_local` equals the read's, and `occurred_at` round-trips | AC23, Decision 14 |
| 24 | Connections at 5h59m and 6h01m since last success, both with old attempts | AC24 |
| 25 | `last_error_code = 'invalid_credentials'`: not swept, but an explicit request runs | AC25 |
| 26 | A row left at `syncing` with the lock free: reset to `idle` before the sweep decides | AC26 |
| 27 | `inactive` and `disconnected` connections are never swept | AC27 |
| 28 | Two overlapping `runSync` calls, same connection and different connections: one read, one refusal, no record change | AC28 |
| 29 | A sentinel credential in the fake secure store and in the runner's traces; dump every column of every table afterwards | AC29 |
| 30 | A read whose `traces` and `productFailures` carry bank-flavoured text: `last_error_message` is one of the four keys | AC30 |

### Parser-risk addendum

The classifier applies to exactly one new module: `apps/mobile/src/db/checks/peso-total-scan.ts`
is a regex-and-scan rule over TypeScript source text, living beside the existing
`inclusion-rule-scan.ts`. The rest of this item is not parser work.

**What the scanner does.** Over comment-stripped source (reusing the same comment-stripping
approach as the shipped scanner), it reports every file that contains a `sum(` applied to
`includedAmount` inside an `sql` tagged template, unless the same file also names
`isPesoDenominated`. Allowlist: `src/db/fragments.ts` (the definition),
`src/db/checks/peso-total-scan.ts` (its own rule text) and its own test file — hard-coded by path
suffix, so no source file can add itself.

**Edge-case enumeration and unit test mapping**
(`apps/mobile/src/db/checks/__tests__/peso-total-scan.test.ts`):

| # | Input | Expected | Test name |
| --- | --- | --- | --- |
| 1 | `sum(${includedAmount})` in a file with no `isPesoDenominated` | one finding, correct line | fires on the real violation |
| 2 | The same file plus `isPesoDenominated` in the `WHERE` | no finding | does not over-fire on a guarded total |
| 3 | `sum(` and `includedAmount` on the same line **twice** | two findings, two distinct lines/offsets | multiple occurrences on one line |
| 4 | `// sum(${includedAmount})` and the same inside a block comment | no finding | comments are stripped |
| 5 | The literal string `'sum(includedAmount)'` inside a plain quoted string, outside any `sql` tag | no finding | negative lookalike outside a tagged template |
| 6 | `coalesce(sum(${includedAmount}), 0)` — the real shipped spelling, nested calls | one finding | nested call wrapping |
| 7 | A nested `sql` tag inside a `${…}` interpolation containing the sum | one finding, attributed to the nested tag's line | nested tagged templates |
| 8 | `count(${includedAmount})` and `avg(${includedAmount})` | no finding | only summation is guarded (a count of a dollar row is legitimate) |
| 9 | `SUM(` upper-case and `sum (` with a space | one finding each | case and whitespace variants |
| 10 | An allowlisted path containing every violating form | no finding | allowlist by path suffix |
| 11 | Empty file, and a file with an unterminated template literal | no finding, no throw | degenerate inputs terminate |

**Suppression semantics**: none. This scanner recognises **no** inline suppression directive, for
the same reason the inclusion-rule scanner recognises none — a suppression comment is exactly the
mechanism by which a dollar would re-enter a peso total. The only escape is the hard-coded
allowlist, which is a reviewed code change.

**Interaction with the shipped inclusion-rule scanner (a real trap).**
`inclusion-rule-scan.ts` Rule C flags the snake_case literals `excluded_at` and `included_amount`
anywhere in a non-allowlisted file. `peso-total-scan.ts` and its tests must therefore express
everything in the camelCase identifiers `includedAmount` / `isPesoDenominated` and never write the
snake_case spellings — otherwise the new file trips the old scanner. The alternative (adding two
more paths to `inclusion-rule-scan.ts`'s allowlist) weakens a shipped guarantee and is rejected.

### Residual verification strategy

This is not a sweep, but it does make a completeness claim ("no peso total sums a dollar"). The
evidence the implementation must produce before `ready-for-human-review`:

- `apps/mobile/src/db/__tests__/peso-total-guard.test.ts` output, which enumerates the scanned files
  and asserts a non-vacuous scan (at least one file found), exactly as
  `inclusion-rule-single-definition.test.ts` does.
- A planted-defect proof in the PR description: add `sum(${includedAmount})` to a throwaway
  repository function, run the guard test, confirm it fails and names the file and line, revert, and
  confirm `git diff --stat` is empty.
- The counterpart claim for the TypeScript side is **not** made by this item; it is carried as a
  named obligation in [Cross-item obligations](#cross-item-obligations).

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Recorded reads | `read-complete.json`, `read-repeat-shuffled.json`, `read-duplicates.json` (two identical coffees plus a charge/refund pair), `read-partial.json`, `read-failed.json`, `read-cancelled.json`, `read-foreign-currency.json`, `read-bad-amount.json`, `read-missing-product.json` — each a whole `ScrapeResult` | `apps/mobile/src/db/__fixtures__/reads/` (new folder) |
| Merchants and aliases | **None added.** The starter catalogue already seeds a merchant with a default category (`lider` → `supermercado`) and one with no category; the person-created case is built in-test by inserting a merchant with `user_id` set | `apps/mobile/src/db/seeds/catalogue.ts` (unchanged) |
| Connections and products | **None.** A connection is created by the connect flow and a product is discovered by a sync — neither is ever seeded. Tests build them with the existing `createTestConnection` / `createTestProduct` helpers | `apps/mobile/src/db/testing/product-fixture.ts` (unchanged) |
| Committed store snapshot | **Unchanged.** `store-v1.sql` and `build-fixture.ts` use literal `dedup_hash` values, so the identity change does not regenerate the fixture (Verification Log) | `apps/mobile/src/db/__fixtures__/store-v1.sql` |

The read fixtures are hand-written from item #6's contract, not captured from a bank: they contain
no real account data, no real description and no credential.

---

## Documentation Updates

To be performed by the developer during implementation, not now.

- [ ] `docs/project/4-database-model.md` — three edits: the `transactions.dedup_hash` row's formula
      becomes Decision 1's `v2` input (direction and occurrence index added); the
      `user_financial_products.external_id` row says the scraper's **opaque instance identity**
      rather than `Product.financialProductId` (spec Conflict 3); the
      `user_financial_institutions` section gains Decision 8's exit table and Decision 12's
      eligibility predicate, including the last-attempt half of the interval.
- [ ] `docs/project/1-business-domain.md` — non-negotiable 4 ("Re-syncing is idempotent") gains the
      two identity guarantees: direction is part of a movement's identity, and N indistinguishable
      movements in one read stay N.
- [ ] `docs/project/3-software-architecture.md` — add the sync feature to the layering section:
      `app/ → features/sync → src/db → SQLite`, with the scraper as an injected port and no
      credential in the engine.
- [ ] `docs/best-practices/stack/sqlite-drizzle.md` — the upsert example still shows the two-route
      lookup; update its dedup-input description to the `v2` input and add the enrichment-on-insert
      rule.
- [ ] `docs/best-practices/STACK-SPECIFIC.md` — the "repository's upsert keyed on
      `(user_financial_product_id, external_id)` / `dedup_hash`" sentence gains direction and
      occurrence index.
- [ ] `docs/best-practices/4-database.md` — same one-line correction to the dedup fallback
      description.
- [ ] `AGENTS.md` — four edits: the repository tree gains `features/sync/`; the test command comment
      says three Jest projects (`app`, `db`, `sync`); the "Duplicate movements after a sync"
      troubleshooting row names the extended identity; a new troubleshooting row for a
      foreign-currency movement appearing in a peso total, pointing at `isPesoDenominated`.
- [ ] `CLAUDE.md` — no separate edit; it is a symlink to `AGENTS.md`.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A dependency (PR #46 / #44) merges with a different contract than this plan encodes | Medium | High | Protocol 03's implementation-start re-verification re-reads all four assumption rows before the first edit; a mismatch stops the run rather than being adapted around |
| The occurrence-index change is subtly wrong and duplicates on a real reordered read | Low | High | AC5 and AC6 are tested from both directions (duplicates fixture and shuffled fixture), and `assignOccurrenceIndexes` is unit-tested as a pure function independently of SQLite |
| A future writer bypasses `writeBankTransactionsInTx` and re-introduces person-column overwrites | Medium | High | The person-owned columns never appear in an update `set` object; the existing byte-for-byte replay test covers all nine plus `is_manual`, and `merchants.test.ts` already asserts no delete export exists |
| The three-project Jest change makes a tier run twice or not at all | Medium | Low | The implementation step verifies `pnpm --filter @finanzas/mobile test` prints all three project names and that the sync tests appear exactly once |
| A partial read stores half a product's movements and looks complete | Low | Medium | Storage is per read, not per product, inside one transaction; `productFailures` drives the connection state, never the write |
| The bank restates a description and the person sees a duplicate | Medium | Low | Accepted and documented by spec Deferral Note 2; nothing in this plan attempts to guess a restatement |
| A foreign-currency movement reaches a screen total before the aggregate item lands | Low | High | Decision 15 places the guard now and makes it mechanical; the remaining gap is the TypeScript twin, tracked as an explicit obligation |

---

## Assumptions taken in this plan

No human was available; these are resolved from the spec and the codebase and are listed so they
can be checked cheaply.

- **A1 — Crash recovery records the attempt time.** Decision 11. The spec says every exit from
  `syncing` writes the attempt time and separately says the recovered connection is then "eligible
  like any other"; recording the attempt makes it eligible in six hours rather than immediately. If
  wrong, a crash-on-sync loop re-reads the bank on every launch.
- **A2 — A stopped read does not clear an older failure.** Decision 10. If wrong, the bank detail
  screen loses a failure the person has not addressed yet.
- **A3 — `metadata.mask` stores the read's `maskedIdentifier` verbatim** (`••••1111`), with
  `card_brand`, `card_category` and `card_last4` alongside for cards. The data model's example shows
  bare digits; the read never reports anything but the masked form.
- **A4 — Metadata may swap between two indistinguishable movements.** When two movements in one
  group differ only in `extras`, which one holds which extras after a re-read is not stable.
  Nothing the person owns is affected, and no stored money value changes.
- **A5 — A movement whose product cannot be resolved is a defect**, treated as `parse_failed`
  (Decision 6), rather than being dropped silently.
- **A6 — `merchant_aliases.match_count` is not written by a sync.** It is a per-alias statistic the
  `merchant-edit/suggestions` screen shows; the item that owns that screen owns the counter. A sync
  that incremented it would be writing into a merchant-facing surface the spec does not name.
- **A7 — `last_error_message` stores an i18n key, not prose.** Decision 9. It keeps AC30 true by
  construction and leaves the wording to the item that renders it, as the spec's Statuses section
  requires.
- **A8 — The engine is invoked by a later item.** This item ships `runSync` and `runAppOpenSync` and
  wires neither into `app/_layout.tsx`: starting a real read needs the hidden WebView host, which is
  the connect-flow / syncing-screen item's surface. `app/_layout.tsx` today does not even call
  `ensureDatabaseReady`, so there is no existing app-open hook to extend without inventing one.

---

## Cross-item obligations

Carried explicitly, per spec Deferral Note 3, so they cannot be lost:

1. **The TypeScript twin of the peso guard.** `packages/shared-domain/src/aggregates.ts`
   (`summarizePeriod`, `buildCategoryBreakdown`) sums `Movement` values in TypeScript, and
   `Movement` has no currency field. The item that first renders a total from that path must add the
   field and the filter, mirroring `isPesoDenominated`. Until then the SQL side is guarded and the
   TypeScript side is not.
2. **What the person sees for a foreign-currency movement** — a separate line, a badge, or a
   converted figure — belongs to the dashboard/aggregates item. `summary.foreignCurrencyMovementsStored`
   exists so that item has a signal to build on.
3. **The four `sync.errors.*` catalogue entries** belong to the bank detail screen item; this item
   only writes the keys.
4. **A `ScraperRunner` implementation** belongs to the item that mounts the hidden WebView; this
   item defines and tests against the port.

---

## Code Samples

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/dedup.ts — Decisions 1 and 2.

export const DEDUP_INPUT_VERSION = 'v2';

export interface MovementIdentityFields {
  dateLocal: string;
  amount: number;
  direction: 'debit' | 'credit';
  rawDescription: string;
  externalId?: string | null;
}

/** Index of each row within its group of identity-identical rows, in the order given.
 * Order-independent in effect: group members are identical in every field the key names. */
export function assignOccurrenceIndexes(rows: readonly MovementIdentityFields[]): number[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const key = [
      row.dateLocal,
      String(row.amount),
      row.direction,
      row.rawDescription,
      row.externalId ?? '',
    ].join(DEDUP_INPUT_SEPARATOR);
    const next = seen.get(key) ?? 0;
    seen.set(key, next + 1);
    return next;
  });
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/repositories/sync.ts — Decision 5's two phases.

export async function applySyncWrite(
  db: AppDatabase,
  ports: DbPorts,
  input: SyncWriteInput,
): Promise<SyncWriteResult> {
  // Phase A — every await happens here, before the sync transaction opens.
  const now = ports.now();
  const productIdByExternalId = listProductIdsByExternalId(db, input.userFinancialInstitutionId);
  for (const product of input.products) {
    if (!productIdByExternalId.has(product.externalId)) {
      productIdByExternalId.set(product.externalId, ports.newId()); // reserved, inserted in Phase B
    }
  }
  const preparedByProductId = new Map<string, PreparedBankTransaction[]>();
  for (const [productExternalId, rows] of groupByProduct(input.movements)) {
    const productId = productIdByExternalId.get(productExternalId);
    if (productId === undefined) throw new MovementValidationError('unresolved_product');
    preparedByProductId.set(productId, await prepareBankTransactions(productId, rows, ports));
  }

  // Phase B — one transaction, no await, one commit (AC14).
  let result: SyncWriteResult;
  db.transaction((tx: AppDatabase) => {
    const products = upsertBankProductsInTx(
      tx, input.userFinancialInstitutionId, input.products, productIdByExternalId, now,
    );
    const enricher = createMovementEnricher(loadMerchantMatchingSet(tx));
    let stored = 0;
    let known = 0;
    for (const [productId, prepared] of preparedByProductId) {
      const counts = writeBankTransactionsInTx(tx, productId, prepared, now, enricher);
      stored += counts.storedFirstTime;
      known += counts.alreadyKnown;
    }
    recordSyncOutcomeInTx(tx, input.userFinancialInstitutionId, input.connectionRecord);
    result = { productsDiscovered: products.discovered, productsRefreshed: products.refreshed,
      movementsStored: stored, movementsAlreadyKnown: known };
  });
  return result!;
}
```

```sql
-- Illustrative — adapt during implementation.
-- Decision 15: the third fragment, and the one aggregate that already exists.
-- isPesoDenominated  ->  transactions.currency_code = 'CLP'
```

---

## Implementation Order

1. **Gate**: confirm PR #46 and PR #44 are merged into `develop` and re-run the four rows of the
   Cross-Cutting Operational Assumption Check against `develop`. Stop and escalate on any mismatch.
2. `packages/shared-utils/src/dates.ts` — add `canonicalInstantForDateLocal` plus its round-trip
   test. Verify: `pnpm --filter @finanzas/shared-utils test` passes.
3. `apps/mobile/src/db/dedup.ts` — the `v2` input and `assignOccurrenceIndexes`, with
   `apps/mobile/src/db/__tests__/dedup.test.ts`. Verify: the new test passes and the reordering case
   is asserted.
4. `apps/mobile/src/db/repositories/transactions.ts` — split into `prepareBankTransactions` /
   `writeBankTransactionsInTx`, keep the public wrapper, add `MovementValidationError`. Verify:
   item #3's existing `transactions.test.ts` cases pass **unchanged** before any new case is added.
5. Extend `transactions.test.ts` with the identity scenarios (AC5, AC6) and the money-defect
   scenario (AC15).
6. `apps/mobile/src/db/repositories/products.ts` + `products.test.ts` (AC7, AC8).
7. `apps/mobile/src/db/repositories/merchants.ts` — `loadMerchantMatchingSet`; then enrichment on
   the insert branch + `enrichment.test.ts` (AC16-AC20).
8. `apps/mobile/src/db/repositories/institutions.ts` — the connection reads and the four writes +
   `connections-sync.test.ts` (AC10-AC13, AC26).
9. `apps/mobile/src/db/repositories/sync.ts` — `applySyncWrite` + `sync-write.test.ts` (AC9, AC14).
10. `apps/mobile/src/db/fragments.ts` — `isPesoDenominated`; apply it in
    `totalForCategoryInPeriod`. Verify: the existing AC20 total test still returns `63000`.
11. `apps/mobile/src/db/checks/peso-total-scan.ts` + its two test files. Verify: the eleven
    enumerated edge cases pass, and the planted-defect proof fires and is reverted cleanly.
12. `apps/mobile/jest.config.js` — the third project and the `app` ignore entry. Verify:
    `pnpm --filter @finanzas/mobile test` lists `app`, `db` and `sync`, and no sync test runs twice.
13. `apps/mobile/src/features/sync/` — `types.ts`, `sync-lock.ts`, `auto-sync.ts`,
    `map-read-result.ts`, `sync-engine.ts`, `app-open.ts`, `index.ts`, with their five test files
    (AC24-AC30).
14. Run the whole suite under two non-Santiago time zones (AC23):
    `TZ=Pacific/Auckland pnpm --filter @finanzas/mobile test` and
    `TZ=America/Anchorage pnpm --filter @finanzas/mobile test`.
15. Run `pnpm lint`, `pnpm typecheck`, `pnpm --filter @finanzas/mobile db:check` and `pnpm test`.
16. Walk the smoke runbook end to end and update it with anything that turned out to be wrong.
17. Update the project docs listed in [Documentation Updates](#documentation-updates).
18. Add the `CHANGELOG.md` entry under `[Unreleased]`, verbatim:

    ```markdown
    - **Sync engine** (#10): a bank read is stored idempotently — products by the scraper's opaque
      instance identity, movements by an identity that now carries direction and an occurrence index,
      so two identical movements in one read stay two and a re-read adds none. The person's
      category, note, review flag, exclusion and merchant are never written by a sync. Each sync is
      one indivisible write and updates the connection's own record of its last attempt, last
      success and last failure.
    ```

---

## Document Quality Gate

- Spec/brief coverage: Checked — AC1-AC30 each map to a numbered scenario in the
  scenario-to-criterion map and to a named test file; the four Documented Conflicts are resolved by
  Decisions 1-4 and 15.
- Implementation-order consistency: Checked — every file named in Layer-by-Layer appears in the
  Implementation Order in an executable order, and every helper name
  (`prepareBankTransactions`, `writeBankTransactionsInTx`, `upsertBankProductsInTx`,
  `listProductIdsByExternalId`, `applySyncWrite`, `loadMerchantMatchingSet`, `assignOccurrenceIndexes`,
  `canonicalInstantForDateLocal`, `isPesoDenominated`, `isDueForAutomaticSync`,
  `selectFailureReason`, `composeFailureMessageKey`, `clearStuckSyncingConnections`,
  `acquireReadLock`) is spelled identically in the Decisions, the Layer-by-Layer list, the Code
  Samples and the Implementation Order. Two inconsistencies were found by this gate and fixed
  before the PR was opened: Phase A had no way to know a brand-new product's id before hashing
  (resolved by `listProductIdsByExternalId` plus id reservation), and the feature-module files
  appeared only in the Implementation Order (resolved by the
  [Application layer](#application--the-headless-feature-module) subsection, which also pins the
  `SyncSummary` shape to the spec's Operational Visibility list).
- Verification support: Checked — every claim about existing behaviour (one `buildDedupInput`
  caller, literal fixture hashes, no delete path, absent `features/` folder, the two dependency
  contracts) cites a Verification Log command and its result.
- Behavioural guarantees: Checked — idempotency is enforced by the identity function plus the
  two-route lookup (Decisions 1-3); atomicity by the single synchronous transaction with all awaits
  hoisted (Decision 5); "at most one read" by the module-level lock with no await between test and
  set (Decision 13); "never fewer, never the sum" by the counting argument in Decision 3.
- Complex workflow decision-gate matrix: Not applicable — this plan changes no workflow protocol,
  no review gate and no tracker-status behaviour. Its only tabulated gate, the connection exit
  table in Decision 8, is product behaviour and is covered by AC10-AC13 and AC26.
- Parser/API/concurrency checklist: Checked — parser-risk applies to `peso-total-scan.ts` and has
  an eleven-case enumeration mapped to one named unit test file plus an explicit no-suppression
  rule; concurrent-event-source applies and all seven items are answered.
- CHANGELOG literal format: Checked — the Implementation Order's literal uses
  `**Bold Title** (#N):` and is not added on this plan branch.
- Not-applicable rationale: Checked — the cross-cutting checklist block is skipped because this
  plan adds no safety/quality/compliance category to `REVIEW.md` or to any protocol; the executable
  shell snippet block is skipped because no framework-owned shell guidance is added.
