# Transaction detail and exclusion — Implementation Plan

**Work item brief**: [issue #16](https://github.com/lhpaul/personal-finances/issues/16) — a
Refactor-type item, so there is no spec file; the issue body is the brief and is quoted verbatim
in [Brief coverage](#brief-coverage).
**Smoke test runbook**: [`../../../testing/mobile/16-transaction-detail-exclusion.smoke-test.md`](../../../testing/mobile/16-transaction-detail-exclusion.smoke-test.md)
**Behaviour contract**: `design/mockups/mobile/BEHAVIOR.md` → `transaction-detail`
**Visual contract**: `design/mockups/mobile/index.html#screen=transaction-detail`
(`categorized`, `uncategorized`, `excluded`, `exclude-sheet`)

---

## Summary

**Approach**: `apps/mobile/app/transactions/[transactionId].tsx` — today a `RoutePlaceholder` —
becomes a thin composition over a new `apps/mobile/src/features/transaction-detail/` folder. The
screen renders the bank's own facts as read-only text (`raw_description`, `amount`, `type`, date
and time) and makes only the user's decision layer editable: the note, the category, and the
exclusion. Three new functions land in `apps/mobile/src/db/repositories/transactions.ts` — one
joined read and two person-owned writes, one of which is the **re-inclusion** write this item
introduces. Everything the categorization flow already built is consumed rather than rebuilt: the
exclusion sheet, the category-chip grid and the chip-ordering function come from
`src/features/categorization/`, and the category and exclusion writes are #13's own
`setUserCategory` and `excludeTransaction` repository functions. All four MVP states of
`#screen=transaction-detail` render, and their four fidelity targets flip `planned` → `wired`.

**Estimated complexity**: M

**Rationale**: One screen, four states, three new `src/db` exports, 39 catalogue keys, one delta
fixture and one mechanical guard. It is materially smaller than #13 (three screens, seven states,
seven exports), and most of its interaction surface — the sheet, the chip grid, the two writes —
is reuse rather than new code. What keeps it out of S is the number of simultaneous contracts:
BR3 (never delete, re-inclusion clears), the immutable/mutable split, the four-state fidelity
capture, the i18n lint and the layering lint.

**Dependencies**:

| Item | What this plan needs from it | State at plan time | Blocking? |
| --- | --- | --- | --- |
| [#15 transactions list](https://github.com/lhpaul/personal-finances/issues/15) | The navigation seam only: a movement row pushes `/transactions/[transactionId]`. #15 creates no route file and does not touch this screen's internals (#15 Decision 13) | Plan PR [#64](https://github.com/lhpaul/personal-finances/pull/64) open | **Yes**, for the runbook's entry path; Step 0 re-verifies the seam against whatever #15 merged |
| [#13 categorization flow](https://github.com/lhpaul/personal-finances/issues/13) | `src/features/categorization/components/ExcludeSheet.tsx`, `components/CategoryGrid.tsx`, `category-choices.ts`, and the repository writes `setUserCategory` / `excludeTransaction` (#13 Decision 5, Decision 6, Decision 8) | Plan merged (`7a0d861`, `641a536`, `49ed275`); implementation pending | **Yes** — this item reuses those surfaces instead of reimplementing them (Decision 5, Decision 7) |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | `apps/mobile/src/db/runtime.ts` → `getAppDatabase(): Promise<AppDatabase>` | Plan merged; implementation pending | **Yes** |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | `scripts/mobile-ui/fidelity-targets.json`, `apps/mobile/src/lib/fidelity-preview.ts`, `pnpm fidelity` | Plan merged; implementation open on PR [#61](https://github.com/lhpaul/personal-finances/pull/61) | **Yes**, for Implementation Order Step 10 only |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | `suggestCategory({ currentCategorySource, merchant })`, consumed only through #13's `buildCategoryChoices` | PR [#44](https://github.com/lhpaul/personal-finances/pull/44) open | Transitively, through #13 |
| [#14 merchant editor](https://github.com/lhpaul/personal-finances/issues/14) | Nothing. This item pushes `/categorize/merchant/[merchantId]`, which exists as a placeholder today | Plan PR [#62](https://github.com/lhpaul/personal-finances/pull/62) open | No (Decision 8) |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | The guarantee that a re-sync never overwrites a person-owned column. Already true in shipped code | Plan merged; implementation pending | No |
| [#3 database](https://github.com/lhpaul/personal-finances/issues/3) | `transactions`, `merchants`, `transaction_categories`, `user_financial_products`, `getCategory`, `listCategories`, `store-v1.sql` | Merged | Satisfied |
| [#2 design system](https://github.com/lhpaul/personal-finances/issues/2) | `Card`, `Badge`, `Amount`, `Text`, `TextField`, `Note`, `Button`, `Sheet`, `Radio`, `CategoryChip` | Merged | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | `formatClp`, `formatLongDate`, `formatTimeOfDay` | Merged | Satisfied |

---

## Brief coverage

The issue body is the acceptance contract. Every line of it maps to implementation and to a test.

| Brief line | Where it is implemented | Where it is verified |
| --- | --- | --- |
| *"Full detail with the immutable bank description"* | `DetailInfoCard` renders `raw_description` in a flat `mu-mono` card with no input affordance (Decision 4) | Scenario 5, Scenario 18, runbook Step 3 |
| *"…and the editable note"* | `DetailNoteField` over the `note` column, saved on blur (Decision 9) | Scenarios 4, 5, runbook Step 4 |
| *"…category change"* | `CategoryPickerSheet`, writing through #13's `setUserCategory` (Decision 7) | Scenarios 12, 14, runbook Step 5 |
| *"…merchant shortcut"* | A push to `/categorize/merchant/[merchantId]` (Decision 8) | Scenario 14, runbook Step 6 |
| *"…the exclusion sheet"* | #13's `ExcludeSheet`, with the four reasons the mockup draws (Decision 5) | Scenario 16, runbook Step 7 |
| *"…and re-inclusion"* | `reincludeTransaction` (Decision 6) | Scenarios 6, 7, 8, 9, runbook Step 8 |
| AC1 — *"`raw_description` is never editable"* | No write path names it (Decision 3, Decision 14) | Scenario 5 (store round-trip), Scenario 18 (source guard) |
| AC2 — *"`Categoría sugerida automáticamente` shows only when `category_source = 'auto'`"* | `showsAutoSuggestionCaption` (Decision 4) | Scenario 13, runbook Steps 3 and 8 |
| AC3 — *"Re-including clears the exclusion fields and restores it to aggregates"* | `reincludeTransaction` (Decision 6) | Scenarios 6, 7, runbook Step 8 |
| AC4 — *"Open the mockups and compare side by side before marking done"* | Four fidelity targets flip to `wired` (Decision 12) | `pnpm fidelity --issue 16`, runbook Step 9 |

---

## Verification Log

Every command below was run in the worktree `.claude/worktrees/item-16` on branch
`implementation-plan/16-transaction-detail-exclusion`, at repo revision `09fb7dd`, which was
identical to `origin/develop` at that moment.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` and `git rev-parse --short origin/develop` | Both `09fb7dd` (`docs: close the re-run plan review gate findings at the realigned head (#9)`) |
| The four MVP states this screen must render | `grep -n "transaction-detail" -A 12 design/mockups/mobile/mockup-manifest.js` | `screen_id: 'transaction-detail'`, `route: '/transactions/[transactionId]'`, states `categorized` (initial), `uncategorized`, `excluded`, `exclude-sheet`. No state is flagged `mvp: false` |
| The drawn action sets per state | Python extraction of `#s-transaction-detail` from `design/mockups/mobile/index.html` | Three `mu-btn-stack` blocks: `uncategorized` → *Categorizar ahora* / *Configurar comercio* / *Excluir del análisis*; `categorized exclude-sheet` → *Cambiar categoría* / *Configurar comercio* / *Excluir del análisis*; `excluded` → *Volver a incluir en el análisis*. **No "Eliminar" button exists in any state** (BR3) |
| Which states draw the auto-suggestion caption | Same extraction | `<p class="mu-xs mu-mt1" data-states="categorized exclude-sheet">Categoría sugerida automáticamente según el comercio</p>` — drawn in `categorized` and `exclude-sheet`, **not** in `excluded`. Drives Decision 4 and the fixture's `category_source` choice |
| The detail exclusion sheet's reason set | Same extraction | **Four** radios: *Transferencia personal* (drawn `is-on`), *Involucra a más personas*, *Gasto no relevante*, *Otro*. **No note field** is drawn in this sheet |
| The categorization exclusion sheet's reason set, for comparison | Extraction of `#s-categorize`'s `mu-overlay` block | **Five** radios — the four above plus *Retiro de efectivo* — **and** a `mu-input mu-input--ph` note field (*Explica brevemente (opcional)*). The two sheets differ; drives Decision 5 |
| `mu-*` classes this screen draws, and their ownership | Python scan of the extracted section cross-referenced against `apps/mobile/src/test-utils/mu-class-map.ts` | 48 distinct classes: **29 `primitive`**, **12 `utility`**, **7 `deferred`**. The seven are `mu-topbar`, `mu-topbar__btn`, `mu-topbar__title` (noted to #12 today) and `mu-list`, `mu-item`, `mu-item__txt`, `mu-item__title` (noted to #19) → Decision 10 |
| Existing `transactions` repository surface | `grep -n "^export function\|^export async function" apps/mobile/src/db/repositories/transactions.ts` | Five exports: `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`. No single-movement read, no note write and no re-inclusion write exists |
| Function names other in-flight items add to that same file | #12 plan (merged), #13 plan (merged), #15 plan (PR #64), #10 plan (merged) | #12: `sumIncludedByDirectionAndCategory`, `sumIncludedByDirectionAndDay`, `listRecentMovements`. #13: `listPendingBatch`, `countCategorized`, `sumIncludedExpensesInPeriod`, `setUserCategory`, `setReviewFlag`, `excludeTransaction`. #15: `listTransactionsPage`, `countTransactionsByMonth`, `insertManualTransaction`. #10: `prepareBankTransactions` / `writeBankTransactionsInTx`. **None collides with this item's three names** (Decision 3) |
| That a category read already exists | `sed -n '58,66p' apps/mobile/src/db/repositories/categories.ts` | `getCategory(db, id, locale): Category \| undefined` — already exported, already resolves the JSON `labels` column and the emoji. This item reuses it rather than duplicating the mapper (Decision 3) |
| The inclusion-rule scanner's exact rules and allowlist | `sed -n '1,55p' apps/mobile/src/db/checks/inclusion-rule-scan.ts` | Rules applied to **comment-stripped** source: **A** an `sql` tagged template mentioning `excluded` / `included_amount` / `includedAmount`; **B** `isNull(` / `isNotNull(` on an expression ending `.excludedAt`; **C** the snake_case literals `excluded_at` / `included_amount`. Five allowlisted files; `repositories/transactions.ts` is not one. `.set({ excludedAt: null })` plus `eq(transactions.id, …)` trips none of the three (Decision 6) |
| Product mask storage | `grep -n "mask" apps/mobile/src/db/json.ts docs/project/4-database-model.md` | `ProductMetadata.mask?: string`, parsed by `parseProductMetadata`; the data model's own example is `{"balance":1842300,"mask":"4821"}` — the same digits the mockup draws (Decision 11) |
| A long-date formatter already exists | `sed -n '320,332p' packages/shared-utils/src/dates.ts` | `formatLongDate(dateLocal, locale)` → `viernes, 24 de enero de 2025` (`es`) — character-identical to the mockup's *Fecha* row. `formatTimeOfDay(instant)` → `11:20`. No new formatter is needed |
| The bundled device fixture's usable rows | Python parse of `apps/mobile/src/db/__fixtures__/store-v1.sql` | 13 movements, all `debit`, all `2026-01`. It already contains one `category_source = 'auto'` movement (`seed-movement-auto`, merchant `lider`), one uncategorized (`seed-movement-uncategorized`) and five excluded, including `seed-movement-excluded-shared-expense`. Behaviourally sufficient; **numerically** different from the mockup's sample values → Decision 11 |
| Category emoji available for the capture | `sed -n '246,268p' apps/mobile/src/theme.ts` | `comida: '🍔'`, `supermercado: '🛒'`, `uncategorized: '❓'`. The mockup draws the pair *"🛒 Comida"*, which no seeded category satisfies → Assumption A5 |
| `testID` is exempt from the i18n lint | `grep -n "no-literal-string" -A 16 apps/mobile/eslint.config.mjs` | `mode: 'jsx-text-only'` with `'jsx-attributes': { exclude: ['testID', 'accessibilityLabel', 'accessible'] }` — the literal `ready_test_id` of Decision 12 is not a lint violation |
| What `wired` requires of a fidelity target | #47 plan Decision 2 and validation table rows 15–19 | A `wired` mapping must carry `app_file`, `deep_link` and `ready_test_id`; the validator asserts the file exists **and that the `ready_test_id` string literally appears in it**, and that the deep link's `fidelityScreen` / `fidelityState` match → Decision 12 |
| `#16`'s coverage set in the fidelity contract | Coverage-set table in [`../20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md`](../20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md) | `\| #16 \| transaction-detail \| 4 \|` — four targets, all seeded `status: "planned"` |
| #15's treatment of this screen | `git show origin/implementation-plan/15-transactions-list:…/2_15-transactions-list_implementation-plan.md`, Decision 13 | *"A movement row navigates to `/transactions/[transactionId]`, which already exists as a placeholder route owned by #16. This item creates no route file… Nothing about the detail screen's internals — the exclusion sheet, re-inclusion, note editing — is planned here."* |
| #14's merchant route and its param name | `git show origin/implementation-plan/14-merchant-editor-alias-grouping:…/2_14-merchant-editor-alias-grouping_implementation-plan.md`, Decision 3 | Route `/categorize/merchant/[merchantId]`, with one **optional** param named `categoryId`. This item pushes the route with no param at all, so the #13/#14 param-name difference cannot affect it (Decision 8) |
| Catalogue key rules | `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Flat dotted snake_case keys matching `^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$`; identical `es` / `en` key sets; every value a non-empty string; no nested objects. 122 keys today |
| React render-testing library availability | `grep -rn "testing-library" apps/mobile/package.json package.json` | Absent. Screens are verified through pure functions, static source scans and the device runbook (precedent: #2, #34, #8, #13) |
| The in-memory test helpers this plan names | `grep -rn "export function loadFixture\|export async function openBootstrappedMemoryDb" apps/mobile/src/db/testing/*.ts` | `testing/load-fixture.ts:12` and `testing/memory-db.ts:60`. Both exist today; Decision 11 and Scenario 22 consume them unchanged |
| The typed bootstrap rejection the concurrency addendum names | `grep -n "DatabaseBootstrapError" apps/mobile/src/db/bootstrap.ts` | `export class DatabaseBootstrapError extends Error` at line 22, thrown at lines 63 and 73. The error-propagation claim is not hypothetical |
| Open pull requests at plan time (bounded same-surface scope) | `gh pr list --state open --json number,title,headRefName` | #64 `implementation-plan/15-transactions-list`, #63 `implementation-plan/19-…`, #62 `implementation-plan/14-…`, #61 `feature/47-design-fidelity-gate`, #60 `fix/12-plan-post-merge-review`, #46 `feature/6-…`, #44 `feature/5-…` |

### Unverified claims — the implementer must confirm before proceeding

Every symbol in the table below is described by a **merged plan document**, not by code that
exists on `develop` at `09fb7dd`. Each is therefore recorded here as *unverified*, and
[Implementation Order Step 0](#implementation-order) re-checks it against merged `develop` and
**stops the run** on a mismatch rather than adapting silently. No claim in this plan about these
symbols should be read as a claim about shipped code.

| Symbol | Recorded shape | Owner (and its state) |
| --- | --- | --- |
| `getAppDatabase(): Promise<AppDatabase>` in `src/db/runtime.ts` | Memoized, clears its memo on failure, rejects with `DatabaseBootstrapError` | #8 — plan merged, implementation pending |
| `ExcludeSheet` and its props | `visible`, `onCancel`, `onConfirm({ reason, note })`, plus this item's additive `reasons` / `showNote` | #13 — plan merged, implementation pending |
| `CategoryGrid` | Presentational chip grid rendering a `CategoryChoice[]` plus the *Elegir otra* tile | #13 — same |
| `buildCategoryChoices({ suggestion, used, taxonomy })`, `MAX_CATEGORY_CHIPS` | Pure; suggestion first, capped at seven | #13 — same |
| `setUserCategory(db, id, categoryId, ports)`, `excludeTransaction(db, id, { reason, note }, ports)`, `listMostUsedCategories(db, …)` | #13 Decision 5's signatures | #13 — same |
| `useFidelityPreview()`, `fidelityTestId(screenId)` in `src/lib/fidelity-preview.ts` | `{ active, state }`; `fidelity-<screenId>` | #47 — plan merged, implementation open on PR #61 |
| `suggestCategory({ currentCategorySource, merchant })` | Returns `null` for a user-sourced category, no merchant, or no default | #5 — open PR #44; reaches this screen only through `buildCategoryChoices` |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Plan artifact base branch and artifact owner | `develop`; this repository owns the plan (`mode` absent in `.ai-dev-workflow.yaml` ⇒ `single_repo`) | `.ai-dev-workflow.yaml`; `AGENTS.md` → *Git & Branching* | 2026-08-02T18:39Z, repo `09fb7dd` | Current invocation item `{#16}`; no open PR changes the base-branch contract | `Verified` |
| Screen data-access pattern | `getAppDatabase()` from `apps/mobile/src/db/runtime.ts` plus repository functions, behind feature hooks. **No TanStack Query, no provider, no `app/_layout.tsx` change** | Item #8's merged plan; #12 Decision 7; #13 Decision 16; #15 Decision 1; the parent orchestrator's campaign-wide binding decision | 2026-08-02T18:39Z, repo `09fb7dd` | Current invocation item `{#16}`; same-surface siblings #8, #12, #13, #9, #15 all record the identical pattern; no open PR proposes a competing one | `Verified` |
| Ownership of the `*.db.test.ts` Jest routing | The two additive lines in `apps/mobile/jest.config.js` belong to **#12**; later items reuse the convention and add the lines only if #12's implementation has not landed them | #12's merged plan, Infrastructure block (`f1fc56e`); #13 Decision 16 records the same | 2026-08-02T18:39Z, repo `09fb7dd` | Same-surface siblings #12, #13, #15. The two lines are byte-identical in every plan, so the later lander is a no-op | `Verified` |
| Fidelity contract path, lifecycle vocabulary, preview helpers, and the #16 coverage set | `scripts/mobile-ui/fidelity-targets.json`; `status: "planned" \| "wired"`; `apps/mobile/src/lib/fidelity-preview.ts` exports `useFidelityPreview()` and `fidelityTestId()`; #16 owns **4** targets | #47's merged implementation plan (Decisions 2, 6, 9 and the coverage-set table) | 2026-08-02T18:39Z, repo `09fb7dd` | Same-surface open PRs: #61 (#47's own implementation) and #64 (#15's four `transactions` targets). #15's `screen_id` set is disjoint from `transaction-detail` | `Verified` — Step 0 re-verifies against merged `develop`, not against the plan document |
| Function-name ownership inside `src/db/repositories/transactions.ts` | This item claims `getTransactionContext`, `setTransactionNote`, `reincludeTransaction` | The four sibling plan documents (Verification Log row *"Function names other in-flight items add…"*) | 2026-08-02T18:39Z, repo `09fb7dd` | Same-surface items #10, #12, #13 (plans merged) and #15 (plan PR #64). Enumerated and disjoint | `Verified` |
| Reusable categorization surfaces | `src/features/categorization/components/ExcludeSheet.tsx`, `components/CategoryGrid.tsx`, `category-choices.ts` (`buildCategoryChoices`, `MAX_CATEGORY_CHIPS`), and the repository writes `setUserCategory` / `excludeTransaction` | #13's merged implementation plan, Decisions 5–8 and its Layer-by-Layer block | 2026-08-02T18:39Z, repo `09fb7dd` | Current invocation item `{#16}`; #13's implementation has not opened a PR yet, so no competing definition exists | `Verified` at plan time against a **merged plan, unimplemented code** — every such symbol is listed in [Unverified claims](#unverified-claims--the-implementer-must-confirm-before-proceeding). Step 0 re-verifies each against merged `develop` and stops on a mismatch (Risk R1) |
| `mu-list` / `mu-item*` / `mu-topbar*` ownership | Stay `deferred`; screens compose these rows locally in their feature folder | `apps/mobile/src/test-utils/mu-class-map.ts` at `09fb7dd`; #13 Decision 13; #15 Decision 11; #9's Layer-by-Layer | 2026-08-02T18:39Z, repo `09fb7dd` | Same-surface open PRs #62, #63, #64 — all leave these entries `deferred` | `Verified` — this plan leaves `MU_CLASS_MAP` unchanged (Decision 10) |
| Navigation seam into this screen | A movement row in `#screen=transactions` pushes `/transactions/[transactionId]`; #15 creates no route file and plans nothing about this screen's internals | #15's plan Decision 13, on open PR #64 | 2026-08-02T18:39Z, PR #64 head | Same-surface open PR: #64 only | `Verified` at plan time against an **open** PR. Step 0 re-verifies the seam against whatever #15 merged and, if #15 has not merged, the runbook's Step 2 falls back to the deep link (runbook *Known Limitations*) |
| **Exclusion-reason vocabulary offered by this screen** | The detail sheet offers the **four** reasons the mockup draws (`personal_transfer`, `shared_expense`, `not_relevant`, `other`); the *display* mapping covers all **five** stored values, so a movement excluded as `cash_withdrawal` elsewhere still renders its reason | `design/mockups/mobile/index.html#screen=transaction-detail&state=exclude-sheet` (four radios) vs `#screen=categorize&state=exclude-sheet` (five radios) vs the `exclusion_reason` column's five-value domain in `docs/project/4-database-model.md` line 270 | 2026-08-02T18:39Z, repo `09fb7dd` | Current invocation item `{#16}`; same-surface sibling #13 (plan merged) offers all five from its own sheet. No open PR changes either drawing | `Resolved` — decision owner: this run's tech-lead, under the run's *"no human available; decisions yours within the brief"* instruction. AGENTS.md non-negotiable 6 makes the drawing the contract, and the fidelity capture of `exclude-sheet` would fail against a fifth radio. Recorded as **Decision 5** and **Assumption A3**, and raised for LH in the PR body |

No conflict remains open. One row is `Resolved` rather than `Verified` and names its decision
owner. Implementation Order Step 0 repeats the data-access, reusable-surface, fidelity and
navigation-seam rows before any file edit and records `Still valid` or `Stale or conflicting` in
the implementation PR.

---

## Key Decisions

Decision indices are stable within this document and are referenced from Layer-by-Layer, Testing
Strategy, Seed Data, Risks and Implementation Order.

### Decision 1 — The route stays thin; the screen lives in `src/features/transaction-detail/`

`docs/best-practices/stack/expo-react-native.md` → *Screen structure*: *"A route file that
contains business logic or a SQL query is in the wrong place."*
`apps/mobile/app/transactions/[transactionId].tsx` becomes an import, the `transactionId` route
param, the literal `ready_test_id` of Decision 12, and a one-line render of
`TransactionDetailScreen`. The `dbAccessBoundary` ESLint rule and
`src/db/__tests__/db-access-boundary.test.ts` already forbid a SQL import anywhere outside
`src/db/`, so the layering `app/ → feature hooks → src/db → SQLite` is machine-checked on every
file this item adds. The route path is unchanged, so `route-manifest-parity.test.ts` stays green
with no edit.

### Decision 2 — Data access follows the campaign pattern: `getAppDatabase()` plus repository functions, behind feature hooks. **No TanStack Query.**

Identical to #8, #12, #13, #9 and #15. Concretely:

- **No** `@tanstack/react-query`, **no** `src/providers/`, **no** change to
  `apps/mobile/app/_layout.tsx`. This item adds no runtime dependency at all.
- **Two hooks**, both in `src/features/transaction-detail/`:
  - `useTransactionDetail(transactionId)` in `use-transaction-detail.ts` — the read side, over
    the pure composition `readTransactionDetail(db, params)`. It awaits `getAppDatabase()` once
    behind a `cancelled` guard and re-reads when a `useFocusEffect`-driven `reloadToken` changes,
    so a category confirmed in #13's flow or a movement excluded elsewhere is reflected on
    return.
  - `useTransactionDetailActions(transactionId)` in `use-transaction-detail-actions.ts` — the
    write side, exposing `changeCategory`, `saveNote`, `excludeMovement` and `reincludeMovement`.
    Each awaits the same memoized handle and calls exactly one repository function.
- Because the driver is synchronous (`BaseSQLiteDatabase<'sync', …>`), every call after the
  handle resolves is a plain function call, so `readTransactionDetail` returns **one snapshot
  taken in a single uninterrupted pass**: the movement, its merchant, its product, its category
  and the picker's chip inputs can never describe different store states.

### Decision 3 — Three new `src/db` exports; two of them write, and neither writes a bank fact

All three live in existing repository files, because `src/db` is the only directory allowed to
contain SQL.

| Export | File | Purpose |
| --- | --- | --- |
| `getTransactionContext(db, transactionId)` | `repositories/transactions.ts` | One `SELECT` joining `transactions` with `merchants` and `user_financial_products`, returning `TransactionContext \| undefined`. **No exclusion predicate**: an excluded movement must still open (BR3) |
| `setTransactionNote(db, transactionId, note, ports)` | `repositories/transactions.ts` | Writes `note` (trimmed; `null` when blank, so an empty string never reaches the column) and `updated_at`. Nothing else |
| `reincludeTransaction(db, transactionId, ports)` | `repositories/transactions.ts` | Writes `excluded_at = null`, `exclusion_reason = null`, `exclusion_note = null`, and `updated_at`. Nothing else (Decision 6) |

The category is **not** re-read by a join: `readTransactionDetail` calls the already-exported
`getCategory(db, categoryId, locale)`, which owns the JSON `labels` / `assets` mapping. Adding a
second category mapper would be a duplicate of logic that already exists.

Four guarantees these writes carry, each with a named enforcement mechanism:

- **Never a delete.** No `delete` statement is added anywhere. The existing file-level comment in
  `repositories/transactions.ts` — *"There is no `deleteTransaction` export anywhere in this file
  or in `src/db` … a movement is never deleted, only excluded"* — stays true, and Scenario 18's
  guard asserts the vocabulary is absent from this item's screen tier too. "Eliminar" appears in
  no catalogue key this item adds (BR3).
- **Never a bank fact.** Neither write's `set` object names `rawDescription`, `amount`, `type`,
  `occurredAt`, `dateLocal`, `externalId` or `dedupHash`. Scenario 5 asserts this at the store
  level by comparing every bank-owned column before and after each write; Scenario 18 asserts it
  at the source level (AC1).
- **Never `included_amount`.** Neither write names that column, and partial inclusion has no UI in
  the MVP (`docs/project/4-database-model.md` line 272). Scenario 18's Rule 2 keeps the
  identifier out of the screen tier entirely.
- **Never resurrected by a re-sync.** `upsertBankTransactions` refreshes only bank-owned columns;
  its doc comment enumerates the nine person-owned columns that never appear in its update `set`
  object. This item consumes that seam and adds nothing to it; Scenario 11 re-asserts it for a
  re-included movement.

### Decision 4 — State resolution: `excluded` outranks everything, and the auto-suggestion caption is driven only by `category_source`

`resolveDetailState(transaction)` in `detail-state.ts` is a pure function returning
`'categorized' | 'uncategorized' | 'excluded'`:

```text
excludedAt !== null                      → 'excluded'
transactionCategoryId !== null           → 'categorized'
otherwise                                → 'uncategorized'
```

The sheet is not a fourth value: `exclude-sheet` is the `categorized` (or `uncategorized`) screen
with `ExcludeSheet` visible, exactly as the mockup draws it — the same `data-states="categorized
exclude-sheet"` blocks render behind the overlay.

Two consequences the mockup makes explicit and this plan encodes:

1. **The category row is data, not state.** The mockup renders `🛒 Comida` under
   `data-states="categorized excluded exclude-sheet"` and the *Sin categorizar* badge under
   `data-states="uncategorized"`. The screen therefore renders the resolved category whenever
   `transaction_category_id` is non-null and the badge otherwise — **independently** of
   exclusion. An excluded movement that was never categorized shows the badge.
2. **The caption is a `category_source` predicate, not a state predicate.**
   `showsAutoSuggestionCaption(transaction)` returns `true` only when
   `categorySource === 'auto'` **and** a category is present. The brief's AC2 is the authority;
   the mockup's `excluded` sample simply happens not to be auto-categorized, which the fixture
   reproduces by giving the excluded row `category_source = 'user'` (Decision 11). The caption is
   never rendered by state.

`resolveActionSet(state, hasMerchant)` returns the drawn button list for the state, with the
merchant action omitted when no merchant resolved (Decision 8).

### Decision 5 — The exclusion sheet is #13's `ExcludeSheet`, extended additively, not a second sheet

The two drawings differ: `#screen=categorize&state=exclude-sheet` has five reasons and an
optional note field; `#screen=transaction-detail&state=exclude-sheet` has four reasons and no
note field. Both draw the same title, the same question, the same *Cancelar* / *Confirmar* pair,
and pre-select the first radio.

Rather than write a second sheet, this item adds two **optional** props to #13's component,
defaulted so #13's own call site is unchanged:

```ts
// Illustrative — adapt during implementation. UNVERIFIED: #13's component does not exist on
// develop yet, so these prop names are read from #13's merged plan, not from code. Step 0
// re-checks them and stops on a mismatch.
// apps/mobile/src/features/categorization/components/ExcludeSheet.tsx (#13 owns this file)
export type ExcludeSheetProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (input: { reason: ExclusionReason; note: string | null }) => void;
  /** Defaults to all five reasons — #13's own drawing. #16 passes the four its mockup draws. */
  reasons?: readonly ExclusionReason[];
  /** Defaults to true — #13 draws the optional note field; #16's sheet does not. */
  showNote?: boolean;
};
```

`DETAIL_EXCLUSION_REASONS` — the ordered four — lives in
`src/features/transaction-detail/exclusion-copy.ts`. `showNote={false}` means an exclusion made
from this screen always stores `exclusion_note = null`; the column keeps its meaning and the
categorization flow keeps writing it.

The sheet's **copy stays #13's**: `categorize.exclude_sheet_title`,
`categorize.exclude_sheet_question`, `categorize.exclude_reason_*`, `categorize.exclude_cancel`
and `categorize.exclude_confirm` are the component's own keys and are reused verbatim, because
the two drawings are character-identical for every string they share. This item adds **no**
duplicate exclusion keys. Renaming that namespace to something sheet-owned is a later catalogue
refactor, not this item's job (Out of Scope).

### Decision 6 — Re-inclusion is one `UPDATE` that clears exactly three columns

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/repositories/transactions.ts
export function reincludeTransaction(
  db: AppDatabase,
  transactionId: string,
  ports: { now: () => string },
): void {
  // BR3: this is an UPDATE. The row is never deleted, and no bank-owned column is named here.
  // `included_amount` is deliberately absent: partial inclusion has no UI in the MVP.
  db.update(transactions)
    .set({
      excludedAt: null,
      exclusionReason: null,
      exclusionNote: null,
      updatedAt: ports.now(),
    })
    .where(eq(transactions.id, transactionId))
    .run();
}
```

Three properties, each with its mechanism:

- **It restores the movement to every aggregate** (AC3) because every aggregate reads through
  `isIncluded` / `includedAmount` in `src/db/fragments.ts`, whose predicate is
  `excluded_at is null`. Clearing the column is sufficient; no aggregate is touched. Scenario 7
  proves it through `totalForCategoryInPeriod`.
- **It does not restate the inclusion rule.** The Verification Log records the scanner's three
  rules; a `.set({ excludedAt: null })` object plus `eq(transactions.id, …)` matches none of
  them, so `inclusion-rule-single-definition.test.ts` stays green without an allowlist entry.
- **It is idempotent.** Re-including an already-included movement writes the same three nulls and
  bumps `updated_at`; it neither throws nor changes anything else (Scenario 9).

The category is **not** cleared. A person who categorized a movement and then excluded it gets
that category back on re-inclusion — the exclusion is a separate decision from the category, and
BR3's *"the record stays"* applies to the person's layer as much as the bank's.

### Decision 7 — Category change is a local sheet composed from #13's chip surfaces

The mockup's *Cambiar categoría* / *Categorizar ahora* buttons call `go('categorize')`, which is
the mockup's own navigation shorthand; `BEHAVIOR.md` lists this screen's actions without an
arrow (*"cambiar categoría; editar nota; excluir / reincluir"*), and uses `→` elsewhere when it
means navigation (*"fila → `transaction-detail`"*). Navigating to `/categorize` is also wrong in
substance: that screen walks the **pending queue**, and an already-categorized movement is not in
it.

So the change happens in place, in `components/CategoryPickerSheet.tsx` — a `Sheet` containing
#13's `CategoryGrid`, fed by #13's `buildCategoryChoices({ suggestion, used, taxonomy })` with
exactly the inputs #13 gives it: `listCategories(db, { income })` for the movement's own
direction, `listMostUsedCategories(db, …)` for the usage ordering, and `suggestCategory` for the
✨ chip. Confirming a chip calls `setUserCategory` — the same repository write `confirmCategory`
calls in #13's `useStageActions`. Nothing about chip ordering, chip capping or the *Elegir otra*
tile is reimplemented here.

The picker is **not** a manifest state and therefore **not** a fidelity target: the manifest
declares four states for this screen and the contract's target universe is derived from the
manifest, so no entry is possible for it (Assumption A4). The four declared states are all
captured.

### Decision 8 — The merchant shortcut is a plain route push, with no param

*Configurar comercio* pushes `/categorize/merchant/[merchantId]`, which exists today as a
`RoutePlaceholder` and is owned by #14. This item passes **no** query parameter: #14's optional
`categoryId` param exists to pre-select a default category when arriving from the categorization
flow, and this screen has no such intent. That also sidesteps the param-name difference between
#13's plan (`defaultCategoryId`) and #14's plan (`categoryId`) entirely — it is not this item's
conflict to resolve.

When the movement has no merchant, the button is **not rendered**. The mockup's sample always has
one, and rendering a disabled button that navigates nowhere is worse than omitting an action that
does not exist (same treatment as #13's spec A8). The *Comercio* info row falls back to a dash in
that case (Assumption A6).

### Decision 9 — The note is saved on blur and flushed at teardown; never on every keystroke

`TextField` is controlled, so the draft lives in React state. A write per keystroke would be one
`UPDATE` per character; a debounce would add a timer to the concurrency surface for no user-visible
gain. Instead:

- `saveNote` is called on the field's `onBlur`, **and only when** the trimmed draft differs from
  the stored value.
- The same comparison runs in the `useFocusEffect` cleanup and on unmount, so leaving the screen
  with the keyboard still open flushes the draft. That flush is the one write this feature issues
  during teardown; it is fire-and-forget by design (the decision is the person's, and the screen
  is gone), and its rejection path is described in the concurrency addendum.
- A blank or whitespace-only draft stores `null`, not `''` (Scenario 4).

### Decision 10 — `mu-topbar*`, `mu-list` and `mu-item*` stay `deferred`; compose screen-locally

The Verification Log shows seven of the 48 classes this screen draws are classified `deferred` in
`MU_CLASS_MAP` — the three `mu-topbar*` classes to #12 and the four `mu-list` / `mu-item*`
classes to #19. `MU_CLASS_MAP` records which `src/components/ui/` **primitive owns** a mockup
class, not which screen has rendered something that looks like it; changing an entry here would
make `mu-class-coverage.test.ts` assert an owner that does not exist in the barrel.

**Decision**: build `components/DetailTopBar.tsx` as a screen-local composition of `Text` and
`Pressable`, and let the four radio rows inside `ExcludeSheet` stay #13's screen-local
composition. `MU_CLASS_MAP` is **unchanged in the diff** — the same precedent #9, #13 and #15 set.

### Decision 11 — A committed delta fixture, `transaction-detail-v1.sql`, reproduces the mockup's own sample values

The bundled `store-v1.sql` already covers the behaviour (it has an `auto` movement, an
uncategorized one and five excluded ones), so the *runbook* could run from it. The **fidelity
captures** could not: the mockup draws `$35.000`, `Líder S.A.`, `viernes, 24 de enero de 2025`,
`11:20`, `Cta. corriente ••4821` and the note `Compras semanales`, and none of those match the
seeded rows. #47 Decision 4 forbids fixing a capture by raising a threshold, so the fixture is
what has to match.

`store-v1.sql` is #3's generated artifact and several merged tests read it; this item does not
modify it. It adds `apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql`: a small,
hand-written, reviewed **delta** of `INSERT OR REPLACE` statements assuming a bootstrapped store
(schema and starter seeds present). Contents are specified in [Seed Data](#seed-data); ids are
literal and prefixed `detail-` so the file is diffable and idempotent, and so the four deep links
of Decision 12 can name a concrete movement.

It is applied in two places, and a test keeps them honest:

- **On device** (runbook Step 0): `sqlite3` against the simulator's app container. No app code and
  no route, so it cannot collide with #12's `/(dev)/sample-data` panel or #15's demo generator.
- **In Jest** (`db` project): through the existing `loadFixture()` helper into
  `openBootstrappedMemoryDb()`, asserting the three movements and their person-layer are exactly
  as specified (Scenario 22).

### Decision 12 — The four fidelity targets flip `planned` → `wired`, and the route file carries the literal `ready_test_id`

#47's validator asserts that a `wired` target's `ready_test_id` string **literally appears in its
`app_file`** (validation row 17). `app_file` for all four targets is the route file, so the route
file — not the screen component — carries the literal:

```tsx
// Illustrative — adapt during implementation.
// apps/mobile/app/transactions/[transactionId].tsx
import { useLocalSearchParams } from 'expo-router';

import { TransactionDetailScreen } from '../../src/features/transaction-detail/TransactionDetailScreen';

/** Must equal `fidelityTestId('transaction-detail')`; Scenario 23 asserts the equality, and
 * #47's contract validator requires this literal to appear in this file. */
const READY_TEST_ID = 'fidelity-transaction-detail';

export default function TransactionDetailRoute() {
  const { transactionId } = useLocalSearchParams<{ transactionId: string }>();
  return <TransactionDetailScreen transactionId={transactionId} testID={READY_TEST_ID} />;
}
```

The four mappings, all with `fixture: "transaction-detail"` and
`ready_test_id: "fidelity-transaction-detail"`:

| `state_id` | `deep_link` |
| --- | --- |
| `categorized` | `finanzas:///transactions/detail-tx-categorized?fidelity=1&fidelityScreen=transaction-detail&fidelityState=categorized` |
| `uncategorized` | `finanzas:///transactions/detail-tx-uncategorized?fidelity=1&fidelityScreen=transaction-detail&fidelityState=uncategorized` |
| `excluded` | `finanzas:///transactions/detail-tx-excluded?fidelity=1&fidelityScreen=transaction-detail&fidelityState=excluded` |
| `exclude-sheet` | `finanzas:///transactions/detail-tx-categorized?fidelity=1&fidelityScreen=transaction-detail&fidelityState=exclude-sheet` |

The screen reads `useFidelityPreview()` and, when `active`, opens `ExcludeSheet` for
`state === 'exclude-sheet'` and otherwise renders whatever the movement's own data produces — the
three fixture rows are built so each requested state is the state its movement genuinely is in.
The `transaction-detail` entry is added to the contract's `fixtures` map with a one-line
description. No `max_mismatch_pct` override and no `threshold_note` is planned; a failing capture
is fixed in the screen or the fixture, or escalated (Risk R5).

### Decision 13 — One catalogue namespace, `transaction_detail.*`

Flat, dotted, matching the key pattern `catalogue-parity.test.ts` enforces. Emoji the mockup
draws as content (🚫, ❓) are catalogue values too, following the `ds.note.info_icon` precedent —
an emoji is copy, and hard-coding one in JSX would trip `i18next/no-literal-string`. The category
emoji is **not** a catalogue value: it comes from the store, through `getCategory`. The full key
map is in [Copy contract mapping](#copy-contract-mapping); the exclusion sheet's own copy stays
in #13's `categorize.exclude_*` keys (Decision 5).

### Decision 14 — The immutable/mutable split is asserted mechanically, twice

AC1 is the item's central claim, and a screen that "just doesn't have an input there" is not
evidence. Two independent guards hold it:

- **Store level** (Scenario 5, `db` project): before and after each of the four writes this
  screen can issue — `setTransactionNote`, `setUserCategory`, `excludeTransaction`,
  `reincludeTransaction` — the seven bank-owned columns `raw_description`, `amount`, `type`,
  `occurred_at`, `date_local`, `external_id`, `dedup_hash` are compared and must be byte-identical.
- **Source level** (Scenario 18, `app` project): a static scan over this item's screen tier and
  over `repositories/transactions.ts`, described in full in the
  [Parser-risk addendum](#parser-risk-addendum).

---

## Layer-by-Layer Changes

### Database / Data Layer — `apps/mobile/src/db/`

- [ ] `repositories/transactions.ts` — add `getTransactionContext`, `setTransactionNote`,
      `reincludeTransaction` (Decision 3). No new file: `src/db` is the only place SQL may live
      and these belong to the `transactions` table.
- [ ] `types.ts` — add `TransactionContext` (`{ transaction: Transaction; merchantName: string |
      null; product: ProductSummary | null }`) and `ProductSummary`
      (`{ id: string; name: string; mask: string | undefined }`).
- [ ] `__fixtures__/transaction-detail-v1.sql` — new delta fixture (Decision 11).
- [ ] **No migration, no schema change, no change to `fragments.ts`.** `included_amount` keeps its
      column and stays unwritten.
- [ ] **Consumed, not changed**: `getCategory`, `listCategories` (`repositories/categories.ts`),
      `parseProductMetadata` (`json.ts`), `isIncluded` / `includedAmount` (`fragments.ts`, read by
      the aggregate Scenario 7 asserts against, never restated here).

### Shared Packages / Libraries

- [ ] `@finanzas/shared-utils` — **consumed, not changed**: `formatClp`, `formatLongDate`,
      `formatTimeOfDay`.
- [ ] `@finanzas/shared-domain` — **consumed, not changed**, and only transitively: `suggestCategory`
      reaches this screen through #13's `buildCategoryChoices`.

### Providers, query layer, `app/_layout.tsx`

**None.** Decision 2: no `src/providers/`, no `@tanstack/react-query`, no root-layout change.
`apps/mobile/package.json` gains no dependency and no script.

### Frontend / UI — `apps/mobile/src/features/transaction-detail/` (new)

- [ ] `read-detail.ts` — `readTransactionDetail(db, { transactionId, locale })`: the pure
      composition of `getTransactionContext`, `getCategory`, `listCategories` and
      `listMostUsedCategories` into one snapshot. No React, no SQL of its own.
- [ ] `use-transaction-detail.ts` — `useTransactionDetail(transactionId)`. Returns
      `{ status: 'pending' | 'ready' | 'missing' | 'error', … }`; `missing` is the branch for an
      id that resolves to nothing (Assumption A7).
- [ ] `use-transaction-detail-actions.ts` — `useTransactionDetailActions(transactionId)`:
      `changeCategory`, `saveNote`, `excludeMovement`, `reincludeMovement`, each behind the
      single-flight ref of the concurrency addendum.
- [ ] `detail-state.ts` — `resolveDetailState`, `showsAutoSuggestionCaption`, `resolveActionSet`.
      Pure (Decision 4).
- [ ] `product-label.ts` — `formatProductLabel({ name, mask })`. Pure.
- [ ] `exclusion-copy.ts` — `DETAIL_EXCLUSION_REASONS` (the ordered four of Decision 5) and
      `exclusionReasonKey(reason)` covering all five stored values. Pure.
- [ ] `TransactionDetailScreen.tsx` — composition, preview handling, sheet visibility.
- [ ] `components/DetailTopBar.tsx`, `components/DetailHeroCard.tsx`,
      `components/DetailInfoCard.tsx`, `components/DetailNoteField.tsx`,
      `components/ExclusionNote.tsx`, `components/DetailActions.tsx`,
      `components/CategoryPickerSheet.tsx` — presentational, composed from `src/components/ui`
      primitives plus the screen-local top bar of Decision 10. No data access.

### Frontend / UI — reused from `apps/mobile/src/features/categorization/` (#13)

- [ ] `components/ExcludeSheet.tsx` — **modified additively**: two optional props, `reasons` and
      `showNote`, both defaulted to #13's current behaviour (Decision 5). No other change; #13's
      call site is untouched.
- [ ] `components/CategoryGrid.tsx` — **consumed unchanged** by `CategoryPickerSheet`.
- [ ] `category-choices.ts` — **consumed unchanged**: `buildCategoryChoices`, `MAX_CATEGORY_CHIPS`.

### Routing — `apps/mobile/app/transactions/`

- [ ] `[transactionId].tsx` — replace the `RoutePlaceholder` body with the route shell of
      Decision 12. The route path is unchanged, so `route-manifest-parity.test.ts` needs no edit.
- [ ] No other route file is created, moved or modified. `(tabs)/transactions.tsx` belongs to #15.

### i18n — `apps/mobile/src/i18n/`

- [ ] `es.json` / `en.json` — the keys in [Copy contract mapping](#copy-contract-mapping).
      Spanish verbatim from the mockup; English is a fallback and not a product commitment, but
      must be a non-empty string for every key or `catalogue-parity.test.ts` fails.

### Tooling / configuration

- [ ] `scripts/mobile-ui/fidelity-targets.json` — flip the four `transaction-detail` targets to
      `wired` with `app_file`, `deep_link`, `ready_test_id` and `fixture: "transaction-detail"`;
      add the `transaction-detail` entry to the contract's `fixtures` map (Decision 12).
- [ ] `apps/mobile/jest.config.js` — the two additive lines #12's plan specifies, **only if no
      sibling implementation has already landed them**:
      `'<rootDir>/src/features/**/*.db.test.ts'` appended to the `db` project's `testMatch`, and
      `'\\.db\\.test\\.ts$'` appended to the `app` project's `testPathIgnorePatterns`.
      Byte-identical in every plan that names them, so the later lander is a no-op.
- [ ] `apps/mobile/package.json`, root `package.json` — **no** new script and **no** new
      dependency.
- [ ] No executable shell guidance is added to a framework-owned surface, so no shell contract
      (`bash` / `bash-zsh`) declaration and no snippet-linter run applies to this item. The
      runbook's `sqlite3` block is operator guidance in a testing document, in the same shape #13's
      runbook already uses.

---

## Copy contract mapping

Spanish is verbatim from `design/mockups/mobile/index.html#screen=transaction-detail`. Values
this plan invents are marked ✚ and are listed again in [Assumptions](#assumptions-this-plan-adds).

| Key | Spanish value |
| --- | --- |
| `transaction_detail.topbar_title` | Detalle de transacción |
| `transaction_detail.back_a11y` | Volver ✚ |
| `transaction_detail.badge_expense` | Gasto |
| `transaction_detail.badge_income` | Ingreso ✚ |
| `transaction_detail.badge_excluded` | Excluida del análisis |
| `transaction_detail.icon_uncategorized` | ❓ |
| `transaction_detail.icon_excluded` | 🚫 |
| `transaction_detail.info_title` | Información |
| `transaction_detail.info_merchant` | Comercio |
| `transaction_detail.info_date` | Fecha |
| `transaction_detail.info_time` | Hora |
| `transaction_detail.info_product` | Producto |
| `transaction_detail.info_category` | Categoría |
| `transaction_detail.info_missing` | — ✚ |
| `transaction_detail.category_value` | {{emoji}} {{name}} |
| `transaction_detail.uncategorized_badge` | Sin categorizar |
| `transaction_detail.auto_suggested` | Categoría sugerida automáticamente según el comercio |
| `transaction_detail.product_value` | {{name}} ••{{mask}} |
| `transaction_detail.description_label` | Descripción del banco |
| `transaction_detail.note_label` | Nota |
| `transaction_detail.note_placeholder` | Agregar una nota… |
| `transaction_detail.excluded_note_icon` | 🚫 |
| `transaction_detail.excluded_note_strong` | Excluida del análisis. |
| `transaction_detail.excluded_note_body` | Motivo: {{reason}}. No cuenta en totales ni gráficos. |
| `transaction_detail.reason_personal_transfer` | transferencia personal ✚ |
| `transaction_detail.reason_shared_expense` | involucra más personas |
| `transaction_detail.reason_not_relevant` | gasto no relevante ✚ |
| `transaction_detail.reason_cash_withdrawal` | retiro de efectivo ✚ |
| `transaction_detail.reason_other` | otro ✚ |
| `transaction_detail.action_categorize` | Categorizar ahora |
| `transaction_detail.action_change_category` | Cambiar categoría |
| `transaction_detail.action_merchant` | Configurar comercio |
| `transaction_detail.action_exclude` | Excluir del análisis |
| `transaction_detail.action_reinclude` | Volver a incluir en el análisis |
| `transaction_detail.picker_title` | Elegir categoría ✚ |
| `transaction_detail.picker_cancel` | Cancelar ✚ |
| `transaction_detail.write_failed_icon` | ⚠️ ✚ |
| `transaction_detail.write_failed` | No pudimos guardar ese cambio. Inténtalo de nuevo. ✚ |
| `transaction_detail.not_found` | No encontramos esta transacción. ✚ |

39 keys. The mockup draws the excluded note as *"**Excluida del análisis.** Motivo: involucra más
personas. No cuenta en totales ni gráficos."*, so the reason values are lower-case sentence
fragments — deliberately **not** the same strings as #13's sheet radio labels
(*"Involucra a más personas"*), which are title-case options. Both spellings are drawn, in
different places, and both are kept verbatim.

---

## Assumptions this plan adds

All are reversible, and each names what changes if it is reversed.

| # | Assumption | Rationale | Cost to reverse |
| --- | --- | --- | --- |
| A1 | The category picker is a sheet on this screen, not a navigation to `/categorize` (Decision 7) | `BEHAVIOR.md` lists this screen's actions without a `→`, and `/categorize` walks the pending queue, which an already-categorized movement is not in. The mockup's `go('categorize')` is mockup navigation shorthand | One component and one button handler |
| A2 | Re-inclusion keeps the category (Decision 6) | The exclusion and the category are separate decisions; BR3's *"the record stays"* covers the person's layer too | Three characters in one `set` object |
| A3 | The detail sheet offers four reasons; `cash_withdrawal` remains reachable only from the categorization flow, and is still **displayed** correctly here (Decision 5) | AGENTS.md non-negotiable 6 makes the drawing the contract, and a fifth radio would fail the `exclude-sheet` capture | One entry in `DETAIL_EXCLUSION_REASONS` — **flagged for LH** |
| A4 | The category picker is not a fidelity target | The contract's target universe is derived from the manifest, which declares four states for this screen | Nothing today; a manifest change would be needed first |
| A5 | The `categorized` / `excluded` captures use the seeded `supermercado` category (🛒 Supermercado) | The mockup draws *"🛒 Comida"*, pairing `supermercado`'s emoji with `comida`'s name; no seeded category is both. The 34 px hero glyph matches, and only one small info-row token differs | One id in the fixture — **flagged for LH** |
| A6 | With no merchant, the *Comercio* row shows `transaction_detail.info_missing` and the merchant button is not rendered (Decision 8) | The mockup's sample always has a merchant; a disabled button that navigates nowhere is worse than an absent action | One branch in `resolveActionSet` |
| A7 | An unresolvable `transactionId` renders `transaction_detail.not_found` with a back action rather than crashing | The route is deep-linkable, so a bad id is reachable | One branch in the screen |
| A8 | The note is saved on blur and flushed at teardown, not per keystroke and not on a timer (Decision 9) | One `UPDATE` per character is wasteful; a debounce adds a timer to the concurrency surface for no visible gain | One handler |
| A9 | The product row renders the stored product `name` plus `••{mask}`, with no type→label abbreviation table | #15's Assumption A6 already treats the drawn product pills as **data**; inventing a second, abbreviating label map would put two spellings of one product in the app | One formatter |
| A10 | Nine invented strings (marked ✚ in the copy table) — the failure and not-found messages, the picker's title and cancel, the income badge, the em-dash placeholder, four of the five reason fragments, and the back label | The mockup draws only one direction, one reason and the happy path. Kept minimal so replacing them is a catalogue edit | A catalogue edit |

---

## Testing Strategy

**Test types**: unit (pure functions and hook callbacks, `app` Jest project), integration
(repository functions and the feature-layer read composition against `better-sqlite3` in memory,
`db` Jest project — directly for `src/db/**`, and via the `*.db.test.ts` convention for
`src/features/**`), static source scans, smoke (device), fidelity capture.

No React renderer is available (Verification Log), so the screen is verified through its pure
inputs and outputs, static scans, the device runbook and the four fidelity captures — the
precedent items #2, #34, #8, #13 and #15 set. The two hooks are exercised as plain functions over
a stubbed `getAppDatabase`.

**Key scenarios**:

| # | Scenario | Maps to | Where | Project |
| --- | --- | --- | --- | --- |
| 1 | `getTransactionContext` returns the movement with its merchant name, product name and mask; `undefined` for an unknown id | Brief *"Full detail"*, A7 | `src/db/__tests__/transactions.test.ts` | `db` |
| 2 | `getTransactionContext` returns an **excluded** movement — the read carries no inclusion predicate | BR3 | same | `db` |
| 3 | `getTransactionContext` returns `merchantName: null` for a movement with no merchant, and a `product` whose `mask` is `undefined` when the metadata has none | A6, A9 | same | `db` |
| 4 | `setTransactionNote` writes a trimmed note, stores `null` for a blank or whitespace-only note, and bumps `updated_at` | Brief *"editable note"*, A8 | same | `db` |
| 5 | Each of `setTransactionNote`, `setUserCategory`, `excludeTransaction`, `reincludeTransaction` leaves `raw_description`, `amount`, `type`, `occurred_at`, `date_local`, `external_id` and `dedup_hash` byte-identical | **AC1**, Decision 14 | same | `db` |
| 6 | `reincludeTransaction` clears `excluded_at`, `exclusion_reason` and `exclusion_note`, keeps the row and its category, and leaves `included_amount` null | **AC3** | same | `db` |
| 7 | A re-included movement re-enters `totalForCategoryInPeriod`, and an excluded one is absent from it | **AC3** ("restores it to aggregates") | same | `db` |
| 8 | Exclude → re-include → exclude is repeatable, and each step is observable in the row | BR3 | same | `db` |
| 9 | `reincludeTransaction` on a movement that is not excluded is a no-op that does not throw | Decision 6 | same | `db` |
| 10 | No function this item adds issues a `delete`, and `repositories/transactions.ts` still exports no `deleteTransaction` | BR3 | same | `db` |
| 11 | A simulated `upsertBankTransactions` re-sync over a re-included, noted, categorized movement preserves all four person-owned decisions | #10 seam, Decision 3 | same | `db` |
| 12 | `resolveDetailState`: excluded outranks categorized and uncategorized; all three branches, including an excluded movement that has a category and one that does not | Decision 4 | `src/features/transaction-detail/__tests__/detail-state.test.ts` | `app` |
| 13 | `showsAutoSuggestionCaption` is true only for `categorySource === 'auto'` **with** a category; false for `'user'`, `'rule'`, `null`, and for a movement with no category | **AC2** | same | `app` |
| 14 | `resolveActionSet` returns the three drawn button lists, and omits the merchant action when no merchant resolved | Brief actions, A6 | same | `app` |
| 15 | `formatProductLabel` renders `{name} ••{mask}` with a mask and the bare name without one | A9 | `src/features/transaction-detail/__tests__/product-label.test.ts` | `app` |
| 16 | `DETAIL_EXCLUSION_REASONS` is exactly the four drawn reasons in the drawn order, and `exclusionReasonKey` maps all **five** stored values to a catalogue key | Decision 5, A3 | `src/features/transaction-detail/__tests__/exclusion-copy.test.ts` | `app` |
| 17 | Every `t('…')` key used by the screen and its components exists in `es.json` and `en.json`, and every Spanish value matches the Copy contract table character for character | AGENTS.md non-negotiable 8 | `src/features/transaction-detail/__tests__/copy-contract.test.ts` — reuses the shipped `catalogue-key-scan.ts` | `app` |
| 18 | The immutability guard: no bank-fact write vocabulary in the screen tier, `rawDescription` confined to two functions in the repository, no `included_amount` in the screen tier, no "Eliminar" under a `transaction_detail.*` key | **AC1**, BR3, Decision 14 | `src/features/transaction-detail/__tests__/immutability-guard.test.ts` | `app` |
| 19 | `useTransactionDetail` discards a resolved read after unmount, lets a newer focus supersede an in-flight read, and turns a rejected `getAppDatabase()` into `status: 'error'` and a missing row into `status: 'missing'` | Concurrency addendum, A7 | `src/features/transaction-detail/__tests__/use-transaction-detail.test.ts` | `app` |
| 20 | `useTransactionDetailActions` rejects a second write while the first is in flight; a rejected write surfaces `transaction_detail.write_failed` and leaves local state unchanged | Concurrency addendum | `src/features/transaction-detail/__tests__/use-transaction-detail-actions.test.ts` | `app` |
| 21 | `readTransactionDetail` composes its four repository calls over a **real** in-memory store and returns one internally consistent snapshot: the movement, its category, its product and the picker's chip inputs describe the same store state | Decision 2 | `src/features/transaction-detail/__tests__/read-detail.db.test.ts` — the `.db.test.ts` suffix routes it to the Node/`better-sqlite3` project | `db` |
| 22 | `transaction-detail-v1.sql` applies cleanly to a bootstrapped store and yields the three expected movements with the expected person-layer, including the excluded row's `category_source = 'user'` | Decision 11 | `src/db/__tests__/transaction-detail-fixture.test.ts` | `db` |
| 23 | `fidelityTestId('transaction-detail') === 'fidelity-transaction-detail'`, and that literal appears in `apps/mobile/app/transactions/[transactionId].tsx` | Decision 12 | `src/features/transaction-detail/__tests__/fidelity-wiring.test.ts` | `app` |
| 24 | The shipped repository-wide scans stay green with the new files: `no-naked-text`, `no-style-literals`, `touch-targets`, `mu-class-coverage`, `route-manifest-parity`, `db-access-boundary`, `inclusion-rule-single-definition`, `catalogue-parity` | Decisions 1, 6, 10 | existing tests — **no edits expected** | both |

**Smoke test runbook**:
[`docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md`](../../../testing/mobile/16-transaction-detail-exclusion.smoke-test.md)

**Regression suite**: `.maestro/` exists as a folder but holds no flows yet, and item #22 owns
them; no regression spec is added here.

### Parser-risk addendum

Scenario 18 reads source and catalogue text and matches patterns, and Rule 3 below genuinely
parses the repository file into top-level function blocks. That is enough to treat this plan as
parser-risk. The guard's contract is deliberately narrow so it cannot be defeated and cannot
false-positive. All matching is done on **comment-stripped** source, reusing the same
comment-stripping discipline `src/db/checks/inclusion-rule-scan.ts` already documents (strings and
template literals are left intact; only `//` and `/* … */` are removed, preserving newlines so
line numbers stay correct).

**Scopes and rules**

- **Scope A** — every file under `apps/mobile/app/transactions/` and
  `apps/mobile/src/features/transaction-detail/`, excluding the guard's own test file.
  - **Rule 1**: the identifiers `rawDescription` and `raw_description` must not appear.
  - **Rule 2**: the identifiers `includedAmount` and `included_amount` must not appear.
  - **Rule 3a**: the tokens `.delete(`, `deleteTransaction` and `DELETE FROM` must not appear.
- **Scope B** — `apps/mobile/src/db/repositories/transactions.ts` only. The file is split on
  top-level `export function` / `export async function` / `function` boundaries; `rawDescription`
  may appear **only** inside the blocks named `upsertBankTransactions` and `mapTransactionRow`,
  plus the `TransactionRow` interface. Any other block naming it is a finding, reported with the
  block's name and line.
- **Scope C** — the *keys and values* of `es.json` and `en.json` whose key starts with
  `transaction_detail.`, compared after Unicode NFC normalisation and lower-casing, against the
  forbidden phrase `eliminar`.

**Edge cases and their tests** — all in
`src/features/transaction-detail/__tests__/immutability-guard.test.ts`, driven by inline fixture
strings so no real file has to be broken to test the guard:

| # | Input | Expected |
| --- | --- | --- |
| E1 | `// rawDescription stays read-only` in a Scope A file | **not** flagged — comments are stripped before matching |
| E2 | `/* included_amount */ const includedAmountLocal = 1` | flagged **once** — the comment is stripped, and the identifier prefix still matches on a leading word boundary |
| E3 | `notRawDescription` | **not** flagged — a word boundary is required *before* the identifier |
| E4 | `rawDescriptionLocal` | flagged — a trailing suffix does not break the leading word boundary (the same rule as E2, stated from the other side) |
| E5 | Two occurrences of `included_amount` on one line | flagged **twice**, both offsets reported |
| E6 | `const label = 'raw_description'` (a string, not a comment) in Scope A | flagged — strings are **not** stripped; only comments are |
| E7 | `RawDescription` (different casing) in Scope A | **not** flagged by Rules 1–2, which match identifiers case-sensitively as TypeScript does. Scope C's phrase match, by contrast, is case-insensitive |
| E8 | `rawDescription` inside `mapTransactionRow` in Scope B | **not** flagged — an allowed block |
| E9 | `rawDescription` inside a newly added exported function in Scope B | flagged, naming the function |
| E10 | `/* .delete( */` in Scope A | **not** flagged — the comment is stripped first |
| E11 | `Eliminar` as the value of a `categorize.*` key | **not** flagged — Scope C is restricted to `transaction_detail.*` keys |
| E12 | `Eliminar movimiento` as the value of `transaction_detail.action_delete` | flagged, naming the key |
| E13 | An empty scope (a mistyped directory) | the test **fails loudly** rather than passing vacuously — the guard asserts it scanned at least one file in each of Scopes A, B and C |

**Suppression semantics**: none. The guard recognises no inline suppression directive, for the
same reason `inclusion-rule-scan.ts` and `catalogue-key-scan.ts` do not: a suppression here would
be an escape hatch from the exact acceptance criterion (AC1, BR3) the guard exists to hold. There
is no recognised directive, no placement where one would be honoured, and therefore no
multi-suppression behaviour to define.

### Concurrent-event-source addendum

Three asynchronous sources interleave over the same screen state: the `getAppDatabase()` await
inside `useTransactionDetail`, the four write promises in `useTransactionDetailActions`, and
navigation focus / blur / unmount events — including the merchant-editor round trip and the note
flush at teardown. The checklist is answered in full.

- **Shared mutable state guards**: the database handle is not this feature's state to guard —
  #8's `getAppDatabase()` is a module-level memoized `Promise<AppDatabase>` wrapping
  `ensureDatabaseReady`, which itself serialises through the module-level single-flight promise in
  `src/db/bootstrap.ts`. This feature's own mutable state is the snapshot, the note draft and the
  sheet visibility flags — all React state owned by `TransactionDetailScreen`, mutated only
  through its setters from the React event loop, with the snapshot replaced wholesale in one
  `setState` rather than patched field by field.
- **Re-entrancy / in-flight tracking**: yes. A second tap on *Confirmar*, *Volver a incluir* or a
  category chip can arrive before the first resolves. A `writeInFlight` ref in
  `useTransactionDetailActions` rejects the second call, and every action button renders
  `disabled` while a write is in flight. The note flush shares the same ref, so a blur that
  coincides with an exclusion cannot interleave two `UPDATE`s. On the read side, a second focus
  event bumps `reloadToken`; React runs the superseded effect's cleanup — which sets
  `cancelled = true` — before the next effect, so last-write-wins is deterministic (Scenario 19).
- **Event deduplication**: each write targets the movement currently on screen, and all four are
  idempotent at the store level — writing the same note, the same category, the same exclusion or
  the same re-inclusion twice produces the same row (Scenarios 4, 6, 9). The note flush additionally
  compares the trimmed draft with the stored value and issues no write when they are equal, so a
  blur-then-unmount pair cannot produce two writes. A duplicate focus event costs one extra set of
  `SELECT`s and cannot corrupt anything, because every call in `readTransactionDetail` is a read
  and the whole snapshot is replaced in one `setState`; no debounce is added.
- **Listener and resource cleanup**: the feature registers no timer, socket or subscription.
  `useFocusEffect` returns its own cleanup, and the data effect returns a cleanup that sets
  `cancelled`, so unmounting mid-read cannot `setState` on an unmounted component. The SQLite
  handle is process-lived and deliberately not closed: it is owned by `src/db/runtime.ts`, not by
  any screen.
- **Race conditions at initialization**: a focus event can arrive before the handle resolves; it
  only bumps `reloadToken`, and the effect still awaits the same memoized promise, so nothing
  reads an unready database. While `status === 'pending'` the screen renders nothing rather than a
  half-populated card, so a bank fact is never briefly shown against the wrong movement.
- **Race conditions at teardown**: leaving the screen mid-write is allowed and is the expected
  path for the note flush (Decision 9). The write has already been issued against the store, so
  the decision is committed; its resolution callback is a no-op because the `cancelled` guard is
  set and there is no component left to update. Nothing needs draining, because every read is
  side-effect-free and every write is a single statement.
- **Error propagation across async boundaries**: `getAppDatabase()` rejects with the typed
  `DatabaseBootstrapError` from `bootstrap.ts` and clears its own memo, so the next mount genuinely
  retries; `useTransactionDetail` stores the rejection as `status: 'error'`. A write rejection
  while the screen is mounted is surfaced as the `transaction_detail.write_failed` note and leaves
  the local state untouched (Scenario 20). The one deliberately fire-and-forget path — the note
  flush at teardown — attaches a rejection handler that swallows the error **after** it has been
  recorded, so it can never become an unhandled rejection; there is no surface left to show it on,
  and `no-console` keeps it out of the log.

**New concurrent patterns**: none. This mirrors the cancellation-guarded,
`getAppDatabase()`-awaiting hook shape items #8, #12, #13 and #15 established. The single new
wrinkle — a write issued from a teardown path — is described above and is covered by Scenario 20's
rejection case.

---

## Seed Data

`apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql` — `INSERT OR REPLACE` statements
applied on top of a bootstrapped store (schema and starter seeds present). Ids are literal and
prefixed `detail-` so the file is diffable and idempotent and so the deep links of Decision 12 can
name a concrete movement.

| Entity | Rows | Why |
| --- | --- | --- |
| `user_financial_institutions` | 1 — `detail-connection`, `banco-de-chile`, `status = 'active'`, `sync_status = 'idle'` | Movements need a product; products need a connection |
| `user_financial_products` | 1 — `detail-product`, `external_id = 'checking-detail'`, `type = 'checking'`, `name = 'Cta. corriente'`, `metadata = '{"mask":"4821"}'` | Reproduces the mockup's *Producto* row exactly: `Cta. corriente ••4821` (Decision 11, A9) |
| `merchants` | 1 — `detail-merchant-lider`, `name = 'Líder S.A.'`, `transaction_category_id = 'supermercado'`, `country_code = 'CL'` | The name the mockup draws in both the hero and the *Comercio* row; its default category gives the picker a ✨ suggestion |
| `transactions` — categorized | 1 — `detail-tx-categorized`: `debit`, `35000`, `occurred_at = '2025-01-24T14:20:00.000Z'` (11:20 in `America/Santiago`), `date_local = '2025-01-24'`, `raw_description = 'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL'`, `note = 'Compras semanales'`, merchant `detail-merchant-lider`, category `supermercado`, `category_source = 'auto'` | Drives the `categorized` **and** `exclude-sheet` captures. `category_source = 'auto'` is what makes the *Categoría sugerida automáticamente* caption render (AC2) |
| `transactions` — uncategorized | 1 — `detail-tx-uncategorized`: identical bank facts and merchant, `note = NULL`, `transaction_category_id = NULL`, `category_source = NULL` | The mockup's `uncategorized` state changes only the hero glyph, the category row, the note placeholder and the buttons — every other value is the same. Identical facts make that literally true in the capture |
| `transactions` — excluded | 1 — `detail-tx-excluded`: identical bank facts and merchant, `note = 'Compras semanales'`, category `supermercado`, **`category_source = 'user'`**, `excluded_at = '2025-01-25T12:00:00.000Z'`, `exclusion_reason = 'shared_expense'`, `exclusion_note = NULL` | Drives the `excluded` capture. `shared_expense` is exactly the reason the mockup's note renders (*"involucra más personas"*). `category_source = 'user'` is why the caption is **absent** in that state, matching the drawing without special-casing the state (Decision 4) |

The fixture writes **no** `included_amount` on any row, so a partial-inclusion value can never
silently enter a capture. `store-v1.sql` is not modified.

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `docs/project/1-business-domain.md` — Business Rule 3 states that bank data is never
      deleted, only excluded. Add the re-inclusion half of the rule in one clause: re-including a
      movement clears `excluded_at`, `exclusion_reason` and `exclusion_note` and returns it to
      every total, and there is still no delete.
- [ ] `docs/project/4-database-model.md` — line 271 describes `exclusion_note` as *"Free text when
      reason = `other`"*, which #13's plan already queues for correction (the note is optional for
      every reason). Verify whether #13's implementation landed that fix; if it did, add only that
      an exclusion made from `transaction-detail` always stores `null` there (Decision 5), and
      that this screen is the writer of `note` and the clearer of the three exclusion columns. If
      #13 has not landed it, make both edits here.
- [ ] `docs/best-practices/stack/expo-react-native.md` — **no edit from this item.** Item #8's plan
      owns correcting the *Data fetching* and *Screen structure* blocks, which describe TanStack
      Query and a `queries.ts` that do not exist (Decision 2). If it is still wrong when this item
      is implemented, raise a follow-up rather than editing the same block from a third lane.
- [ ] `docs/project/3-software-architecture.md` — its *Hooks in `src/features/*/queries.ts` wrap
      TanStack Query* line describes a layer that does not exist. Correct it **only if** none of
      #8, #12, #13 or #15 has already done so; if one has, verify the wording covers this item's
      two hooks and raise a follow-up instead of a second edit.
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — **no edit.** #47 owns it; confirm the
      per-PR fidelity-evidence block it prescribes is what the implementation PR pastes.
- [ ] `AGENTS.md` — no change. This item adds no command, no workspace and no file type that the
      repository-structure block does not already describe.
- [ ] `docs/project/2-repo-architecture.md`, `design/mockups/mobile/BEHAVIOR.md` — no change; the
      packages, layering and behaviour this item implements are already described there.

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | #13's implementation lands `ExcludeSheet` / `CategoryGrid` / `buildCategoryChoices` with different names, paths or props, invalidating Decision 5 and Decision 7 | Med | High | Step 0 re-verifies every reused symbol against merged `develop`, not against #13's plan document, and **stops before any file edit** on a mismatch, returning the evidence to the parent |
| R2 | #13 has not merged at all when this item is implemented, so there is nothing to reuse | Med | High | Step 0 stops. This item does **not** fork a second exclusion sheet or a second chip grid to unblock itself — that is the exact duplication the reuse instruction exists to prevent |
| R3 | #15 has not merged, so there is no list to navigate from | Med | Low | Every runbook step is reachable by deep link (`finanzas:///transactions/detail-tx-…`); only runbook Step 2's entry path depends on #15, and it is marked optional there |
| R4 | #47 has not landed, so no target can be flipped | Med | High | Step 0 stops before Implementation Order Step 10. Nothing in this item invents a parallel fidelity mechanism |
| R5 | A fidelity capture fails because the fixture's *Supermercado* label differs from the mockup's *Comida* (A5) | Med | Low | The 34 px hero glyph matches; only one small info-row token differs. A residual failure is fixed in the screen or the fixture — **never** by raising a threshold (#47 Decision 4). If it cannot be fixed, the implementer escalates rather than adding a `threshold_note` |
| R6 | The additive props on #13's `ExcludeSheet` break #13's own call site | Low | High | Both props are optional with defaults equal to #13's current behaviour; #13's call site is not edited, and #13's own tests run unchanged in the same suite |
| R7 | A future edit adds a second statement of the inclusion rule to make re-inclusion "work" | Low | High | `inclusion-rule-single-definition.test.ts` fails the build. `reincludeTransaction` clears a column and reads nothing (Decision 6) |
| R8 | The note flush at teardown loses a draft on a fast back-navigation | Low | Med | The flush runs in both the `useFocusEffect` cleanup and the unmount cleanup, and the write is issued before the component is gone. Runbook Step 4 exercises exactly this path |
| R9 | An excluded movement is opened and the screen offers actions the mockup does not draw | Low | Med | `resolveActionSet` is a pure function with one branch per drawn stack, asserted by Scenario 14, and the `excluded` capture would show any extra button |
| R10 | Two items both add the `.db.test.ts` Jest routing lines and conflict | Low | Low | The two lines are byte-identical in every plan that names them; Step 3 adds them only if absent |

---

## Residual verification strategy

This plan makes four pattern-completeness claims. Each names the evidence the implementation PR
must paste, and none is satisfied by prose.

1. **Every MVP state of `transaction-detail` renders** (brief AC4). Evidence:
   `pnpm fidelity --issue 16` output listing all four targets with their PASS/FAIL and mismatch
   percentages, plus the `pnpm fidelity:contract` summary line showing four fewer `planned`
   targets than before. Residual: any target still `planned` is a failed claim, not a follow-up.
2. **The bank's facts are immutable** (AC1). Evidence: Scenario 5's output naming the seven
   columns it compared across four writes, and Scenario 18's guard output naming the files it
   scanned in each of Scopes A, B and C with zero findings. The guard must additionally be
   demonstrated failing: introduce `rawDescription` into a Scope A file, paste the failing output,
   remove it, paste the passing output.
3. **Re-inclusion restores the movement to every total** (AC3). Evidence: Scenario 7's assertion
   through `totalForCategoryInPeriod` — an aggregate that reads the shared fragments — rather than
   a hand-written sum, plus the runbook's Step 8 `sqlite3` read showing the three columns null.
4. **Every user-facing string is catalogue-owned** (AGENTS.md non-negotiable 8). Evidence:
   Scenario 17's output, which scans the screen's `t('…')` call sites and compares each Spanish
   value with the [Copy contract mapping](#copy-contract-mapping) table, plus a green
   `pnpm lint` showing `i18next/no-literal-string` clean over the new `.tsx` files.

---

## Code Samples

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/repositories/transactions.ts
export function getTransactionContext(
  db: AppDatabase,
  transactionId: string,
): TransactionContext | undefined {
  // No inclusion predicate: an excluded movement must still open (BR3).
  const row = db
    .select({
      transaction: transactions,
      merchantName: merchants.name,
      productId: userFinancialProducts.id,
      productName: userFinancialProducts.name,
      productMetadata: userFinancialProducts.metadata,
    })
    .from(transactions)
    .leftJoin(merchants, eq(transactions.merchantId, merchants.id))
    .innerJoin(
      userFinancialProducts,
      eq(transactions.userFinancialProductId, userFinancialProducts.id),
    )
    .where(eq(transactions.id, transactionId))
    .get() as RawContextRow | undefined;
  if (!row) return undefined;
  return {
    transaction: mapTransactionRow(row.transaction),
    merchantName: row.merchantName ?? null,
    product: {
      id: row.productId,
      name: row.productName,
      mask: parseProductMetadata(row.productMetadata).mask,
    },
  };
}

export function setTransactionNote(
  db: AppDatabase,
  transactionId: string,
  note: string | null,
  ports: { now: () => string },
): void {
  const trimmed = note?.trim();
  // Only two columns are named here. No bank-owned column, and no `included_amount` (AC1).
  db.update(transactions)
    .set({ note: trimmed ? trimmed : null, updatedAt: ports.now() })
    .where(eq(transactions.id, transactionId))
    .run();
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/transaction-detail/detail-state.ts
export type DetailState = 'categorized' | 'uncategorized' | 'excluded';

export function resolveDetailState(transaction: Transaction): DetailState {
  if (transaction.excludedAt !== null) return 'excluded';
  return transaction.transactionCategoryId !== null ? 'categorized' : 'uncategorized';
}

/** AC2: the caption is a `category_source` predicate, never a state predicate (Decision 4). */
export function showsAutoSuggestionCaption(transaction: Transaction): boolean {
  return transaction.transactionCategoryId !== null && transaction.categorySource === 'auto';
}
```

```jsonc
// Illustrative — adapt during implementation.
// scripts/mobile-ui/fidelity-targets.json — one of the four #16 mappings, after the flip
{
  "screen_id": "transaction-detail",
  "state_id": "exclude-sheet",
  "status": "wired",
  "fixture": "transaction-detail",
  "app_file": "apps/mobile/app/transactions/[transactionId].tsx",
  "deep_link": "finanzas:///transactions/detail-tx-categorized?fidelity=1&fidelityScreen=transaction-detail&fidelityState=exclude-sheet",
  "ready_test_id": "fidelity-transaction-detail"
}
```

---

## Implementation Order

Each step is independently committable and leaves the repository green.

0. **Implementation-start re-verification.** Re-run the data-access, reusable-surface, fidelity and
   navigation-seam rows of the
   [Cross-Cutting Operational Assumption Check](#cross-cutting-operational-assumption-check) and
   record `Still valid` or `Stale or conflicting` in the PR body. Concretely:
   `grep -n 'getAppDatabase' apps/mobile/src/db/runtime.ts`;
   `grep -c 'tanstack' apps/mobile/package.json` (expect `0`);
   `grep -n 'db.test.ts' apps/mobile/jest.config.js`;
   `ls apps/mobile/src/features/categorization/components/ExcludeSheet.tsx apps/mobile/src/features/categorization/components/CategoryGrid.tsx apps/mobile/src/features/categorization/category-choices.ts`;
   `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/transactions.ts`;
   `ls scripts/mobile-ui/fidelity-targets.json apps/mobile/src/lib/fidelity-preview.ts`;
   `grep -rn "transactions/\[transactionId\]" apps/mobile/app apps/mobile/src --include=*.tsx`.
   **Stop before any file edit** if: #8 has not merged or `getAppDatabase()` differs from the
   recorded shape; or a query library has appeared; or #13 has not merged or any reused symbol
   differs in name, path or props; or a sibling has taken one of this item's three repository
   function names; or #47 has not landed the contract and the preview helpers.
1. **Database layer.** The three new exports in `repositories/transactions.ts` and the two types
   in `types.ts`. Verify: `pnpm --filter @finanzas/mobile test` — read the output and confirm the
   `db` project runs Scenarios 1–11 and that `inclusion-rule-single-definition` and
   `db-access-boundary` are still green.
2. **Fixture.** `src/db/__fixtures__/transaction-detail-v1.sql` plus Scenario 22's test. Verify:
   `pnpm --filter @finanzas/mobile test` and confirm the new test names the three expected
   movements and the excluded row's `category_source`.
3. **Jest routing for the `.db.test.ts` convention.** Only if Step 0 found the two lines absent
   from `apps/mobile/jest.config.js`, add them exactly as #12's plan specifies. No other config
   change, no dependency. Verify: `pnpm --filter @finanzas/mobile test` still runs both projects
   and no existing test changed project.
4. **Catalogues.** Every key in [Copy contract mapping](#copy-contract-mapping) added to `es.json`
   and `en.json`. Verify: `pnpm --filter @finanzas/mobile test` and confirm `catalogue-parity`
   passes with the new keys.
5. **Pure feature logic.** `detail-state.ts`, `product-label.ts`, `exclusion-copy.ts` with
   Scenarios 12–16. Verify: `pnpm --filter @finanzas/mobile test`.
6. **Data access.** `read-detail.ts`, `use-transaction-detail.ts`,
   `use-transaction-detail-actions.ts` with Scenarios 19–21. Verify:
   `pnpm --filter @finanzas/mobile test` — confirm `read-detail.db.test.ts` runs under the `db`
   project and not under `app` — plus `pnpm --filter @finanzas/mobile typecheck`, `pnpm lint`, and
   that `db-access-boundary` is still green with the new hooks in the scan.
7. **The additive `ExcludeSheet` props.** Add `reasons` and `showNote` to #13's component with
   defaults equal to its current behaviour, and leave #13's call site untouched. Verify:
   `pnpm --filter @finanzas/mobile test` with #13's own categorization tests green and unmodified
   in the diff.
8. **Components and screen.** The seven files in `components/`, including the screen-local top bar
   of Decision 10, plus `TransactionDetailScreen.tsx`. Verify:
   `pnpm --filter @finanzas/mobile test` and confirm `no-naked-text`, `no-style-literals`,
   `touch-targets` and `mu-class-coverage` are green — `MU_CLASS_MAP` must be **unchanged** in the
   diff.
9. **Route and guards.** The route shell of Decision 12, then Scenarios 17, 18 and 23 including
   the E1–E13 fixtures. Verify: `route-manifest-parity` green; then demonstrate the guard failing
   and passing — introduce `rawDescription` into a Scope A file, run the suite, remove it, run it
   again, and paste both outputs into the PR.
10. **Fidelity.** Flip the four targets to `wired` with `app_file`, `deep_link`, `ready_test_id`
    and `fixture: "transaction-detail"`; add the `transaction-detail` entry to the contract's
    `fixtures` map. Verify: `pnpm fidelity:contract` prints four more `wired` targets than before,
    then run `pnpm fidelity --issue 16` against the dev build and paste the four-row result table
    into the PR. A failing target is fixed in the screen or the fixture; a threshold is never
    raised.
11. **Smoke runbook.** Execute
    [`docs/testing/mobile/16-transaction-detail-exclusion.smoke-test.md`](../../../testing/mobile/16-transaction-detail-exclusion.smoke-test.md)
    end to end and record the result.
12. **Documentation.** Apply the [Documentation Updates](#documentation-updates) above.
13. **CHANGELOG.** Add under `[Unreleased]` → `### Added`, verbatim:

    ```markdown
    - **Transaction detail and exclusion** (#16): the movement detail screen with its categorized, uncategorized and excluded states — the immutable bank facts, the editable note, a category change, the merchant shortcut, the exclusion sheet, and re-inclusion, which clears the exclusion fields and restores the movement to every total.
    ```

---

## Out of Scope

- The transactions list, its filters, its search and its pagination (#15). This item owns only the
  route it navigates to.
- The merchant editor itself (#14): this item pushes the route and verifies the round trip.
- Any second exclusion sheet, second chip grid or second chip-ordering function. Those are #13's,
  and reusing them is the point (Decisions 5 and 7).
- Renaming the `categorize.exclude_*` catalogue namespace to something sheet-owned. It is a
  catalogue refactor across two features and belongs to whichever item next touches both.
- Partial inclusion. `included_amount` has no UI in the MVP and is written by nothing here.
- Offering `cash_withdrawal` from this screen's sheet (Assumption A3 — flagged for LH).
- Any query library, provider or `app/_layout.tsx` change (Decision 2).
- Promoting `mu-topbar*`, `mu-list` or `mu-item*` to design-system primitives (#12 / #19,
  Decision 10 here).
- Maestro flows (#22).
