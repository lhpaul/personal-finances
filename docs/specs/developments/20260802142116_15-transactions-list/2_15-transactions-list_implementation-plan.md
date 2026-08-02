# Transactions list — Implementation Plan

**Work item**: [#15 Transactions list](https://github.com/lhpaul/personal-finances/issues/15) —
a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the three contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` `#screen=transactions`, states `list`,
  `search`, `filters`, `empty` (manifest entry in
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js), lines 331-343)
- **Behaviour contract**: [`BEHAVIOR.md` → `transactions`](../../../../design/mockups/mobile/BEHAVIOR.md)
- **Domain contract**: [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md)
  Business Rules 3, 4, 6 and 8

**Smoke test runbook**: [`docs/testing/mobile/15-transactions-list.smoke-test.md`](../../../testing/mobile/15-transactions-list.smoke-test.md)

---

## Summary

**Approach**: `app/(tabs)/transactions.tsx` becomes a composition-only route over
`src/features/transactions/`, whose single feature hook reads through `getAppDatabase()` and
repository functions — the pattern items #8, #12, #13 and #9 all follow (Decision 1). Three new
read/write functions land in `apps/mobile/src/db/repositories/transactions.ts` beside the
existing five: a keyset-paginated, filtered, searched page read; a per-month `count(*)` for the
group headers; and the manual-entry insert. Both read queries are built from **one shared
predicate builder**, so the header counts and the page contents can never describe different
sets. The list itself is a `FlashList` over a flat, heterogeneous entry array (month headers and
movement rows), so no `.map()` of the table into a `ScrollView` exists anywhere. Excluded
movements stay in the list, attenuated, and leave only the totals — which this screen has none
of (Decision 6, BR3/BR4).

**Estimated complexity**: **L**

**Rationale**: four manifest states, a debounced text search that spans four columns across
three tables, a four-control filter sheet whose state must survive navigation, cursor
pagination over a table that grows unbounded, and a manual-entry surface the mockup never draws
(Decision 12). The data layer is the smallest part; the concurrency between focus re-reads,
search-token changes and in-flight page appends is the part that needs care (concurrency
addendum).

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | `schema.ts`, `fragments.ts`, the repositories, `transactions_date_local_idx`, the two mechanical guards | Satisfied |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | `TransactionRow` (including its `state="excluded"` attenuation), `Sheet`, `Pill`, `Switch`, `TextField`, `EmptyState`, `Button`, `Text` | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `formatClp`, `formatShortDate`, `deriveDateLocal`, `parseDateLocal` | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues and the `no-literal-string` lint rule | Satisfied |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged (PR [#55](https://github.com/lhpaul/personal-finances/pull/55)); implementation pending | `apps/mobile/src/db/runtime.ts` → `getAppDatabase()`, and the `screenMetrics` theme export | **Yes** |
| [#12 home screen](https://github.com/lhpaul/personal-finances/issues/12) | Plan merged (PR [#56](https://github.com/lhpaul/personal-finances/pull/56)); implementation pending | The `ScreenHeader` primitive that owns `mu-head*` — this screen draws the same header block; and the `__DEV__` sample-data surface this item extends (Decision 14) | **Yes** |
| [#9 connect a bank](https://github.com/lhpaul/personal-finances/issues/9) | Plan PR [#57](https://github.com/lhpaul/personal-finances/pull/57) open | `TextField`'s optional `icon` / `accessibilityLabel` props (#9 Decision 16) — the same `mu-input` search box this screen draws | **Yes**, for the search bar only; see the fallback in Decision 5 |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | PR [#44](https://github.com/lhpaul/personal-finances/pull/44) open | `isIncludedInAnalysis` (the sanctioned in-memory twin of the SQL inclusion rule, for the dimmed row) and `normalizeDescription` (accent-folded category-name matching) | **Yes** |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | Plan merged; implementation pending | Creates `src/db/repositories/products.ts`, where this item's `listUserProducts` lands as a sibling; and produces the real movements the screen lists | **Yes** for `products.ts`; the dev sample-data surface (Decision 14) is what makes the runbook executable without a real sync |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | Plan merged; implementation pending | `scripts/mobile-ui/fidelity-targets.json` and `src/lib/fidelity-preview.ts`, whose four `transactions` targets this item flips `planned` → `wired` (Decision 15) | **Conditional** — blocking for Implementation Order Step 12 only |
| [#16 transaction detail](https://github.com/lhpaul/personal-finances/issues/16) | Not started; depends on this item | Consumes the navigation seam this item defines | Not a dependency |

**Not built here** (navigation seam only — Decision 13): `transaction-detail` (#16). Its route
file already exists as a placeholder and is not modified.

---

## Verification Log

All commands were run in the plan worktree at repo revision `1c7af24`
(`git rev-parse HEAD` equals `git rev-parse origin/develop`), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse HEAD` and `git rev-parse origin/develop` | Both `1c7af2441e500504e1a7cf8a1bba02d62c341946` (`1c7af24`, *Merge PR #58*) — the plan branch is not stacked on unmerged work |
| Template-fit check applies? | `grep -n 'is_template' .ai-dev-workflow.yaml` | Line 176: `is_template: false` → Protocol 02 **Step 0 does not apply** |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | No `mode` key, no `workflow_hub` and no `product_repo` section → default `single_repo`; this repository owns the plan and the plan PR |
| Manifest entry for this screen | `mockup-manifest.js` lines 331-343 | `screen_id: 'transactions'`, `route: '/(tabs)/transactions'`, four states: `list` (initial), `search`, `filters`, `empty`. No `mvp: false` flag → all four must be implemented |
| What the mockup actually draws | Python extraction of `<section id="s-transactions">` from `index.html` (lines 1577-1704) | Header + search input; month group headers `📅 Enero de 2025 (31)` / `📅 Diciembre de 2024 (14)`; nine movement rows including one `mu-tx--excluded`; a `search` block headed `2 resultados para «uber»`; a `mu-empty` block; `+ Agregar transacción manual`; a filter `mu-sheet` with four controls; the four-tab `mu-tabbar` |
| Filter controls actually drawn | Same extraction, lines 92-119 of the excerpt | Exactly four: **Tipo** (Todos / Gastos / Ingresos), **Estado** (Todas / Sin categorizar / Categorizadas), **Producto** (Todos / Cta. corriente / Tarjeta crédito), and a **Mostrar excluidas** switch drawn `is-on`, plus *Limpiar* / *Aplicar*. **No date-range control is drawn** → Decision 7 |
| Whether an excluded movement is drawn in the default `list` state | Same extraction, line 50 of the excerpt | Yes — `mu-tx mu-tx--excluded`, *"Compra errónea online · 14 ene · Excluida: involucra más personas"*, inside the `data-states="list filters"` block. The drawing and `BEHAVIOR.md` agree that excluded rows are visible by default → Decision 6 |
| The inclusion rule's single SQL definition | `cat apps/mobile/src/db/fragments.ts` | Two exports: `isIncluded` and `includedAmount`. This item imports `isIncluded` only, and only for the "Mostrar excluidas = off" branch |
| The inclusion-rule guard's exact rules | `sed -n '1,50p;300,360p' apps/mobile/src/db/checks/inclusion-rule-scan.ts`; `cat apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` | Rule **A**: an `sql\`…\`` body (including interpolations and nested `sql` tags) mentioning `excluded` / `included_amount` / `includedAmount`. Rule **B**: `isNull(` / `isNotNull(` on an expression ending in `.excludedAt`. Rule **C**: the bare literals `excluded_at` / `included_amount` anywhere in the file. Five hard-coded allowlisted files; `src/db/repositories/transactions.ts` is **not** one of them. Driven over the whole `apps/mobile/src` + `apps/mobile/app` tree |
| Existing `transactions` repository surface | `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/transactions.ts` | Five exports: `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`. No page read, no month count and no manual-entry write exists |
| Function names other in-flight items add to that same file | #12 plan (merged), #13 plan (PR #59), #10 plan (merged) | #12: `sumIncludedByDirectionAndCategory`, `sumIncludedByDirectionAndDay`, `listRecentMovements`. #13: `listPendingBatch`, `countCategorized`, `sumIncludedExpensesInPeriod`, `setUserCategory`, `setReviewFlag`, `excludeTransaction`. #10: splits the upsert into `prepareBankTransactions` / `writeBankTransactionsInTx`. **None collides with this item's three names** (Decision 2) |
| Index available for the list order | `sed -n '218,231p' apps/mobile/src/db/schema.ts` | `transactions_date_local_idx` on `desc(date_local)`; also `transactions_category_id_idx` and `transactions_merchant_id_idx`. No composite `(date_local, id)` index exists → Decision 4's tiebreaker note |
| Columns the search must span | `sed -n '187,232p' apps/mobile/src/db/schema.ts`; `merchants` at line 146; `transaction_categories` at line 121 | `transactions.raw_description` (not null), `transactions.note` (nullable), `merchants.name` (not null, reached by `merchant_id`), and the category name, which lives **inside a JSON `labels` column** resolved per locale by `resolveLabel` — not directly searchable in SQL → Decision 5 |
| Product rows the "Producto" pills describe | `grep 'user_financial_products' apps/mobile/src/db/__fixtures__/store-v1.sql` | Two products for the fixture user: `type: 'checking', name: 'Cuenta Corriente'` and `type: 'credit_card', name: 'Tarjeta de Crédito'` — exactly the two pills the mockup draws, so the drawn pills are **data**, not a fixed taxonomy → Assumption A6 |
| Where a products repository will live | #10 plan, Layer-by-Layer | #10 creates `apps/mobile/src/db/repositories/products.ts` with `listProductIdsByExternalId` and `upsertBankProductsInTx`. `listUserProducts` is added there as a sibling, not in a new file |
| `TransactionRow` already renders the attenuated state | `cat apps/mobile/src/components/ui/TransactionRow.tsx` | `state?: 'default' \| 'pending' \| 'excluded'`; `excluded` applies `componentMetrics.transactionRow.excludedOpacity`. `metaTone: 'warn'` renders the `⚠️` meta line. **No new primitive is needed for the row** |
| `TextField`'s icon slot | #9 plan (PR #57) Decision 16 and Layer-by-Layer | #9 adds optional `icon?: ReactNode` and `accessibilityLabel?: string` to `TextField` for the bank-picker's `mu-input` search box. This item **consumes** them rather than adding a second search input |
| `mu-*` classes this screen draws, and their ownership status | Python scan of the extracted section cross-referenced against `apps/mobile/src/test-utils/mu-class-map.ts` | 52 distinct classes: 28 `primitive`, 10 `utility`, 14 `deferred`. The 14 are the eight `mu-head*` classes (`mu-head`, `__avatar`, `__txt`, `__title`, `__sub`, `__action`, `__action--brand`, `__action--dot`) plus `mu-topbar__btn`, all noted to #12 today; and `mu-list`, `mu-item`, `mu-item__title`, `mu-item__txt`, `mu-item__sub`, noted to #19. Every `mu-tx*` class is already owned by `TransactionRow`, and `mu-tx-group` is `utility` → Decision 11 |
| How sibling screen plans treat `mu-list` / `mu-item*` | #13 plan Decision 13; #9 plan Layer-by-Layer | Both leave them `deferred` to #19 and compose the row **screen-locally** in the feature folder, with `MU_CLASS_MAP` unchanged. This plan does the same |
| Virtualization guidance | `sed -n '41,45p' docs/best-practices/stack/expo-react-native.md` | *"Long lists (`transactions` holds every movement ever synced) use `FlashList` or `FlatList` with `getItemLayout`. Never `.map()` a full table into a `ScrollView`."* Neither library is installed today (`apps/mobile/package.json` has no `@shopify/flash-list`) → Decision 3 |
| Fidelity targets this item owns | #47 plan, coverage-set table and Decision 2 | Coverage set `{ "issue": 15, "targets": [{ "screen_id": "transactions", "states": "all" }] }` — **4 targets**, all starting `status: "planned"`. Flipping them to `wired` requires `app_file`, `deep_link` and `ready_test_id`, all validated mechanically |
| Committed on-device fixture | `python3` scan of `apps/mobile/src/db/__fixtures__/store-v1.sql` | 13 movements, **all `debit`**, **all in `2026-01`**, five of them excluded, one manual, one partially included. Enough for the excluded/attenuated and manual cases; **not** enough for month grouping, the *Ingresos* filter, or pagination → Decision 14 |
| Guard 1 — the SQL access boundary | `cat apps/mobile/src/db/__tests__/db-access-boundary.test.ts`; `apps/mobile/eslint.config.mjs` | `dbAccessBoundary` (lint) plus a source scan forbid `drizzle-orm` / `expo-sqlite` / `better-sqlite3` imports anywhere under `app/**` or `src/**` except `src/db/**` |
| Bounded same-surface open PRs | `gh pr list --state open --json number,headRefName`; `gh pr view <n> --json files` for each | Four open PRs: #57 and #59 (plan-only, `docs/specs` + `docs/testing`), #44 (`packages/shared-domain`, `packages/shared-utils/src/{dates,money}.ts`, shared docs), #46 (`packages/bank-scraper`). **No open PR touches any file under `apps/mobile/`** — see the Cross-Cutting Operational Assumption Check |
| Board membership / tracker status | Not mutated by this plan run | The parent orchestrator owns every tracker transition for this item and explicitly reserved them; `ensure_on_project_board 15 "Writing Plan"` is therefore the parent's call, not this agent's. Recorded in the run summary |

### Residual verification strategy

This plan makes two pattern-completeness claims. Neither is verified by a number written in this
document; both have a mechanical evidence source the implementation PR must paste.

1. *"Every `mu-*` class `#screen=transactions` draws is classified, and this item leaves no class
   unclassified."* Evidence: `apps/mobile/src/__tests__/mu-class-coverage.test.ts`, which asserts
   set equality between the live stylesheet inventory and `MU_CLASS_MAP` and prints the
   per-status breakdown. The 52-class, 14-deferred snapshot in the Verification Log above is a
   **plan-time snapshot, not a frozen scope**: #12 and #9 may flip some of it first. The
   developer follows the live map and records any difference in the PR body.
2. *"All four manifest states are implemented and none is silently dropped."* Evidence:
   `pnpm fidelity:contract` (item #47), which fails when a `mvp: true` screen/state pair is
   neither covered nor excluded, plus the four `transactions` mappings moving from `planned` to
   `wired` — a change the validator refuses unless `app_file` exists on disk and `ready_test_id`
   literally appears in it.

A third claim — *"nothing on this screen restates the inclusion rule"* — is held by
`apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` staying green over the
whole tree, including every file this item adds.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo`) | 2026-08-02T14:21Z, `1c7af24` | Current invocation item `{#15}`; no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* | 2026-08-02T14:21Z, `1c7af24` | Current invocation item `{#15}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/15-transactions-list` at `1c7af24`, identical to `origin/develop` | `git rev-parse HEAD origin/develop` | 2026-08-02T14:21Z | Isolated worktree at `.claude/worktrees/item-15`; no sibling agent shares this checkout | `Verified` |
| **The sanctioned statements of the inclusion rule** | Exactly two: `apps/mobile/src/db/fragments.ts` (SQL) and `packages/shared-domain/src/inclusion.ts` (in-memory, item #5). A third is a review blocker | `docs/project/1-business-domain.md` BR4; item #3 plan Decision 9; item #5 plan Decision 2; the scanner's own header comment | 2026-08-02T14:21Z, `1c7af24` | Same-surface concurrent work is #5 (PR #44), which **created** the second sanctioned statement rather than competing with the first. This plan adds no third: the only exclusion predicate it writes is the imported `isIncluded`, and the only in-memory exclusion read is `isIncludedInAnalysis` | `Verified` |
| **Function-name ownership inside `src/db/repositories/transactions.ts`** | This item claims `listTransactionsPage`, `countTransactionsByMonth`, `insertManualTransaction`. #12 claims three names, #13 claims six, #10 restructures the upsert | The three plan documents (Verification Log row *"Function names other in-flight items add…"*) | 2026-08-02T14:21Z, `1c7af24` | Same-surface items are #10 and #12 (plans merged) and #13 (plan PR #59 open). Enumerated and disjoint | `Verified` |
| **`TextField` icon slot ownership** | Added by item #9 (`icon?: ReactNode`, `accessibilityLabel?: string`); consumed, not re-added, here | #9 plan Decision 16 and Layer-by-Layer, on open PR #57 | 2026-08-02T14:21Z, `1c7af24` | Same-surface open PR is #57 only; it is plan-only today and touches no `apps/mobile/` file yet | `Verified` — with the fallback in Decision 5 if #9's implementation lands a different prop name |
| **`mu-list` / `mu-item*` ownership** | Stay `deferred` to #19; screens compose the row locally | #13 plan Decision 13; #9 plan Layer-by-Layer; `apps/mobile/src/test-utils/mu-class-map.ts` at `1c7af24` | 2026-08-02T14:21Z, `1c7af24` | Same-surface open PRs #57 and #59, both of which explicitly leave these entries `deferred` | `Verified` — this plan leaves `MU_CLASS_MAP` unchanged (Decision 11) |
| **Screen data-access pattern** | `getAppDatabase()` + repository functions behind one feature hook. **No TanStack Query**, despite `expo-react-native.md` prescribing it | Item #8's merged plan; item #12 Decision 7; item #9 Decision 17; parent orchestrator's campaign-wide binding decision for this run | 2026-08-02T14:21Z, `1c7af24` | Current invocation item `{#15}`; same-surface siblings #8, #12, #9 and #13 all record the identical pattern | `Verified` |
| **Foreign-currency display** | Deferred by item #10 Decision 15: the guard lives in SQL (`isPesoDenominated`, applied to money aggregates only); "what the person sees" for a non-CLP movement is explicitly out of scope | #10 plan, *Decision 15* section | 2026-08-02T14:21Z, `1c7af24` | Same-surface item is #10 (plan merged). This screen sums nothing, so `isPesoDenominated` does not apply to either of its queries; it inherits #10's deferral for row display | `Verified` — recorded as Assumption A13 and a Risk, not silently absorbed |
| **Brief AC2 vs. the visual and behaviour contracts** | Brief AC2 says excluded movements are *"hidden by default and shown by the toggle"*. `BEHAVIOR.md` and the drawing say they are **shown by default, attenuated**, and only leave the totals | Brief AC2; `BEHAVIOR.md` → `transactions` (*"los excluidos 🟡 se muestran atenuados… no desaparecen de la lista — solo salen de los totales"*); `index.html` `#screen=transactions&state=list` renders `mu-tx--excluded`; the filter switch is drawn `is-on`; BR3 | 2026-08-02T14:21Z, `1c7af24` | Current invocation item `{#15}`; no open PR changes any of the three sources | `Resolved` — decision owner: this run's tech-lead, under the run's "no human available; decisions yours within the brief" instruction. Two of three authorities (the drawing and the behaviour contract), plus the switch's drawn default, outrank one line of the brief. Recorded as **Decision 6** and **Assumption A1**, and raised for LH in the PR body |

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved, and
records `Still valid` or `Stale or conflicting` in the implementation PR body:

1. `git log --oneline -1 origin/develop` — confirm items **#8, #12, #9, #5 and #10** have merged.
2. `grep -n 'getAppDatabase' apps/mobile/src/db/runtime.ts` — confirm #8 shipped the memoized
   handle, and that no query library appeared in `apps/mobile/package.json`.
3. `grep -n 'ScreenHeader' apps/mobile/src/components/ui/index.ts` — confirm #12 exported it, and
   read its props for the brand/dot action variants this screen needs.
4. `grep -n 'icon\|accessibilityLabel' apps/mobile/src/components/ui/TextField.tsx` — confirm
   #9's icon slot exists with the recorded prop names. If it does not, apply Decision 5's fallback.
5. `grep -n 'isIncludedInAnalysis\|normalizeDescription' packages/shared-domain/src/index.ts` —
   confirm both are exported with the recorded signatures.
6. `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/transactions.ts
   apps/mobile/src/db/repositories/products.ts` — confirm no sibling took this item's three
   function names, and that `products.ts` exists.
7. `grep -n "status: 'deferred'" apps/mobile/src/test-utils/mu-class-map.ts` — confirm
   `mu-list` / `mu-item` / `mu-item__title` are still `deferred` and that `mu-head*` is now owned
   by `ScreenHeader`.
8. `ls scripts/mobile-ui/fidelity-targets.json apps/mobile/src/lib/fidelity-preview.ts` —
   determines whether Implementation Order Step 12 runs or is recorded as blocked on #47.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to
the parent orchestrator.

---

## Key Decisions

Decision indices are stable within this document and are referenced by the Layer-by-Layer,
Testing Strategy and Implementation Order sections.

### Decision 1 — data access follows the campaign-wide pattern: `getAppDatabase()` plus repository functions, behind one feature hook. **No TanStack Query.**

`docs/best-practices/stack/expo-react-native.md` → *Data fetching* prescribes TanStack Query and
sketches a `queries.ts`. That library is not installed; item #8 deliberately did not add it, and
items #12, #9 and #13 all restate the rule. This item follows it, so every screen in the app
reads the database the same way.

Consequences: no provider, no query client, no change to `app/_layout.tsx`. One feature hook,
`useTransactionsList(params)`, awaits `getAppDatabase()` once and then calls repository
functions; the route calls neither directly. Freshness after a write elsewhere (categorizing in
#13, excluding in #16) comes from re-reading on screen focus (concurrency addendum).

### Decision 2 — every list query lives in `src/db/repositories/transactions.ts`, and the page and the counts share one predicate builder

Three additive exports beside the existing five, none of which is touched:

| New export | Answers | Backed by |
| --- | --- | --- |
| `listTransactionsPage(db, params): TransactionListPage` | *"Give me the next page of movements matching these filters and this search term, newest first."* | `transactions_date_local_idx` |
| `countTransactionsByMonth(db, params): MonthCount[]` | *"How many matching movements are in each month?"* — the `(31)` in `📅 Enero de 2025 (31)` | the same index, aggregated in SQL |
| `insertManualTransaction(db, input, ports): Promise<string>` | *"Record a movement the bank never reported."* | Decision 12 |

Both reads are assembled by one module-private `buildTransactionListPredicates(params)` and one
module-private `transactionListQuery(db, selection)` that fixes the `FROM` / `JOIN` shape.
**That is the mechanism** behind the guarantee that a group header's count and the rows underneath it always
describe the same set: they are not two hand-written `WHERE` clauses that happen to agree, they
are one clause used twice. A filter added to one and forgotten in the other is not expressible.

Aggregation stays in SQL (`sqlite-drizzle.md`: *"Aggregate in SQL, not in JS… these tables grow
unbounded"*), and both functions return domain types, never Drizzle rows.

### Decision 3 — the list is a `FlashList` over one flat, heterogeneous entry array

Brief AC1: *"Virtualized list — no full-table `.map()` into a ScrollView."*
`expo-react-native.md` names `FlashList` or `FlatList` with `getItemLayout`.

`@shopify/flash-list` is installed with `expo install` (so the SDK 54-compatible version is
chosen rather than guessed). The screen builds a flat
`TransactionListEntry[]` — a discriminated union of `{ kind: 'month-header' }`,
`{ kind: 'movement' }` and `{ kind: 'search-summary' }` — and passes `getItemType` so headers and
rows are recycled in separate pools.

Rejected alternatives, recorded so this is not re-litigated:

- **`FlatList` + `getItemLayout`**: `getItemLayout` requires every item's height to be known
  ahead of render. A movement row's name can wrap to a second line on a long merchant string, so
  a precomputed offset table would be wrong exactly when the list is longest.
- **`SectionList`**: virtualized and gives sticky headers for free, but it is not one of the two
  options the best-practice document names, and its per-section rendering makes the
  "one flat array, one `getItemType`" recycling story worse.
- **A `ScrollView` with `.map()`**: forbidden by AC1 and by the best-practice document.

**Fallback if `@shopify/flash-list` cannot be installed for SDK 54 / the New Architecture at
implementation time**: use `FlatList` **without** `getItemLayout` (still virtualized, still no
`.map()`), record the reason in the PR body, and open a follow-up. Do not silently fall back to a
`ScrollView` — that fails AC1.

### Decision 4 — pagination is a keyset cursor on `(date_local desc, id desc)`, page size 50

`LIMIT`/`OFFSET` drifts when rows are inserted between page reads (a sync can land while the
person scrolls). The cursor is the last row's `(dateLocal, id)` pair, and the next page's
predicate is

```text
date_local < cursor.dateLocal  OR  (date_local = cursor.dateLocal AND id < cursor.id)
```

which is a total order because `id` is the primary key, so no row can be skipped or repeated.
`id` is a UUID and its ordering carries no meaning — it is a tiebreaker, not a sort key, and the
plan does not claim movements within a day appear in insertion order.

`transactions_date_local_idx` is on `date_local desc` alone, so the tiebreaker comparison is
resolved by SQLite after the index seek. No new index is added: adding one would be a schema
change for a within-day tie on a local database, and migrations are additive and unrecoverable
if wrong (non-negotiable 5). If profiling on a real device later shows this matters, a composite
index is a clean additive follow-up.

`TRANSACTIONS_PAGE_SIZE = 50` lives in `src/features/transactions/constants.ts`. The repository
takes `limit` as a parameter and fetches `limit + 1` rows to decide whether a next page exists
without a second count query.

### Decision 5 — search spans four fields, three of them in SQL and the category name resolved in TypeScript first

The mockup's placeholder is *"🔍 Buscar por comercio, categoría, nota…"* and brief AC3 says
*"Search covers merchant, category and note."* `BEHAVIOR.md` adds the raw bank description
(🟡 *"búsqueda por texto sobre descripción cruda y nombre de comercio"*). The union of the three
authorities is four fields, and this plan implements all four:

| Field | Where it is matched | Why |
| --- | --- | --- |
| `transactions.raw_description` | SQL `LIKE` | `BEHAVIOR.md`; also the only handle on a movement whose merchant is still unresolved |
| `merchants.name` | SQL `LIKE` over the left join | brief AC3, `BEHAVIOR.md` |
| `transactions.note` | SQL `LIKE` | brief AC3, mockup placeholder |
| the category name | resolved in TypeScript to a set of ids, then `transaction_category_id IN (…)` in SQL | the name lives inside the JSON `labels` column, per locale. A `LIKE` over that JSON would match the wrong locale and the key names themselves |

The category resolution runs over the catalogue the hook already holds (16 seed categories plus
the person's own), comparing `normalizeDescription(categoryName)` against
`normalizeDescription(term)` from `@finanzas/shared-domain` — so category search is
accent- and case-insensitive by construction.

The three SQL comparisons use `lower(column) LIKE <pattern> ESCAPE '\'`. The repository builds
`<pattern>` from the plain term — lower-cased, with `%`, `_` and `\` escaped, wrapped in `%…%` —
so the `LIKE` mechanics stay inside `src/db` and the work happens once per query rather than once
per row. SQLite's `LIKE` folds ASCII case but not diacritics, so a search for `nunoa`
does not match a stored `ÑUÑOA` in the three text columns (it does for a category name). That
limitation is Assumption A8, with FTS5 or a normalized shadow column as the named follow-up.

The search box itself is `TextField` with #9's `icon` slot (`🔍`) and an `accessibilityLabel`, so
the field is not announced as its emoji placeholder. **Fallback** if #9's implementation lands
different prop names: pass the emoji through the existing `label` slot is *not* acceptable
(it renders `mu-label`, a different class); instead compose the emoji as a sibling `Text` inside
the same container and record the deviation in the PR body.

Input is debounced by `SEARCH_DEBOUNCE_MS = 250` before it becomes a query; the debounce is the
only timer this screen owns and is cleared on unmount (concurrency addendum).

### Decision 6 — excluded movements are visible by default and attenuated; the switch hides them

This is the one place the brief and the two contracts disagree, and the disagreement is resolved
against the brief. Sources, in full:

- `BEHAVIOR.md` → `transactions` → *Datos*: *"los excluidos 🟡 se muestran atenuados (siguen
  existiendo, BR3), no desaparecen de la lista — solo salen de los totales."*
- The drawing: `#screen=transactions&state=list` renders a `mu-tx--excluded` row, and the filter
  sheet's *Mostrar excluidas* switch is drawn `is-on`.
- BR3: *"Bank data is never deleted, only excluded… 'Eliminar' does not exist as a concept."*
- Brief AC2: *"Excluded movements are hidden by default and shown by the toggle, visually
  de-emphasized."*

Three authorities against one line of the brief, and the brief's own second half ("visually
de-emphasized") only makes sense for a row that is on screen. So: `showExcluded` defaults to
`true`; the row renders `TransactionRow state="excluded"`; turning the switch off adds the
imported `isIncluded` fragment to the predicate. The rest of AC2 — that the toggle governs
visibility and that excluded rows are de-emphasized — is satisfied exactly.

Nothing on this screen totals money, so BR4's "they leave the totals" has no surface here; it is
`home` and `dashboard` that must not diverge, and neither reads through this item's functions.

**Reversal cost**: one constant, `DEFAULT_TRANSACTION_FILTERS.showExcluded`, in
`src/features/transactions/filters.ts`. Flagged for LH in the PR body.

### Decision 7 — the filter sheet implements exactly the four controls the mockup draws

`BEHAVIOR.md` proposes (🟡) *"por categoría, cuenta, dirección, rango de fechas"*. The drawing has
**Tipo**, **Estado**, **Producto** and **Mostrar excluidas**, and no date range and no category
picker. The 🟡 marks that line as an inference from the mockup, not a validated rule, and
`BEHAVIOR.md`'s own convention is that *"si no está dibujado, no existe"*. The drawing wins:

| Control | Values | Maps to |
| --- | --- | --- |
| **Tipo** | Todos / Gastos / Ingresos | `transactions.type` `'debit'` / `'credit'` |
| **Estado** | Todas / Sin categorizar / Categorizadas | `transaction_category_id` null / not null |
| **Producto** | Todos + one pill per product | `transactions.user_financial_product_id` |
| **Mostrar excluidas** | on (default) / off | Decision 6 |

The sheet edits a **draft** copy of the filters; *Aplicar* commits it and closes, *Limpiar*
resets the draft to `DEFAULT_TRANSACTION_FILTERS`, and the ✕ discards the draft. That is what
makes AC4's *"filters combine correctly"* testable as a pure function
(`applyFilters` / `isDefaultFilters`) with no rendering.

AC4's *"reflected in the header badge"* is `mu-head__action--dot`: the header action renders its
dot when `isDefaultFilters(active) === false`. A date-range filter and a category filter are
recorded as follow-ups against `BEHAVIOR.md`, not built.

### Decision 8 — groups are months, keyed off `date_local`, and the count comes from SQL

The mockup draws `📅 Enero de 2025 (31)`, and the manifest labels the state
*"Listado agrupado por mes"*. `BEHAVIOR.md` says *"Agrupación: por día local
(`deriveDateLocal`)"*. These agree once read precisely: the grouping **basis** is the local civil
day — never a month derived from a UTC timestamp — and the grouping **granularity** the mockup
draws is the month. The group key is therefore `substr(date_local, 1, 7)`, computed in SQL from
the column that `deriveDateLocal` produced at write time, exactly as `sqlite-drizzle.md` requires
(*"Group and filter by `date_local`. Deriving the local day from the UTC timestamp at query time
reintroduces the timezone bug the column exists to prevent."*).

The count in the header is the count of **matching** movements in that month, so it must come
from `countTransactionsByMonth` rather than from the loaded page — a page of 50 cannot know that
January has 31 matches. Row meta keeps the day-level `formatShortDate` label (`27 ene`), exactly
as drawn.

The header label needs `Enero de 2025`, which no existing formatter produces
(`formatMonthYear` gives `ene 2025`, `formatLongDate` gives a full weekday date). One additive
formatter, `formatMonthHeading(dateLocal, locale)`, lands in
`packages/shared-utils/src/dates.ts` beside its siblings, returning `Enero de 2025` (`es`) /
`January 2025` (`en`) — the `Intl` long-month output with its first code point upper-cased,
because it heads a group. It is capitalization of a formatter's own output, not a second date
implementation, and `apps/mobile` writes no date logic.

### Decision 9 — one pure resolver picks the manifest state

`resolveTransactionsState(input): TransactionsScreenState` in
`src/features/transactions/list-state.ts`, with
`TransactionsScreenState = 'list' | 'search' | 'filters' | 'empty'`. The order is total, so
exactly one state is always selected:

| Priority | State | Condition | Source |
| --- | --- | --- | --- |
| 1 | `filters` | the filter sheet is open | The mockup draws the sheet over the `list` body |
| 2 | `empty` | the result set is empty | *"`empty` (sin movimientos que mostrar con el filtro activo)"* |
| 3 | `search` | the committed search term is non-empty | *"`search` (búsqueda con resultados)"* |
| 4 | `list` | otherwise | initial state |

`filters` outranks the others because the mockup's `filters` state draws the sheet **over** the
populated list body (`data-states="list filters"` on the same block). `empty` outranks `search`
because the mockup's `empty` state also draws a focused search box (`🔍 zzz`) — the empty result
is what distinguishes them.

### Decision 10 — `empty` is one state, with the drawn copy, whatever produced it

The manifest declares one `empty` state and the mockup draws one block:
*"🔎 Sin resultados / No encontramos movimientos con ese término. Prueba con otro comercio o
ajusta los filtros."* That copy is search-flavoured, but it is the contract, and it is also
correct for a filter that matches nothing. A person with a brand-new install and no sync yet sees
the same block; inventing a second, softer empty state would be inventing UI the manifest does
not declare (non-negotiable 6). Recorded as Assumption A4 with a `BEHAVIOR.md` follow-up.

### Decision 11 — `MU_CLASS_MAP` is not modified; `mu-list` / `mu-item*` / `mu-tx-group` are composed screen-locally

`mu-tx-group` is already classified `utility`, which by `MU_CLASS_MAP`'s own definition means the
consumer applies `theme` / `componentMetrics` directly. `mu-list`, `mu-item`, `mu-item__title`,
`mu-item__txt` and `mu-item__sub` are all `deferred` to #19 (Settings hub) today — #12's plan
reassigns the last two to its own row primitives, and this item claims none of them. Both sibling
screen plans that draw the same block, #9 and #13, leave them deferred and compose the row inside
their feature folder. This plan does the same, so `MU_CLASS_MAP` is **unchanged in the diff** and
#19 still inherits a clean, unclaimed surface.

`mu-head*` is #12's `ScreenHeader`. This screen composes it; it does not build a second header.
If #12's implementation left `mu-head__action--brand` / `mu-head__action--dot` unowned, this item
adds the corresponding `ScreenHeader` props (an action variant and a dot flag) **and** flips those
two entries, because this screen is the first to draw them — verified live at implementation time
(re-verification check 7), not assumed here.

### Decision 12 — manual entry is a sheet built from this screen's own drawn vocabulary, and it is the one place this item goes beyond the contract

The brief's scope line ends with *"Manual transaction entry."* The mockup draws the entry point —
`+ Agregar transacción manual`, `mu-btn mu-btn--outline`, in the `list` state — and **nothing
else**: no destination screen in the manifest, no `onclick` in the mockup (every other button in
this section has one), and no line in `BEHAVIOR.md`. It also has no acceptance criterion in the
brief.

A new **route** is mechanically impossible: `route-manifest-parity.test.ts` asserts set equality
between `apps/mobile/app/**` routes and the manifest's `route` values. So the only shape available
is a sheet, which is what this plan builds — deliberately minimal, and composed **only** from the
vocabulary the filter sheet on this same screen already draws (`Sheet` + grab handle + title +
✕ + `mu-field`/`mu-label`/`mu-input` + `mu-pill-row` + `mu-btn-row`):

| Field | Control | Value |
| --- | --- | --- |
| Monto | `TextField`, numeric keyboard | Digits only, parsed to a positive integer of minor units. `assertPositiveMinorUnits` is the backstop |
| Descripción | `TextField` | Stored as `raw_description` |
| Tipo | `Pill` row | `'debit'` (Gasto, default) / `'credit'` (Ingreso) |
| Producto | `Pill` row, one per product | `user_financial_product_id` (required — the column is `NOT NULL` with an FK) |
| Fecha | **not editable in this item** — displayed as today | `date_local = deriveDateLocal(new Date())` |
| Categoría | **not asked** | Left null, so the movement joins the categorization queue like any other (BR6, and #13 owns that flow) |

`occurred_at` is `ports.now()` — for a manual entry there is no bank instant, and every query in
the app groups and filters by `date_local` anyway. `is_manual = 1`, and `dedup_hash` folds in the
row id, which is exactly what `buildDedupInput`'s `isManual` branch already exists for, so two
identical manual entries never collide (BR5 stays true).

**This is the item's largest deviation and is flagged, not buried**: the Spanish strings for
these five labels do not come from the mockup, because the mockup does not draw them. They are
proposed in the catalogue and must be confirmed by a `design/mockups/` + `BEHAVIOR.md` PR, which
this plan lists as a follow-up. Not editable date and not asking for a category are the choices
that keep the invention smallest while still shipping a usable control; both are cheap to widen
once the surface is drawn. The sheet is **excluded from fidelity comparison** — it has no manifest
state, so `pnpm fidelity:contract` neither expects nor allows a target for it.

### Decision 13 — this item defines a navigation seam, not the adjacent screen

A movement row navigates to `/transactions/[transactionId]`, which already exists as a
placeholder route owned by **#16**. This item creates no route file and modifies no route other
than `app/(tabs)/transactions.tsx`, so `route-manifest-parity.test.ts` keeps passing unchanged.
Nothing about the detail screen's internals — the exclusion sheet, re-inclusion, note editing —
is planned here.

Because #16 writes exclusions and #13 writes categories, this screen re-reads its data on focus
so a movement categorized or excluded elsewhere is reflected on return (concurrency addendum).

### Decision 14 — the dev sample-data surface gains a bounded, deterministic list dataset

The committed fixture has 13 movements, all `debit`, all in one month. That cannot exercise month
grouping, the *Ingresos* filter, or pagination, so the runbook would be untestable in exactly the
areas the brief's ACs care about.

Item #12 creates `app/(dev)/sample-data.tsx` + `src/dev/SampleDataPanel.tsx` behind the `__DEV__`
+ inline-`require()` guard the gallery route established. This item adds **one action** to that
panel — *Generar movimientos de demo* — backed by `src/dev/demo-movements.ts`, a pure generator
that returns a deterministic `BankTransactionInput[]` (240 movements across four months, both
directions, spread over both products) and persists it through the **existing**
`upsertBankTransactions` repository function. No SQL leaves `src/db`, the boundary guard stays
green, and re-running the action is idempotent because the upsert is (BR5).

Excluded movements keep coming from `store-v1.sql`, which already carries five of them; this
generator writes only bank-owned columns, exactly as the upsert contract requires.

If #12's panel does not exist when this item is implemented, the action is added to whatever
`__DEV__` surface #12 shipped, and its absence is a `Stale or conflicting` stop
(re-verification check 3), not an invitation to build a second dev surface.

### Decision 15 — the four fidelity targets flip `planned` → `wired`, with the state driven by the deep link

Item #47's coverage set for this issue is `{"issue": 15, "targets": [{"screen_id":
"transactions", "states": "all"}]}` — four targets, all `planned`. This item flips all four in
`scripts/mobile-ui/fidelity-targets.json`, each gaining:

- `app_file`: `apps/mobile/app/(tabs)/transactions.tsx`
- `ready_test_id`: `fidelity-transactions` (the literal `fidelityTestId('transactions')`
  produces, asserted by the validator to appear in `app_file`)
- `deep_link`: `finanzas:///(tabs)/transactions?fidelity=1&fidelityScreen=transactions&fidelityState=<state>`

The screen calls `useFidelityPreview()` once and, when `active`, seeds its initial UI state from
`state` so each target is reachable deterministically without a script driving taps:

| `fidelityState` | Seeded state |
| --- | --- |
| `list` | defaults |
| `search` | committed search term `uber` |
| `filters` | filter sheet open |
| `empty` | committed search term `zzz` |

Those two terms are the ones the mockup itself draws, so the comparison is against the same
inputs. The hook is `__DEV__`-only and inert in a release build, by #47's contract.

**If #47 has not merged** when this item is implemented, `fidelity-targets.json` and
`src/lib/fidelity-preview.ts` do not exist. The implementer then records
`blocked_dependency: #47` for Implementation Order Step 12 in the PR body, opens a follow-up
issue carrying the four mappings verbatim from this decision, and ships the rest of the item.
No other step depends on Step 12.

---

## Assumptions

Every 🟡-marked statement this plan builds on, per `BEHAVIOR.md`'s own rule (*"Una spec puede
construir sobre él, pero debe listarlo en sus supuestos"*), plus the inferences this plan makes
where the contracts are silent. Each is reversible in one named place.

| # | Assumption | Source / derivation | Reversal cost |
| --- | --- | --- | --- |
| A1 | 🟡 Excluded movements are shown by default, attenuated; the switch hides them (Decision 6) | `BEHAVIOR.md` (🟡), the drawn `mu-tx--excluded` row, the switch drawn `is-on`, BR3 — against brief AC2 | One constant in `filters.ts` |
| A2 | 🟡 Search covers `raw_description`, merchant name, note and category name (Decision 5) | `BEHAVIOR.md` (🟡) names two; brief AC3 and the placeholder name three; the union is four | One predicate in `buildTransactionListPredicates` |
| A3 | 🟡 The filter set is exactly what is drawn; no date range, no category filter (Decision 7) | `BEHAVIOR.md` (🟡) proposes four dimensions, two of which are not drawn | `TransactionListFilters` plus one sheet section |
| A4 | One `empty` state serves "no results" and "no data at all", with the drawn copy (Decision 10) | The manifest declares one `empty` state | One branch in the route |
| A5 | Group counts describe matching movements in that month, not all movements in it | The mockup shows `(31)` next to a filtered-list header | `countTransactionsByMonth`'s predicate argument |
| A6 | The **Producto** pills are one per row in `user_financial_products`, not the fixed pair the mockup happens to draw | The mockup's two pills match the fixture's two products exactly (Verification Log) | `listUserProducts` plus the sheet section |
| A7 | The month header is `📅 {month} ({count})` with the month capitalized (Decision 8) | The mockup draws `📅 Enero de 2025 (31)` | `formatMonthHeading` |
| A8 | SQL text search folds ASCII case but not diacritics; only category-name search is accent-insensitive (Decision 5) | SQLite's built-in `LIKE`; `normalizeDescription` is a TypeScript function with no SQL twin | FTS5 or a normalized shadow column — a follow-up, not this item |
| A9 | The row icon is the merchant emoji, then the category emoji, then `💰` for a credit and `💳` for a debit | Reproduces all nine drawn rows; identical to item #12's Assumption A9 for the same primitive | One function in `MovementRow` |
| A10 | An **uncategorized debit** row shows `⚠️ Necesita categorización` with `state="pending"`; every other row shows `27 ene · Categoría · Nota` | Reproduces all nine drawn rows; identical to item #12's Assumption A10 | Same function |
| A11 | An excluded row's meta reads `14 ene · Excluida: <motivo>`, with the reason from `exclusion_reason` through a catalogue key | The drawn row: *"14 ene · Excluida: involucra más personas"* | Five catalogue keys, one per `ExclusionReason` |
| A12 | Manual entry is a sheet with five controls, a fixed date of today and no category (Decision 12) | The mockup draws the button and nothing else | The sheet component and its catalogue keys |
| A13 | A non-CLP movement renders with `formatClp` like any other, because item #10 explicitly defers foreign-currency display | #10 Decision 15: *"What stays deferred is what the person sees"* | One formatter call in `MovementRow`, once #10's successor lands a currency-aware display |
| A14 | The tab bar renders **two** tabs where the mockup draws four | `AGENTS.md` non-negotiable: *"The tab bar is drawn with four tabs; the MVP renders only Inicio and Transacciones"*. This is an accepted, permanent fidelity difference, recorded in the runbook | Out of scope |
| A15 | While the database handle is resolving, the screen renders nothing; a bootstrap failure propagates rather than being caught here | The mockup declares no loading state for `transactions`; launch-failure handling is #8's | `use-transactions-list.ts` |
| A16 | The manual-entry Spanish strings are **proposed**, not contract, until a `design/mockups/` + `BEHAVIOR.md` PR draws the sheet | Decision 12 | Six catalogue keys in both locales |

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration, no schema change, no new committed seed data. Every column this item reads and
writes already exists in the merged schema.

**`apps/mobile/src/db/repositories/transactions.ts`** — three additive exports plus two
module-private helpers; the five existing exports are untouched.

- [ ] `buildTransactionListPredicates(params)` — module-private, **not exported**. Returns the
      array of Drizzle conditions shared by the two reads (Decision 2): the direction filter, the
      categorization filter, the product filter, the search disjunction, and — only when
      `showExcluded` is `false` — the **imported** `isIncluded` fragment. This file is not
      allowlisted by the inclusion-rule scanner, so the fragment import is the only sanctioned way
      to express that condition; the file contains no `excluded_at` literal, no `sql` template
      mentioning `excluded`, and no `isNull(x.excludedAt)`.
- [ ] `transactionListQuery(db, selection)` — module-private. Takes the selection and returns the
      builder with the `FROM transactions` + `LEFT JOIN merchants` +
      `LEFT JOIN transaction_categories` + `INNER JOIN user_financial_products` shape both reads
      use, so the shared predicates always resolve against the same columns. The page read passes
      the module-private `TRANSACTION_LIST_COLUMNS` selection; the count read passes its own
      two-column aggregate selection.
- [ ] `listTransactionsPage(db, params): TransactionListPage` — Decision 4. Ordered
      `date_local desc, id desc`, `LIMIT limit + 1`, keyset cursor. Returns
      `{ rows: TransactionListRow[]; nextCursor: TransactionListCursor | null }`, mapped to a
      domain type with the merchant name and emoji, the category name and emoji (through the
      existing `resolveLabel` / `parseCategoryLabels` / `parseAssets` helpers) and the product
      name already resolved. **No inclusion filter unless the caller asks for one** (Decision 6).
- [ ] `countTransactionsByMonth(db, params): MonthCount[]` — Decision 8.
      `select substr(date_local, 1, 7) as monthKey, count(*)`, grouped by that key, ordered
      descending, over the same predicates. Sums nothing, so item #10's `peso-total-scan` guard
      does not apply to it.
- [ ] `insertManualTransaction(db, input, ports): Promise<string>` — Decision 12. Calls
      `assertPositiveMinorUnits`, reserves the id through `ports.newId()`, awaits
      `ports.digestSha256(buildDedupInput({ …, isManual: true, id }))` **before** opening the
      write, inserts with `is_manual = 1`, and returns the new id. Writes no person-owned column
      other than the ones the person just supplied.

**`apps/mobile/src/db/repositories/products.ts`** — one additive export, in the file item #10
creates. `institutions.ts` is not touched.

- [ ] `listUserProducts(db): UserProduct[]` — every product of every connection, with
      `{ id, name, type }`, ordered by name. Drives the **Producto** pills (Assumption A6). A
      sibling of #10's sync-facing reads, which answer a different question.

**`apps/mobile/src/db/types.ts`** — additive domain types alongside the existing ones:
`TransactionListFilters`, `TransactionSearch` (`{ term, categoryIds }` — the plain term the
repository turns into a `LIKE` pattern, plus the category ids the feature layer already resolved),
`TransactionListQueryParams` (filters plus `search: TransactionSearch | null`),
`TransactionPageParams` (`TransactionListQueryParams` plus `cursor` and `limit`),
`TransactionListCursor`, `TransactionListRow`, `TransactionListPage`, `MonthCount`,
`UserProduct` and `ManualTransactionInput`. `TransactionListFilters` is declared here, **once**,
and imported by the feature layer — the filter shape is not redeclared in `src/features/`. The
raw joined row shape (`TransactionListQueryRow`) stays module-private in the repository; nothing
outside `src/db` sees a column name.

**Unchanged and reused as-is**: `listMonth` (a whole-month read with no filters, which this
screen cannot use and does not replace), `countUncategorized`, `totalForCategoryInPeriod`,
`listByMerchant`, `upsertBankTransactions`, `listCategories`.

### Shared Packages / Libraries

**`@finanzas/shared-utils`** — one additive formatter, no behaviour change to any existing export.

- [ ] `src/dates.ts` — `formatMonthHeading(dateLocal, locale)` (Decision 8), beside
      `formatMonthYear`. `src/index.ts` needs no edit: it already re-exports `./dates` with
      `export *`. **Merge-order note**: PR #44 (item #5) also edits `dates.ts`; it merges before
      this item starts, and both changes are additive functions.

**`@finanzas/shared-domain`** — **not modified**. This item only consumes `isIncludedInAnalysis`
(the dimmed-row display decision) and `normalizeDescription` (category-name search).

**`@finanzas/bank-scraper`** — untouched.

### Frontend / UI

**Design-system primitives** — **no new primitive is added**, and `MU_CLASS_MAP` is unchanged
(Decision 11). `TransactionRow`, `Sheet`, `Pill`, `Switch`, `TextField`, `EmptyState`, `Button`
and `Text` are composed as they are. The one possible exception is `ScreenHeader`'s brand/dot
action variants, which are added only if #12 left them unowned (re-verification check 7).

**`apps/mobile/src/features/transactions/`** — new.

- [ ] `constants.ts` — `TRANSACTIONS_PAGE_SIZE = 50`, `SEARCH_DEBOUNCE_MS = 250`.
- [ ] `filters.ts` — `DEFAULT_TRANSACTION_FILTERS`, `isDefaultFilters(filters)`,
      `activeFilterCount(filters)`. Pure; imports the `TransactionListFilters` type from
      `src/db/types.ts` (Decision 7).
- [ ] `search.ts` — `resolveSearch(term, categories): TransactionSearch | null`, which trims the
      term and resolves matching category ids through `normalizeDescription` (Decision 5). Returns
      `null` for a blank or whitespace-only term. It builds no SQL and no `LIKE` pattern — the
      repository owns that (Decision 5).
- [ ] `list-state.ts` — `TransactionsScreenState` and `resolveTransactionsState` (Decision 9).
- [ ] `grouping.ts` — `buildListEntries(rows, monthCounts, locale): TransactionListEntry[]`, the
      flat heterogeneous array `FlashList` renders, and `getEntryType(entry)` for `getItemType`
      (Decision 3). Pure.
- [ ] `movement-presentation.ts` — `describeMovement(row, locale)`, returning the
      `TransactionRow` props for one row: icon (A9), meta line and tone (A10, A11), amount string
      via `formatClp`, direction, and `state` — where `excluded` comes from
      `isIncludedInAnalysis` rather than from a hand-written `excludedAt === null` (Decision 6).
- [ ] `manual-entry.ts` — `validateManualEntry(draft): ManualTransactionInput | ManualEntryError`,
      pure: digits-only amount parsed to a positive integer, non-empty description, a selected
      product (Decision 12).
- [ ] `read-transactions-page.ts` — `readTransactionsPage(db, params)`, the pure composition of
      `listTransactionsPage`, `countTransactionsByMonth`, `listCategories` (called once per
      direction, `income: 0` and `income: 1`, because search must match a category name of either)
      and `listUserProducts`. No React, so it is testable against a real in-memory store in the
      `db` tier.
- [ ] `use-transactions-list.ts` — `useTransactionsList(params)`, the single feature hook
      (Decision 1): awaits `getAppDatabase()`, owns the request token, the debounce timer, the
      cursor and the append semantics (concurrency addendum), and re-reads on focus.
- [ ] `components/MovementRow.tsx` — one `TransactionRow` from one `TransactionListRow`.
- [ ] `components/MonthHeader.tsx` — `📅 {month} ({count})`, `mu-tx-group` composed from `theme`.
- [ ] `components/SearchSummary.tsx` — `{count} resultados para «{term}»`.
- [ ] `components/TransactionsSearchBar.tsx` — `TextField` with #9's `icon` slot.
- [ ] `components/TransactionsFilterSheet.tsx` — `Sheet` + three `Pill` rows + the toggle row +
      *Limpiar* / *Aplicar*, over draft state (Decision 7).
- [ ] `components/FilterToggleRow.tsx` — the `mu-list` / `mu-item` row, composed screen-locally
      (Decision 11), wrapping `Switch`.
- [ ] `components/ManualTransactionSheet.tsx` — Decision 12.
- [ ] `components/TransactionsEmptyState.tsx` — `EmptyState` with the drawn copy (Decision 10).

**`apps/mobile/app/(tabs)/transactions.tsx`** — **rewritten**: reads the locale, calls
`useTransactionsList`, resolves the state, seeds fidelity preview state (Decision 15), and
composes `ScreenHeader`, the search bar, the `FlashList`, the two sheets and the manual-entry
button. No SQL, no business logic, no literal copy.

**`apps/mobile/src/theme.ts`** — **modified**: a `transactions` group in the `screenMetrics`
export item #8 adds (the search-bar band, the group-header rhythm, the list content padding), and
`componentMetrics` entries only if a composed block needs geometry no primitive owns. The `theme`
object itself is **not** touched, so `theme-tokens-parity.test.ts` is unaffected.

**`apps/mobile/src/dev/`** — `demo-movements.ts` new; `SampleDataPanel.tsx` (item #12's)
**modified** with one action (Decision 14).

**`apps/mobile/src/i18n/es.json` and `en.json`** — **modified**: `transactions.*` keys for every
string the screen draws, plus `transactions.manual.*` (proposed copy, Assumption A16) and one
`dev.sample_data.*` key for the new action. Flat, lowercase, snake_case, identical key sets;
`es` copied verbatim from the mockup wherever the mockup draws the string.

**`apps/mobile/app/_layout.tsx`, `app/(tabs)/_layout.tsx`** — **not modified.** The tab shell's
final labels and icons belong to another item (A14).

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — **one** dependency, installed through Expo's resolver:

      ```bash
      pnpm --filter @finanzas/mobile exec expo install @shopify/flash-list
      ```

      No query library is added (Decision 1). `react-native-svg` is item #12's, not this item's.
- [ ] `pnpm check:layout` must stay green after the install (it runs as a `postinstall` and in
      CI). `@shopify/flash-list` is a native module, so the PR must state that a **dev build
      rebuild** is required — Expo Go cannot run this screen.
- [ ] `apps/mobile/jest.config.js` — **no change if item #12 already added** the two lines that
      route `src/features/**/*.db.test.ts` to the Node/`better-sqlite3` project and keep it out of
      the `jest-expo` project. If #12's implementation did not land them, this item adds exactly
      those two lines, byte-identical to #12's plan, and says so in the PR body.
- [ ] `scripts/mobile-ui/fidelity-targets.json` — four mappings flipped `planned` → `wired`
      (Decision 15), conditional on #47.
- [ ] No new CI job and no new script.

This item adds no executable shell guidance to a framework-owned surface, so no shell contract
(`bash` / `bash-zsh`) needs naming and the snippet linter is not in scope.

---

## Testing Strategy

**Test types**: unit (Jest `db` project, Node + `better-sqlite3`), unit (Jest `app` project),
existing source-scanning enforcement tests, and a manual smoke runbook on a dev build.

`@testing-library/react-native` is **not** installed and this item does not add it — following
item #2's precedent, component-level assertions call the component function directly and inspect
the returned element tree, and everything else is a pure function or a real-SQLite test.

### Scenario map

| # | Scenario | Maps to | Test file | Tier |
| --- | --- | --- | --- | --- |
| 1 | `listTransactionsPage` returns `limit` rows and a cursor when more exist, and a `null` cursor on the last page | brief AC1, Decision 4 | `apps/mobile/src/db/__tests__/transactions.test.ts` (extend) | db |
| 2 | Paging the whole table with the cursor visits every row exactly once — asserted over a fixture with several movements sharing one `date_local`, so the `id` tiebreaker is exercised | Decision 4 | `transactions.test.ts` | db |
| 3 | A row inserted between two page reads cannot cause a skip or a duplicate in the already-read prefix | Decision 4's rationale for keyset over `OFFSET` | `transactions.test.ts` | db |
| 4 | `showExcluded: true` (the default) returns excluded movements; `showExcluded: false` omits exactly them, and the result equals the `true` result minus the excluded rows | brief AC2, Decision 6, BR3/BR4 | `transactions.test.ts` | db |
| 5 | Search matches on `raw_description`, on `merchants.name`, on `note`, and on a category name — one case each, plus a negative case that matches none of the four | brief AC3, Decision 5 | `transactions.test.ts` | db |
| 6 | A search term containing `%`, `_` or `\` is escaped and matches literally, not as a wildcard | Decision 5 | `transactions.test.ts` | db |
| 7 | Search is ASCII-case-insensitive (`uber` matches `UBER BV`) and category search is also diacritic-insensitive (`nunoa` matches a category named `Ñuñoa`) | Decision 5, Assumption A8 | `transactions.test.ts` | db |
| 8 | Every filter combination narrows correctly, including two filters at once and a filter plus a search term — a table-driven case per combination of Tipo × Estado × Producto × Mostrar excluidas over one fixture | brief AC4, Decision 7 | `transactions.test.ts` | db |
| 9 | `countTransactionsByMonth` returns one entry per month present, descending, and its counts equal the number of rows `listTransactionsPage` yields for the same params when paged to exhaustion — **the mechanical check that the header count and the list body cannot disagree** | brief AC4, Decision 2 | `transactions.test.ts` | db |
| 10 | The month key is derived from `date_local`: a movement whose `occurred_at` falls in the next UTC month but whose `date_local` is in this one groups under `date_local`'s month | Decision 8, `sqlite-drizzle.md` → *Dates* | `transactions.test.ts` | db |
| 11 | `insertManualTransaction` writes `is_manual = 1`, a dedup hash that folds in the row id, and rejects a non-positive or non-integer amount; two identical manual entries both persist | Decision 12, BR5, BR8 | `transactions.test.ts` | db |
| 12 | `listUserProducts` returns every product of every connection with its name and type | Assumption A6 | `apps/mobile/src/db/__tests__/products.test.ts` (extend, #10's file) | db |
| 13 | The inclusion-rule scanner finds **zero** restatements across the whole tree, including every new file | brief AC2, BR4 | `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` (existing, must stay green) | db |
| 14 | No file outside `src/db/**` imports a SQL library — including the feature hook, the pure modules and the dev generator | Decision 1 | `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` (existing) | db |
| 15 | `readTransactionsPage` composes its four repository calls over a **real** in-memory store and returns one internally consistent snapshot: the month counts, the page rows, the category catalogue and the product list all describe the same store state | Decision 2 | `apps/mobile/src/features/transactions/__tests__/read-transactions-page.db.test.ts` | db |
| 16 | `resolveTransactionsState` returns the right state for each of at least seven inputs: sheet open with results; sheet open with none; empty with a term; empty without a term; term with results; no term with results; no term with no data | brief AC4, Decision 9 | `apps/mobile/src/features/transactions/__tests__/list-state.test.ts` | app |
| 17 | `isDefaultFilters` is `true` only for `DEFAULT_TRANSACTION_FILTERS`, and `false` for each single-control deviation including `showExcluded: false` — the predicate behind the header dot | brief AC4, Decision 7 | `apps/mobile/src/features/transactions/__tests__/filters.test.ts` | app |
| 18 | `buildListEntries` emits a header before each month's runs, carries the SQL count into the header, emits a `search-summary` entry instead of headers when a term is active, and returns an empty array for no rows | Decision 3, Decision 8 | `apps/mobile/src/features/transactions/__tests__/grouping.test.ts` | app |
| 19 | `getEntryType` returns a distinct type per entry kind, so `FlashList` recycles headers and rows separately | brief AC1, Decision 3 | `grouping.test.ts` | app |
| 20 | `describeMovement` reproduces all nine drawn rows: merchant-emoji fallback chain, the `⚠️` pending meta for an uncategorized debit, the `Excluida: <motivo>` meta and `state="excluded"` for an excluded row, `+` on a credit | Assumptions A9-A11, brief AC2 | `apps/mobile/src/features/transactions/__tests__/movement-presentation.test.ts` | app |
| 21 | `resolveSearch` normalizes the term, resolves matching category ids, and returns `null` for a blank or whitespace-only term | Decision 5 | `apps/mobile/src/features/transactions/__tests__/search.test.ts` | app |
| 22 | `validateManualEntry` rejects a blank description, a non-numeric amount, `0`, a negative amount and a missing product, and accepts a valid draft | Decision 12 | `apps/mobile/src/features/transactions/__tests__/manual-entry.test.ts` | app |
| 23 | `formatMonthHeading` renders `Enero de 2025` (`es`) and `January 2025` (`en`), is stable across a month boundary, and is idempotent under re-capitalization | Decision 8, Assumption A7 | `packages/shared-utils/src/dates.test.ts` (extend) | shared-utils |
| 24 | `useTransactionsList` discards a resolved read after unmount; a newer search token supersedes an in-flight read rather than racing it into state; and an in-flight page append is discarded when the filters change | Concurrency addendum | `apps/mobile/src/features/transactions/__tests__/use-transactions-list.test.ts` — driven as a plain function over a stubbed `getAppDatabase`, following item #2's no-renderer precedent | app |
| 25 | `es` and `en` carry identical key sets and every new key matches the flat snake_case pattern | Non-negotiable 8 | `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` (existing) | app |
| 26 | No hex, `rgb()` or numeric style-property literal outside `theme.ts`, including in every new feature component | Item #2's still-enforced AC | `apps/mobile/src/__tests__/no-style-literals.test.ts` (existing) | app |
| 27 | A string icon never lands as a bare child of a non-text host in any new component | Regression class found in item #2's review | `apps/mobile/src/__tests__/no-naked-text.test.ts` (extend) | app |
| 28 | Route/manifest parity is unchanged — this item creates no route | Decision 13 | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (existing) | app |
| 29 | Every `mu-*` class is classified exactly once and `MU_CLASS_MAP` is unchanged by this item's diff | Decision 11 | `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (existing) | app |
| 30 | `pnpm fidelity:contract` passes with the four `transactions` targets `wired`, and the validator confirms `fidelity-transactions` appears in the route file | Decision 15, non-negotiable 6 | `scripts/mobile-ui/fidelity-contract.mjs` (item #47) | contract |
| 31 | All four manifest states render, with the per-state fidelity comparison | brief AC5, non-negotiable 6 | `docs/testing/mobile/15-transactions-list.smoke-test.md` | smoke |

**Seed data for the automated tiers**: the `db` scenarios build their own fixtures with the
existing `createTestConnection` / `createTestProduct` helpers from
`apps/mobile/src/db/testing/product-fixture.ts` and the deterministic ports from `memory-db.ts`.
No new committed fixture file, and `src/db/__fixtures__/store-v1.sql` is **not** regenerated —
this item changes no schema and no starter content.

### Parser-risk addendum

**Not applicable.** No file in this plan lives under `scripts/lint/` or a comparable parse/scan
directory, no new module has lint/parser/scanner/tokenizer responsibilities, and no behaviour is
regex-heavy scanning or structured-text parsing. The `LIKE`-term escaping in Decision 5 is a
four-character substitution over a user string with a dedicated test (Scenario 6), not a parser;
the three existing source-scanning tests this item must satisfy are consumed unchanged and their
scanners are not modified.

### Concurrent-event-source addendum

**Applicable.** The screen has four concurrent sources touching one piece of shared mutable state
(the hook's list state): the asynchronous `getAppDatabase()` await, the debounce timer, screen
focus events, and the user-driven "load next page" callback.

- **Shared mutable state guards** — the database handle is not this hook's to guard: item #8's
  `getAppDatabase()` is a module-level memoized `Promise<AppDatabase>` wrapping `bootstrap.ts`'s
  single-flight promise, so two screens mounting at once share one open-and-bootstrap. The hook's
  own state has exactly one writer — its effect — and is always replaced wholesale, never mutated
  in place. Every repository call is synchronous once the handle resolves
  (`BaseSQLiteDatabase<'sync', …>`), so a page read and its month counts are taken in one
  uninterrupted pass with no interleaved write. That is the mechanism behind Scenario 15's
  "one internally consistent snapshot" — not a transaction, and not luck.
- **Re-entrancy / in-flight tracking** — a `requestToken` (a monotonically increasing number held
  in a ref) is captured when a read starts and compared before `setState`. A read whose token is
  no longer current is discarded. Filters, the committed search term, the reload token and the
  cursor are all inputs to the same effect, so a change to any of them supersedes an in-flight
  read deterministically: React runs the previous effect's cleanup before the next effect.
- **Event deduplication** — `useFocusEffect` fires on every focus, including a re-focus with no
  intervening navigation. A duplicate costs one extra set of `SELECT`s and cannot corrupt
  anything: every call in `readTransactionsPage` is a read and the whole result is replaced in one
  `setState`. Debounced keystrokes collapse to one committed term. The "load next page" callback
  is guarded by an `isAppending` flag so a fast repeated scroll cannot issue two appends for the
  same cursor.
- **Listener and resource cleanup** — the debounce timer is cleared in its effect's cleanup;
  `useFocusEffect` returns its own cleanup; the data effect's cleanup invalidates the current
  token. Unmounting mid-read therefore cannot `setState` on an unmounted component. The SQLite
  handle is process-lived and deliberately **not** closed — it is owned by `src/db/runtime.ts`,
  not by any screen.
- **Race conditions at initialization** — a focus event or a keystroke can arrive before the
  handle resolves. Both only change effect inputs; the effect still awaits the same memoized
  promise, so nothing reads an unready database. The screen renders nothing while the first read
  is pending (Assumption A15).
- **Race conditions at teardown** — after unmount, the invalidated token discards both a resolved
  and a rejected read. Because every call is a read, a discarded result has no side effect and
  nothing needs draining. The one write on this screen (manual entry) is awaited to completion
  before the sheet closes, and its `setState` is token-guarded like any read.
- **Error propagation across async boundaries** — `getAppDatabase()` rejects with the typed
  `DatabaseBootstrapError` from `bootstrap.ts`, which clears its own memo so the next mount
  genuinely retries. The hook stores the rejection and re-throws it during render, which is what
  makes it reachable by the route's `ErrorBoundary`; throwing inside the async callback would
  produce an unhandled rejection instead. It is never `console.log`ged (`no-console` is on) and
  carries no credential, because none is in scope here. A **manual-entry** failure is different:
  it is a user action with a visible surface, so it sets an error message on the sheet rather than
  propagating.

**New concurrent patterns**: the request-token guard is one step beyond the plain `cancelled`
boolean items #8 and #12 use, because this screen has an *appending* read as well as a
*replacing* one and needs to know which generation a resolved append belongs to. It is otherwise
the same cancellation-guarded, `getAppDatabase()`-awaiting hook shape, and the token subsumes the
boolean rather than replacing it with a different discipline.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Movements covering every person-owned state, including five excluded and one manual | The committed deterministic snapshot: one `banco-de-chile` connection, two products, 13 movements, all `debit`, all in `2026-01` | `apps/mobile/src/db/__fixtures__/store-v1.sql` — **existing, unchanged**; loaded on device by item #12's `__DEV__` panel |
| Month grouping, the *Ingresos* filter and pagination | 240 deterministic movements across four months, both directions, both products | Generated by `apps/mobile/src/dev/demo-movements.ts` and persisted through `upsertBankTransactions` from the panel's *Generar movimientos de demo* action (Decision 14). Not committed as SQL; idempotent on re-run |
| `empty` state | The bootstrapped store with starter content only, or any query that matches nothing | Item #12's *Vaciar datos de ejemplo* action, or typing `zzz` |
| `db`-tier scenarios | Built per test from `createTestConnection` / `createTestProduct` and the deterministic ports | `apps/mobile/src/db/testing/product-fixture.ts`, `memory-db.ts` — **existing, unchanged** |

No seed file is added or regenerated: this item changes no schema and no starter content.

---

## Documentation Updates

To be executed by the developer **during implementation**, not now.

- [ ] `AGENTS.md` — note that `@shopify/flash-list` is a native module, so a **dev build** is
      required. No structure change: `src/features/` is already documented.
- [ ] `docs/project/2-repo-architecture.md` — record `@shopify/flash-list` as a new runtime
      dependency of `@finanzas/mobile`, with its rationale (Decision 3).
- [ ] `docs/project/3-software-architecture.md` — record the list-virtualization choice and the
      keyset-pagination pattern (Decision 4) as the convention every later paginated read follows.
      **Merge-order note**: PRs #44 and #46 also edit this file; both land before this item.
- [ ] `docs/best-practices/stack/sqlite-drizzle.md` → *Queries* — add the pagination rule
      ("paginated reads use a keyset cursor on `(date_local desc, id desc)`, never `OFFSET`") and
      the shared-predicate rule ("a filtered read and its count are built from one predicate
      builder, so they cannot describe different sets"). **Merge-order note**: PR #44 also edits
      this file.
- [ ] `docs/best-practices/stack/expo-react-native.md` — **no edit from this item** unless item
      #8's queued correction of the *Data fetching* / *Screen structure* blocks has not landed. If
      it has not, raise a follow-up rather than editing the same block twice.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — **no edit in this PR**, per that document's own rule
      that gaps are closed by their own PR. Three follow-ups are raised instead: (a) the
      excluded-by-default resolution in Decision 6, so the 🟡 can be promoted or corrected;
      (b) the filter set actually drawn versus the four dimensions the 🟡 line lists (Decision 7);
      (c) the manual-entry surface, which needs both a `BEHAVIOR.md` section and a mockup state
      before its copy is contract (Decision 12, Assumption A16).
- [ ] `docs/project/4-database-model.md` — **no edit.** No schema change.
- [ ] `docs/project/1-business-domain.md` — **no edit.** No new rule.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The excluded-by-default resolution (Decision 6) is not what LH wants | Medium | Low | One constant, in one file, with a test that pins both branches (Scenario 4). Raised explicitly in the PR body rather than merged silently |
| The manual-entry sheet is judged "inventing UI" at review | Medium | Medium | Decision 12 states the constraint that forced it (no route is possible), keeps the vocabulary to what this same screen already draws, keeps the field set minimal, and lists the mockup PR that would make it contract. If review says no, deleting the sheet leaves the drawn button wired to nothing — an outcome the PR body asks reviewers to choose explicitly |
| `@shopify/flash-list` is incompatible with the installed SDK 54 / New Architecture setup | Low | Medium | Decision 3 names the `FlatList` fallback and forbids falling back to a `ScrollView`. `pnpm check:layout` runs right after the install, before any other work |
| Item #12's implementation lands a different `ScreenHeader` shape, or no `screenMetrics` export | Medium | Medium | Re-verification checks 2, 3 and 7 run against merged `develop` before any edit and stop the run on a mismatch |
| Item #9's `TextField` icon slot lands with different prop names | Medium | Low | Re-verification check 4, plus the explicit fallback in Decision 5 |
| Item #47 has not merged, so the fidelity targets cannot be flipped | Medium | Low | Decision 15 makes Step 12 conditional and self-contained: the four mappings are written out verbatim so a follow-up is minutes of work, and no other step depends on it |
| Search feels wrong on accented merchant names (Assumption A8) | Medium | Low | Documented as a known limitation with a named remedy (FTS5 or a normalized shadow column). Category search, the case a person is most likely to type in Spanish, is already accent-insensitive |
| The month-count query gets slow on a very large table | Low | Low | It is a `count(*)` grouped by a prefix of an indexed column, run once per filter change rather than per page, on a local database. If profiling shows it matters, caching it per filter signature is contained in the hook |
| A non-CLP movement renders as pesos (Assumption A13) | Low | Medium | Inherited from item #10's explicit deferral, recorded rather than absorbed. This item adds no money aggregate, so no total can be silently wrong — only one row's label |
| Two sibling items edit `src/db/repositories/transactions.ts` in the same window | High | Low | The three plans' function names are enumerated and disjoint (Cross-Cutting Assumption Check); all additions are new exports appended to the file, and the five existing exports are untouched by this item |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation.

The shared predicate builder, which is the whole reason the header counts and the list body
cannot disagree. Note what is *not* here: no `excluded_at` literal, no `sql` template mentioning
`excluded`, no `isNull(x.excludedAt)` — only the imported fragment.

```ts
// apps/mobile/src/db/repositories/transactions.ts — Illustrative, adapt during implementation
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from 'drizzle-orm';

import { isIncluded } from '../fragments';
import { merchants, transactionCategories, transactions, userFinancialProducts } from '../schema';
import type { AppDatabase, TransactionListQueryParams } from '../types';

/** Escapes the three characters SQLite's LIKE treats specially, so a typed `%` matches a `%`. */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The one place this screen's filter semantics exist. `listTransactionsPage` and
 * `countTransactionsByMonth` both call it, so a filter cannot be applied to the rows and
 * forgotten in the counts (Decision 2). The "hide excluded" branch reads through the imported
 * `isIncluded` fragment — the only sanctioned way to state that condition outside
 * `src/db/fragments.ts` (Business Rule 4).
 */
function buildTransactionListPredicates(params: TransactionListQueryParams): SQL[] {
  const { filters, search } = params;
  const predicates: SQL[] = [];

  if (filters.direction !== 'all') predicates.push(eq(transactions.type, filters.direction));
  if (filters.categorization === 'uncategorized') {
    predicates.push(isNull(transactions.transactionCategoryId));
  }
  if (filters.categorization === 'categorized') {
    predicates.push(isNotNull(transactions.transactionCategoryId));
  }
  if (filters.productId !== null) {
    predicates.push(eq(transactions.userFinancialProductId, filters.productId));
  }
  if (!filters.showExcluded) predicates.push(isIncluded);

  if (search !== null) {
    // Lower-cased and escaped once per query, not once per row.
    const pattern = `%${escapeLikeTerm(search.term.toLowerCase())}%`;
    const textMatches = [
      sql`lower(${transactions.rawDescription}) like ${pattern} escape '\\'`,
      sql`lower(${merchants.name}) like ${pattern} escape '\\'`,
      sql`lower(${transactions.note}) like ${pattern} escape '\\'`,
    ];
    if (search.categoryIds.length > 0) {
      textMatches.push(inArray(transactions.transactionCategoryId, search.categoryIds));
    }
    predicates.push(or(...textMatches) as SQL);
  }

  return predicates;
}
```

The page read, with the keyset cursor as a total order:

```ts
// apps/mobile/src/db/repositories/transactions.ts — Illustrative, adapt during implementation
export function listTransactionsPage(
  db: AppDatabase,
  params: TransactionPageParams,
): TransactionListPage {
  const { cursor, limit } = params;
  const cursorPredicate =
    cursor === null
      ? undefined
      : or(
          lt(transactions.dateLocal, cursor.dateLocal),
          and(eq(transactions.dateLocal, cursor.dateLocal), lt(transactions.id, cursor.id)),
        );

  const rows = transactionListQuery(db, TRANSACTION_LIST_COLUMNS)
    .where(and(...buildTransactionListPredicates(params), cursorPredicate))
    .orderBy(desc(transactions.dateLocal), desc(transactions.id))
    // One extra row answers "is there a next page?" without a second count query.
    .limit(limit + 1)
    .all() as TransactionListQueryRow[];

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    rows: page.map(mapTransactionListRow),
    nextCursor:
      rows.length > limit && last !== undefined
        ? { dateLocal: last.dateLocal, id: last.id }
        : null,
  };
}
```

The month counts — the same predicates, aggregated in SQL, keyed off `date_local`:

```ts
// apps/mobile/src/db/repositories/transactions.ts — Illustrative, adapt during implementation
const MONTH_KEY = sql<string>`substr(${transactions.dateLocal}, 1, 7)`;

export function countTransactionsByMonth(
  db: AppDatabase,
  params: TransactionListQueryParams,
): MonthCount[] {
  // Same joins, same predicates, different selection — the joins are still needed because the
  // search disjunction reads `merchants.name`.
  return transactionListQuery(db, { monthKey: MONTH_KEY, count: sql<number>`count(*)` })
    .where(and(...buildTransactionListPredicates(params)))
    .groupBy(MONTH_KEY)
    .orderBy(desc(MONTH_KEY))
    .all() as MonthCount[];
}
```

The state resolver — one total order, four outcomes:

```ts
// apps/mobile/src/features/transactions/list-state.ts — Illustrative, adapt during implementation
export type TransactionsScreenState = 'list' | 'search' | 'filters' | 'empty';

export interface TransactionsStateInput {
  filterSheetOpen: boolean;
  searchTerm: string;
  resultCount: number;
}

/** Decision 9. Exactly one state is always selected; the order is total. */
export function resolveTransactionsState({
  filterSheetOpen,
  searchTerm,
  resultCount,
}: TransactionsStateInput): TransactionsScreenState {
  if (filterSheetOpen) return 'filters';
  if (resultCount === 0) return 'empty';
  if (searchTerm !== '') return 'search';
  return 'list';
}
```

The dimmed-row decision, delegated to the one in-memory statement of the rule:

```tsx
// apps/mobile/src/features/transactions/movement-presentation.ts — Illustrative
import { isIncludedInAnalysis } from '@finanzas/shared-domain';

// Business Rule 4's in-memory twin (item #5). This file states no exclusion condition of its
// own; it asks the one function that owns it.
const state = isIncludedInAnalysis(row) ? categorizedState(row) : 'excluded';
```

---

## Implementation Order

Each step is independently committable and leaves the repository green. Steps 1-4 are
infrastructure with no visible change; the screen appears at Step 8.

0. **Implementation-start re-verification.** Run the eight checks in the *Cross-Cutting
   Operational Assumption Check* and record `Still valid` or `Stale or conflicting` in the PR
   body. Stop before any edit if items **#8, #12, #9, #5 or #10** have not merged, or if any
   symbol this plan consumes from them differs from the recorded shape.
1. **Dependency.** `pnpm --filter @finanzas/mobile exec expo install @shopify/flash-list` — and
   nothing else. Verify: `pnpm check:layout` passes and
   `pnpm --filter @finanzas/mobile typecheck` still passes.
2. **`@finanzas/shared-utils`: `formatMonthHeading`.** Decision 8, plus Scenario 23 in the
   existing `dates.test.ts`. Verify: `pnpm --filter @finanzas/shared-utils test`.
3. **Domain types.** The seven additive types in `src/db/types.ts`. Verify:
   `pnpm --filter @finanzas/mobile typecheck`.
4. **Database layer.** `buildTransactionListPredicates`, `transactionListQuery`,
   `listTransactionsPage`, `countTransactionsByMonth`, `insertManualTransaction` in
   `repositories/transactions.ts`; `listUserProducts` in #10's `repositories/products.ts`; and
   Scenarios 1-12 in the existing `db` test files. Verify:
   `pnpm --filter @finanzas/mobile test` — read the output and confirm the `db` project runs the
   new cases and that `inclusion-rule-single-definition` and `db-access-boundary` are still green
   (Scenarios 13-14).
5. **The read composition.** `read-transactions-page.ts` plus Scenario 15 against a real
   in-memory store. Confirm the two `jest.config.js` lines that route `*.db.test.ts` to the `db`
   project exist (item #12) and add them byte-identically if they do not. No React yet. Verify:
   `pnpm --filter @finanzas/mobile test` — confirm the new file runs under the **`db`** project
   exactly once and that every pre-existing test still runs under the project it ran under before;
   and `pnpm lint` reports no `dbAccessBoundary` violation.
6. **Feature logic.** `constants.ts`, `filters.ts`, `search.ts`, `list-state.ts`, `grouping.ts`,
   `movement-presentation.ts`, `manual-entry.ts` and `use-transactions-list.ts`, plus
   Scenarios 16-22 and 24. Verify: `pnpm --filter @finanzas/mobile test`.
7. **Copy.** Every `transactions.*` key in `es.json` and `en.json`, with the Spanish copied
   verbatim from `#screen=transactions` wherever the mockup draws it, and the `transactions.manual.*`
   keys marked in the PR body as proposed (Assumption A16). Verify: `catalogue-parity.test.ts`
   passes and `pnpm --filter @finanzas/mobile lint` reports no `i18next/no-literal-string` error.
8. **Components and route.** The nine feature components, the `screenMetrics.transactions` group,
   and the rewritten `app/(tabs)/transactions.tsx`. Verify: `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, and confirm `route-manifest-parity`, `mu-class-coverage`, `no-style-literals` and
   `no-naked-text` all pass (Scenarios 26-29) and that `MU_CLASS_MAP` is unchanged in the diff.
9. **Manual entry.** `ManualTransactionSheet.tsx` wired to `insertManualTransaction`, with the
   list re-reading after a successful write (Decision 12). Verify: `pnpm test` and a manual add
   on a dev build.
10. **Dev demo data.** `src/dev/demo-movements.ts` and the one new action in item #12's
    `SampleDataPanel.tsx`, with its `dev.sample_data.*` key (Decision 14). Verify:
    `db-access-boundary.test.ts` passes and running the action twice leaves the same row count.
11. **Smoke runbook execution.** Run
    [`docs/testing/mobile/15-transactions-list.smoke-test.md`](../../../testing/mobile/15-transactions-list.smoke-test.md)
    end to end on a dev build, comparing all four states against the mockup side by side. Record
    the device, viewport, screenshots and any accepted difference in the PR, per
    `mobile-ui-fidelity.md` → *Review evidence*.
12. **Fidelity wiring** (conditional on #47 — Decision 15). Add
    `testID={fidelityTestId('transactions')}` and the `useFidelityPreview()` seeding, then flip
    the four `transactions` mappings in `scripts/mobile-ui/fidelity-targets.json` from `planned`
    to `wired`. Verify: `pnpm fidelity:contract` passes (Scenario 30) and paste its summary line
    into the PR body. If #47 has not merged, record `blocked_dependency: #47` and open the
    follow-up instead.
13. **Documentation updates.** Execute the *Documentation Updates* section above.
14. **CHANGELOG.** Add, under `## [Unreleased]` → `### Added`, exactly:

    ```markdown
    - **Transactions list** (#15): the month-grouped virtualized movement list with keyset
      pagination, text search across the raw description, merchant, note and category, the
      filter sheet (tipo, estado, producto, mostrar excluidas) with its header badge, the empty
      state and manual transaction entry, in all four manifest states (`list`, `search`,
      `filters`, `empty`). Excluded movements stay in the list, attenuated, per Business Rule 3
    ```

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — all five brief acceptance criteria map to implementation
  steps and tests. AC1 → Decision 3 + Scenarios 1, 19 + Step 8; AC2 → Decision 6 + Scenarios 4,
  13, 20 + runbook Step 5; AC3 → Decision 5 + Scenarios 5-7, 21 + runbook Step 4;
  AC4 → Decisions 2, 7 + Scenarios 8, 9, 17 + runbook Step 6; AC5 → the runbook's per-state
  fidelity steps + Decision 15. The brief's fifth scope item, manual entry, has no AC and is
  covered by Decision 12, Scenarios 11 and 22, and runbook Step 8.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  exactly one Implementation Order step. `listTransactionsPage`, `countTransactionsByMonth`,
  `insertManualTransaction`, `listUserProducts`, `buildTransactionListPredicates`,
  `transactionListQuery`, `readTransactionsPage`, `useTransactionsList`,
  `resolveTransactionsState`, `TransactionsScreenState`, `buildListEntries`, `getEntryType`,
  `describeMovement`, `resolveSearch`, `validateManualEntry`, `isDefaultFilters`,
  `formatMonthHeading`, `TRANSACTIONS_PAGE_SIZE`, `SEARCH_DEBOUNCE_MS` and
  `DEFAULT_TRANSACTION_FILTERS` are spelled identically in the Summary, Decisions, Layer-by-Layer,
  Testing Strategy, Code Samples and Implementation Order sections. Decision indices 1-15 are
  referenced consistently. Route and directory paths (`apps/mobile/app/(tabs)/transactions.tsx`,
  `apps/mobile/src/features/transactions/`, `apps/mobile/src/db/repositories/`,
  `scripts/mobile-ui/fidelity-targets.json`) agree everywhere. The type
  `TransactionListRow` and the component `MovementRow` are deliberately distinct names so no
  section can be read as referring to the other.
- **Verification support**: Checked — every claim about existing behaviour (the fragments, the
  scanner's three rules and its allowlist, the five existing repository exports, the index set,
  the sibling items' claimed function names, `TransactionRow`'s excluded state, `TextField`'s
  icon slot, the `mu-*` statuses, the fixture's contents, the absence of any list library) cites
  a Verification Log command with its result. Claims about items #8, #9, #10, #12 and #47 cite
  their plan documents and are re-verified against merged `develop` by Step 0 before any edit.
- **Behavioural guarantees**: Checked — "the header count and the list body cannot disagree"
  names the shared `buildTransactionListPredicates` plus Scenario 9; "no row is skipped or
  repeated while paging" names the total order on `(date_local, id)` plus Scenarios 2-3;
  "exactly one state is always selected" names the total order in Decision 9 plus Scenario 16;
  "re-running the demo generator is idempotent" names `upsertBankTransactions` and BR5; "a
  superseded read cannot race a later one" names the `requestToken` guard and React's
  run-cleanup-before-next-effect ordering; "nothing restates the inclusion rule" names the
  imported `isIncluded` / `isIncludedInAnalysis` plus the scanner test.
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes no workflow
  documentation, protocol or decision gate. Its two multi-input decision tables
  (`resolveTransactionsState`, Decision 9; the filter matrix, Decision 7) are product behaviour
  and are enumerated exhaustively there and in Scenarios 16-17.
- **Cross-cutting checklist**: Not applicable — this plan introduces no safety, quality or
  compliance category that other feature implementations must satisfy. It changes no protocol, no
  agent or skill guidance file and no `REVIEW.md` section; its only repository-wide obligations
  (the inclusion rule, the SQL access boundary, the `mu-*` census) already exist and are consumed
  unchanged.
- **Parser/API/concurrency checklist**: Parser-risk — Not applicable, with the rationale in the
  Parser-risk addendum. Concurrent-event-source — **applicable and completed**: all seven
  checklist items are answered in the Concurrent-event-source addendum, including the one new
  pattern (the request token) and why it is not a second discipline.
- **CHANGELOG literal format**: Checked — Implementation Order Step 14 carries the entry verbatim
  in the project's `**Bold Title** (#N):` format, under `### Added`.
- **Not-applicable rationale**: Checked — the two skipped categories (parser-risk, workflow
  decision-gate matrix) each carry a one-sentence rationale above.
