# Home screen — Implementation Plan

**Work item**: [#12 Home screen](https://github.com/lhpaul/personal-finances/issues/12) —
a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the two contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` `#screen=home`, states `pending`,
  `all-clear`, `empty`, `sync-error` (manifest entry in
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js))
- **Behaviour contract**: [`BEHAVIOR.md` → `home`](../../../../design/mockups/mobile/BEHAVIOR.md)

**Smoke test runbook**: [`docs/testing/mobile/12-home-screen.smoke-test.md`](../../../testing/mobile/12-home-screen.smoke-test.md)

---

## Summary

**Approach**: `app/(tabs)/home.tsx` becomes a composition-only route over
`src/features/home/`, whose single feature hook reads through `getAppDatabase()` and `src/db`
repository functions — the pattern item #8 established (Decision 7). Every money figure on the
screen is produced by a SQL aggregate in
`apps/mobile/src/db/repositories/transactions.ts` that reads the shared `isIncluded` /
`includedAmount` fragments — the same functions the dashboard (#17) will call, so the two
screens cannot diverge. The five `mu-*` blocks the mockup draws that item #2 deferred
(`mu-head`, `mu-cat-row`, `mu-line`, `mu-legend`, `mu-bank`) are built as design-system
primitives in `src/components/ui/`, not as one-off screen styles.

**Estimated complexity**: **L**

**Rationale**: the screen composes six data-bearing sections across four states, and it is the
first item in the repository to (a) render a chart, (b) aggregate money for a screen, and
(c) build design-system primitives that three later items (#9, #17, #19) were expected to own.
None of that is avoidable — the mockup draws all of it — but it is more than one day of work.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged (PR [#55](https://github.com/lhpaul/personal-finances/pull/55)); implementation pending | Owns `apps/mobile/src/db/runtime.ts` → `getAppDatabase()`, the async-`migrate` widening of `bootstrap.ts`, `src/db/repositories/connections.ts`, the `screenMetrics` theme export, and the launch gate that makes `/(tabs)/home` reachable on a normal launch. This plan reuses all of them (Decision 7) | **Yes** — must be merged before Step 4 |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | PR [#44](https://github.com/lhpaul/personal-finances/pull/44) open, in review on another lane | `apportionTenths` (percentages that sum to 100) and `isIncludedInAnalysis` (the in-memory twin of the SQL rule, used for the dimmed row state) | **Yes** — must be merged to `develop` before Step 5 |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | Not started | Writes the `user_financial_institutions` sync bookkeeping columns and the movements home reads. Home only **reads** those columns, which already exist in the merged schema | **No** for implementation; **yes** for on-device data. The dev-only sample-data route (Decision 11) is what makes the runbook executable without #10 |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | Every primitive this screen composes | Satisfied |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged (PR [#45](https://github.com/lhpaul/personal-finances/pull/45)) | `fragments.ts`, the repositories, the partial index, the two enforcement guards | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `formatClp`, `formatClpAbbreviated`, `deriveDateLocal`, `getMonthPeriod`, `formatMonthYear`, `formatShortDate`, `formatTimeOfDay` | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues and the `no-literal-string` rule | Satisfied |

**Not built here** (navigation seams only — see Decision 13): the categorization flow (#13),
bank review (#20), the dashboard (#17), the transactions list (#15), transaction detail (#16)
and the settings hub (#19). Home links to their existing placeholder routes.

---

## Verification Log

All commands were run in the plan worktree at repo revision `6ab7d03`
(`git rev-parse HEAD` equals `git rev-parse origin/develop`), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` and `git rev-parse --short origin/develop` | Both `6ab7d03` — the plan branch is not stacked on unmerged work |
| Template-fit check applies? | `grep -n 'is_template' .ai-dev-workflow.yaml` | Line 176: `is_template: false` → Protocol 02 **Step 0 does not apply**; no template-fit warning is required |
| The inclusion rule's single SQL definition | `cat apps/mobile/src/db/fragments.ts` | Two exports only: `isIncluded = sql\`${transactions.excludedAt} is null\`` and `includedAmount = sql\`coalesce(${transactions.includedAmount}, ${transactions.amount})\`` |
| The existing fragment-backed aggregates this plan extends | `grep -n '^export function' apps/mobile/src/db/repositories/transactions.ts` | `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`. `countUncategorized` and `totalForCategoryInPeriod` are the two that import the fragments |
| The partial index the "por categorizar" count must match | `sed -n '226,231p' apps/mobile/src/db/schema.ts` | `transactions_uncategorized_idx` with predicate `transaction_category_id is null and excluded_at is null`; `countUncategorized`'s `WHERE` is `and(sql\`…transactionCategoryId is null\`, isIncluded)` — already matching. **No change needed for brief AC1** |
| Guard 1 — the SQL access boundary | `cat apps/mobile/src/db/__tests__/db-access-boundary.test.ts`; `sed -n '30,42p' apps/mobile/eslint.config.mjs` | `dbAccessBoundary` (lint) + a test scan both forbid `drizzle-orm`, `expo-sqlite`, `better-sqlite3` imports anywhere under `app/**` or `src/**` except `src/db/**` |
| Guard 2 — the inclusion rule cannot be restated | `sed -n '1,50p' apps/mobile/src/db/checks/inclusion-rule-scan.ts`; `cat apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` | Rules A/B/C over the whole `src/` + `app/` tree, five hard-coded allowlisted files. Rule C flags the bare literals `excluded_at` / `included_amount` anywhere |
| `mu-*` classes the home mockup draws, and their current status | Python scan of `design/mockups/mobile/index.html` lines 1415-1572 cross-referenced against `apps/mobile/src/test-utils/mu-class-map.ts` | 81 distinct `mu-*` classes. 22 of them are currently `deferred`; the rest are already `primitive` or `utility`. The 22 are enumerated in Decision 5 |
| Which screens draw `mu-topbar*` (the classes whose deferral note wrongly names #12) | Python scan mapping each `class="…"` occurrence to its enclosing `<section class="app-screen" id="s-…">` | `onboarding-value`, `bank-picker`, `bank-credentials`, `stage-intro`, `categorize`, `dashboard`, `settings*`, `transaction-detail`, … — **never `home`**. Earliest owning MVP item is #8 (`onboarding-value`) |
| Chart colours already in the theme | `python3 -c "import json;print(json.load(open('design/tokens.json'))['chart'])"` | `series: ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6']`, `grid: '#e2e8f0'`, `comparison: '#cbd5e1'` — exactly the values the mockup's SVG uses (`#f59e0b` solid line, `#cbd5e1` dashed comparison, `#e2e8f0` gridlines). **No new colour token is needed** |
| Chart / query libraries already installed | `grep -c 'react-native-svg\|@tanstack/react-query' apps/mobile/package.json` | `0` for both. `react-native-svg` is added by this item (Decision 6); `@tanstack/react-query` is **not** added — see the data-access row below |
| **The established screen data-access pattern** | `git show origin/implementation-plan/8-onboarding-intro-value-ready:docs/specs/developments/20260802132343_8-onboarding-intro-value-ready/2_8-onboarding-intro-value-ready_implementation-plan.md` (plan merged as PR #55) | Item #8 creates `apps/mobile/src/db/runtime.ts` exporting a memoized `getAppDatabase(): Promise<AppDatabase>`, and states: *"`getAppDatabase()` is the single app-tier entry point to the store. Feature hooks call it and then call repository functions; screens call neither directly."* It adds **no** query library, and its Documentation Updates queue the `expo-react-native.md` correction because that document *"shows `queries.ts` with TanStack Query, which is not installed"* → Decision 7 |
| Sibling repository file this plan extends rather than duplicates | Same plan document, *Database / Data Layer* | Item #8 creates `apps/mobile/src/db/repositories/connections.ts` with a read-only `getConnectedBanksSummary(db): ConnectedBanksSummary` (connected institutions + product counts, for `onboarding-ready`). Home needs a different read — every connection with its sync bookkeeping — so `listBankConnections` is added to **that same file** as a sibling, not to `institutions.ts` |
| Screen-level geometry export | Same plan document, Decision 10 | Item #8 adds a `screenMetrics` export to `apps/mobile/src/theme.ts` alongside `componentMetrics`, with an `onboarding` group; `theme` itself is untouched so `theme-tokens-parity.test.ts` still passes. This item adds a `home` group to `screenMetrics` and per-primitive groups to `componentMetrics` |
| Abbreviation helper already exists | `sed -n '108,148p' packages/shared-utils/src/money.ts` | `formatClpAbbreviated(amount, { direction, signDisplay, withCurrencySymbol })` renders `3.7M` / `+2.3M` / `$279K`. **This plan writes no new money arithmetic** |
| Percentage granularity the mockup renders | `grep -oE '[0-9]{1,3},[0-9]%' design/mockups/mobile/index.html \| sort -u` | One decimal, comma separator (`11,6%`, `14,3%`, `17,4%`, `20,6%`, `32,4%`, `67,6%`). No formatter for this exists in `@finanzas/shared-utils` → Decision 12 |
| `@finanzas/shared-domain` public surface this plan calls | Merged plan document `docs/specs/developments/20260802125300_5-shared-domain-rules-matching-aggregates/2_5-…-implementation-plan.md` (Layer-by-Layer → Shared Packages, Decisions 2-5); corroborated read-only against `git show origin/feature/5-…:packages/shared-domain/src/{index,inclusion,apportionment}.ts` | Plan document is authoritative: `isIncludedInAnalysis`, `effectiveAmount`, `contributedAmount`, `apportionTenths(entries)`, `PERCENTAGE_TENTHS_TOTAL = 1000`. The branch read agrees. **This plan does not depend on #5's branch** — see the implementation-start re-verification below |
| Committed on-device fixture available for the runbook | `ls apps/mobile/src/db/__fixtures__/`; `sed -n '20,45p' apps/mobile/scripts/db/build-fixture.ts` | `store-v1.sql` (29 KB) — one connected `banco-de-chile` institution with `syncStatus: 'ok'`, two products and movements covering every person-owned state, regenerated deterministically by `pnpm --filter @finanzas/mobile db:seed` |
| `.sql` files can be inlined into the app bundle | `cat apps/mobile/babel.config.js`; `cat apps/mobile/metro.config.js` | `babel-plugin-inline-import` with `extensions: ['.sql']` plus `sql` in `resolver.sourceExts` — the mechanism Decision 11 reuses |
| Dev-only routes are already a supported concept | `cat apps/mobile/src/test-utils/route-inventory.ts` | `DEV_ONLY_ROUTES = ['/(dev)/gallery']`, subtracted from the route/manifest parity set-equality assertion; each entry must resolve to a `__DEV__`-guarded file |
| Catalogue key shape enforced by CI | `cat apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Flat lowercase snake_case dotted keys (`/^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/`), identical key sets in `es` and `en`, no nested values |
| Bounded same-surface open PRs | `gh pr list --state open --json number,headRefName`; `gh pr view 44 --json files`; `gh pr view 46 --json files` | Two open PRs: **#44** (item #5) and **#46** (item #6). Neither touches any file this plan creates. Overlap is limited to shared documentation files — see the Cross-Cutting Operational Assumption Check |
| Board membership | `ensure_on_project_board 12 "Writing Plan"` (sourced from `scripts/development-workflow/workflow-lib.sh`) | Recorded in the run summary; the function is a no-op when the issue is already on the board |

### Residual verification strategy

This plan makes one pattern-completeness claim: *"every `mu-*` class the home mockup draws is
implemented by a component, and no class is silently unclassified."* The evidence source is
the existing mechanical check, not a count written in this document:

- `apps/mobile/src/__tests__/mu-class-coverage.test.ts` asserts set equality between the live
  stylesheet inventory and `MU_CLASS_MAP`, and asserts that every `primitive` entry's `owners`
  resolve to real barrel exports. Its second test also prints the per-status breakdown, which
  the implementation PR must paste as evidence.
- If the live map at implementation time differs from Decision 5's enumeration (because a
  sibling item flipped a class first), the developer follows the live map and records the
  difference in the PR body. The enumeration below is a plan-time snapshot, not a frozen scope.

The second claim — *"every total and chart reads through the shared fragments"* — has its own
mechanical residual check: `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts`
must stay green over the whole tree, including every file this item adds.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — no `mode` key is present, so this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-02T17:27Z, `6ab7d03` | Current invocation item `{#12}`; neither open PR (#44, #46) changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* ("spec/plan/feature/fix PRs target `develop`") | 2026-08-02T17:27Z, `6ab7d03` | Current invocation item `{#12}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/12-home-screen` at `6ab7d03`, identical to `origin/develop` | `git rev-parse HEAD origin/develop` | 2026-08-02T17:27Z | Same-checkout parallel execution: this is an isolated worktree at `.claude/worktrees/item-12` | `Verified` |
| **The canonical statement of the inclusion rule, and how many sanctioned statements exist** | Two, and only two: the SQL fragments in `apps/mobile/src/db/fragments.ts` (item #3, merged) for set-based queries, and the domain functions in `packages/shared-domain/src/inclusion.ts` (item #5, in review) for in-memory objects. A third is a review blocker | `docs/project/1-business-domain.md` BR4; item #3's implementation plan Decision 9; item #5's merged implementation plan, *Cross-Cutting Operational Assumption Check* row 3 | 2026-08-02T17:27Z, `6ab7d03` | Item #5 (PR #44) is the only concurrent work on the same surface, and it **created** the second sanctioned statement rather than competing with the first. This plan adds no third statement: every money aggregate it adds is in `src/db/repositories/` and imports the fragments | `Verified` |
| **Public interface of `@finanzas/shared-domain` that this plan calls** | `isIncludedInAnalysis(m)`, `apportionTenths(entries): Map<string, number>`, `PERCENTAGE_TENTHS_TOTAL = 1000` | Item #5's **merged plan document** (Layer-by-Layer → Shared Packages; Decisions 2-5), which is the contract this plan is written against. The read of `origin/feature/5-…` is corroboration only | 2026-08-02T17:27Z, `6ab7d03` | Item #5 is on another lane; its branch may still change under review. This plan therefore names only the two functions the plan document specifies, and **Step 0 of the Implementation Order re-verifies them against merged `develop`** | `Verified` |
| Shared files this plan edits that a concurrent PR also edits | `docs/project/2-repo-architecture.md`, `docs/project/3-software-architecture.md`, `AGENTS.md`, `docs/best-practices/stack/sqlite-drizzle.md`, `packages/shared-utils/src/index.ts` | `gh pr view 44 --json files`; `gh pr view 46 --json files` | 2026-08-02T17:27Z, `6ab7d03` | PR #44 edits the first four; PR #46 edits `docs/project/3-software-architecture.md`. Neither edits `packages/shared-utils/src/index.ts` (PR #44 adds exports inside `dates.ts` / `money.ts`, both already re-exported by `export *`). All overlaps are **additive documentation edits**, and both PRs merge before this item starts (both are dependencies or already ahead in the queue) | `Verified` |
| **Screen data-access pattern (cross-item consistency)** | `getAppDatabase()` from `apps/mobile/src/db/runtime.ts`, plus repository functions, behind one feature hook per screen. **No TanStack Query**, despite `expo-react-native.md` prescribing it | Item #8's **merged** plan document (PR #55), which establishes the pattern and queues the `expo-react-native.md` correction as its own documentation update; parent orchestrator's binding consistency decision for all screen plans | 2026-08-02T18:05Z, `d936107` | Current invocation item `{#12}`; same-surface sibling is item #8, whose plan is merged and whose implementation is pending. This plan consumes #8's interface and adds no competing one | `Resolved` — decision owner: parent orchestrator, on the authority of #8's merged plan. An earlier draft of this plan introduced TanStack Query; that draft is superseded, and this document is the single record of the decision |
| First-sync progress signal | **None exists.** No column in `docs/project/4-database-model.md` carries sync progress, and item #10's brief adds none | `apps/mobile/src/db/schema.ts` (`user_financial_institutions` has `sync_status`, `last_sync_at`, `last_success_at`, `last_error_code`, `last_error_message` — no progress fraction); issue #10 body | 2026-08-02T17:27Z, `6ab7d03` | Item #11 (bank syncing progress screen) owns live scraper step progress, and is not in this invocation | `Verified` — the `empty` state therefore renders an **indeterminate** progress bar (Decision 10), not a fabricated percentage |

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved and
records `Still valid` or `Stale or conflicting` in the implementation PR:

1. `git log --oneline -1 origin/develop` — confirm items **#8 and #5** have merged.
2. `grep -n 'getAppDatabase' apps/mobile/src/db/runtime.ts` and
   `grep -n '^export function' apps/mobile/src/db/repositories/connections.ts` — confirm #8
   shipped `getAppDatabase()` and `getConnectedBanksSummary` with the recorded shapes, and that
   no query library appeared in `apps/mobile/package.json`.
3. `grep -n 'apportionTenths\|isIncludedInAnalysis\|PERCENTAGE_TENTHS_TOTAL' packages/shared-domain/src/index.ts packages/shared-domain/src/*.ts`
   — confirm the two functions and the constant are exported with the recorded signatures.
4. `grep -n "status: 'deferred'" apps/mobile/src/test-utils/mu-class-map.ts` — confirm the 22
   classes in Decision 5 are still `deferred` and still needed.
5. `grep -n '^export function' apps/mobile/src/db/repositories/transactions.ts` — confirm the
   five existing exports are unchanged.
6. `grep -n 'screenMetrics' apps/mobile/src/theme.ts` — confirm #8's screen-geometry export
   exists, so this item adds a `home` group rather than creating the export.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to
the parent orchestrator.

---

## Key Decisions

Decision indices are stable within this document and are referenced by the Layer-by-Layer,
Testing Strategy and Implementation Order sections.

### Decision 1 — every money figure on `home` is aggregated in SQL, through the shared fragments, by functions the dashboard will also call

This is the item's hard rule, and it is stated in four places that all agree:

- `BEHAVIOR.md` → `home`: *"todo total y gráfico usa los fragmentos compartidos
  `isIncluded` / `includedAmount` de `apps/mobile/src/db`… `home` y `dashboard` **no pueden**
  divergir: misma definición, un solo lugar."*
- The brief's AC3: *"Totals match the dashboard exactly — both read the shared inclusion
  fragment."*
- `docs/best-practices/stack/sqlite-drizzle.md` → *Queries*: *"Aggregate in SQL, not in JS.
  `home` and `dashboard` must not `SELECT *` and reduce in JavaScript — these tables grow
  unbounded."*
- Issue #17 (Dashboard) AC1: *"Aggregation happens in SQL, not in JavaScript."*

Home needs three money figures the five existing repository functions do not produce: period
totals split by direction, per-category buckets **including the uncategorized bucket**, and a
per-day series. Those are added to the **same file** as the existing aggregates,
`apps/mobile/src/db/repositories/transactions.ts`, importing the **same two fragments**. They
are written as the general functions #17 needs, so home and dashboard will call the identical
function rather than merely the identical fragment — a strictly stronger guarantee than the AC
asks for.

**What makes this structurally unavoidable rather than a convention:**

| Guard | Where | What it prevents |
| --- | --- | --- |
| `dbAccessBoundary` ESLint rule | root `eslint.config.mjs`, applied by `apps/mobile/eslint.config.mjs` to `app/**` and `src/**` with `src/db/**` ignored | A feature hook, a component or a route importing `drizzle-orm` / `expo-sqlite` / `better-sqlite3` and writing its own query |
| `db-access-boundary.test.ts` | `apps/mobile/src/db/__tests__/` | The same, surviving a lint-config regression |
| `inclusion-rule-scan.ts` rules A/B/C + `inclusion-rule-single-definition.test.ts` | `apps/mobile/src/db/checks/` and `src/db/__tests__/` | Any file outside the five allowlisted ones restating the rule — including the bare literals `excluded_at` / `included_amount`, a `sql` template mentioning `excluded`, or `isNull(x.excludedAt)` |

The only two ways left to filter or weight money anywhere in this repository are therefore
importing `isIncluded` / `includedAmount` from `src/db/fragments.ts` (SQL side) or importing
`isIncludedInAnalysis` / `effectiveAmount` / `contributedAmount` from `@finanzas/shared-domain`
(in-memory side). This plan uses the first for every total and chart, and the second only for
the *display* decision of whether a recent-movement row is dimmed.

### Decision 2 — row-level reads on `home` are bounded by `LIMIT`; the screen never reduces a table in JavaScript

"Transacciones recientes" needs three rows. The existing `listMonth` would return the whole
month and force a slice in JS — exactly what `sqlite-drizzle.md` forbids. A new
`listRecentMovements(db, { limit, locale })` returns a bounded, already-joined domain type
(merchant name and emoji, category name and emoji), backed by `transactions_date_local_idx`
(`date_local desc`). This also satisfies *"Repository functions return domain types, not
Drizzle rows. Screens must not know a column name."*

### Decision 3 — percentages come from `@finanzas/shared-domain`'s `apportionTenths`, over the SQL bucket totals

The mockup renders `20,6%`, `17,4%`, `14,3%`, `11,6%` — one decimal, comma separator. Item #5
owns the "percentages sum to 100 with rounding handled explicitly" guarantee via
largest-remainder apportionment in tenths (`PERCENTAGE_TENTHS_TOTAL = 1000`). Home feeds it
`{ key, weight }` entries built from the SQL bucket totals, so the money still comes from SQL
and the rounding invariant still comes from the one place that tests it.

Apportionment runs over **all** buckets of the direction, not only the four the card displays;
otherwise the displayed percentages would be shares of a truncated total.

### Decision 4 — the four manifest states are resolved by one pure, total-order function

`resolveHomeState(input): HomeState` in `apps/mobile/src/features/home/home-state.ts`, with
`HomeState = 'empty' | 'sync-error' | 'pending' | 'all-clear'`. The order is total and
exhaustive, so exactly one state is always selected:

| Priority | State | Condition | Source |
| --- | --- | --- | --- |
| 1 | `empty` | No bank connection has a `lastSuccessAt` (including the case of no connections at all) | `BEHAVIOR.md`: *"`empty` (sin datos: 🟡 conexión aún sin primer sync exitoso)"* — Assumption A2 |
| 2 | `sync-error` | Any connection has `syncStatus === 'error'` | `BEHAVIOR.md`: *"`sync-error` (última sincronización falló → CTA a `bank-review` del banco afectado)"* |
| 3 | `pending` | `uncategorizedCount > 0` | `BEHAVIOR.md`: *"`pending` (hay movimientos por categorizar → CTA a `stage-intro`)"* |
| 4 | `all-clear` | otherwise | `BEHAVIOR.md`: *"`all-clear` (cola en cero)"* |

`sync-error` outranks `pending` because the mockup's `sync-error` state hides the challenge
hero and shows the danger note in its place, while keeping every card below it — the two are
mutually exclusive in the drawing (Assumption A1).

### Decision 5 — the five `mu-*` blocks the mockup draws but item #2 deferred are built here as design-system primitives, not as one-off screen styles

`docs/best-practices/stack/mobile-ui-fidelity.md`: *"Compose the shared primitives in
`src/components/ui/` before writing a one-off style. A one-off is a signal the primitive is
missing — add it there."* Item #2's `MU_CLASS_MAP` deferred five blocks that `#screen=home`
draws; three of them were assigned to items that land **after** this one (#9, #17, #19).
Building them here as primitives and reassigning ownership is the only option that keeps
`mu-class-coverage.test.ts` honest and prevents #17 and #9 from rebuilding the same component.

Five new components, exported from `apps/mobile/src/components/ui/index.ts`:

| New primitive | `mu-*` classes it takes ownership of | Later consumers |
| --- | --- | --- |
| `ScreenHeader` | `mu-head`, `mu-head--plain`, `mu-head__avatar`, `mu-head__avatar--brand`, `mu-head__txt`, `mu-head__title`, `mu-head__sub`, `mu-head__action` | every screen with a `mu-head` |
| `CategoryRow` | `mu-cat-row`, `mu-cat-row__icon`, `mu-cat-row__bar`, `mu-cat-row__fill` | #17 |
| `LineChart` | `mu-line` | #17 |
| `Legend` | `mu-legend`, `mu-legend__row`, `mu-legend__dot` | #17 |
| `BankRow` | `mu-bank`, `mu-bank__logo`, `mu-bank__name` | #9, #20 |

Three further classes the home mockup draws inside those two rows also flip, with the row
components as owners: `mu-item__txt` (`owners: ['CategoryRow', 'BankRow']`), `mu-item__sub`
(`['BankRow']`) and `mu-item__chev` (`['BankRow']`). That is **22 classes** moving from
`deferred` to `primitive`. `mu-legend__name`, `mu-legend__val`, `mu-item`, `mu-item__icon`,
`mu-item__title` and `mu-list` stay deferred — the home mockup does not draw them.

Separately, four classes carry a deferral note that names #12 but that `#screen=home` never
draws: `mu-topbar`, `mu-topbar__btn`, `mu-topbar__title`, `mu-topbar__title--left`. Their
notes are retargeted to **#8 (Onboarding)**, the earliest MVP item whose screen
(`onboarding-value`) draws a topbar. This is a note correction only; their status stays
`deferred`.

`.mu-head--plain` has no occurrence in any screen body — it is a modifier of the block
`ScreenHeader` owns, implemented as `variant="plain"`, exactly as `Button` owns
`.mu-btn--danger-soft`.

### Decision 6 — the trend chart uses `react-native-svg`

The mockup draws `.mu-line` as an `<svg>` with two `<polyline>` elements and three gridlines.
`docs/best-practices/stack/expo-react-native.md` → *Performance*: *"Charts are
`react-native-svg`, memoized on their data."* Issue #17 says the dashboard is *"built on
`react-native-svg`"*. It is installed with `expo install` so the SDK 54-compatible version is
chosen rather than guessed, and it requires a **dev build**, which this app already requires
for `expo-sqlite` and `expo-crypto`.

Rejected: emulating the polyline with rotated `View`s. It cannot render the dashed comparison
line, does not scale to #17's donut and bars, and would be thrown away in one item.

### Decision 7 — data access follows the pattern item #8 established: `getAppDatabase()` plus repository functions, behind one feature hook. **No TanStack Query.**

`docs/best-practices/stack/expo-react-native.md` → *Data fetching* prescribes *"TanStack Query
over repository functions"* and sketches `src/features/home/queries.ts`. **That library is not
installed** (Verification Log), and item #8's approved plan — the first item to read the database
from React — deliberately did not add it. Instead it created `apps/mobile/src/db/runtime.ts`
exporting a memoized `getAppDatabase(): Promise<AppDatabase>`, established *"feature hooks call
it and then call repository functions; screens call neither directly"*, and **queued the
`expo-react-native.md` correction as its own documentation update**, leaving "does this app adopt
TanStack Query at all" as an open decision for LH.

This plan follows that pattern, so every screen item reads the database the same way. Adopting a
second pattern on the second screen would be the worse outcome even if the doc still described
the first.

Consequences, all of which simplify this item:

- No `QueryProvider`, no `QueryClient`, no `DatabaseProvider`, no change to
  `apps/mobile/app/_layout.tsx`.
- One feature hook, `useHomeData(params)` in
  `apps/mobile/src/features/home/use-home-data.ts`, delegates its cancellation-guarded read to
  the file's other export, `loadHomeData`, which awaits `getAppDatabase()` once and then calls
  the repository functions. Because the driver is synchronous
  (`BaseSQLiteDatabase<'sync', …>`), every read after the handle resolves is a plain call — there
  is no per-query async machinery to cache.
- Freshness after a write (categorizing in #13, excluding in #16) comes from re-reading on
  screen focus: `useFocusEffect` bumps a `reloadToken`, which is a dependency of the hook's
  effect. That is the whole invalidation contract this screen needs; it is precise by
  construction, because the hook only ever re-reads `home`'s own data.
- A stored rejection is re-thrown **during render**, not inside the async callback — throwing
  inside the callback would produce an unhandled rejection instead of reaching the route's
  `ErrorBoundary` (concurrency addendum, Decision 15's precedent from item #8).

```ts
// apps/mobile/src/features/home/use-home-data.ts — Illustrative, adapt during implementation
interface LoadHomeDataArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  params: HomeDataParams;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable
 * without a renderer (Scenario 26) — the same hook/pure split item #8 established between
 * `use-launch-decision.ts` and `launch-decision.ts`. Returns `undefined` once `isCancelled()`
 * flips true, so the caller never `setState`s a superseded run's result.
 */
export async function loadHomeData({
  getAppDatabase,
  params,
  isCancelled,
}: LoadHomeDataArgs): Promise<HomeDataState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined; // teardown raced the handle — discard, do not setState
    return { status: 'ready', data: readHomeData(db, params) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

export function useHomeData({ period, previousPeriod, locale }: HomeDataParams): HomeDataState {
  const [state, setState] = useState<HomeDataState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);

  useFocusEffect(useCallback(() => setReloadToken((token) => token + 1), []));

  useEffect(() => {
    let cancelled = false;
    loadHomeData({
      getAppDatabase,
      params: { period, previousPeriod, locale },
      isCancelled: () => cancelled,
    }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [period, previousPeriod, locale, reloadToken]);

  // Surfaces a bootstrap failure to the route's `ErrorBoundary` (concurrency addendum,
  // "Error propagation across async boundaries").
  if (state.status === 'error') throw state.error;
  return state;
}
```

`loadHomeData` is the exported, hook-free async race the hook delegates to — Scenario 26 calls it
directly with a stubbed `getAppDatabase` and a manually-flipped `isCancelled`, with no renderer
involved. `readHomeData(db, params)` is the pure composition of the six repository functions it
awaits — separated the same way item #8 split `use-launch-decision.ts` from `launch-decision.ts`.

### Decision 8 — the displayed month comes from `getMonthPeriod(deriveDateLocal(now))`, never from UTC

`BEHAVIOR.md` → `home`: *"agregados del mes en curso (mes por `deriveDateLocal`, nunca UTC)."*
The clock enters the feature once, at the route, as `new Date()`; `deriveDateLocal(instant)`
converts it to the Chilean civil day and `getMonthPeriod(dateLocal)` produces the
`{ start, end }` period. The previous month for the comparison line is
`shiftMonthPeriod(period, -1)`. The month badge label is
`formatMonthYear(period.start, locale)` → `ene 2025`. All four helpers already exist in
`@finanzas/shared-utils`; this item writes no date arithmetic.

### Decision 9 — D2 (abbreviated amounts) resolves to "exactly what the mockup draws on `home`, nowhere else"

🔴 **D2 is an open decision owned by LH** (`BEHAVIOR.md` → *Decisiones abiertas*: *"Alcance del
formato abreviado de montos (`3.7M`, `$279K`): ¿solo stat tiles y filas de categoría de `home`,
o también dashboard/detalle?"*). No human is available for this run, so this plan takes the
reversible default the parent orchestrator specified and **flags it for review**.

Abbreviation is used in exactly three places on this screen, matching the mockup character for
character, and nowhere else in the repository:

| Surface | Call | Renders |
| --- | --- | --- |
| Stat tile value (`Ingresos`, `Gastos`) | `formatClpAbbreviated(total, { withCurrencySymbol: false, signDisplay: 'never' })` | `3.7M`, `1.4M` |
| Balance del mes | `formatClpAbbreviated(balance, { withCurrencySymbol: false, direction: balance >= 0 ? 'in' : 'out' })` | `+2.3M` |
| Category row amount | `formatClpAbbreviated(total, { withCurrencySymbol: true, signDisplay: 'never' })` | `$279K` |

Everything else on `home` — the three recent-movement amounts — uses full
`formatClp(amount, { direction })` → `+$1.200.000`, `$42.000`, exactly as drawn.

Reversibility: every call site is inside `src/features/home/`, and widening or narrowing D2 is
a change to those three call sites plus #17's, with no change to `@finanzas/shared-utils`.

**Open sub-question this plan cannot resolve** (Assumption A12): `formatClpAbbreviated` renders
`3.7M` with a `.` decimal separator, because that is what the mockup draws — while the same
mockup renders percentages as `20,6%` with the Chilean comma. The two are inconsistent in the
contract itself. This plan reproduces the contract verbatim and does not "fix" it; flag it with
D2 at plan review.

### Decision 10 — the `empty` state renders an indeterminate progress bar, not a fabricated percentage

The mockup draws `.mu-progress` at `width:45%` inside the first-sync empty state. There is no
progress signal anywhere in the data model (Cross-Cutting Assumption Check, last row), so
rendering `45%` would be a lie and rendering `0%` would look stuck. `Progress` gains an
additive, backwards-compatible `indeterminate?: boolean` prop that animates a fixed-width fill
across the track. Existing call sites are untouched; #11 (bank syncing) is the next consumer.

### Decision 11 — a `__DEV__`-only sample-data route makes the runbook executable before #10 lands

`home` cannot be smoke-tested against an empty database: three of its four states need
movements, categories and a connection with sync bookkeeping. Item #10 (which produces that
data from a real bank sync) has not started, and a real sync needs live bank credentials.

`app/(dev)/sample-data.tsx` renders `src/dev/SampleDataPanel.tsx` behind the same `__DEV__` +
`require()` guard the gallery route already uses, with three actions:

- **Cargar datos de ejemplo** — executes the committed `src/db/__fixtures__/store-v1.sql`
  against the open device database (inlined by `babel-plugin-inline-import`, the same mechanism
  the migrations use).
- **Simular error de sincronización** — sets `sync_status = 'error'` and a `last_error_code` on
  the connection, so the `sync-error` state is reachable.
- **Vaciar datos de ejemplo** — restores the pre-fixture state so `empty` is reachable again.

`/(dev)/sample-data` is added to `DEV_ONLY_ROUTES` so route/manifest parity stays green. The
panel never ships: the route returns `null` when `__DEV__` is false, and the `require()` inside
that branch keeps `src/dev/` and the fixture out of a release bundle.

### Decision 12 — `formatPercentTenths` lands in `@finanzas/shared-utils`, in a new `percent.ts`

Item #5 returns percentages as integer tenths; the mockup renders `20,6%`. No formatter for
that exists. It goes in `@finanzas/shared-utils` for the same reason `formatClp` does
(`expo-react-native.md`: *"Money, date and RUT formatting live in `@finanzas/shared-utils` …
not in `apps/mobile`"*), it is locale-invariant and hand-built like every other formatter in
that package, and #17 needs the identical function. A new file avoids editing `money.ts` and
`dates.ts`, which item #5's open PR is already changing.

```ts
// packages/shared-utils/src/percent.ts — Illustrative, adapt during implementation
import { MINUS_SIGN } from './money';

export const PERCENT_DECIMAL_SEPARATOR = ',';

/** `206` → `20,6%`. Tenths of a percent in, display string out. Throws on a non-integer. */
export function formatPercentTenths(tenths: number): string {
  if (!Number.isSafeInteger(tenths)) {
    throw new TypeError(`formatPercentTenths: tenths must be a safe integer, received ${String(tenths)}`);
  }
  const magnitude = Math.abs(tenths);
  const whole = Math.trunc(magnitude / 10);
  const fraction = magnitude % 10;
  const sign = tenths < 0 ? MINUS_SIGN : '';
  return `${sign}${whole}${PERCENT_DECIMAL_SEPARATOR}${fraction}%`;
}
```

### Decision 13 — this item defines navigation seams, not adjacent screens

Every CTA on `home` navigates to a route that already exists as a placeholder. No adjacent
screen is built, and no route file outside `app/(tabs)/home.tsx` and the dev route is created —
so `route-manifest-parity.test.ts` keeps passing unchanged.

| CTA in the mockup | Destination route | Owning item |
| --- | --- | --- |
| Challenge hero (`pending`) | `/categorize/intro` | #13 |
| `sync-error` note → **Reintentar** | `/settings/banks/[bankId]` of the failed connection | #20 |
| Connected-banks row | `/settings/banks/[bankId]` | #20 |
| Header ⚙️ | `/settings` | #19 |
| "Ver análisis completo →" (×2) | `/dashboard` | #17 |
| "Ver todas" | `/(tabs)/transactions` | #15 |
| Recent-movement row | `/transactions/[transactionId]` | #16 |

`BEHAVIOR.md` assigns the `sync-error` CTA to `bank-review`, so **Reintentar** navigates rather
than triggering a sync — home owns no sync trigger.

### Decision 14 — `home` renders the month in progress only; the `‹ ›` glyphs are inert

`BEHAVIOR.md` → `home` → *Datos*: *"agregados del mes en curso"*, with no month-navigation
action listed. The mockup draws `‹ ›` as a `mu-xs` text span, not as buttons. They are rendered
as drawn and are non-interactive in this item (Assumption A4). Period navigation is a
`dashboard` question (`BEHAVIOR.md` → `dashboard`: *"🟡 Navegación a períodos anteriores si el
mockup la dibuja"*), owned by #17.

---

## Assumptions

Every 🟡-marked statement this plan builds on, per `BEHAVIOR.md`'s own rule (*"Una spec puede
construir sobre él, pero debe listarlo en sus supuestos"*), plus the inferences this plan makes
from the drawing where the behaviour contract is silent. Each is reversible in one named place.

| # | Assumption | Source / derivation | Reversal cost |
| --- | --- | --- | --- |
| A1 | State precedence is `empty` > `sync-error` > `pending` > `all-clear` | The mockup's `sync-error` state hides the challenge hero; `empty` hides every card | One table in `home-state.ts` |
| A2 | 🟡 `empty` means "no connection has a successful sync yet", including "no connections" | `BEHAVIOR.md`: *"conexión aún sin primer sync exitoso"* (🟡) | One predicate in `home-state.ts` |
| A3 | The three `mu-dots` under the hero are a decorative indicator with the first dot active, not a carousel | The mockup draws three dots but only one hero slide, and `BEHAVIOR.md` lists no swipe action for `home` | One `<Dots total={3} current={1} />` call |
| A4 | The `‹ ›` month glyphs are inert (Decision 14) | `BEHAVIOR.md` lists no month-navigation action for `home` | Wiring two `Pressable`s |
| A5 | The category card lists the **top 4** buckets by included total, while its subtitle counts **all** buckets (`8 categorías · ene 2025`) | The mockup draws four rows under a subtitle that says eight | One constant, `HOME_CATEGORY_ROW_LIMIT` |
| A6 | Bar width is `bucketTotal / largestBucketTotal`; the fill colour is `theme.chart.series[rank]`, except the uncategorized bucket which uses `theme.colors.palette.slate['300']` | Derived from the mockup: `100% / 84% / 69% / 56%` matches `279 / 235 / 193 / 156` against `279`; the four fill colours match `series[0..2]` plus `--slate-300` for *Sin categorizar* | `CategoryBreakdownCard` |
| A7 | 🟡 The trend series is the **cumulative** included total per local day, current month vs previous month, each normalized to its own day count on the x axis and to the shared maximum on the y axis | Both polylines in the mockup are monotonically increasing in value; the legend reads *"Este mes"* vs *"dic 2024"* | `trend-series.ts` |
| A8 | "Transacciones recientes" is the 3 most recent movements by `date_local`, regardless of exclusion; an excluded one renders with `TransactionRow state="excluded"` | `BEHAVIOR.md` → `transactions`: *"los excluidos 🟡 se muestran atenuados… no desaparecen de la lista"*, BR3 | One constant, `HOME_RECENT_MOVEMENT_LIMIT` |
| A9 | A recent row's icon is the merchant emoji, falling back to the category emoji, falling back to `💰` for a credit and `💳` for a debit | Reproduces all three drawn rows (`🛒` Líder = merchant, `💰` uncategorized income, `💳` uncategorized expense) | One function in `RecentMovementsSection` |
| A10 | A recent row shows the warn meta `⚠️ Necesita categorización` (and `state="pending"`) when it is an **uncategorized debit**; otherwise `27 ene · Sin categorizar` / `24 ene · Comida` | Reproduces all three drawn home rows and all seven drawn `transactions` rows | Same function |
| A11 | 🟡 The bank row's sub-label is a relative sync time (`Sincronizado hace 2 h`), and the `sync-error` note names the last **successful** sync as `ayer 21:14` | The mockup's exact strings; issue #20 AC1 requires last-success and last-attempt to be shown separately | `relative-time.ts` + two catalogue keys |
| A12 | D2's abbreviation keeps the mockup's `.` decimal separator (`3.7M`) even though the same mockup uses `,` for percentages (`20,6%`) | The mockup is the contract; the inconsistency is in the contract | Flag with D2 — one options object in `formatClpAbbreviated` |
| A13 | The bank logo is the institution's `assets.logo` when present, and a three-letter monogram (`BCH`) on the brand colour otherwise | `financial_institutions.assets` is nullable; the mockup draws a monogram | `BankRow` |
| A14 | `StatTile` renders `↑` / `↓` where the mockup draws `↗` / `↘` | Inherited from item #2's merged `ARROW_GLYPH` map; not re-litigated here | Out of scope — raise as a follow-up against #2 if it matters |
| A15 | While the database is bootstrapping, `home` renders nothing; a bootstrap failure propagates rather than being caught by this screen | The mockup declares no loading state for `home`; launch-failure handling belongs to #8 | `use-home-data.ts` |

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration, no schema change, no new seed data. Every column this item reads already exists in
the merged schema.

**`apps/mobile/src/db/repositories/transactions.ts`** — three additive exports; the five existing
exports are untouched.

- [ ] `sumIncludedByDirectionAndCategory(db, period): DirectionCategoryTotal[]` — Decision 1.
      `select type, transaction_category_id, sum(includedAmount), count(*)` filtered by
      `and(isIncluded, gte(dateLocal, period.start), lte(dateLocal, period.end))`, grouped by
      `type` and `transaction_category_id`. Imports `isIncluded` and `includedAmount` from
      `../fragments`. Drives the two stat tiles, the balance line and the whole category card.
      The `null` `transaction_category_id` group is the *Sin categorizar* bucket and is
      returned like any other (item #5 Decision 10: *"uncategorized movements are a bucket, not
      a filter"*).
- [ ] `sumIncludedByDirectionAndDay(db, period): DirectionDayTotal[]` — Decision 1. Same filter,
      grouped by `date_local` and `type`, ordered by `date_local` ascending. Drives the trend
      chart; called once for the current period and once for the previous period.
- [ ] `listRecentMovements(db, params): RecentMovement[]` — Decision 2. `limit`-bounded,
      ordered by `date_local desc`, left-joined to `merchants` and `transaction_categories`,
      mapped to a domain type with the category label resolved through the existing
      `resolveLabel` / `parseCategoryLabels` / `parseAssets` helpers. **No inclusion filter** —
      an excluded movement still appears in the list, dimmed (Assumption A8) — and therefore no
      fragment import and no restatement.

**`apps/mobile/src/db/repositories/connections.ts`** — one additive export, in the file item #8
creates. `institutions.ts` is **not** touched: #8 put connection reads in `connections.ts`, and
splitting them across two files is the kind of drift this plan is aligning away from.

- [ ] `listBankConnections(db): BankConnection[]` — joins `user_financial_institutions` to
      `financial_institutions`, returning name, logo, `status`, `syncStatus`, `lastSyncAt`,
      `lastSuccessAt` and `lastErrorCode`, for **every** connection regardless of status. A
      sibling of #8's `getConnectedBanksSummary`, which answers a different question (connected
      institutions plus product counts, for `onboarding-ready`) and is left unchanged. Both
      columns sets are written by #10; only read here.

**`apps/mobile/src/db/types.ts`** — four additive domain types alongside #8's
`ConnectedBanksSummary` and `ReminderSettings`: `DirectionCategoryTotal`, `DirectionDayTotal`,
`RecentMovement`, `BankConnection`.

```ts
// apps/mobile/src/db/types.ts — Illustrative, adapt during implementation
export interface DirectionCategoryTotal {
  type: 'debit' | 'credit';
  transactionCategoryId: string | null;
  total: number;
  movementCount: number;
}

export interface DirectionDayTotal {
  dateLocal: string;
  type: 'debit' | 'credit';
  total: number;
}
```

**Unchanged and reused as-is**: `countUncategorized` (brief AC1 — its `WHERE` already matches
`transactions_uncategorized_idx` exactly, verified above), `listCategories`, `listMonth`,
`totalForCategoryInPeriod`, `listByMerchant`.

### Shared Packages / Libraries

**`@finanzas/shared-utils`** — one new module, no behaviour change to any existing export.

- [ ] `src/percent.ts` — `formatPercentTenths(tenths)` and `PERCENT_DECIMAL_SEPARATOR`
      (Decision 12).
- [ ] `src/index.ts` — one added line, `export * from './percent';`.

**`@finanzas/shared-domain`** — **not modified**. This item only consumes
`isIncludedInAnalysis` and `apportionTenths` (Decisions 1 and 3).

**`@finanzas/bank-scraper`** — untouched.

### Frontend / UI

**New design-system primitives** (Decision 5), all in `apps/mobile/src/components/ui/`, all
exported from `index.ts`, all composing `theme` / `componentMetrics` with no style literal:

- [ ] `ScreenHeader.tsx` — avatar (emoji or brand), title, subtitle, optional right action
      button; `variant?: 'default' | 'plain'`.
- [ ] `CategoryRow.tsx` — emoji, name, formatted amount, proportional bar with an explicit fill
      colour, and a meta line (`5 transacciones · 20,6%`). Pressable, optional `onPress`.
- [ ] `LineChart.tsx` — `react-native-svg`. Takes already-computed polyline point strings, a
      gridline count, a series colour and an optional dashed comparison series. Wrapped in
      `React.memo`; owns no aggregation.
- [ ] `Legend.tsx` — coloured dot + label rows.
- [ ] `BankRow.tsx` — logo or monogram, name, sub-label, chevron. Pressable.
- [ ] `Progress.tsx` — **modified**: additive `indeterminate?: boolean` (Decision 10).
- [ ] `_internal/touch-metrics.ts` — **modified**: `headerAction`, `categoryRow`, `bankRow`
      entries, automatically covered by `touch-targets.test.ts`.
- [ ] `index.ts` — **modified**: five new exports plus their prop types.

**`apps/mobile/src/theme.ts`** — **modified**: `componentMetrics` entries for
`screenHeader`, `categoryRow`, `lineChart`, `legend` and `bankRow`, each citing its `.mu-*`
selector and the mockup line number, per the existing convention; plus a `home` group in the
`screenMetrics` export item #8 adds, for screen-level geometry that belongs to no single
primitive (the chart's `viewBox`, the section rhythm). The `theme` object itself is **not**
touched — `design/tokens.json` already carries every colour this screen needs, so
`theme-tokens-parity.test.ts` is unaffected.

**`apps/mobile/app/_layout.tsx`** — **not modified.** There is no provider to install: the
database handle comes from item #8's memoized `getAppDatabase()` (Decision 7), and this item adds
no query client.

**`apps/mobile/src/features/home/`** — new.

- [ ] `use-home-data.ts` — `useHomeData(params): HomeDataState`, the single feature hook
      (Decision 7): re-reads when `useFocusEffect` bumps its `reloadToken`, throws a stored
      rejection during render so the route's `ErrorBoundary` sees it (Assumption A15), and
      delegates the cancellation-guarded read to the file's other export, `loadHomeData`, which
      awaits `getAppDatabase()` and calls `readHomeData` — extracted so Scenario 26 can drive the
      race without a renderer.
- [ ] `read-home-data.ts` — `readHomeData(db, params): HomeData`, the pure composition of six
      repository functions, called eight times in total because two of them run once per period
      (`countUncategorized`; `sumIncludedByDirectionAndCategory` for the current period;
      `sumIncludedByDirectionAndDay` for the current **and** previous periods;
      `listRecentMovements`; `listBankConnections`; `listCategories` for **both** directions). No
      React, so it is testable against a real in-memory store in the `db` tier.
- [ ] `home-state.ts` — `HomeState` and `resolveHomeState` (Decision 4).
- [ ] `summary.ts` — `buildFinancialSummary(totals)` (income total, expense total, per-direction
      movement counts, balance) and `buildCategoryBreakdown(totals, catalogue)` (buckets sorted
      by total descending with the uncategorized bucket last among equals, percentages from
      `apportionTenths`, bar ratios, series colours). Pure; no SQL, no React.
- [ ] `trend-series.ts` — `buildCumulativeSeries(dailyTotals, period, direction)` and
      `toPolylinePoints(series, viewBox)` (Assumption A7). Pure integer arithmetic over totals
      that SQL has already filtered, so it states no rule.
- [ ] `relative-time.ts` — `describeSyncTime(nowInstant, isoInstant)` returning a discriminated
      descriptor (`{ kind: 'minutes' | 'hours' | 'yesterday' | 'date', … }`) that the component
      renders through i18n keys, so no Spanish string is built in TypeScript (Assumption A11).
      Composes `formatShortDate` / `formatTimeOfDay` from `@finanzas/shared-utils`.
- [ ] `components/ChallengeHero.tsx` — `#screen=home&state=pending`.
- [ ] `components/AllClearHero.tsx` — `#screen=home&state=all-clear`.
- [ ] `components/SyncErrorNote.tsx` — `#screen=home&state=sync-error`.
- [ ] `components/FirstSyncEmptyState.tsx` — `#screen=home&state=empty`.
- [ ] `components/FinancialSummaryCard.tsx` — stat tiles, balance, month badge.
- [ ] `components/TrendCard.tsx` — segment (Gastos / Ingresos, local `useState`), `LineChart`,
      `Legend`, "Ver análisis completo →". Memoized on its series data (brief AC4).
- [ ] `components/CategoryBreakdownCard.tsx` — top-4 `CategoryRow`s, subtitle, CTA.
- [ ] `components/RecentMovementsSection.tsx` — three `TransactionRow`s + "Ver todas".
- [ ] `components/ConnectedBanksCard.tsx` — `BankRow` list with the `Al día` / `Error` badge.

**`apps/mobile/app/(tabs)/home.tsx`** — **rewritten**: derives `now` → period once, calls
`useHomeData`, resolves the state, and composes the sections. No SQL, no business logic, no
literal copy — `expo-react-native.md`: *"A route file that contains business logic or a SQL query
is in the wrong place."*

**`apps/mobile/src/dev/`** — `SampleDataPanel.tsx` and `sample-store.ts` (Decision 11);
`DesignSystemGallery.tsx` **modified** with a section per new primitive.

**`apps/mobile/app/(dev)/sample-data.tsx`** — new, `__DEV__`-guarded (Decision 11).

**`apps/mobile/src/test-utils/`** — `route-inventory.ts` **modified** (`DEV_ONLY_ROUTES` gains
`/(dev)/sample-data`); `mu-class-map.ts` **modified** (Decision 5).

**`apps/mobile/src/i18n/es.json` and `en.json`** — **modified**: `home.*` keys for every string
the mockup draws, `dev.sample_data.*` keys for the panel, and `ds.*` keys for the new gallery
sections. `es` copy is copied from the mockup verbatim; `en` is a faithful translation. Flat,
lowercase, snake_case, identical key sets — the shape `catalogue-parity.test.ts` enforces.

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — **one** dependency, installed through Expo's resolver so the
      SDK 54-compatible version is chosen rather than pinned by guess:

      ```bash
      pnpm --filter @finanzas/mobile exec expo install react-native-svg
      ```

      No query library is added (Decision 7).

- [ ] `pnpm check:layout` must stay green after the install (it runs as a `postinstall` and in
      CI); `react-native-svg` is a native module, so the PR must state that a **dev build
      rebuild** is required — Expo Go cannot run this screen.
- [ ] `apps/mobile/jest.config.js` — two additive lines so a repository **composition** that
      lives outside `src/db/` can still be tested against real SQLite (Scenario 25). The `db`
      project's `testMatch` gains `'<rootDir>/src/features/**/*.db.test.ts'`, and the `app`
      project's `testPathIgnorePatterns` gains `'\\.db\\.test\\.ts$'` so the same file does not
      also run under `jest-expo`. Existing patterns are left byte-identical; no existing test
      changes project. The `.db.test.ts` suffix is the convention every later screen item reuses.
- [ ] No new CI job, no new script, no `metro.config.js` or `babel.config.js` change: the
      `.sql` inline-import mechanism Decision 11 uses is already configured.

This item adds no executable shell guidance to a framework-owned surface, so no shell contract
(`bash` / `bash-zsh`) needs naming and the snippet linter is not in scope.

---

## Testing Strategy

**Test types**: unit (Jest `db` project, Node + `better-sqlite3`), unit (Jest `app` project),
source-scanning enforcement tests, and a manual smoke runbook on a dev build.

Both Jest projects already exist (`apps/mobile/jest.config.js`): `db` matches
`src/db/**/*.test.ts` under Node, `app` runs everything else under `jest-expo`.
`@testing-library/react-native` is **not** installed and this item does not add it — following
item #2's precedent, component-level assertions call the component function directly and inspect
the returned element tree, and everything else is a pure function or a real-SQLite test.

### Scenario map

| # | Scenario | Maps to | Test file | Tier |
| --- | --- | --- | --- | --- |
| 1 | `countUncategorized` uses `transactions_uncategorized_idx`, proven by `EXPLAIN QUERY PLAN` naming the partial index rather than `SCAN transactions`. **This test already exists and passes** (`indexes.test.ts`, the `"How many movements still need a category?"` case) because item #3 built it; this item adds no query on that path, so the requirement is to keep it green — extend it only if `countUncategorized` is touched | brief AC1 | `apps/mobile/src/db/__tests__/indexes.test.ts` (existing) | db |
| 2 | `sumIncludedByDirectionAndCategory` over a fixture with one full, one partially included and one excluded movement returns a hand-derived literal total, and the excluded movement's amount appears nowhere | brief AC3, BR4, Decision 1 | `apps/mobile/src/db/__tests__/transactions.test.ts` (extend) | db |
| 3 | The same fixture: the per-category buckets returned by `sumIncludedByDirectionAndCategory` agree, category by category, with `totalForCategoryInPeriod` — **and both agree with the hand-derived literal**, so this is an equivalence check, not two implementations agreeing about a shared mistake | brief AC3 ("totals match the dashboard exactly") | `apps/mobile/src/db/__tests__/transactions.test.ts` | db |
| 4 | The `null`-category group is returned as its own bucket and is not dropped | Mockup's *Sin categorizar* row; item #5 Decision 10 | `transactions.test.ts` | db |
| 5 | `sumIncludedByDirectionAndDay` buckets by `date_local` and excludes movements on the day before `period.start` and the day after `period.end` | Decision 8 | `transactions.test.ts` | db |
| 6 | `listRecentMovements` respects `limit`, orders by `date_local` descending, resolves merchant and category labels, and returns an excluded movement rather than filtering it out | Assumption A8 | `transactions.test.ts` | db |
| 7 | `listBankConnections` returns the institution name, logo and every sync bookkeeping column | Decision 4 inputs | `apps/mobile/src/db/__tests__/institutions.test.ts` (extend) | db |
| 8 | The inclusion-rule scanner finds **zero** restatements across the whole tree, including every new file | brief AC3, BR4 | `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` (existing, must stay green) | db |
| 9 | No file outside `src/db/**` imports a SQL library — including the new feature hook, the pure modules and the dev panel | Decision 1 | `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` (existing) | db |
| 10 | `resolveHomeState` returns the right state for each of at least eight inputs: no connections; connection without `lastSuccessAt`; error + pending together (→ `sync-error`); error alone; pending alone; neither; error on one of two connections; `lastSuccessAt` on one of two | brief AC2, Decision 4, Assumptions A1-A2 | `apps/mobile/src/features/home/__tests__/home-state.test.ts` | app |
| 11 | `buildCategoryBreakdown` percentages sum to exactly `PERCENTAGE_TENTHS_TOTAL`, including a three-equal-bucket tie and a single-bucket case; bar ratios are relative to the largest bucket; the uncategorized bucket sorts last among equals and takes the slate fill | Assumption A6, Decision 3 | `apps/mobile/src/features/home/__tests__/summary.test.ts` | app |
| 12 | `buildFinancialSummary` computes the balance as income minus expenses and reports per-direction movement counts, over SQL-produced subtotals | Mockup's `+2.3M` / `2 movimientos` / `24 movimientos` | `summary.test.ts` | app |
| 13 | `buildCumulativeSeries` is monotonically non-decreasing, emits one point per day of the period, carries the previous day's value forward for a day with no movements, and returns an empty series for an empty period | Assumption A7 | `apps/mobile/src/features/home/__tests__/trend-series.test.ts` | app |
| 14 | `toPolylinePoints` maps an empty series, a single point and a flat all-zero series without producing `NaN` in the output string | Assumption A7, brief AC4 (a broken chart is worse than an empty one) | `trend-series.test.ts` | app |
| 15 | `describeSyncTime` classifies "minutes ago", "hours ago", "yesterday" and "older", and is stable across the Santiago DST transitions | Assumption A11 | `apps/mobile/src/features/home/__tests__/relative-time.test.ts` | app |
| 16 | `formatPercentTenths` renders `206 → 20,6%`, `1000 → 100,0%`, `0 → 0,0%`, `5 → 0,5%`, a negative value with `−`, and throws on a non-integer | Decision 12 | `packages/shared-utils/src/percent.test.ts` | shared-utils |
| 17 | Every `mu-*` class is classified exactly once and every `primitive` owner resolves to a barrel export — with the 22 reassigned classes now resolving to the five new components | Decision 5 | `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (existing) | app |
| 18 | No hex, `rgb()` or numeric style-property literal outside `theme.ts`, including in the five new primitives and the chart | AC "No hex, spacing or radius literal outside `theme.ts`" (#2, still enforced) | `apps/mobile/src/__tests__/no-style-literals.test.ts` (existing) | app |
| 19 | Every new `TOUCH_METRICS` entry reaches `theme.touchTarget.min` | Accessibility rule in `expo-react-native.md` | `apps/mobile/src/__tests__/touch-targets.test.ts` (existing) | app |
| 20 | A string icon passed to `ScreenHeader`, `CategoryRow` or `BankRow` never lands as a bare child of a non-text host | Regression class found in item #2's review | `apps/mobile/src/__tests__/no-naked-text.test.ts` (extend with the three new primitives) | app |
| 21 | Route/manifest parity still holds with `/(dev)/sample-data` in `DEV_ONLY_ROUTES`, and that file is `__DEV__`-guarded | Decision 11, BR3 | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (existing) | app |
| 22 | `es` and `en` carry identical key sets and every new key matches the flat snake_case pattern | Non-negotiable 8 | `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` (existing) | app |
| 23 | `TrendCard` and `CategoryBreakdownCard` are wrapped in `React.memo`, and `LineChart` receives a `useMemo`-stabilised points object — asserted by a source scan over `src/features/home/` plus a referential-stability test on `buildCumulativeSeries`'s memo input | brief AC4 ("Charts are memoized; no recomputation on unrelated re-renders") | `apps/mobile/src/features/home/__tests__/memoization.test.ts` | app |
| 24 | All four manifest states render — the runbook's per-state fidelity comparison | brief AC2, AC5, non-negotiable 6 | `docs/testing/mobile/12-home-screen.smoke-test.md` | smoke |
| 25 | `readHomeData` composes its eight repository calls over a **real** in-memory store and returns one internally consistent snapshot: the stat-tile totals, the category buckets and the trend series all describe the same set of movements | Decision 7 | `apps/mobile/src/features/home/__tests__/read-home-data.db.test.ts` — the `.db.test.ts` suffix routes it to the Node/`better-sqlite3` Jest project (Infrastructure below) | db |
| 26 | `loadHomeData` returns `undefined` (so the hook it backs never calls `setState`) once `isCancelled()` flips true, for both a resolved and a rejected `getAppDatabase()`; called a second time with a fresh `isCancelled` it models a second focus event superseding an in-flight read | Concurrency addendum | `apps/mobile/src/features/home/__tests__/use-home-data.test.ts` — `loadHomeData` is called directly with a stubbed `getAppDatabase` and a manually-flipped `isCancelled`, so the cancellation guard is exercised as a plain async function with no renderer, following item #2's no-renderer precedent for what can be asserted without one | app |

**Seed data for the automated tiers**: the `db` scenarios build their own fixtures with the
existing `createTestConnection` / `createTestProduct` helpers from
`apps/mobile/src/db/testing/product-fixture.ts` and the deterministic ports from
`memory-db.ts`. No new fixture file is committed, and `src/db/__fixtures__/store-v1.sql` is
**not** regenerated by this item — it changes no schema and no seed.

### Parser-risk addendum

**Not applicable.** No file in this plan lives under `scripts/lint/` or a comparable
parse/scan directory, no new module has lint/parser/scanner/tokenizer responsibilities, and no
behaviour is described as regex-heavy scanning or structured-text parsing. The three existing
source-scanning tests this item must satisfy (`no-style-literals`, `mu-class-coverage`,
`inclusion-rule-single-definition`) are consumed unchanged; their scanners are not modified.

### Concurrent-event-source addendum

**Applicable.** `useHomeData`'s asynchronous `getAppDatabase()` await runs concurrently with
React lifecycle events and with screen-focus events that trigger a re-read, over shared mutable
state (the hook's `state` and `reloadToken`).

- **Shared mutable state guards** — the database handle is not this hook's state to guard:
  item #8's `getAppDatabase()` is a module-level memoized `Promise<AppDatabase>` written once
  before any `await`, wrapping `ensureDatabaseReady`, which itself serialises through the
  module-level single-flight promise in `apps/mobile/src/db/bootstrap.ts`. Two screens mounting
  at once therefore share one open-and-bootstrap, not two. The hook's own state has exactly one
  writer — its effect — and is only ever replaced wholesale, never mutated in place.
- **Re-entrancy / in-flight tracking** — a second focus event can arrive while the first read is
  still awaiting the handle. Bumping `reloadToken` re-runs the effect, whose cleanup sets
  `cancelled = true` on the superseded run, so the earlier read's result is discarded rather
  than racing the later one into state. Last write wins, deterministically, because React runs
  the cleanup before the next effect.
- **Event deduplication** — `useFocusEffect` fires on every focus, including a re-focus with no
  intervening navigation. A duplicate event costs one extra set of `SELECT`s and cannot corrupt
  anything: every repository call in `readHomeData` is a read, and the whole result is replaced
  atomically in one `setState`. No debounce is added; a redundant local SQLite read is cheaper
  than the state machine that would avoid it.
- **Listener and resource cleanup** — `useFocusEffect` returns its own cleanup, and the data
  effect returns a cleanup that sets `cancelled`. Unmounting mid-read therefore cannot
  `setState` on an unmounted component. The SQLite handle is process-lived and deliberately
  **not** closed: it is owned by `src/db/runtime.ts`, not by any screen, and there is exactly one
  database for the app's lifetime.
- **Race conditions at initialization** — a focus event can arrive before the handle resolves.
  It only bumps `reloadToken`, which re-runs the same effect; the effect still awaits the same
  memoized promise, so nothing reads an unready database. `home` renders nothing while
  `status === 'pending'` (Assumption A15).
- **Race conditions at teardown** — after unmount, the `cancelled` flag discards both a resolved
  read and a rejected one. Because every call is a read, a discarded result has no side effect,
  and nothing needs draining.
- **Error propagation across async boundaries** — `getAppDatabase()` rejects with the typed
  `DatabaseBootstrapError` from `bootstrap.ts` (and clears its own memo, so the next mount
  genuinely retries rather than replaying a cached failure). `loadHomeData` catches it and
  resolves to `{ status: 'error', error }` rather than rejecting itself, so the hook's `.then`
  always runs; the hook stores that value with `setState` and re-throws it **during render** on
  the next pass, which is what makes it reachable by the route's `ErrorBoundary` — throwing
  inside the async callback would produce an unhandled rejection instead. It is never
  `console.log`ged (`no-console` is on) and carries no credential, because none is in scope here.
  This screen renders no read-error state of its own: the mockup declares none for `home`, and a
  failed read against a local SQLite file after a successful bootstrap is not a modelled product
  state.

**New concurrent patterns**: none. This mirrors the cancellation-guarded,
`getAppDatabase()`-awaiting hook shape item #8 established for `useLaunchDecision` /
`useOnboardingSummary`, rather than inventing a second discipline (Decision 7).

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Bank connection, products and movements for the on-device smoke test | The committed deterministic snapshot: one `banco-de-chile` connection with `sync_status = 'ok'`, two products, and movements covering every person-owned state (categorized, uncategorized, excluded, partially included) | `apps/mobile/src/db/__fixtures__/store-v1.sql` — **existing, unchanged**; loaded on device by the `__DEV__`-only panel (Decision 11) |
| `sync-error` state | `sync_status = 'error'` plus a `last_error_code` written onto the loaded connection | Written by the dev panel's "Simular error de sincronización" action, `apps/mobile/src/dev/sample-store.ts` |
| `empty` state | The bootstrapped store with starter content only — institutions, categories and merchants, no connection with a `last_success_at` | Produced by the dev panel's "Vaciar datos de ejemplo" action, or by a fresh install |
| `db`-tier scenarios | Built per-test from `createTestConnection` / `createTestProduct` and the deterministic ports | `apps/mobile/src/db/testing/product-fixture.ts`, `memory-db.ts` — **existing, unchanged** |

No seed file is added or regenerated: this item changes no schema and no starter content.

---

## Documentation Updates

To be executed by the developer **during implementation**, not now.

- [ ] `AGENTS.md` — note that a **dev build** is required because `react-native-svg` is a native
      module. No structure change: `src/features/` is already documented, and this item adds no
      new top-level directory under `apps/mobile/src/`.
- [ ] `docs/project/2-repo-architecture.md` — record `react-native-svg` as a new runtime
      dependency of `@finanzas/mobile`, with its rationale (Decision 6).
- [ ] `docs/project/3-software-architecture.md` — record the chart library choice, and state
      that `home` reads through item #8's `getAppDatabase()` plus repository functions behind one
      feature hook (Decision 7). **Merge-order note**: PRs #44 and #46 also edit this file, and
      item #8's implementation may too; all land before this item.
- [ ] `docs/best-practices/stack/expo-react-native.md` — **no edit from this item.** Item #8's
      plan already owns correcting the *Data fetching* and *Screen structure* blocks, which
      describe TanStack Query and a `queries.ts` that do not exist. If #8's implementation landed
      that correction, verify it also covers the `src/i18n/{es,en}.ts` / `.json` mismatch in the
      same block; if it did not, raise a follow-up rather than editing the same block twice.
- [ ] `docs/best-practices/stack/design-tokens.md` — add the five new `componentMetrics` groups
      and the `screenMetrics.home` group to the list of documented groups, if that document
      enumerates them (item #8 documents `screenMetrics` itself).
- [ ] `docs/best-practices/stack/mobile-ui-fidelity.md` — note that the mockup's
      `#screen=ds-components` does **not** yet showcase `ScreenHeader`, `CategoryRow`,
      `LineChart`, `Legend` or `BankRow`, while the app gallery does; the mockup side is a
      design change and is raised as a follow-up rather than made here.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — **no edit in this PR.** D2 stays 🔴 open; this plan
      records the chosen reversible default (Decision 9) and flags it. Closing D2 is LH's call
      and belongs in a `BEHAVIOR.md` PR, per that document's own rule.
- [ ] `docs/project/4-database-model.md` — **no edit.** No schema change.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Item #5 changes its public surface under review, invalidating Decision 3 | Medium | Medium | Only two symbols are consumed, both specified in #5's **merged** plan document. Step 0 of the Implementation Order re-verifies them against merged `develop` before any edit and stops on a mismatch |
| **Item #8's implementation lands a different shape than its merged plan**, invalidating Decision 7 | Medium | High | Every symbol this plan consumes from #8 (`getAppDatabase`, `getConnectedBanksSummary`, `screenMetrics`, `src/db/repositories/connections.ts`) is re-verified by Step 0 against merged `develop`, not against #8's plan document. A mismatch stops the run before any edit and returns evidence to the parent |
| A future item adopts a query library and this screen is left on the hook pattern | Low | Low | Decision 7 records the pattern, its authority (#8's merged plan) and the open question ("does this app adopt TanStack Query at all" is LH's call). Migrating one hook is a contained change; migrating half the screens is not, which is why this item does not fork the pattern |
| `home` and `dashboard` still diverge later, despite the fragments | Low | High | #17 is planned to call the *same functions*, not merely the same fragments. Scenario 3 pins the new aggregate against `totalForCategoryInPeriod` **and** against a hand-derived literal, so a shared mistake fails the literal assertion |
| D2 is decided the other way after this item merges | Medium | Low | Three call sites, all in `src/features/home/`, all through one already-tested helper. No `@finanzas/shared-utils` change is needed either way |
| The trend series shape (Assumption A7) is wrong | Medium | Low | Contained in `trend-series.ts` behind `LineChart`'s already-computed-points interface; a different series definition is a rewrite of one pure function with its own tests |
| `react-native-svg` breaks the hoisted `node_modules` layout or the CI bundle check | Low | Medium | `pnpm check:layout` runs as a `postinstall` and in CI (item #35); Step 1 runs it explicitly right after the install, before any other work |
| Scope: this item builds five design-system primitives that three later items expected to own | Certain | Medium | Explicitly recorded in Decision 5 and reflected in `MU_CLASS_MAP` ownership, so #9, #17 and #19 discover the reassignment mechanically rather than duplicating |
| The dev-only sample-data surface leaks into a release bundle | Low | High | Same `__DEV__` + inline-`require()` pattern as the merged gallery route, whose rationale is documented in `app/(dev)/gallery.tsx`; `route-manifest-parity.test.ts` asserts every `DEV_ONLY_ROUTES` file contains a `__DEV__` guard |
| Home is unreachable for smoke testing | Low | Low | Item #8 is a blocking dependency and ships the launch gate that sends a returning user to `/(tabs)/home`, so home is reachable normally. The runbook additionally uses the deep link `finanzas://(tabs)/home` to reach a specific state without replaying onboarding — the same technique the merged gallery runbook uses |
| Bootstrap failure has no UI | Low | Medium | Out of scope by Assumption A15; the error propagates as a typed `DatabaseBootstrapError` for #8's launch gate to render |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation.

The two new money aggregates. The only thing that matters here is that the filter and the
weight are the imported fragments, never a restated condition:

```ts
// apps/mobile/src/db/repositories/transactions.ts — Illustrative, adapt during implementation
import { and, asc, gte, lte, sql } from 'drizzle-orm';

import { includedAmount, isIncluded } from '../fragments';
import { transactions } from '../schema';
import type { AppDatabase, DirectionCategoryTotal, DirectionDayTotal } from '../types';

/**
 * `home`'s two stat tiles, its balance line and its whole category card, plus `dashboard`'s
 * per-category report (#17). Reads through both shared fragments, so this is a consumer of the
 * inclusion rule, never a second statement of it (item #3 Decision 9, Business Rule 4).
 *
 * The `null` `transaction_category_id` group is the "Sin categorizar" bucket and is returned
 * like any other: categorization is never mandatory, so an uncategorized movement must never be
 * silently dropped from a total.
 */
export function sumIncludedByDirectionAndCategory(
  db: AppDatabase,
  period: { startDateLocal: string; endDateLocal: string },
): DirectionCategoryTotal[] {
  return db
    .select({
      type: transactions.type,
      transactionCategoryId: transactions.transactionCategoryId,
      total: sql<number>`coalesce(sum(${includedAmount}), 0)`,
      movementCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        isIncluded,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .groupBy(transactions.type, transactions.transactionCategoryId)
    .all() as DirectionCategoryTotal[];
}

/** The trend chart's source series, called once per period (current, previous). */
export function sumIncludedByDirectionAndDay(
  db: AppDatabase,
  period: { startDateLocal: string; endDateLocal: string },
): DirectionDayTotal[] {
  return db
    .select({
      dateLocal: transactions.dateLocal,
      type: transactions.type,
      total: sql<number>`coalesce(sum(${includedAmount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        isIncluded,
        gte(transactions.dateLocal, period.startDateLocal),
        lte(transactions.dateLocal, period.endDateLocal),
      ),
    )
    .groupBy(transactions.dateLocal, transactions.type)
    .orderBy(asc(transactions.dateLocal))
    .all() as DirectionDayTotal[];
}
```

The state resolver — one total order, four outcomes, no boolean soup:

```ts
// apps/mobile/src/features/home/home-state.ts — Illustrative, adapt during implementation
import type { BankConnection } from '../../db/types';

export type HomeState = 'empty' | 'sync-error' | 'pending' | 'all-clear';

export interface HomeStateInput {
  connections: readonly BankConnection[];
  uncategorizedCount: number;
}

/** Decision 4. Exactly one state is always selected; the order is total. */
export function resolveHomeState({ connections, uncategorizedCount }: HomeStateInput): HomeState {
  const hasFirstSuccess = connections.some((c) => c.lastSuccessAt !== null);
  if (!hasFirstSuccess) return 'empty';
  if (connections.some((c) => c.syncStatus === 'error')) return 'sync-error';
  if (uncategorizedCount > 0) return 'pending';
  return 'all-clear';
}
```

Percentages, delegated to the one place that guarantees they sum to 100:

```ts
// apps/mobile/src/features/home/summary.ts — Illustrative, adapt during implementation
import { apportionTenths } from '@finanzas/shared-domain';

import type { DirectionCategoryTotal } from '../../db/types';

const UNCATEGORIZED_KEY = ' uncategorized';

export function buildCategoryBreakdown(
  totals: readonly DirectionCategoryTotal[],
  /* …catalogue lookup… */
) {
  const expense = totals.filter((row) => row.type === 'debit');
  // Apportion over EVERY bucket, not only the four the card shows (Decision 3).
  const tenths = apportionTenths(
    expense.map((row) => ({
      key: row.transactionCategoryId ?? UNCATEGORIZED_KEY,
      weight: row.total,
    })),
  );
  // …sort by total desc, uncategorized last among equals; bar ratio = total / largestTotal…
  return { tenths /* … */ };
}
```

The read composition — six repository functions, eight calls, one snapshot, no inclusion rule
stated anywhere in this file:

```ts
// apps/mobile/src/features/home/read-home-data.ts — Illustrative, adapt during implementation
export function readHomeData(db: AppDatabase, params: HomeDataParams): HomeData {
  const { period, previousPeriod, locale } = params;
  return {
    uncategorizedCount: countUncategorized(db),
    categoryTotals: sumIncludedByDirectionAndCategory(db, period),
    dailyTotals: sumIncludedByDirectionAndDay(db, period),
    previousDailyTotals: sumIncludedByDirectionAndDay(db, previousPeriod),
    recentMovements: listRecentMovements(db, { limit: HOME_RECENT_MOVEMENT_LIMIT, locale }),
    connections: listBankConnections(db),
    categories: [
      ...listCategories(db, { income: 0, locale }),
      ...listCategories(db, { income: 1, locale }),
    ],
  };
}
```

Every call is synchronous (the driver is `BaseSQLiteDatabase<'sync', …>`), so all eight reads
happen in one uninterrupted pass: the stat tiles, the chart and the category rows are guaranteed
to describe the same store state, with no interleaved write. That is the mechanism behind
Scenario 25's "one internally consistent snapshot" — not a transaction, and not luck.

---

## Implementation Order

Each step is independently committable and leaves the repository green. Steps 1-3 are
infrastructure with no visible change; the screen appears at Step 9.

0. **Implementation-start re-verification.** Run the six checks in the *Cross-Cutting
   Operational Assumption Check* section and record `Still valid` or `Stale or conflicting` in
   the PR body. Stop before any edit if items **#8 or #5** have not merged, or if any symbol
   this plan consumes from them differs from the recorded signatures.
1. **Dependency.** `pnpm --filter @finanzas/mobile exec expo install react-native-svg` — and
   nothing else; no query library is added (Decision 7). Verify: `pnpm check:layout` passes and
   `pnpm --filter @finanzas/mobile typecheck` still passes.
2. **`@finanzas/shared-utils`: `percent.ts`.** Decision 12, plus `percent.test.ts` (Scenario 16)
   and the one-line `index.ts` re-export. Verify: `pnpm --filter @finanzas/shared-utils test`.
3. **Database layer.** The three new exports in `transactions.ts`, `listBankConnections` in
   item #8's `connections.ts`, the four domain types in `types.ts`, and Scenarios 2-7 in the
   existing `db` test files (Scenario 1 is already covered by a merged test and only has to stay
   green). Verify: `pnpm --filter @finanzas/mobile test` — read the output and confirm the `db`
   project runs the new cases and that `inclusion-rule-single-definition` and
   `db-access-boundary` are still green (Scenarios 8-9).
4. **The read composition.** The two `jest.config.js` lines above, then `read-home-data.ts` —
   the pure `readHomeData(db, params)` over the six repository calls — plus Scenario 25 against a
   real in-memory store. No React yet. Verify: `pnpm --filter @finanzas/mobile test` — read the
   output and confirm the new file runs under the **`db`** project exactly once and that every
   pre-existing test still runs under the project it ran under before; and `pnpm lint` reports no
   `dbAccessBoundary` violation.
5. **Design-system primitives.** `ScreenHeader`, `CategoryRow`, `LineChart`, `Legend`,
   `BankRow`; the `Progress` `indeterminate` prop; the three `TOUCH_METRICS` entries; the
   `componentMetrics` groups; the barrel exports. Then update `MU_CLASS_MAP` per Decision 5 —
   the 22 reassignments plus the four `mu-topbar*` note corrections. Verify:
   `pnpm --filter @finanzas/mobile test` and confirm `mu-class-coverage`, `no-style-literals`,
   `touch-targets` and `no-naked-text` all pass; paste the `mu-class-coverage` breakdown line
   into the PR body as residual evidence (Scenarios 17-20).
6. **Gallery.** A section per new primitive in `DesignSystemGallery.tsx` with its `ds.*` keys in
   both catalogues. Verify: `gallery-catalogue-keys.test.ts` and `catalogue-parity.test.ts`
   pass, and `/gallery` renders the five new sections on a dev build.
7. **Home feature logic.** `home-state.ts`, `summary.ts`, `trend-series.ts`, `relative-time.ts`
   and `use-home-data.ts`, plus Scenarios 10-15 and 23. Verify:
   `pnpm --filter @finanzas/mobile test`.
8. **Home copy.** Every `home.*` key in `es.json` and `en.json`, with the Spanish copied
   verbatim from `#screen=home`. Verify: `catalogue-parity.test.ts` passes and
   `pnpm --filter @finanzas/mobile lint` reports no `i18next/no-literal-string` error.
9. **Home components and route.** The nine feature components and the rewritten
   `app/(tabs)/home.tsx`. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass, and
   `route-manifest-parity.test.ts` is unchanged and green.
10. **Dev sample-data surface.** `sample-store.ts`, `SampleDataPanel.tsx`,
    `app/(dev)/sample-data.tsx`, the `DEV_ONLY_ROUTES` entry and its `dev.sample_data.*` keys.
    Verify: `route-manifest-parity.test.ts` passes (Scenario 21) and the panel loads the fixture
    on a dev build.
11. **Smoke runbook execution.** Run
    [`docs/testing/mobile/12-home-screen.smoke-test.md`](../../../testing/mobile/12-home-screen.smoke-test.md)
    end to end on a dev build, comparing all four states against the mockup side by side. Record
    the device, viewport, screenshots and any accepted difference in the PR, per
    `mobile-ui-fidelity.md` → *Review evidence*.
12. **Documentation updates.** Execute the *Documentation Updates* section above.
13. **CHANGELOG.** Add, under `## [Unreleased]` → `### Added`, exactly:

    ```markdown
    - **Home screen** (#12): the challenge hero, financial summary, trend chart, category
      breakdown, recent movements and connected-banks card, in all four manifest states
      (`pending`, `all-clear`, `empty`, `sync-error`), reading real aggregates through the
      shared `isIncluded` / `includedAmount` fragments. Adds five design-system primitives
      (`ScreenHeader`, `CategoryRow`, `LineChart`, `Legend`, `BankRow`), `formatPercentTenths`
      in `@finanzas/shared-utils`, and a `__DEV__`-only sample-data route
    ```

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — all five brief acceptance criteria map to implementation
  steps and tests. AC1 → Verification Log row on `transactions_uncategorized_idx` + Scenario 1
  (already satisfied by merged code; the requirement is to keep it satisfied);
  AC2 → Decision 4 + Scenario 10 + runbook Steps 3-6; AC3 → Decision 1 + Scenarios 2, 3, 8, 9;
  AC4 → Decision 6 + Scenario 23; AC5 → the runbook's per-state fidelity steps.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  exactly one Implementation Order step; the five primitive names, the four repository function
  names, the four domain type names, `useHomeData`, `loadHomeData`, `readHomeData`,
  `resolveHomeState`, `HomeState`, `buildCategoryBreakdown`, `buildFinancialSummary`,
  `buildCumulativeSeries`, `toPolylinePoints`, `describeSyncTime` and `formatPercentTenths` are
  spelled identically in the Summary, Decisions, Layer-by-Layer, Testing Strategy, Code Samples
  and Implementation Order sections. Decision indices 1-14 are referenced consistently. Route paths
  (`app/(tabs)/home.tsx`, `app/(dev)/sample-data.tsx`, `/(dev)/sample-data`) and directory
  paths (`apps/mobile/src/features/home/`, `apps/mobile/src/db/repositories/`,
  `apps/mobile/src/components/ui/`) agree everywhere. **Re-verified after the data-access
  realignment (Decision 7)**: a provider, a query client and `queries.ts` are now named only
  where the plan explains what it deliberately does *not* build (Verification Log, Decision 7,
  Documentation Updates, Risks); no section prescribes building one, and the runbook names none.
- **Verification support**: Checked — every claim about existing behaviour (the fragments, the
  partial index, the two guards, the deferred `mu-*` classes, the chart tokens, the absence of
  `react-native-svg` and of any query library, the abbreviation helper, the `.sql` inline-import
  mechanism, the fixture) cites a Verification Log command with its result. The three claims
  about item #8's interface cite the `git show` of its **merged** plan document, and are
  re-verified against merged `develop` by Step 0 before any edit.
- **Behavioural guarantees**: Checked — "home and dashboard cannot diverge" names the mechanism
  (the same repository function plus the two mechanical guards, Decision 1); "percentages sum to
  100" names `apportionTenths` (Decision 3); "exactly one state is always selected" names the
  total order in Decision 4; "the database is opened and bootstrapped once" names item #8's
  memoized `getAppDatabase()` promise wrapping `bootstrap.ts`'s existing module-level
  single-flight promise (concurrency addendum); "a superseded read cannot race a later one"
  names React's run-cleanup-before-next-effect ordering plus the `cancelled` flag; "a bootstrap
  failure reaches the route's `ErrorBoundary`" names the specific mechanism — `loadHomeData`
  resolves to `{ status: 'error', error }` rather than rejecting, and `useHomeData` re-throws
  that stored error **during render** (Decision 7's illustrative code, concurrency addendum); "the
  dev surface never ships" names the `__DEV__` + inline-`require()` pattern and the parity test
  that asserts it.
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes no workflow
  documentation, protocol or decision gate. Its only multi-input decision table
  (`resolveHomeState`, Decision 4) is product behaviour and is enumerated exhaustively there and
  in Scenario 10.
- **Parser/API/concurrency checklist**: Parser-risk — Not applicable, with the rationale
  recorded in the Parser-risk addendum. Concurrent-event-source — **applicable and completed**:
  all seven checklist items are answered in the Concurrent-event-source addendum.
- **CHANGELOG literal format**: Checked — Implementation Order Step 13 carries the entry
  verbatim in the project's `**Bold Title** (#N):` format, under `### Added`.
- **Not-applicable rationale**: Checked — the two skipped categories (parser-risk, workflow
  decision-gate matrix) each carry a one-sentence rationale above.
