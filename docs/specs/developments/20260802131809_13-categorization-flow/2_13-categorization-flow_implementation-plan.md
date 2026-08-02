# Categorization flow — Implementation Plan

**Spec**: [`1_13-categorization-flow_specs.md`](1_13-categorization-flow_specs.md)
**Smoke test runbook**: [`../../../testing/mobile/13-categorization-flow.smoke-test.md`](../../../testing/mobile/13-categorization-flow.smoke-test.md)
**Work item**: #13 · **Depends on**: #2 (merged), #5 (PR #44, open), #10 (spec merged, not implemented), #47 (plan merged, implementation on another lane)

---

## Summary

**Approach**: Three routes that already exist as `RoutePlaceholder`s
(`app/categorize/intro.tsx`, `app/categorize/index.tsx`, `app/categorize/complete.tsx`) become
thin compositions over a new `apps/mobile/src/features/categorization/` folder. The feature
folder holds the pure stage logic (batch selection, chip ordering, progress, completion
counters), the presentational components composed from the shipped `src/components/ui`
primitives, and the TanStack Query hooks that are the only thing allowed to touch
`apps/mobile/src/db`. Seven new functions land in `src/db` — one queue read, one usage read,
one aggregate read, one counter, and three person-owned writes (category, deferral mark,
exclusion). Every user-facing string moves into the `es` / `en` catalogues under three new key
namespaces. All seven MVP states of the three screens render; `categorize&state=advanced` is
absent, and a guard test proves it, together with the fact that no path in this feature writes
`included_amount`.

**Estimated complexity**: L

**Rationale**: Three screens, seven render states, seven new `src/db` exports, ~70 catalogue
keys, a device fixture, and the first flip of fidelity targets from `planned` to `wired`. No
single piece is hard; the volume and the number of contracts that have to stay simultaneously
true (mockup fidelity, inclusion rule, layering lint, i18n lint, `mu-class` ownership) is what
makes it large. It is also the first item that renders real device data through React, so it
inherits the provider seam described in Decision 16.

**Dependencies**:

| Item | What this plan needs from it | State at plan time |
| --- | --- | --- |
| #2 — design system | `Steps`, `CategoryChip`, `Sheet`, `Radio`, `Progress`, `Card`, `Button`, `Note`, `TextField`, `Amount`, `Badge`, `Text` | Merged |
| #5 — shared-domain | `suggestCategory({ currentCategorySource, merchant })` from `@finanzas/shared-domain` | PR #44 open — **hard blocker** |
| #10 — sync engine | Real movements on the device; the guarantee that a re-sync never overwrites a person-owned column | Spec merged only. The persistence guarantee already exists in shipped code — see Decision 5 |
| #12 — home screen | `src/providers/DatabaseProvider.tsx`, `src/providers/QueryProvider.tsx`, `@tanstack/react-query`, the `app/_layout.tsx` wrap | PR #56 (plan) open — see Decision 16 for the precedence rule |
| #47 — design-fidelity gate | `scripts/mobile-ui/fidelity-targets.json`, `apps/mobile/src/lib/fidelity-preview.ts`, `pnpm fidelity` | Plan merged; implementation on another lane — see Decision 14 |

---

## Verification Log

Every command below was run in the worktree `.claude/worktrees/item-13` on branch
`implementation-plan/13-categorization-flow`.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `4fc495a` (identical to `origin/develop` at plan time) |
| `mu-*` classes each screen draws, and their ownership status | Python scan of `design/mockups/mobile/index.html` sections `s-stage-intro`, `s-categorize`, `s-categorize-complete`, cross-referenced against `apps/mobile/src/test-utils/mu-class-map.ts` | `stage-intro` 26 classes, 3 `deferred` (`mu-topbar`, `mu-topbar__btn`, `mu-topbar__title`); `categorize` 56 classes, 10 `deferred` (the three topbar classes plus `mu-list`, `mu-item`, `mu-item__icon`, `mu-item__txt`, `mu-item__title`, `mu-item__sub`, `mu-item__chev`); `categorize-complete` 24 classes, 0 `deferred` |
| Existing `transactions` repository surface | `grep -n "^export function\|^export async function" apps/mobile/src/db/repositories/transactions.ts` | 5 exports: `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`. No pending-queue read and no person-owned write exists yet |
| Whether anything writes `included_amount` today | `grep -rn "includedAmount\|included_amount" apps/mobile/src/db` (excluding `__tests__/` and `checks/`) | Read-only: the column declaration (`schema.ts:212`), the `includedAmount` SQL fragment (`fragments.ts:21`), the row mapping (`repositories/transactions.ts:51,77`), the domain type (`types.ts:60`). It never appears in a Drizzle `.set()` or `.values()` object |
| Pending movements in the committed device fixture | Parse of `apps/mobile/src/db/__fixtures__/store-v1.sql` for rows with `transaction_category_id IS NULL AND excluded_at IS NULL` | 2 pending of 13 movements, **all `debit`** — no pending income, so the `income` state is unreachable from this fixture (drives Decision 15) |
| Seeded taxonomy sizes | `theme.categoryIcons` in `apps/mobile/src/theme.ts`, mirrored by `src/db/seeds/catalogue.ts` | 10 expense slugs, 6 income slugs (`otros` emitted as `otros-gasto` / `otros-ingreso`) |
| React render-testing library availability | `grep -rn "testing-library" apps/mobile/package.json package.json` | Absent. Tests are pure functions plus static source scans (precedent: item #34 Decision 11, item #8 Decision 14) |
| Catalogue key rules | `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Flat dotted snake_case keys matching `^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$`; `es` and `en` key sets must be identical and every value a non-empty string |
| `#13` coverage set in the fidelity contract | Coverage-set table in [`../20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md`](../20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md) | Issue #13 owns `stage-intro`, `categorize`, `categorize-complete` = **7 targets**, all seeded as `status: "planned"` |
| Open pull requests at plan time (bounded same-surface scope) | `gh pr list --state open --json number,title,headRefName` | #44 `feature/5-shared-domain-…`, #46 `feature/6-port-bank-scraper-…`, #55 `implementation-plan/8-onboarding-…`, #56 `implementation-plan/12-home-screen` |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch and artifact owner | `develop`; this repository owns the plan (`mode` absent in `.ai-dev-workflow.yaml` ⇒ `single_repo`) | `.ai-dev-workflow.yaml` (no `mode` key, no `workflow_hub` block); `AGENTS.md` → Git & Branching | 2026-08-02, repo `4fc495a` | This invocation only; no other open PR changes the base-branch contract | `Verified` |
| Fidelity contract path, lifecycle vocabulary, preview helpers, and the #13 coverage set | `scripts/mobile-ui/fidelity-targets.json`; `status: "planned" \| "wired"`; a `wired` target must carry `app_file`, `deep_link`, `ready_test_id`; `apps/mobile/src/lib/fidelity-preview.ts` exports `useFidelityPreview()` and `fidelityTestId()`; #13 owns 7 targets | #47 implementation plan, merged on `develop` (Decisions 2, 6, 9 and the coverage-set table) | 2026-08-02, repo `4fc495a` | Same-surface open PRs: #55 (#8 coverage set) and #56 (#12 coverage set). Both touch `fidelity-targets.json` but own **disjoint** `screen_id` sets from #13's three screens | `Verified` |
| Ownership of the `__DEV__` sample-data route | `/(dev)/sample-data` and `src/dev/SampleDataPanel.tsx` belong to **#12** | #12 implementation plan, Decision 11 (PR #56) | 2026-08-02, repo `4fc495a` | Same-surface open PRs: #56 only | `Verified` — this plan neither creates nor modifies that route (Decision 15) |
| Ownership of the app-level database/query provider seam | `apps/mobile/src/providers/DatabaseProvider.tsx` (`useDatabase()`), `QueryProvider.tsx`, `index.ts`, `@tanstack/react-query`, and the `app/_layout.tsx` wrap belong to **#12** | #12 implementation plan, Decision 7 and its Layer-by-Layer "`apps/mobile/src/providers/`" block (PR #56) | 2026-08-02, repo `4fc495a` | Same-surface open PRs: #56 only. #55 (#8) builds static onboarding screens and declares no provider | `Verified` — precedence rule recorded in Decision 16; both plans name identical paths and symbols, so whichever lands first owns the files and the other consumes them unchanged |
| `mu-class` ownership for the classes these screens draw but no primitive owns | `mu-topbar*` stays `deferred` (note corrected to #8 by #12's plan); `mu-list` / `mu-item*` stay `deferred` to #19 | `apps/mobile/src/test-utils/mu-class-map.ts` at `4fc495a`; #8 plan Decision 12; #12 plan Decision 5 | 2026-08-02, repo `4fc495a` | Same-surface open PRs: #55 and #56, both of which explicitly leave these entries `deferred` | `Verified` — this plan leaves `MU_CLASS_MAP` unchanged (Decision 13) |
| `@finanzas/shared-domain` suggestion API | `suggestCategory({ currentCategorySource, merchant }): CategorySuggestion \| null`, returning `null` when `currentCategorySource === 'user'`, when there is no merchant, or when the merchant has no default category | `packages/shared-domain/src/category-suggestion.ts` on `origin/feature/5-shared-domain-rules-matching-aggregates` (PR #44, open) | 2026-08-02, PR #44 head | Same-surface open PRs: #44 only | `Verified` at plan time against an **open** branch. Implementation Order Step 0 re-verifies the signature after #44 merges and stops on a mismatch |

No conflict was found. Implementation Order Step 0 repeats the last three rows before any file
edit and records `Still valid` or `Stale or conflicting` in the implementation PR.

---

## Key Decisions

### Decision 1 — Routes stay thin; everything else lives in `src/features/categorization/`

`docs/best-practices/stack/expo-react-native.md` → *Screen structure*: *"A route file that
contains business logic or a SQL query is in the wrong place."* Each of the three route files
becomes an import plus a one-line render of a screen component. The `dbAccessBoundary` ESLint
rule and `src/db/__tests__/db-access-boundary.test.ts` already forbid a SQL import anywhere
outside `src/db/`, so the layering `app/ → feature hooks → src/db → SQLite` is machine-checked
on every file this item adds.

### Decision 2 — The stage session is React state inside the route subtree, never persisted

Spec Use Case 10: *"There is no 'resume this stage' concept in the MVP."*
`expo-react-native.md` → *Data fetching*: *"No global store. Session state (the current
categorization run …) is React Context scoped to its flow."* The session — the batch array, the
index, the pending selection, the resolved counter — is `useState` inside `CategorizeScreen`,
exposed to its children through a `StageSessionContext` in the same folder. Nothing is written
to `app_settings`. Leaving the flow unmounts the screen and the session is gone, which is
exactly the specified behavior (AC16).

Consequence for AC26: pushing `/categorize/merchant/[merchantId]` keeps `/categorize` mounted in
the Expo Router stack, so popping back restores the same movement, the same index and the same
unconfirmed selection with no extra machinery.

### Decision 3 — `STAGE_BATCH_SIZE = 10`, fetched once at stage start

Spec A1. The constant lives in `src/features/categorization/stage-batch.ts` and is the only
place the number appears. Reading the batch once — rather than re-querying after each decision —
is what makes AC4 ("no movement is offered twice within one stage") true by construction: a
skipped or deferred movement is still in the in-memory array but its index has already passed,
and a categorized or excluded movement leaves the queue in the database without changing the
array. No `excludeIds` parameter is needed anywhere.

### Decision 4 — Queue order is `date_local DESC, occurred_at DESC, id ASC`

Spec A3 requires "most recent first, with a deterministic tie-break". `date_local` is the
person's local day (spec Business Rule 9) and is the column the existing
`transactions_date_local_idx` is built on. `occurred_at` breaks a same-day tie by the bank's own
instant; `id` breaks the remaining tie so two devices holding the same rows produce the same
order. The predicate is `transaction_category_id IS NULL AND` the shared `isIncluded` fragment —
identical to `countUncategorized`'s predicate and to the `transactions_uncategorized_idx`
partial index, so the count on `stage-intro` and the queue the stage walks can never disagree
(spec Business Rule 11, AC1).

### Decision 5 — Seven new `src/db` exports; three of them write person-owned columns

All seven live in existing repository files, because `src/db` is the only directory allowed to
contain SQL:

| Export | File | Purpose |
| --- | --- | --- |
| `listPendingBatch(db, { limit })` | `repositories/transactions.ts` | Decision 4's query, `LIMIT limit` |
| `countCategorized(db)` | `repositories/transactions.ts` | `count(*) where transaction_category_id is not null` — the `done` state's total (spec A6) |
| `sumIncludedExpensesInPeriod(db, period)` | `repositories/transactions.ts` | `sum(includedAmount) where type = 'debit' and isIncluded and date_local between …` — both completion tiles |
| `setUserCategory(db, id, categoryId, ports)` | `repositories/transactions.ts` | Writes `transaction_category_id`, `category_source = 'user'`, clears `review_flag`, bumps `updated_at` |
| `setReviewFlag(db, id, flag, ports)` | `repositories/transactions.ts` | Writes `review_flag` = `'review_later'` or `'uncertain'`; writes no category |
| `excludeTransaction(db, id, { reason, note }, ports)` | `repositories/transactions.ts` | Writes `excluded_at = now`, `exclusion_reason`, `exclusion_note` (`null` when blank) |
| `listMostUsedCategories(db, { income, excludeCategoryId, limit, locale })` | `repositories/categories.ts` | Usage histogram for the chip grid (Decision 6) |

Three guarantees these writes carry, each with a named enforcement mechanism:

- **Never a delete.** No `delete` statement is added anywhere; `excludeTransaction` is an
  `UPDATE` (spec Business Rule 4, AC21). The existing file-level comment in
  `repositories/transactions.ts` — *"There is no `deleteTransaction` export anywhere in this
  file"* — stays true and is asserted by the new guard test (Scenario 19).
- **Never `included_amount`.** None of the three write functions names that column in its `set`
  object, and the guard test asserts the identifier does not appear in any file this item adds
  under `app/categorize/` or `src/features/categorization/` (AC22, AC24).
- **Never resurrected by a re-sync.** This is #10's guarantee, and it already exists in shipped
  code: `upsertBankTransactions` refreshes only the bank-owned columns, and its doc comment
  enumerates the nine person-owned columns — including `transaction_category_id`,
  `category_source`, `review_flag`, `excluded_at`, `exclusion_reason`, `exclusion_note` — that
  "never appear in the update `set` object under any code path". This item consumes that seam
  and adds nothing to it; the smoke runbook re-asserts it end to end by re-applying the fixture
  after categorizing (runbook Step 9).

### Decision 6 — Chip order: suggestion, then used categories, then taxonomy order, capped at seven

Spec A7. `buildCategoryChoices` in `src/features/categorization/category-choices.ts` is a pure
function over three inputs — the suggestion (or `null`), the usage-ordered list, and the full
taxonomy for the direction — and returns at most `MAX_CATEGORY_CHIPS = 7` chips followed by the
always-present "Elegir otra" tile:

1. When `suggestCategory` returns a suggestion, its category is chip 1 and carries the ✨ star
   and the "Sugerido" hint (spec Business Rule 13, AC8).
2. Then the categories of the movement's direction that the person has actually used, ordered by
   usage count descending, ties broken by `sort_order` ascending, excluding the suggested one.
3. When the person has used nothing in that direction yet, fall back to plain taxonomy order
   (`sort_order` ascending), so a first-time user still gets a full grid.
4. Truncate to seven, then append "Elegir otra", which opens the full taxonomy for that
   direction — the ✨ Otros fallback and any category the person created included (AC9).

The list is always built from the taxonomy of the movement's own direction, so AC7 holds by
construction: `listCategories(db, { income })` is the only source and `income` is derived from
`transaction.type`.

### Decision 7 — A chip selects; "Siguiente →" confirms; "Omitir" is always live

Spec A10 and Conflict 1. The screen holds `selectedCategoryId: string | null`.

- Tapping a chip sets it (`CategoryChip state="selected"`); tapping another replaces it; nothing
  is written.
- "Siguiente →" is rendered `disabled` while `selectedCategoryId === null` (`Button` already
  supports `disabled`), calls `setUserCategory`, then advances. It is the only control in the
  flow whose availability depends on a selection (spec UX Rules).
- "Omitir" is never disabled, in every state including `not-sure` and while the sheet is open,
  and writes nothing (AC12, AC13).

**Single-flight advance**: a `writeInFlight` ref guards the confirm path, so a double tap cannot
produce two writes or skip a movement. The mutation resolves before the index advances; on
failure the index does not move, the selection is kept, and a `Note tone="danger"` renders
inside the card area (spec UX Rules → *Failure*). This is the only piece of copy in the feature
that the mockup does not draw — see Assumption P2.

### Decision 8 — The exclusion sheet writes BR3-style and offers no re-inclusion

`ExcludeSheet` composes the shipped `Sheet` (`mu-sheet`, `mu-sheet__grab`, `mu-overlay`) with
five `Radio` rows, an optional `TextField` and a `Button` pair. `personal_transfer` is
pre-selected (spec AC17: "one pre-selected"; the mockup draws the first radio `is-on`). Cancel
closes the sheet and returns to the `not-sure` state with nothing written (AC18). Confirm calls
`excludeTransaction` with the chosen reason and a trimmed note — `null` when the field is empty,
so an empty string never reaches the column — then advances the stage (AC19). The note is
offered for every reason (spec A11 / Conflict 3). Re-inclusion is #16's and appears nowhere
here (spec Deferral Note 3).

### Decision 9 — The merchant hook is a plain route push

Spec A9 / Conflict 2 / AC25–AC27. The merchant name row is a pressable that navigates to
`/categorize/merchant/[merchantId]` with the currently selected category as a query parameter
(`?defaultCategoryId=…`). #14 owns the editor and what it does with that parameter; today the
route is still a `RoutePlaceholder`, so this item's verification is limited to: the push happens
with the right `merchantId` and parameter, and popping back restores the same movement and
progress. When no merchant resolved, the row is not rendered at all — the card shows the bank's
description in place of a merchant name and no edit affordance and no suggestion (spec A8).

### Decision 10 — Completion counters travel as route parameters

`CategorizeScreen` navigates with `router.replace({ pathname: '/categorize/complete', params: {
resolved, pendingAtStart } })`. The completion screen resolves its state from the live pending
count (`countUncategorized() === 0 ? 'done' : 'partial'`), renders `resolved / pendingAtStart`
with a matching bar for `partial`, and `countCategorized()` with a full bar for `done` (spec
A6). Parameters, rather than a shared session store, because the screen must also render when it
is entered cold — from a deep link, and from the fidelity capture — where it falls back to
`resolved = 0` and `pendingAtStart = countUncategorized()`. "Resolved" counts a movement that
left the pending queue during the stage: categorized or excluded, not skipped or deferred.

### Decision 11 — Both completion tiles read through the shared inclusion rule

Spec Business Rule 6 and AC31. `sumIncludedExpensesInPeriod` is written with the `isIncluded`
and `includedAmount` fragments from `src/db/fragments.ts`, which is the one place that condition
is allowed to exist — `src/db/checks/inclusion-rule-scan.ts` and
`src/db/__tests__/inclusion-rule-single-definition.test.ts` fail the build on a second
statement of it. "Gasto diario promedio" is that sum for the current month divided by the
elapsed days of the month; "vs mes pasado" compares it with the same figure for the previous
month, using `getMonthPeriod` / `shiftMonthPeriod` from `@finanzas/shared-utils`.

The percentage is rendered as a whole percent with the `MINUS_SIGN` constant from
`@finanzas/shared-utils` (the mockup draws `−12%`, U+2212), by a feature-local pure function
`formatMonthOverMonthChange` in `completion.ts`. This plan deliberately adds **no** percentage
formatter to `@finanzas/shared-utils`: #12's open plan introduces `formatPercentTenths` there
for the tenths-precision figures `home` and `dashboard` need, and a second formatter in the same
package from a parallel lane is a merge conflict for no benefit. Consolidation, if it is ever
worth it, is a later refactor over one call site.

### Decision 12 — `advanced` is absent, and a guard test proves it

Spec AC23 and Business Rule 7: not disabled, not flagged — absent. The disclosure row, the
radio group, the amount field and the 50 % / Monto segment are simply not written. Two
mechanical guards back the claim (see the parser-risk addendum for their exact matching rules):

- No catalogue key or value in `es.json` / `en.json` contains the advanced-panel copy
  (`Opciones avanzadas`, `Incluir parcialmente`, `Configurar inclusión en análisis`,
  `Incluir completo`).
- The identifiers `includedAmount` / `included_amount` do not appear in any file under
  `apps/mobile/app/categorize/` or `apps/mobile/src/features/categorization/`.

### Decision 13 — `mu-topbar*`, `mu-list` and `mu-item*` stay `deferred`; compose screen-locally

The Verification Log shows these ten classes are drawn by `stage-intro` and `categorize` but are
classified `deferred` in `MU_CLASS_MAP` — `mu-topbar*` to the earliest owning MVP item (#8, per
#12's plan) and `mu-list` / `mu-item*` to #19. `MU_CLASS_MAP` records which
`src/components/ui/` **primitive owns** a mockup class, not which screen has rendered something
that looks like it; changing an entry here would make `mu-class-coverage.test.ts` assert an
owner that does not exist in the barrel.

**Decision**: build `StageTopBar` and `NotSureDisclosure` (with its three option rows) as
screen-local compositions of `Text`, `Card` and `Pressable` inside
`src/features/categorization/components/`, and leave `MU_CLASS_MAP` untouched. This is exactly
the precedent #8's plan set in its Decision 12, so the two lanes cannot disagree.

### Decision 14 — The seven fidelity targets flip `planned` → `wired` in this item

#47 registers `stage-intro` (1 target), `categorize` (`expense`, `income`, `not-sure`,
`exclude-sheet` — 4 targets) and `categorize-complete` (`partial`, `done` — 2 targets) as
`status: "planned"`, and its Decision 2 states that flipping them is "the concrete task each
screen item inherits, and it is machine-checked". `categorize&state=advanced` stays in the
contract's `exclusions` with the reason the manifest itself gives; this item does not touch that
entry.

Each of the three screens therefore:

- reads `useFidelityPreview()` from `apps/mobile/src/lib/fidelity-preview.ts` and, when
  `active`, renders the requested state instead of the state the live data would produce. In
  preview mode `CategorizeScreen` reorders its batch so the movement matching the requested
  direction is at position 1, so the progress line and step indicator match the mockup's
  "Transacción 1 de 4" for both `expense` and `income`;
- carries `testID={fidelityTestId('<screen-id>')}` on its root view;
- gets `app_file`, `deep_link` and `ready_test_id` filled in, with the deep link's
  `fidelityScreen` / `fidelityState` matching the target, and `fixture: "stage-queue"`
  (Decision 15).

Because the contract is validated in CI, a target flipped to `wired` with a missing file, a
missing `testID` or a mismatched deep link fails `pnpm fidelity:contract` — no reviewer has to
notice it. If #47 has not landed when implementation starts, Step 0 stops the run rather than
inventing a parallel mechanism.

### Decision 15 — A committed delta fixture, `stage-queue-v1.sql`, makes the flow reproducible

The Verification Log shows the bundled `store-v1.sql` holds only 2 pending movements and no
pending income, so neither the smoke runbook nor the `income` fidelity capture can be driven
from it. `store-v1.sql` is #3's generated artifact and several merged tests read it; this item
does not modify it.

Instead it adds `apps/mobile/src/db/__fixtures__/stage-queue-v1.sql`: a small, hand-written,
reviewed **delta** of `INSERT OR REPLACE` statements that assumes a bootstrapped store (schema +
starter seeds already present) and adds one connection, one product, two merchants, four pending
movements and nine already-categorized movements. Its contents are specified in
[Seed Data](#seed-data) and are chosen so the four `categorize` captures and the `stage-intro`
capture reproduce the mockup's own numbers, labels and chip grids.

The file is applied in two places, and a test keeps them honest:

- **On device** (runbook Step 0): `sqlite3` against the simulator's app container. No app code,
  no route, and therefore no collision with #12's `/(dev)/sample-data` panel — which, once it
  lands, is a faster alternative the runbook mentions but does not depend on.
- **In Jest** (`db` project): through the existing `loadFixture()` helper into
  `openBootstrappedMemoryDb()`, asserting the resulting queue is exactly the four expected
  movements in the expected order (Scenario 12). A drift between the fixture and the queue rule
  fails the suite.

### Decision 16 — The provider seam is shared with #12, first-lander wins

Neither `@tanstack/react-query` nor `src/providers/` exists at `4fc495a`; #12's open plan
introduces both, with the exact paths and symbols recorded in the Cross-Cutting Operational
Assumption Check. This plan consumes them and does not redesign them.

**Precedence rule** (deterministic, no human decision needed): at Step 0 the implementer checks
whether `apps/mobile/src/providers/DatabaseProvider.tsx` exists. If it does, this item imports
`useDatabase()` and adds nothing. If it does not, this item creates
`src/providers/DatabaseProvider.tsx`, `src/providers/QueryProvider.tsx`, `src/providers/index.ts`
and the `app/_layout.tsx` wrap **using the same file names, symbol names and shape #12's plan
specifies**, and adds `@tanstack/react-query`. Because both plans name the same files and
symbols, whichever lands first owns them and the other consumes them unchanged; the second lane
resolves at most a `package.json` conflict.

### Decision 17 — Three catalogue namespaces, one key per drawn string

`stage_intro.*`, `categorize.*` and `categorize_complete.*`, flat and dotted, matching the key
pattern `catalogue-parity.test.ts` enforces. Emoji that the mockup draws as content (💡, 🎯, 🎉,
✨, 🚫, 🤔, 🕒, ❓, 💳, 📥, ✏️, 🔲) are catalogue values too, following the `ds.note.info_icon`
precedent — an emoji is copy, and hard-coding one in JSX would trip
`i18next/no-literal-string`. The full key map is in [Copy contract mapping](#copy-contract-mapping).

---

## Layer-by-Layer Changes

### Database / Data Layer — `apps/mobile/src/db/`

- [ ] `repositories/transactions.ts` — add `listPendingBatch`, `countCategorized`,
      `sumIncludedExpensesInPeriod`, `setUserCategory`, `setReviewFlag`, `excludeTransaction`
      (Decision 5). No new file: `src/db` is the only place SQL may live, and these belong to
      the `transactions` table.
- [ ] `repositories/categories.ts` — add `listMostUsedCategories` (Decision 6), reusing the
      existing `mapCategoryRow` / `resolveLabel` locale handling.
- [ ] `types.ts` — add `StageMovement` (a `Transaction` joined with its resolved merchant name
      and the direction the UI needs) and `CategoryUsage`.
- [ ] `__fixtures__/stage-queue-v1.sql` — new delta fixture (Decision 15).
- [ ] No migration, no schema change, no change to `fragments.ts`. `included_amount` keeps its
      column and stays unwritten.

### Shared Packages / Libraries

- [ ] `@finanzas/shared-domain` — **consumed, not changed**: `suggestCategory` (#5).
- [ ] `@finanzas/shared-utils` — **consumed, not changed**: `formatClp`, `MINUS_SIGN`,
      `formatShortDate`, `formatTimeOfDay`, `getMonthPeriod`, `shiftMonthPeriod`,
      `deriveDateLocal`.

### Providers — `apps/mobile/src/providers/` (conditional, Decision 16)

- [ ] `DatabaseProvider.tsx`, `QueryProvider.tsx`, `index.ts` and the `app/_layout.tsx` wrap —
      **only if #12 has not already landed them**, in which case this item creates nothing here.

### Frontend / UI — `apps/mobile/src/features/categorization/` (new)

- [ ] `queries.ts` — `categorizationKeys` plus the hooks: `usePendingCount`, `useStageQueue`,
      `useCategoryCatalogue`, `useCategoryUsage`, `useStageSummary`, and the three mutations
      `useSetCategory`, `useSetReviewFlag`, `useExcludeTransaction`. Each mutation invalidates
      precisely the keys it affects (`pendingCount`, `stageQueue`, `summary`) and nothing else.
- [ ] `stage-batch.ts` — `STAGE_BATCH_SIZE`, `SECONDS_PER_MOVEMENT`, `buildStageBatch(pending,
      options)`, `estimateStageMinutes(batchSize)`. Pure.
- [ ] `category-choices.ts` — `MAX_CATEGORY_CHIPS`, `buildCategoryChoices(input)`. Pure.
- [ ] `completion.ts` — `buildCompletionView(input)`, `formatMonthOverMonthChange(current,
      previous)`, `dailyAverage(total, elapsedDays)`. Pure.
- [ ] `StageSessionContext.tsx` — the session state described in Decision 2.
- [ ] `StageIntroScreen.tsx`, `CategorizeScreen.tsx`, `CategorizeCompleteScreen.tsx`.
- [ ] `components/StageTopBar.tsx`, `components/StageProgress.tsx`, `components/MovementCard.tsx`,
      `components/CategoryGrid.tsx`, `components/NotSureDisclosure.tsx`,
      `components/ExcludeSheet.tsx`, `components/CompletionSummary.tsx` — presentational,
      composed from `src/components/ui` primitives plus the two screen-local compositions of
      Decision 13. No data access.

### Routing — `apps/mobile/app/categorize/`

- [ ] `intro.tsx`, `index.tsx`, `complete.tsx` — replace the `RoutePlaceholder` body with the
      matching screen component. Routes and their paths are unchanged, so
      `route-manifest-parity.test.ts` stays green.
- [ ] `merchant/[merchantId].tsx` — **unchanged**; #14 owns it.

### i18n — `apps/mobile/src/i18n/`

- [ ] `es.json` / `en.json` — the keys in [Copy contract mapping](#copy-contract-mapping).
      Spanish verbatim from the mockup; English is a fallback and not a product commitment
      (spec Out of Scope), but must be a non-empty string for every key or
      `catalogue-parity.test.ts` fails.

### Tooling / configuration

- [ ] `scripts/mobile-ui/fidelity-targets.json` — flip the seven #13 targets to `wired`, each
      with `app_file`, `deep_link`, `ready_test_id` and `fixture: "stage-queue"`; add the
      `stage-queue` entry to the contract's `fixtures` map with a one-line description
      (Decision 14).
- [ ] `apps/mobile/package.json` — no new script. The fixture is applied by `sqlite3` in the
      runbook and by `loadFixture()` in tests; nothing generates it.

---

## Copy contract mapping

Spanish is verbatim from `design/mockups/mobile/index.html` (spec Copy contract, AC33).

| Key | Spanish value |
| --- | --- |
| `stage_intro.topbar_title` | Etapa 1 |
| `stage_intro.back_a11y` | Volver |
| `stage_intro.hero_icon` | 🎯 |
| `stage_intro.heading` | Tu primera etapa |
| `stage_intro.eyebrow` | Categorización inteligente |
| `stage_intro.lead` | Ya tienes todo configurado. Ahora viene lo divertido: tomar control de tus finanzas paso a paso. |
| `stage_intro.what_title` | ¿Qué vamos a hacer? |
| `stage_intro.what_body` | Vamos a categorizar tus transacciones recientes juntos. Es rápido, y cada categorización es una pequeña victoria. |
| `stage_intro.step_identify_icon` | 🔍 |
| `stage_intro.step_identify_title` | Identificamos |
| `stage_intro.step_identify_sub` | Gastos por categorizar |
| `stage_intro.step_categorize_icon` | 🏷️ |
| `stage_intro.step_categorize_title` | Categorizamos |
| `stage_intro.step_categorize_sub` | Uno por uno |
| `stage_intro.step_celebrate_icon` | 🎉 |
| `stage_intro.step_celebrate_title` | Celebramos |
| `stage_intro.step_celebrate_sub` | Cada progreso |
| `stage_intro.tile_pending_label` | Transacciones por categorizar |
| `stage_intro.tile_minutes_label` | Minutos estimados |
| `stage_intro.tile_minutes_value` | ~{{minutes}} |
| `stage_intro.why_title` | ¿Por qué es importante? |
| `stage_intro.why_check` | ✓ |
| `stage_intro.why_visibility_title` | Visibilidad total |
| `stage_intro.why_visibility_sub` | Sabrás exactamente en qué gastas tu dinero |
| `stage_intro.why_insights_title` | Insights inteligentes |
| `stage_intro.why_insights_sub` | Análisis automáticos de tus patrones de gasto |
| `stage_intro.why_control_title` | Control gradual |
| `stage_intro.why_control_sub` | Cada categorización te acerca a tus objetivos |
| `stage_intro.note_icon` | 💡 |
| `stage_intro.note_strong` | Flexibilidad total: |
| `stage_intro.note_body` | puedes parar cuando quieras y continuar después. No hay presión, solo progreso. |
| `stage_intro.start` | 🚀 ¡Empezar mi primera etapa! |
| `categorize.topbar_title` | Categorizar |
| `categorize.back_a11y` | Volver |
| `categorize.close_a11y` | Cerrar |
| `categorize.progress` | Transacción {{current}} de {{total}} |
| `categorize.progress_a11y` | Progreso de la etapa |
| `categorize.icon_expense` | 💳 |
| `categorize.icon_income` | 📥 |
| `categorize.badge_expense` | Gasto |
| `categorize.badge_income` | Ingreso |
| `categorize.datetime` | {{date}} · {{time}} |
| `categorize.merchant_edit_icon` | ✏️ |
| `categorize.merchant_edit_hint` | Toca para editar |
| `categorize.description_label` | Descripción del banco |
| `categorize.question_expense` | ¿En qué categoría lo pones? |
| `categorize.question_income` | ¿De qué tipo de ingreso se trata? |
| `categorize.suggested_star` | ✨ |
| `categorize.suggested_hint` | Sugerido |
| `categorize.choose_other_emoji` | 🔲 |
| `categorize.choose_other` | Elegir otra |
| `categorize.not_sure_icon` | 🤔 |
| `categorize.not_sure` | ¿No estás seguro? |
| `categorize.review_later_icon` | 🕒 |
| `categorize.review_later_title` | Revisar más tarde |
| `categorize.review_later_sub` | Lo veré después |
| `categorize.uncertain_icon` | ❓ |
| `categorize.uncertain_title` | No recuerdo |
| `categorize.uncertain_sub` | No estoy seguro de qué fue |
| `categorize.exclude_icon` | 🚫 |
| `categorize.exclude_title` | Excluir del análisis |
| `categorize.exclude_sub` | No es un gasto propio |
| `categorize.skip` | Omitir |
| `categorize.next` | Siguiente → |
| `categorize.write_failed_icon` | ⚠️ |
| `categorize.write_failed` | No pudimos guardar esa decisión. Inténtalo de nuevo. |
| `categorize.exclude_sheet_title` | 🚫 Excluir del análisis |
| `categorize.exclude_sheet_question` | ¿Por qué quieres excluir esta transacción? |
| `categorize.exclude_reason_personal_transfer` | Transferencia personal |
| `categorize.exclude_reason_shared_expense` | Involucra a más personas |
| `categorize.exclude_reason_not_relevant` | Gasto no relevante |
| `categorize.exclude_reason_cash_withdrawal` | Retiro de efectivo |
| `categorize.exclude_reason_other` | Otro |
| `categorize.exclude_note_placeholder` | Explica brevemente (opcional) |
| `categorize.exclude_cancel` | Cancelar |
| `categorize.exclude_confirm` | Confirmar |
| `categorize_complete.celebration_icon` | 🎉 |
| `categorize_complete.heading_partial` | ¡Buen trabajo! |
| `categorize_complete.lead_partial` | Categorizaste las transacciones recientes. |
| `categorize_complete.heading_done` | ¡Increíble trabajo! |
| `categorize_complete.lead_done` | Has organizado completamente tus transacciones. |
| `categorize_complete.counter_label` | Total categorizado |
| `categorize_complete.counter_partial` | {{resolved}} / {{total}} |
| `categorize_complete.counter_done` | {{total}} |
| `categorize_complete.counter_sub` | transacciones organizadas |
| `categorize_complete.progress_a11y` | Progreso de la etapa |
| `categorize_complete.tile_daily_label` | Gasto diario promedio |
| `categorize_complete.tile_daily_sub` | este mes |
| `categorize_complete.tile_change_label` | vs mes pasado |
| `categorize_complete.tile_change_sub_less` | estás gastando menos |
| `categorize_complete.tile_change_sub_more` | estás gastando más |
| `categorize_complete.tile_change_sub_same` | igual que el mes pasado |
| `categorize_complete.continue` | Seguir categorizando |
| `categorize_complete.done_for_today` | Terminado por hoy |
| `categorize_complete.go_home` | Continuar a inicio |
| `categorize_complete.closing` | ¡Ahora tienes una vista completa de tus gastos! |

Four values above are **not** drawn by the mockup and are this plan's own Spanish, kept as short
as possible and flagged for review: `categorize.write_failed`,
`categorize_complete.tile_change_sub_more`, `categorize_complete.tile_change_sub_same`, and the
three accessibility labels (`*_a11y`), which are never visible. See Assumption P2.

---

## Assumptions this plan adds

The spec's register A1–A14 is settled input and is not restated. These are the plan's own,
all reversible:

| # | Assumption | Rationale |
| --- | --- | --- |
| P1 | `SECONDS_PER_MOVEMENT = 15`, so the "Minutos estimados" tile is `max(1, round(batchSize × 15 / 60))` | Spec A5 asks for "one fixed per-movement estimate"; 15 s puts a full ten-movement stage at 3 minutes, the top of the domain's "1–3 minutos" promise, and a short batch at 1 minute |
| P2 | Four strings the mockup does not draw are invented: the write-failure message, the two non-"gastando menos" variants of the change tile, and the accessibility labels | Spec UX Rules require a non-blocking failure message and the tiles must render when spending rose or held steady; the mockup draws only the happy branch. Kept minimal so replacing them is a catalogue edit |
| P3 | The "most used" ordering counts every movement carrying that category, excluded ones included | Usage is a habit signal, not an analysis figure; excluding it from the inclusion rule keeps `fragments.ts` the single statement of *that* rule (Decision 11) and avoids implying an aggregate where there is none |
| P4 | `countCategorized` counts every movement with a category, whether or not it is excluded | Spec A6 says "the total number of categorized movements on the device"; an excluded movement the person categorized first is still categorized |
| P5 | The completion screen entered without parameters shows `0 / <pending>` | Only reachable by deep link or fidelity capture; the real flow always supplies parameters (Decision 10) |
| P6 | In fidelity preview mode the batch is reordered so the requested direction is at position 1 | `__DEV__`-only, and it is what makes the `expense` and `income` captures comparable with the mockup's "Transacción 1 de 4". Never reachable in a release build |

---

## Testing Strategy

**Test types**: unit (pure functions, `app` Jest project), integration (repository functions
against `better-sqlite3` in memory, `db` Jest project), static source scans, smoke (device).

No React renderer is available (Verification Log), so screens are verified through their pure
inputs and outputs, static scans, and the device runbook — the precedent items #34 and #8 set.

**Key scenarios**:

| # | Scenario | Maps to | Where |
| --- | --- | --- | --- |
| 1 | `listPendingBatch` returns only movements with no category that are not excluded, newest first, tie-broken by `occurred_at` then `id`, capped at the limit | AC2, AC4, spec BR11 | `src/db/__tests__/transactions.test.ts` (`db`) |
| 2 | `listPendingBatch` with fewer pending than the limit returns the whole queue | AC2, spec A14 | same |
| 3 | `setUserCategory` writes the category and `category_source = 'user'`, clears `review_flag`, and leaves `excluded_at` and `included_amount` null | AC10, AC22, AC24 | same |
| 4 | After `setUserCategory`, `countUncategorized` drops by one | AC10, AC11 | same |
| 5 | `setReviewFlag` writes the mark, writes no category, and the movement is still pending | AC14, AC15 | same |
| 6 | `excludeTransaction` writes `excluded_at`, the reason and the note; a blank note is stored as `null`; the row still exists and is still selectable | AC19, AC21 | same |
| 7 | An excluded movement leaves `sumIncludedExpensesInPeriod` and `totalForCategoryInPeriod` | AC20 | same |
| 8 | `excludeTransaction` never writes `included_amount` | AC22, AC24 | same |
| 9 | A simulated `upsertBankTransactions` re-sync over a categorized and an excluded movement preserves both decisions | #10 seam (Decision 5) | same |
| 10 | `listMostUsedCategories` orders by usage descending, ties by `sort_order`, excludes the suggested category, and honours the limit | AC8, spec A7 | `src/db/__tests__/categories.test.ts` (`db`) |
| 11 | `listMostUsedCategories` with no history returns taxonomy order | Decision 6 fallback | same |
| 12 | The `stage-queue-v1.sql` fixture applies cleanly to a bootstrapped store and yields exactly the four expected pending movements in the expected order | Decision 15 | `src/db/__tests__/stage-queue-fixture.test.ts` (`db`, new) |
| 13 | `buildStageBatch` caps at `STAGE_BATCH_SIZE`, preserves queue order, and in preview mode promotes the first movement of the requested direction | AC2, AC3, P6 | `src/features/categorization/__tests__/stage-batch.test.ts` (`app`, new) |
| 14 | `estimateStageMinutes` never returns 0 and rounds as P1 specifies | spec A5 | same |
| 15 | `buildCategoryChoices`: suggestion first with the hint; no suggestion ⇒ no chip carries the hint; never more than seven chips; "Elegir otra" always last; only the movement's own direction | AC7, AC8, AC9 | `src/features/categorization/__tests__/category-choices.test.ts` (`app`, new) |
| 16 | `buildCompletionView` resolves `partial` vs `done`, the counter and the bar ratio, including the paramless fallback | AC28, AC30, P5 | `src/features/categorization/__tests__/completion.test.ts` (`app`, new) |
| 17 | `formatMonthOverMonthChange` renders `−12%` with U+2212 for a decrease, the increase and zero branches, and the no-previous-month branch | AC31, P2 | same |
| 18 | Every `t('…')` key used by the three screens exists in `es.json` and `en.json`, and every Spanish value matches the Copy contract table character for character | AC33 | `src/features/categorization/__tests__/copy-contract.test.ts` (`app`, new) — reuses the shipped `catalogue-key-scan.ts` |
| 19 | Guard: no advanced-panel copy in either catalogue, and no `includedAmount` / `included_amount` identifier in the feature or its routes | AC23, AC24 | `src/features/categorization/__tests__/advanced-absent.test.ts` (`app`, new) |
| 20 | The shipped repository-wide scans stay green with the new files: `no-naked-text`, `no-style-literals`, `touch-targets`, `mu-class-coverage`, `route-manifest-parity`, `db-access-boundary`, `inclusion-rule-single-definition` | AC32, layering, AC34 | existing tests, no edits expected |

**Smoke test runbook**:
[`docs/testing/mobile/13-categorization-flow.smoke-test.md`](../../../testing/mobile/13-categorization-flow.smoke-test.md)

**Regression suite**: `.maestro/` exists as a folder but holds no flows yet and item #22 owns
them; no regression spec is added here.

### Parser-risk addendum

Scenario 19's guard reads source and catalogue text and matches patterns, which is enough to
treat it as parser-risk. Its contract is deliberately narrow so it cannot be defeated and cannot
false-positive:

- **Scope A (catalogue)**: the *values* of `es.json` and `en.json`, compared after Unicode NFC
  normalisation and lower-casing, against the four advanced-panel phrases.
- **Scope B (source)**: files under `apps/mobile/app/categorize/` and
  `apps/mobile/src/features/categorization/`, matched for the identifiers `includedAmount` and
  `included_amount` on a word boundary, after stripping `//` line comments and `/* … */` block
  comments.

Edge cases and their tests (all in `advanced-absent.test.ts`, driven by inline fixture strings
so no real file has to be broken to test the guard):

| # | Input | Expected |
| --- | --- | --- |
| E1 | `Opciones Avanzadas` (different casing) | flagged — matching is case-insensitive |
| E2 | `Opciones avanzadas` written with a combining accent | flagged — NFC normalisation first |
| E3 | `Montoya` in a merchant name | **not** flagged — the guard never matches the bare word "Monto" |
| E4 | `width: '50%'` in a style object | **not** flagged — `50%` is not a scanned token; Scope B matches identifiers only |
| E5 | `// included_amount stays unwritten` in a comment | **not** flagged — comments are stripped before matching |
| E6 | `/* includedAmount */ const includedAmountLocal = 1` | flagged once — the comment is stripped, the identifier prefix still matches on a word boundary |
| E7 | Two occurrences of `included_amount` on one line | flagged twice, both offsets reported |
| E8 | `notIncludedAmount` | **not** flagged — a word boundary is required before the identifier |
| E9 | The string `includedAmount` inside `src/db/repositories/transactions.ts` | **not** flagged — that file is outside Scope B by design (the column must be readable) |
| E10 | An empty scope (a mistyped directory) | the test fails loudly rather than passing vacuously — the guard asserts it scanned at least one file |

**Suppression semantics**: none. The guard recognises no inline suppression directive, for the
same reason `catalogue-key-scan.ts` does not: a suppression here would be an escape hatch from
the exact acceptance criterion (AC23, AC24) it exists to hold.

### Concurrent-event-source addendum

The screen has three interleaving asynchronous sources — a mutation promise, a TanStack Query
refetch triggered by that mutation's invalidation, and navigation focus/unmount events from the
merchant-editor round trip — all reading the same session state, so the checklist is answered in
full rather than skipped.

- **Shared mutable state guards**: the session (batch, index, selection, resolved counter) is
  React state owned by `CategorizeScreen` and mutated only through its own setters, always from
  the React event loop. The batch array is read once and never mutated in place; advancing
  replaces the index.
- **Re-entrancy / in-flight tracking**: yes, a second confirm can arrive before the first
  resolves. A `writeInFlight` ref (Decision 7) rejects the second tap; "Siguiente →" also
  renders `disabled` while a write is in flight. Deferral and exclusion writes share the guard.
- **Event deduplication**: the mutation is keyed by movement id, and the index advances only
  after the write resolves, so a duplicate confirm for the same movement cannot advance twice.
  `setUserCategory` is itself idempotent — writing the same category twice is the same row.
- **Listener and resource cleanup**: the feature registers no listener, timer, socket or
  subscription. TanStack Query cancels its own in-flight queries on unmount. The SQLite handle
  is process-lived and owned by `DatabaseProvider`, not by this feature.
- **Race at initialization**: the screen renders nothing until `useDatabase()` reports ready and
  the queue query resolves; per spec UX Rules → *Loading*, it never shows a half-populated card,
  and the previous movement stays on screen until the next one can render completely.
- **Race at teardown**: leaving mid-write is allowed. The mutation completes in the query client
  (the decision is already committed — spec Business Rule 2), and the resolution callback is a
  no-op because the component is unmounted. No state is set after unmount.
- **Error propagation**: mutation errors surface through TanStack Query's `error` field and are
  rendered as the `categorize.write_failed` note; the stage does not advance and the selection
  is preserved (spec UX Rules → *Failure*). No `catch` swallows an error silently.

---

## Seed Data

`apps/mobile/src/db/__fixtures__/stage-queue-v1.sql` — `INSERT OR REPLACE` statements applied on
top of a bootstrapped store (schema + starter seeds present). Ids are literal and prefixed
`stage-` so the file is diffable and idempotent.

| Entity | Rows | Why |
| --- | --- | --- |
| `user_financial_institutions` | 1 — `stage-connection`, `banco-de-chile`, `status = 'active'`, `sync_status = 'idle'` | Movements need a product, products need a connection |
| `user_financial_products` | 1 — `stage-product`, checking, `Cuenta Corriente` | Parent of every movement below |
| `merchants` | 2 — `stage-merchant-mercadolibre` ("MercadoLibre Chile", default category `compras`), `stage-merchant-consultoria` ("Consultoría Digital SpA", default category `freelance`) | Give `suggestCategory` something to return, with the mockup's own names (AC8) |
| `transactions` — pending | 4: `stage-tx-income` (credit, 1 200 000, `2026-01-27T21:00`, merchant Consultoría, raw `TRANSFERENCIA ELECTRONICA PAGO CONSULTORIA DESARROLLO WEB`); `stage-tx-expense` (debit, 42 000, `2026-01-26T14:32`, merchant MercadoLibre, raw `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO`); `stage-tx-nomerchant` (debit, 8 990, `2026-01-25`, no merchant, raw `COMERCIO SIN IDENTIFICAR 4523`); `stage-tx-plain` (debit, 15 500, `2026-01-24`, no merchant, raw `FARMACIA CENTRO LOCAL 12`) | Four pending movements make `stage-intro` read "4", the step indicator draw four steps, and both direction states reachable. The two merchant-less rows exercise spec A8 |
| `transactions` — history | 9 categorized, `category_source = 'user'`, dated in the current and previous month: one each in `comida`, `supermercado`, `transporte`, `entretenimiento`, `servicios`, `salud`; two in `sueldo`; one in `ingresos-extra` | Produces exactly the mockup's chip grids: expense = Compras (sugerido) + the six used expense categories = 7 chips + "Elegir otra" = 8 tiles; income = Freelance (sugerido) + Sueldo + Ingresos extra = 3 chips + "Elegir otra" = 4 tiles. Also gives both completion tiles a non-zero month-over-month figure |

The fixture writes **no** `included_amount` and **no** `excluded_at` on any row, so an exclusion
made during the smoke run is unambiguously the one the tester just made.

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `docs/project/4-database-model.md` — line 271 describes `exclusion_note` as *"Free text
      when reason = `other`"*. The spec's Conflict 3 resolves the note as optional for **every**
      reason; correct that cell to say so, and note that this flow is the writer of
      `review_flag`, `excluded_at`, `exclusion_reason` and `exclusion_note`.
- [ ] `docs/best-practices/stack/expo-react-native.md` — the *Screen structure* example uses
      `src/i18n/{es,en}.ts`; the shipped files are `.json`. Correct it while touching the
      feature-folder conventions this item is the first real consumer of.
- [ ] `AGENTS.md` — add the categorization feature folder to the repository-structure block only
      if the developer adds a file type not already described there; otherwise "no change".
      Do **not** add a new command: this item adds none.
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — **only if** #47 has already rewritten
      it: append nothing, but confirm the per-PR fidelity-evidence block it prescribes is what
      the implementation PR pastes. If #47 has not landed, this bullet is void and Step 0 will
      already have stopped the run.
- [ ] `docs/project/1-business-domain.md`, `docs/project/2-repo-architecture.md`,
      `docs/project/3-software-architecture.md` — no change required; the entities, packages and
      layering this item uses are already described there.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| #5 (PR #44) changes `suggestCategory`'s shape before merging | Med | Med | Step 0 re-verifies the exact signature and stops on a mismatch. Only `buildCategoryChoices` consumes it, behind a local adapter |
| #12 and #13 both create `src/providers/` | Med | Low | Decision 16's precedence rule: identical paths and symbols in both plans; first lander owns them |
| #47 has not landed when implementation starts, so no target can be flipped | Med | High | Step 0 stops the run. Nothing in this item invents a parallel fidelity mechanism |
| #10 has not landed, so no real bank movement exists on a device | High | Med | The runbook is driven by `stage-queue-v1.sql` (Decision 15), which is applied the same way whether or not a sync exists |
| A fidelity capture fails because the fixture's numbers differ from the mockup's sample digits | Med | Low | The fixture reproduces the mockup's amounts, dates, merchant names and chip grids exactly. A residual failure is fixed in the screen or the fixture — **never** by raising a threshold (#47 Decision 4) |
| The chip grid quietly renders an income category for an expense | Low | High | `income` is derived from `transaction.type` at a single call site and Scenario 15 asserts it (AC7) |
| A future edit adds a second statement of the inclusion rule to make a tile "match" | Low | High | `inclusion-rule-single-definition.test.ts` fails the build (Decision 11) |
| AC31 cannot be verified against `home` because `home` does not exist yet | High | Low | Recorded as a known limitation in the runbook: the tiles are verified to read the same repository function and the same fragments; the visual cross-check moves to #12's runbook |

---

## Residual verification strategy

This plan makes three pattern-completeness claims. Each names the evidence the implementation
PR must paste:

1. **Every MVP state renders** (AC32). Evidence: `pnpm fidelity --issue 13` output listing all
   seven targets as `wired` with their PASS/FAIL and mismatch percentages, plus the
   `pnpm fidelity:contract` summary line showing seven fewer `planned` targets than before.
2. **Every user-facing string comes from the catalogues** (AC33). Evidence: Scenario 18's test
   output, which scans the three screens' `t('…')` call sites and compares each Spanish value
   with the Copy contract table.
3. **`advanced` and `included_amount` are absent** (AC23, AC24). Evidence: Scenario 19's guard
   output naming the files it scanned and the zero findings, plus `grep -rn "includedAmount" `
   over the feature folder returning nothing.

---

## Code Samples

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/repositories/transactions.ts
export function listPendingBatch(db: AppDatabase, params: { limit: number }): Transaction[] {
  const rows = db
    .select()
    .from(transactions)
    .where(and(sql`${transactions.transactionCategoryId} is null`, isIncluded))
    .orderBy(desc(transactions.dateLocal), desc(transactions.occurredAt), asc(transactions.id))
    .limit(params.limit)
    .all() as TransactionRow[];
  return rows.map(mapTransactionRow);
}

export function excludeTransaction(
  db: AppDatabase,
  transactionId: string,
  input: { reason: ExclusionReason; note?: string | null },
  ports: { now: () => string },
): void {
  const now = ports.now();
  // `included_amount` is deliberately absent from this `set` object, as it is from every
  // write in this feature (AC22, AC24). This is an UPDATE: a movement is never deleted (BR3).
  db.update(transactions)
    .set({
      excludedAt: now,
      exclusionReason: input.reason,
      exclusionNote: input.note?.trim() ? input.note.trim() : null,
      updatedAt: now,
    })
    .where(eq(transactions.id, transactionId))
    .run();
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/categorization/category-choices.ts
export const MAX_CATEGORY_CHIPS = 7;

export function buildCategoryChoices(input: {
  suggestion: { transactionCategoryId: string } | null;
  used: Category[]; // usage desc, ties by sortOrder asc, suggestion already excluded
  taxonomy: Category[]; // sortOrder asc, the movement's own direction only
}): CategoryChoice[] {
  const suggested = input.suggestion
    ? input.taxonomy.find((c) => c.id === input.suggestion?.transactionCategoryId)
    : undefined;
  const rest = input.used.length > 0
    ? input.used
    : input.taxonomy.filter((c) => c.id !== suggested?.id);
  return [
    ...(suggested ? [{ category: suggested, suggested: true }] : []),
    ...rest.filter((c) => c.id !== suggested?.id).map((category) => ({ category, suggested: false })),
  ].slice(0, MAX_CATEGORY_CHIPS);
  // "Elegir otra" is rendered by CategoryGrid after this list, always, and is not a Category.
}
```

```jsonc
// Illustrative — adapt during implementation.
// scripts/mobile-ui/fidelity-targets.json — one of the seven #13 mappings, after the flip
{
  "screen_id": "categorize",
  "state_id": "exclude-sheet",
  "status": "wired",
  "fixture": "stage-queue",
  "app_file": "apps/mobile/app/categorize/index.tsx",
  "deep_link": "finanzas:///categorize?fidelity=1&fidelityScreen=categorize&fidelityState=exclude-sheet",
  "ready_test_id": "fidelity-categorize"
}
```

---

## Implementation Order

Each step is independently committable and leaves the repository green.

0. **Implementation-start re-verification.** Re-run the last three rows of the
   [Cross-Cutting Operational Assumption Check](#cross-cutting-operational-assumption-check) and
   record `Still valid` or `Stale or conflicting` in the PR body. **Stop before any file edit**
   if: #5 (PR #44) has not merged or `suggestCategory`'s signature differs; or #47 has not
   landed `scripts/mobile-ui/fidelity-targets.json` and `apps/mobile/src/lib/fidelity-preview.ts`.
   Also record whether `apps/mobile/src/providers/DatabaseProvider.tsx` exists (Decision 16).
1. **Database layer.** The six new exports in `repositories/transactions.ts`, the one in
   `repositories/categories.ts`, and the two types in `types.ts`. Verify:
   `pnpm --filter @finanzas/mobile test` — read the output and confirm the `db` project runs
   Scenarios 1–11 and that `inclusion-rule-single-definition` and `db-access-boundary` are still
   green.
2. **Fixture.** `src/db/__fixtures__/stage-queue-v1.sql` plus Scenario 12's test. Verify:
   `pnpm --filter @finanzas/mobile test` and confirm the new test names the four expected
   movements in order.
3. **Providers (conditional).** Only when Step 0 recorded that `src/providers/` is absent:
   create `DatabaseProvider.tsx`, `QueryProvider.tsx`, `index.ts`, wrap `app/_layout.tsx`, and
   add `@tanstack/react-query`. Verify: `pnpm check:layout`, `pnpm --filter @finanzas/mobile
   typecheck`, and the app boots on a dev build with no console error.
4. **Catalogues.** Every key in [Copy contract mapping](#copy-contract-mapping) added to
   `es.json` and `en.json`. Verify: `pnpm --filter @finanzas/mobile test` and confirm
   `catalogue-parity` passes with the new keys.
5. **Pure feature logic.** `stage-batch.ts`, `category-choices.ts`, `completion.ts` with
   Scenarios 13–17. Verify: `pnpm --filter @finanzas/mobile test`.
6. **Queries and session.** `queries.ts` and `StageSessionContext.tsx`. Verify:
   `pnpm --filter @finanzas/mobile typecheck` and `pnpm lint`.
7. **Components.** The seven files in `components/`, including the two screen-local
   compositions of Decision 13. Verify: `pnpm --filter @finanzas/mobile test` and confirm
   `no-naked-text`, `no-style-literals`, `touch-targets` and `mu-class-coverage` are green —
   `MU_CLASS_MAP` must be **unchanged** in the diff.
8. **Screens and routes.** `StageIntroScreen`, `CategorizeScreen`, `CategorizeCompleteScreen`,
   and the three route files. Verify: `pnpm --filter @finanzas/mobile test` with
   `route-manifest-parity` green, and walk the flow on a dev build.
9. **Guard and copy tests.** Scenarios 18 and 19, including the E1–E10 fixtures. Verify: the
   guard fails when a forbidden identifier is temporarily introduced, then passes when it is
   removed — paste both outputs into the PR.
10. **Fidelity.** Flip the seven targets to `wired` with `app_file`, `deep_link`,
    `ready_test_id` and `fixture: "stage-queue"`; add the `stage-queue` fixture entry. Verify:
    `pnpm fidelity:contract` prints seven more `wired` targets than before, then run
    `pnpm fidelity --issue 13` against the dev build and paste the seven-row result table into
    the PR. A failing target is fixed in the screen or the fixture; a threshold is never raised.
11. **Smoke runbook.** Execute
    [`docs/testing/mobile/13-categorization-flow.smoke-test.md`](../../../testing/mobile/13-categorization-flow.smoke-test.md)
    end to end and record the result.
12. **Documentation.** Apply the [Documentation Updates](#documentation-updates) above.
13. **CHANGELOG.** Add under `[Unreleased]` → `### Added`, verbatim:

    ```markdown
    - **Categorization flow** (#13): the stage intro, the categorization screen with its expense, income, not-sure and exclude-sheet states, and the partial/done completion screen — reading the pending queue and writing categories, deferral marks and exclusions through the shipped repositories.
    ```

---

## Out of Scope

Everything the spec lists under *Out of Scope (MVP)*, plus these plan-level boundaries:

- The merchant editor itself (#14): this item pushes the route and reads the round trip.
- `home`, its pending call to action and its totals (#12).
- The `/(dev)/sample-data` panel (#12, Decision 15 here).
- Promoting `mu-topbar*`, `mu-list` or `mu-item*` to design-system primitives (#8 / #19,
  Decision 13 here).
- A percentage formatter in `@finanzas/shared-utils` (#12, Decision 11 here).
- Maestro flows (#22).
