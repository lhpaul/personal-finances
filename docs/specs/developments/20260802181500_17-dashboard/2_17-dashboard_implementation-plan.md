# Dashboard — Implementation Plan

**Work item**: [#17 Dashboard](https://github.com/lhpaul/personal-finances/issues/17) —
a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the two contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` `#screen=dashboard`, states `month`
  and `week` (manifest entry in
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js))
- **Behaviour contract**: [`BEHAVIOR.md` → `dashboard`](../../../../design/mockups/mobile/BEHAVIOR.md)

**Smoke test runbook**: [`docs/testing/mobile/17-dashboard.smoke-test.md`](../../../testing/mobile/17-dashboard.smoke-test.md)

---

## Summary

**Approach**: `app/dashboard.tsx` becomes a composition-only route over
`src/features/dashboard/`, whose single feature hook reads through `getAppDatabase()` and calls
**only the aggregate functions item #12 already defines** in
`apps/mobile/src/db/repositories/transactions.ts`. This item adds **no SQL, no repository
function and no query**: `home` and `dashboard` do not merely share a fragment, they share the
same functions, which is the mechanism behind `BEHAVIOR.md`'s hard rule that the two screens
*no pueden divergir*. The three cards the brief names (trend, spending overview, category
report) are drawn with `react-native-svg` through two new design-system primitives
(`DonutChart`, `BarChart`) plus additive widenings of item #12's `LineChart` and `Legend`.

**Estimated complexity**: **M**

**Rationale**: the data layer contributes zero new files — the whole item is period arithmetic,
pure shaping functions, two chart primitives and one screen with two states. It is materially
smaller than #12 (which built six primitives, five aggregates and four states) precisely
because it is forbidden from re-solving any of that. The chart primitives and the
percent/apportionment reconciliation are the only genuinely new work.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#12 home screen](https://github.com/lhpaul/personal-finances/issues/12) | Plan merged (commit `9b915f9`); implementation pending; plan-correction PR [#60](https://github.com/lhpaul/personal-finances/pull/60) open | Owns `sumIncludedByDirectionAndCategory`, `sumIncludedByDirectionAndDay`, the `LineChart` and `Legend` primitives, the `react-native-svg` dependency, the `.db.test.ts` Jest wiring, `formatPercentTenths`, and the `__DEV__` sample-data route this runbook drives | **Yes** — must be merged before Step 1 |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | PR [#61](https://github.com/lhpaul/personal-finances/pull/61) open | Owns `scripts/mobile-ui/fidelity-targets.json`, `useFidelityPreview()` and `fidelityTestId()`. This item flips the two `dashboard` targets `planned` → `wired` (Decision 14) | **Yes** for the fidelity wiring; the screen itself does not depend on it |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | PR [#44](https://github.com/lhpaul/personal-finances/pull/44) open | `apportionTenths` and `PERCENTAGE_TENTHS_TOTAL` — the "donut percentages sum to 100" guarantee (brief AC2) | **Yes** — must be merged before Step 3 |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | Plan merged; implementation not started | Owns `isPesoDenominated` in `fragments.ts` and the `peso-total-guard.test.ts` scan (Decision 4), and produces the real movements this screen aggregates | **No** for implementation — see Decision 4's two branches. The runbook is driven by #12's dev sample-data route |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged (PR [#55](https://github.com/lhpaul/personal-finances/pull/55)); implementation pending | `getAppDatabase()` in `apps/mobile/src/db/runtime.ts` and the `screenMetrics` theme export | **Yes** — transitively, via #12 |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | `Card`, `Segment`, `Badge`, `Amount`, `Text`, `EmptyState`, `theme.chart`, `MU_CLASS_MAP` | Satisfied |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | `fragments.ts`, `listCategories`, the two enforcement guards | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `formatClp`, `deriveDateLocal`, `getMonthPeriod`, `getWeekPeriod`, `shiftMonthPeriod`, `shiftWeekPeriod`, `formatMonthAbbreviation` | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues and the `no-literal-string` rule | Satisfied |

**Not built here**: no adjacent screen, no new route file, no month/week *navigation to past
periods* (Decision 3), and no user-visible foreign-currency affordance (Decision 4 — explicitly
deferred, with the reason recorded).

---

## Verification Log

All commands were run in the plan worktree `.claude/worktrees/item-17` at repo revision
`09fb7dd` (`git rev-parse HEAD` equals `git rev-parse origin/develop`), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` and `git rev-parse --short origin/develop` | Both `09fb7dd` — the plan branch is not stacked on unmerged work |
| Template-fit check applies? | `grep -n 'is_template' .ai-dev-workflow.yaml` | Line 176: `is_template: false` → Protocol 02 **Step 0 does not apply**; no template-fit warning is required |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | No match — no `mode` key, so `single_repo`: this repository owns the plan and the plan PR |
| Manifest states this screen must implement | `grep -n "screen_id: 'dashboard'" -A 10 design/mockups/mobile/mockup-manifest.js` | `route: '/dashboard'`, `state_label: 'Período'`, states `month` (initial) and `week`. **Two states, no `mvp: false` flag** — both are built |
| What the mockup actually draws | `awk 'NR>=1785 && NR<=1886' design/mockups/mobile/index.html` | `mu-topbar` (← / "Dashboard" / ⚙️), a 2-item `mu-segment`, then exactly three `mu-card`s: *Tendencia* (2 flat stat cards + `mu-line` with **three** polylines + 3-row legend), *Resumen de gastos* (total + `mu-badge--ok` + `mu-bars` with **two** columns + 2-row legend), *Reporte por categorías* (inner 2-item segment + two `mu-donut`s with `mu-legend__name` / `mu-legend__val` rows). **No `mu-tabbar`, no `mu-head`, no `mu-cat-row`** |
| Amount formatting the dashboard mockup draws | `grep -oE '\$[0-9][0-9.]*' design/mockups/mobile/index.html` within the `s-dashboard` block | `$3.700.000`, `$1.352.470` (×3). **Every amount on this screen is drawn in full**; no `3.7M` / `$279K` form appears anywhere in `#screen=dashboard` → Decision 5 |
| Percentage granularity | The five `mu-legend__val` values in the expense donut, and the two in the income donut | `20,6%`, `17,4%`, `14,3%`, `13,3%`, `11,8%` (sum `77,4%`, five arcs over a visible track) and `67,6%`, `32,4%` (sum `100,0%`, two arcs, no track showing) → Decision 6 |
| Donut arc colours drawn | `stroke="#…"` attributes inside the two `mu-donut` SVGs | Expense: `#6366f1`, `#f59e0b`, `#10b981`, `#ef4444`, `#8b5cf6` = `theme.chart.series[0..4]` in order. Income: `#10b981`, `#6366f1` = `series[2]`, `series[0]`. Track: `#f1f5f9` → Decision 7 |
| Trend line colours drawn | `stroke="#…"` on the three `polyline`s | `#10b981` (income), `#f59e0b` (expense), `#cbd5e1` dashed (`stroke-dasharray="4 4"`) = `theme.colors.success`, `theme.colors.warning`, `theme.chart.comparison`. Consistent with `design-tokens.md` → *Colour semantics* |
| Colour semantics the brief's AC3 points at | `sed -n '117,130p' docs/best-practices/stack/design-tokens.md` | Expenses = `brandSecondary` / `warning` `#f59e0b`; Income = `success` `#10b981`; *"Never render an expense in green or an income in amber"* |
| The chart tokens already in the theme | `python3 -c "import json;print(json.load(open('design/tokens.json'))['chart'])"` | `series: ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6']`, `grid: '#e2e8f0'`, `axis: '#94a3b8'`, `comparison: '#cbd5e1'`. **No new colour token is needed**; `theme-tokens-parity.test.ts` is unaffected |
| Direction and surface tokens this plan names | `sed -n '27,68p' apps/mobile/src/theme.ts` | `success: '#10b981'`, `warning: '#f59e0b'`, `surface3: '#f1f5f9'`. `surface3` is byte-identical to the donut track the mockup draws, so the track needs no new token (Decision 7) |
| The `mu-bars` CSS the `BarChart` primitive must reproduce | `awk 'NR>=496 && NR<=501' design/mockups/mobile/index.html` | `.mu-bars` is a `flex-end` row, `height: 120px`, `gap: 6px`; `.mu-bars__bar` defaults to `var(--brand)`, `--muted` is `var(--slate-300)` `#cbd5e1` and `--warm` is `var(--brand-2)` `#f59e0b`. Confirms the two column colours named in Decision 7 |
| Tone unions of the primitives this plan composes | `grep -n 'AmountTone =' apps/mobile/src/components/ui/Amount.tsx; grep -n 'BadgeTone =' apps/mobile/src/components/ui/Badge.tsx` | `AmountTone = 'neutral' \| 'in' \| 'out'` — **not** `income` / `expense`, which is what `design-tokens.md` uses for `StatTile`; `BadgeTone = 'neutral' \| 'ok' \| 'warn' \| 'danger' \| 'info' \| 'celebration'`, so Decision 16's three tones all exist |
| The fidelity scripts this plan invokes | `git show origin/feature/47-design-fidelity-gate:package.json \| grep fidelity` | `"fidelity": "node scripts/mobile-ui/run-fidelity.mjs"` and `"fidelity:contract": "node scripts/mobile-ui/fidelity-contract.mjs"` — so `pnpm fidelity --issue 17` and `pnpm fidelity:contract` are the correct invocations |
| The inclusion rule's single SQL definition | `cat apps/mobile/src/db/fragments.ts` | Two exports today: `isIncluded` and `includedAmount`. `isPesoDenominated` is **not** there yet — it arrives with #10 (Decision 4) |
| Aggregate functions this plan consumes, and their owner | `git show origin/develop:docs/specs/developments/20260802172715_12-home-screen/2_12-home-screen_implementation-plan.md` → *Layer-by-Layer → Database* and *Code Samples* | `sumIncludedByDirectionAndCategory(db, period): DirectionCategoryTotal[]` (grouped by `type` + `transaction_category_id`, `null` category returned as its own bucket) and `sumIncludedByDirectionAndDay(db, period): DirectionDayTotal[]` (grouped by `date_local` + `type`, ordered ascending). Both filter on `isIncluded` and weight by `includedAmount` |
| The Jest wiring that routes a `.db.test.ts` file outside `src/db/` to the Node project | Same `git show` of item #12's merged plan, *Layer-by-Layer → Infrastructure* | #12 adds `'<rootDir>/src/features/**/*.db.test.ts'` to the `db` project's `testMatch` and `'\\.db\\.test\\.ts$'` to the `app` project's `testPathIgnorePatterns`, and calls the suffix *"the convention every later screen item reuses"*. **This item therefore needs no `jest.config.js` change** |
| Repository exports that exist on `develop` today | `grep -n '^export function' apps/mobile/src/db/repositories/transactions.ts apps/mobile/src/db/repositories/categories.ts` | `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`; `listCategories(db, { income: 0 \| 1, locale })`. The two aggregates above ship with #12 → re-verified by Step 0 |
| `mu-*` classes still deferred to **#17** in the live map | `grep -o "'mu-[a-z_-]*': { status: 'deferred', note: 'Deferred to #17" apps/mobile/src/test-utils/mu-class-map.ts \| wc -l`, then read the entries | **17** entries: `mu-bars`, `mu-bars__bar`, `mu-bars__bar--muted`, `mu-bars__bar--warm`, `mu-bars__col`, `mu-bars__lbl`, `mu-cat-row`, `mu-cat-row__bar`, `mu-cat-row__fill`, `mu-cat-row__icon`, `mu-donut`, `mu-legend`, `mu-legend__dot`, `mu-legend__name`, `mu-legend__row`, `mu-legend__val`, `mu-line`. Item #12's merged plan (Decision 5) takes over `mu-cat-row*` (4), `mu-line`, `mu-legend`, `mu-legend__row` and `mu-legend__dot` — leaving **exactly 9** for this item: `mu-donut`, the six `mu-bars*`, `mu-legend__name`, `mu-legend__val` → Decision 8 |
| `mu-topbar*` ownership across the campaign | `grep -rn "mu-topbar" docs/specs/developments/*/2_*.md apps/mobile/src/test-utils/mu-class-map.ts` | Map says `deferred` "to #12". #12's merged plan retargets the *note* to #8; **#8's merged plan Decision 12 declines to build it** ("these screens compose locally"); #13's merged plan Decision 13 composes `StageTopBar` screen-locally; #9's merged plan keeps `FlowHeader` screen-local. **No item builds a topbar primitive** → Decision 9 |
| `Segment`, `Card`, `Badge`, `Amount`, `EmptyState` are already primitives | `grep -n "mu-segment\|mu-card\|mu-badge\|mu-amount\|mu-empty" apps/mobile/src/test-utils/mu-class-map.ts` | All `primitive` with real barrel owners. `Segment` takes `{ options, value, onChange }`; `EmptyState` takes `{ icon, title, description?, action? }` |
| Period helpers already in `@finanzas/shared-utils` | `grep -n '^export function' packages/shared-utils/src/dates.ts` | `getMonthPeriod`, `getWeekPeriod` (Monday-start), `shiftMonthPeriod`, `shiftWeekPeriod`, `deriveDateLocal`, `formatMonthAbbreviation`, `formatMonthYear`, `addDays`. `Period` is `{ start: DateLocal; end: DateLocal }`. **This plan writes no date arithmetic** |
| Money formatter contract | `sed -n '80,100p' packages/shared-utils/src/money.ts` | `formatClp(minorUnits, { direction?, signDisplay? })`, `direction` defaults `'neutral'`, `signDisplay` defaults `'directional'`; throws `TypeError` on a non-integer |
| The fidelity contract's `dashboard` targets | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-targets.json` | Two mappings, `dashboard--month` and `dashboard--week`, both `status: "planned"`, `fixture: "seed-default"`, `max_mismatch_pct: 5.0`, `threshold_note: "Same charts as home, plus the month/week bar series"`; `coverage_sets` contains `{ "issue": 17, "targets": [{ "screen_id": "dashboard", "states": "all" }] }` → Decision 14 |
| The route file that exists today | `cat apps/mobile/app/dashboard.tsx` | A three-line `RoutePlaceholder` for `screenId="dashboard"`, `route="/dashboard"`. **This item rewrites that file and creates no new route**, so `route-manifest-parity.test.ts` is unaffected |
| Bounded same-surface open PRs | `gh pr list --state open --json number,headRefName,title`; `gh pr diff 60`; `gh pr diff 62 \| grep -n "mu-bars"` | Seven open: **#64**, **#63**, **#62** (plan PRs for #15/#19/#14), **#61** (#47 implementation), **#60** (#12 plan corrections), **#46** (#6), **#44** (#5). Only #60, #61 and #62 touch a surface this plan depends on — resolved in the Cross-Cutting Operational Assumption Check |

### Residual verification strategy

This plan makes two pattern-completeness claims. Neither is verified by a number written in
this document; both have a mechanical evidence source the implementation PR must paste.

1. *"Every `mu-*` class the dashboard mockup draws is implemented by a component, and no class
   is left silently unclassified."* Evidence:
   `apps/mobile/src/__tests__/mu-class-coverage.test.ts` asserts set equality between the live
   stylesheet inventory and `MU_CLASS_MAP` and that every `primitive` entry's `owners` resolve
   to real barrel exports. The implementation PR pastes the per-status breakdown line. If the
   live map at implementation time differs from Decision 8's nine-class enumeration (because
   #12 flipped a class differently), **the developer follows the live map** and records the
   difference in the PR body. The enumeration is a plan-time snapshot, not a frozen scope.
2. *"Every money figure on this screen reaches the screen through an item-#12 aggregate, and
   this item states no filter of its own."* Evidence:
   `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` (rules A/B/C over the
   whole `src/` + `app/` tree) and `apps/mobile/src/db/__tests__/db-access-boundary.test.ts`
   must both stay green with every file this item adds; and Scenario 3 pins the composed
   dashboard totals against `totalForCategoryInPeriod` **and** against a hand-derived literal.
   Once #10 has merged, `apps/mobile/src/db/__tests__/peso-total-guard.test.ts` is the third
   green-required scan (Decision 4).

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — no `mode` key, so this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-02T18:15Z, `09fb7dd` | Current invocation item `{#17}`; no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* (*"spec/plan/feature/fix PRs target `develop`"*) | 2026-08-02T18:15Z, `09fb7dd` | Current invocation item `{#17}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/17-dashboard` at `09fb7dd`, identical to `origin/develop` | `git rev-parse HEAD origin/develop` | 2026-08-02T18:15Z | Isolated worktree at `.claude/worktrees/item-17` | `Verified` |
| **The two aggregate functions this screen calls, and their signatures** | `sumIncludedByDirectionAndCategory(db, period): DirectionCategoryTotal[]` and `sumIncludedByDirectionAndDay(db, period): DirectionDayTotal[]`, both in `apps/mobile/src/db/repositories/transactions.ts`, both filtering on `isIncluded` and weighting by `includedAmount` | Item #12's **merged** implementation plan (Layer-by-Layer → Database, and Code Samples), which is the contract this plan is written against | 2026-08-02T18:15Z, `09fb7dd` | Same-surface open PR: **#60** (`fix/12-plan-post-merge-review`), the only open PR that edits #12's plan. Its diff was read in full: it changes the *hook* shape (extracts `loadHomeData`, moves the error re-throw into render) and the call-count prose (six functions, eight calls). It does **not** rename, re-sign or re-scope either aggregate | `Verified` — the surface this item consumes is untouched by #60. Decision 12 nonetheless adopts #60's hook shape, so the two screens stay identical whichever way #60 lands |
| **The canonical statement of the inclusion rule** | Two sanctioned statements, and only two: `apps/mobile/src/db/fragments.ts` (SQL) and `packages/shared-domain/src/inclusion.ts` (in-memory). A third is a review blocker | `docs/project/1-business-domain.md` BR4; item #3's plan Decision 9; item #5's merged plan; enforced by `inclusion-rule-scan.ts` rules A/B/C | 2026-08-02T18:15Z, `09fb7dd` | Same-surface open PR: **#44** (item #5), which created the second sanctioned statement rather than competing with the first | `Verified` — **this item adds neither a third statement nor a second consumer path**: it writes no `sql` template, imports no fragment, and imports no SQL library (Decision 1) |
| **The peso-total guard, and who owns the user-visible consequence** | `isPesoDenominated` lands in `fragments.ts` with item #10 and must appear in every file that sums `includedAmount`; the *person-facing* handling of a foreign-currency movement is assigned to *"the item that owns the aggregates and the dashboard"* | Item #10's **merged** plan, Decision 15 and its Parser-risk addendum (`peso-total-scan.ts`, `peso-total-guard.test.ts`) | 2026-08-02T18:15Z, `09fb7dd` | Same-surface open PRs: none. #44 (`summarizePeriod`) has no currency field on `Movement`, so it does not compete; #60 does not touch fragments | `Verified` — recorded with an explicit, reasoned **deferral** of the user-visible half and a Step-0 branch for both merge orders (Decision 4) |
| **`mu-*` class ownership for the nine classes this item flips** | `mu-donut`, `mu-bars`, `mu-bars__bar`, `mu-bars__bar--muted`, `mu-bars__bar--warm`, `mu-bars__col`, `mu-bars__lbl`, `mu-legend__name`, `mu-legend__val` belong to **#17** | `apps/mobile/src/test-utils/mu-class-map.ts` on `develop`, minus the classes #12's merged plan Decision 5 claims | 2026-08-02T18:15Z, `09fb7dd` | Same-surface open PRs: **#62** (item #14's plan) is the only open PR naming any of them, and it names `mu-bars` **only to record that it is deferred to #17 and has no `Bars` export**. #63 and #64 name none of the nine | `Verified` |
| **The fidelity contract's `dashboard` targets and their threshold** | Two `planned` targets (`month`, `week`), `fixture: "seed-default"`, `max_mismatch_pct: 5.0` with a `threshold_note`; `ready_test_id` convention is `fidelity-<screenId>` | Item #47's plan Decisions 1/2/4/9, read against the **live contract file** on `origin/feature/47-design-fidelity-gate` | 2026-08-02T18:15Z, `09fb7dd` | Same-surface open PR: **#61** (the #47 implementation) — read directly, so this is the head of the source of truth, not a stale plan claim | `Verified` — the threshold and its note are **carried over unchanged** when the targets flip to `wired` (Decision 14); this item raises no threshold |

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved and
records `Still valid` or `Stale or conflicting` in the implementation PR:

1. `git log --oneline -1 origin/develop` — confirm items **#12**, **#5** and **#47** have
   merged.
2. `grep -n '^export function' apps/mobile/src/db/repositories/transactions.ts` — confirm
   `sumIncludedByDirectionAndCategory` and `sumIncludedByDirectionAndDay` exist with the
   recorded names, and note whether their period parameter is `Period` (`{ start, end }`) or
   `{ startDateLocal, endDateLocal }`; that decides whether `toRepositoryPeriod` (Decision 3)
   is a mapper or the identity.
3. `grep -n 'isPesoDenominated' apps/mobile/src/db/fragments.ts apps/mobile/src/db/repositories/transactions.ts`
   — take the branch Decision 4 specifies for the result.
4. `grep -n 'export' apps/mobile/src/components/ui/index.ts` — confirm `LineChart` and `Legend`
   shipped, and read their prop types; Decision 8's widenings are written against what shipped,
   not against #12's plan text.
5. `grep -n "status: 'deferred'" apps/mobile/src/test-utils/mu-class-map.ts` — confirm exactly
   the nine classes in Decision 8 are still `deferred` and still needed.
6. `grep -n 'apportionTenths\|PERCENTAGE_TENTHS_TOTAL' packages/shared-domain/src/index.ts` and
   `grep -n 'formatPercentTenths' packages/shared-utils/src/percent.ts` — confirm the
   apportionment function, the constant and the formatter exist with the recorded signatures.
7. `grep -n 'fidelityTestId\|useFidelityPreview' apps/mobile/src/lib/fidelity-preview.ts` and
   `python3 -c "import json;d=json.load(open('scripts/mobile-ui/fidelity-targets.json'));print([m for m in d['mappings'] if m['screen_id']=='dashboard'])"`
   — confirm both helpers and both `planned` targets exist.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to
the parent orchestrator.

---

## Key Decisions

Decision indices are stable within this document and are referenced by the Layer-by-Layer,
Testing Strategy, Code Samples and Implementation Order sections.

### Decision 1 — this item adds no SQL, no repository function and no fragment import

`BEHAVIOR.md` → `dashboard`: *"**Regla dura:** misma que `home` — fragmentos compartidos BR4,
sin excepción."* And `BEHAVIOR.md` → `home`: *"`home` y `dashboard` **no pueden** divergir:
misma definición, un solo lugar."*

Item #12's merged plan already chose the strongest available reading of that rule and recorded
it in its own Risks table: *"#17 is planned to call the **same functions**, not merely the same
fragments."* This plan honours that commitment literally. The dashboard's data layer consists
of exactly these calls, all of them pre-existing:

| Card / figure | Function called | Period argument |
| --- | --- | --- |
| Trend series (6 periods), *Ingresos* / *Gastos* totals, spending total, the two bars | `sumIncludedByDirectionAndDay` | the **trend window** (Decision 3) — **one** call |
| Expense donut + legend, income donut + legend | `sumIncludedByDirectionAndCategory` | the current period |
| The same, with the inner segment on *Mes anterior* | `sumIncludedByDirectionAndCategory` | the previous period |
| Category names and emoji for the legend rows | `listCategories` | — twice, once per `income` value, exactly as `readHomeData` does |

**Five calls, four functions, zero new queries.** Consequences that make the guarantee
structural rather than aspirational:

| Guard | Where | What it prevents here |
| --- | --- | --- |
| `dbAccessBoundary` ESLint rule + `db-access-boundary.test.ts` | root `eslint.config.mjs`; `apps/mobile/src/db/__tests__/` | Any file this item adds importing `drizzle-orm` / `expo-sqlite` / `better-sqlite3` and writing its own query |
| `inclusion-rule-scan.ts` **rules A/B/C** + `inclusion-rule-single-definition.test.ts` | `apps/mobile/src/db/checks/`, `apps/mobile/src/db/__tests__/` | Rule A/B: a `sql` template or a Drizzle predicate restating the exclusion condition. **Rule C**: the bare literals `excluded_at` / `included_amount` anywhere outside the five allowlisted files — including in a comment or a test fixture in `src/features/dashboard/` |
| `peso-total-guard.test.ts` (arrives with #10) | `apps/mobile/src/db/__tests__/` | A file that sums `includedAmount` without naming `isPesoDenominated` (Decision 4) |

Because this item writes no `sql` tag at all, all three scans are satisfied vacuously by every
file it adds — which is exactly the intended shape. Any reviewer question of the form *"could
the dashboard drift from home?"* is answered by pointing at this table: there is no second
implementation to drift.

### Decision 2 — brief AC1 ("aggregation in SQL, not in JavaScript") is satisfied by day-grained aggregates folded into periods, and this is the reading the rule was written for

The trend card charts **six periods**, and the spending card compares **two**. Item #12's
aggregates group by `date_local`, not by period. Two options existed:

- **(A)** add a new SQL aggregate that groups by period — which would give the dashboard a
  query `home` does not have, i.e. the divergence Decision 1 exists to prevent;
- **(B)** call `sumIncludedByDirectionAndDay` once over the whole window and fold its rows into
  six period buckets in a pure function.

This plan takes **(B)**. The rule AC1 restates lives in
`docs/best-practices/stack/sqlite-drizzle.md` → *Queries*: *"Aggregate in SQL, not in JS.
`home` and `dashboard` must not `SELECT *` and reduce in JavaScript — **these tables grow
unbounded**."* The hazard named there is reducing an unbounded row set. What crosses the
boundary here is not movements: it is **at most one row per (local day × direction) in the
window** — 6 months ≈ 184 days × 2 = **≤ 368 rows**, 6 weeks = 42 days × 2 = **≤ 84 rows** —
a bound that is independent of how many movements the person has. Every filter (inclusion,
period, and the peso guard once #10 lands) and every `sum()` still happens in SQLite.

This is also the precedent item #12 already set and had reviewed: its `buildCumulativeSeries`
folds the same day rows into a cumulative series, described in its plan as *"pure integer
arithmetic over totals that SQL has already filtered, so it states no rule."* The dashboard
does the same arithmetic with a different fold.

`readDashboardData` therefore performs no row-level read of any kind: it never calls
`listMonth`, `listRecentMovements` or `listByMerchant`.

### Decision 3 — the period model: two period types, one shared shape, one six-period window, no navigation to past periods

`BEHAVIOR.md` → `dashboard` → *Datos*: *"agregados por categoría y por período; períodos en día
local."* Every period in this screen is derived from `deriveDateLocal(new Date())`, never from a
UTC timestamp, and the clock enters the feature exactly once, at the route.

```text
periodType = 'month' | 'week'                      // the manifest's two states
today       = deriveDateLocal(now)                 // Chilean civil day
period      = periodType === 'month' ? getMonthPeriod(today) : getWeekPeriod(today)
previous    = periodType === 'month' ? shiftMonthPeriod(period, -1) : shiftWeekPeriod(period, -1)
trendWindow = { start: shift(period, -(DASHBOARD_TREND_PERIOD_COUNT - 1)).start, end: period.end }
```

with `DASHBOARD_TREND_PERIOD_COUNT = 6`, which is what the mockup's card subtitle states
(*"Últimos 6 meses"* / *"Últimas 6 semanas"*) and what its six polyline x-positions
(`0, 60, 120, 180, 240, 300`) draw. The six period boundaries are produced by repeated
`shiftMonthPeriod` / `shiftWeekPeriod`, so week weeks are Monday-start and month lengths are
correct for February and leap years without this item writing a line of date arithmetic.

`BEHAVIOR.md` marks past-period navigation 🟡 conditional: *"Navegación a períodos anteriores
si el mockup la dibuja; si no, solo período vigente."* The mockup draws **no** period-navigation
affordance on `#screen=dashboard` — the only two controls are the `Mes` / `Semana` segment and
the card-local *Este mes* / *Mes anterior* segment. Therefore **only the period in progress is
navigable**, and the inner segment is a comparison toggle over data this screen has already
read, not navigation (Assumption A3).

Item #12's aggregates take a period argument; step 2 of the implementation-start re-verification
records whether that argument is `Period` or `{ startDateLocal, endDateLocal }`. A single
one-line helper, `toRepositoryPeriod(period: Period)` in
`src/features/dashboard/dashboard-period.ts`, absorbs the difference so no call site has to
know. If the shipped functions take `Period` directly, the helper is the identity and is
deleted.

### Decision 4 — the peso guard is consumed, not restated; the user-visible foreign-currency treatment is explicitly deferred, with the reason

Item #10's merged plan, Decision 15, places `isPesoDenominated` in `fragments.ts`, applies it to
peso totals, and makes the obligation mechanical with `peso-total-scan.ts` /
`peso-total-guard.test.ts`. Its last paragraph assigns the remainder: *"What stays deferred is
what the **person sees**: a separate foreign-currency line, a badge, a converted figure. That
belongs to the item that owns the aggregates and the dashboard."* That is this item, so the
obligation is answered here rather than passed on again.

**The SQL half — consumed, in one of two branches decided by Step 0.** Because this item calls
#12's aggregates and writes no `sql` tag, the guard reaches the dashboard through those
functions or not at all:

- **Branch A — #10 has merged.** `peso-total-guard.test.ts` is already green on `develop`, which
  means `sumIncludedByDirectionAndCategory` and `sumIncludedByDirectionAndDay` **already name**
  `isPesoDenominated`; every dashboard figure is peso-guarded with no edit from this item.
  Step 0's check 3 confirms it. If the fragment exists but the two aggregates do not name it,
  the guard test is red on `develop` — a #12/#10 integration defect, not this item's to hide:
  **stop and return the evidence to the parent orchestrator.**
- **Branch B — #10 has not merged.** `isPesoDenominated` does not exist yet, no aggregate can
  name it, and the guard test does not exist. This item proceeds unchanged and records the
  obligation in the PR body; the guard lands with #10 and, because both screens call the same
  two functions, it protects `home` and `dashboard` in the same commit. **This item still adds
  no `sql` tag**, so it cannot be the file that trips the scanner.

Under no branch does this item add `isPesoDenominated` to a query itself: doing so would mean
writing SQL, which Decision 1 forbids.

**The user-visible half — deferred, deliberately, and this is the record of the decision.**
A foreign-currency movement is stored unconverted (#10 AC22) and, once the guard is in place,
is absent from every peso total on this screen without any on-screen acknowledgement. This item
does **not** add a separate line, a badge or a converted figure, for four reasons:

1. There is no exchange-rate source on the device and there is no backend — the defining
   product constraint (`AGENTS.md`, non-negotiable: *"There is no backend"*). A converted figure
   would require either shipping a stale hard-coded rate or contradicting the product.
2. `#screen=dashboard` draws no such affordance, and `design/mockups/mobile/` is the UI contract
   (non-negotiable 6). Inventing UI here would be building something the contract does not
   declare.
3. The MVP is Banco de Chile CLP accounts (issue #17's own footer), so the population affected
   is empty in practice for the MVP.
4. `countUncategorized` deliberately keeps foreign-currency movements *in* the "por
   categorizar" queue (#10 Decision 15), and `transactions` / `transaction-detail` (#15/#16)
   show every movement including excluded ones — so the movement is never invisible to the
   person, only absent from a peso total.

**Follow-up the developer files during implementation** (a tracker item, not a silent gap): *"a
foreign-currency movement is excluded from every peso total with no on-screen indication; decide
between a per-currency subtotal, a footnote count, or an explicit product decision to keep CLP
only"*, linked from #10 Decision 15 and from this decision. Assumption A11.

### Decision 5 — D2 resolves to "abbreviated amounts exactly where the mockup draws them on `dashboard`" — which, on this screen, is **nowhere**

🔴 **D2 is an open decision owned by LH** (`BEHAVIOR.md` → *Decisiones abiertas*: *"Alcance del
formato abreviado de montos (`3.7M`, `$279K`): ¿solo stat tiles y filas de categoría de `home`,
o también dashboard/detalle?"*, and `dashboard`'s own *Pendiente*: *"🔴 **D2** aplica también
aquí (¿montos abreviados o completos?)"*). No human is available for this run, so this plan
applies the parent orchestrator's specified default — *abbreviated amounts exactly where the
mockup draws them, nowhere else* — and **flags it for review**.

Applying that default to this screen is a mechanical read of the drawing, and the drawing is
unambiguous: **every amount in `#screen=dashboard` is drawn in full**, with thousands
separators — `$3.700.000` (trend income, and again as the income donut total), `$1.352.470`
(trend expense, the spending-overview total, and the expense donut total). The abbreviated forms
`3.7M` and `$279K` appear only under `#screen=home`.

| Surface on `dashboard` | Call | Renders |
| --- | --- | --- |
| Trend card *Ingresos* / *Gastos* flat tiles | `formatClp(total, { direction: 'in' \| 'out', signDisplay: 'never' })` | `$3.700.000`, `$1.352.470` |
| *Resumen de gastos* → *Total gastado* | `formatClp(total, { signDisplay: 'never' })` | `$1.352.470` |
| Category report per-direction totals | `formatClp(total, { direction: 'in' \| 'out', signDisplay: 'never' })` | `$3.700.000`, `$1.352.470` |

`signDisplay: 'never'` is required because `formatClp` defaults to `'directional'`, which would
render `+$3.700.000`; the mockup draws no sign, and the direction is carried by colour through
the `Amount` primitive's tone (`mu-amount--in` / `mu-amount--out`).

So: **`formatClpAbbreviated` is not imported anywhere in `src/features/dashboard/`.** D2's
"dashboard" half therefore resolves to *full amounts*, and the resolution is derived from the
contract rather than chosen. Reversal cost if LH decides otherwise: the five call sites above,
all inside `src/features/dashboard/`, all through one already-tested helper — no
`@finanzas/shared-utils` change either way. Flag with D2 at plan review (Assumption A1).

### Decision 6 — donut percentages come from `apportionTenths` over **all** buckets; the donut draws the top five and shows the remainder as track

Brief AC2: *"Donut percentages sum to 100 and match the legend."* The mockup's expense donut
draws five arcs whose `stroke-dasharray` values are `20.6`, `17.4`, `14.3`, `13.3`, `11.8` —
summing to **77.4**, over a visible `#f1f5f9` track — while its income donut draws two arcs
summing to exactly **100.0** with no track showing. Both are the same rule seen at two bucket
counts:

- Apportionment runs over **every** bucket of the direction, using
  `apportionTenths(entries)` from `@finanzas/shared-domain`, whose largest-remainder algorithm
  guarantees the tenths sum to `PERCENTAGE_TENTHS_TOTAL = 1000`. This is the "sum to 100" half
  of AC2, and it is guaranteed by the one module that tests it — this item computes no
  percentage of its own.
- The card **displays** the top `DASHBOARD_DONUT_SEGMENT_LIMIT = 5` buckets by included total.
  When a direction has five or fewer buckets, they are all shown and the arcs close the circle
  (the income case). When it has more, the untraced remainder is left as the track, which is
  what the mockup draws.
- **The arc length and the legend value are literally the same number**: `buildDonutReport`
  produces one array of `{ key, label, emoji, tenths, colorIndex, amount }` records, and both the
  `DonutChart` arcs and the `Legend` rows are rendered from it. This is the "match the legend"
  half of AC2, guaranteed by construction rather than by two code paths agreeing.
- Uncategorized movements are a bucket, not a filter (item #5 Decision 10): the `null`
  `transaction_category_id` group participates in apportionment and is eligible for the top-5,
  labelled *Sin categorizar*, exactly as it is on `home`.

Percentages are rendered with `formatPercentTenths(tenths)` from `@finanzas/shared-utils`
(added by item #12, Decision 12): `206 → 20,6%`, the mockup's comma-decimal form. This item adds
no percentage formatter.

### Decision 7 — colour: direction semantics for direction-carrying elements, the categorical palette for category identity, seeded so the mockup's first arc is reproduced

Brief AC3: *"Income and expense colours follow the semantics in
`docs/best-practices/stack/design-tokens.md`."* That document is explicit: expenses are
`warning` `#f59e0b`, income is `success` `#10b981`, and *"Never render an expense in green or an
income in amber."* Two different kinds of element on this screen carry colour, and they are
treated differently:

**Direction-carrying elements — always the direction token:**

| Element | Colour |
| --- | --- |
| Trend income polyline | `theme.colors.success` |
| Trend expense polyline | `theme.colors.warning` |
| Trend dashed average polyline | `theme.chart.comparison` |
| Trend `Ingresos` / `Gastos` tile amounts, and the two category-report totals | `Amount` with `tone="in" \| "out"` — item #2's primitive; `AmountTone` is `'neutral' \| 'in' \| 'out'`, verified in `Amount.tsx`, **not** `income` / `expense` |
| Spending-overview current bar (`mu-bars__bar--warm`) | `theme.colors.warning` — the mockup's rule is `background: var(--brand-2)`, i.e. `brandSecondary` `#f59e0b`, the same value; the spending card is about expenses |
| Spending-overview previous bar (`mu-bars__bar--muted`) | `theme.chart.comparison` — the mockup's rule is `background: var(--slate-300)` `#cbd5e1`, which `theme.chart.comparison` and `theme.colors.palette.slate['300']` both carry; `chart.comparison` is chosen because the bar *is* the comparison series, and its legend dot is drawn in the same colour |
| Gridlines | `theme.chart.grid` |

**Category-identity elements — the categorical palette, seeded per direction.** A donut arc
does not represent a direction (every arc in the expense donut is an expense); it represents a
category, so it uses `theme.chart.series`. The mockup seeds the two donuts differently, and this
is reproduced exactly with a rank→palette-index order, defined once in
`src/features/dashboard/dashboard-palette.ts`:

```text
DONUT_SERIES_ORDER = {
  expense: [0, 1, 2, 3, 4],   // #6366f1 #f59e0b #10b981 #ef4444 #8b5cf6 — as drawn
  income:  [2, 0, 1, 3, 4],   // #10b981 #6366f1 …            — as drawn
}
```

The income donut therefore **starts on `success` green**, and the expense donut starts on the
brand primary and reaches amber at rank 2 — which is what the drawing does and what keeps AC3's
"never an income in amber" true for the element that carries the direction (the total above the
donut, which is `Amount tone="in"`). These are **indices into `theme.chart.series`**, never
hex literals, so `no-style-literals.test.ts` stays green (Assumption A2).

The donut track is `theme.colors.surface3`, which is `#f1f5f9` — byte-identical to the track
colour the mockup draws (both verified in the Verification Log). **No new token is added and
`design/tokens.json` is not edited**, so `theme-tokens-parity.test.ts` is unaffected
(Assumption A2).

### Decision 8 — two new primitives, two additive widenings; the nine `mu-*` classes deferred to this item all flip to `primitive`

`docs/best-practices/stack/mobile-ui-fidelity.md`: *"Compose the shared primitives in
`src/components/ui/` before writing a one-off style. A one-off is a signal the primitive is
missing — add it there."*

**New, in `apps/mobile/src/components/ui/`, exported from `index.ts`:**

| New primitive | `mu-*` classes it takes ownership of | Shape |
| --- | --- | --- |
| `DonutChart` | `mu-donut` | `react-native-svg`. Takes already-computed `segments: { tenths, color }[]`, a track colour and a stroke width; renders one `Circle` per segment with `strokeDasharray` / `strokeDashoffset`. Owns no arithmetic, no apportionment, no sorting. `React.memo` |
| `BarChart` | `mu-bars`, `mu-bars__col`, `mu-bars__bar`, `mu-bars__bar--muted`, `mu-bars__bar--warm`, `mu-bars__lbl` | Plain `View`s (the mockup draws these as CSS boxes, not SVG). Takes `columns: { heightRatio, color, label }[]`, clamps `heightRatio` to `[0, 1]`. `React.memo` |

**Additively widened, both owned by item #12:**

- `LineChart` gains `additionalSeries?: readonly LineChartSeries[]`, rendered in order **after**
  the primary series and **before** the existing optional dashed comparison series. Existing
  call sites (home's `TrendCard`) pass nothing and are byte-unchanged. The dashboard passes
  income as the primary series, `[expense]` as `additionalSeries`, and the trailing average as
  the comparison series — which is exactly the three-polyline z-order the mockup draws.
- `Legend` gains an optional `value?: string` per item. When present the row renders
  `mu-legend__name` + `mu-legend__val` (name left, value right, row justified); when absent the
  row is unchanged from item #12's dot + label. `Legend` therefore takes ownership of
  `mu-legend__name` and `mu-legend__val`.

**`MU_CLASS_MAP` changes — the nine classes the live map still defers to #17 after #12's
Decision 5 lands:** `mu-donut` → `owners: ['DonutChart']`; `mu-bars`, `mu-bars__bar`,
`mu-bars__bar--muted`, `mu-bars__bar--warm`, `mu-bars__col`, `mu-bars__lbl` →
`owners: ['BarChart']`; `mu-legend__name`, `mu-legend__val` → `owners: ['Legend']`. No other
entry is touched. If the live map at implementation time differs, the developer follows the map
and records the difference (Residual verification strategy, claim 1).

### Decision 9 — `mu-topbar*` stays `deferred`; the topbar is a screen-local composition, following the campaign's existing precedent

The dashboard mockup draws `mu-topbar` (← back, "Dashboard", ⚙️). The live map defers those
four classes with a note naming #12; #12's merged plan retargets the note to #8; and **#8's
merged plan Decision 12 declines to build the primitive** ("these screens compose locally"), as
does #13's Decision 13 (`StageTopBar`) and #9's Decision 10 (`FlowHeader`). Three merged plans
agree, so this item does not become the fourth opinion:
`src/features/dashboard/components/DashboardTopBar.tsx` composes `Text` and `Pressable`
screen-locally, and **`MU_CLASS_MAP`'s four `mu-topbar*` entries are not edited**.

This is deliberately recorded as a known cross-item residue rather than silently repeated: four
merged plans now compose a topbar locally, which is the point at which extracting the primitive
becomes worth an item of its own. **Follow-up the developer files during implementation**:
*"extract `TopBar` as a design-system primitive and take ownership of `mu-topbar*`; four screen
items now compose it locally."* (Assumption A12.)

### Decision 10 — `CategoryRow` and `ScreenHeader` are consumed by *not* being drawn, and are not duplicated

Item #12 builds five primitives and names #17 as the later consumer of `CategoryRow`,
`LineChart` and `Legend`. Checked against the drawing:

| #12 primitive | Drawn on `#screen=dashboard`? | This item |
| --- | --- | --- |
| `LineChart` (`mu-line`) | **Yes** — the trend card | Consumed, widened additively (Decision 8) |
| `Legend` (`mu-legend*`) | **Yes** — three legends | Consumed, widened additively (Decision 8) |
| `CategoryRow` (`mu-cat-row*`) | **No** — the category report is a donut plus a legend; `grep 'mu-cat-row'` inside the `s-dashboard` block returns nothing | Neither used nor duplicated. This item builds no row component and no bar-in-a-row |
| `ScreenHeader` (`mu-head*`) | **No** — this screen draws `mu-topbar`, not `mu-head` | Neither used nor duplicated (Decision 9) |
| `BankRow` (`mu-bank*`) | **No** | Not used |

The point of recording this explicitly is that "consume #12's primitives, do not duplicate them"
is satisfied for `CategoryRow` and `ScreenHeader` by building nothing — and a reviewer looking
for their use on this screen should find this table rather than a re-implementation.

### Decision 11 — an empty period renders an empty state **per card**, and no chart function can emit `NaN`

Brief AC4: *"Empty periods render an empty state rather than a broken chart."* The manifest
declares no `empty` state for `dashboard`, and it is genuinely a per-card condition — a person
can have income but no expenses in a week, which must not blank the whole screen. Two
independent mechanisms:

**(a) Presentation — one `EmptyState` per data-bearing block**, using item #2's primitive
(`mu-empty` / `mu-empty__icon`), in place of the chart only:

| Block | Empty condition | What renders |
| --- | --- | --- |
| Trend card | every one of the six period totals is `0` for **both** directions | The two flat tiles still render (`$0`), the `LineChart` and its legend are replaced by an `EmptyState` |
| Spending overview | the current period's expense total is `0` | `Total gastado` still renders `$0`; the delta badge, the `BarChart` and its legend are replaced by an `EmptyState` |
| Category report, per direction | that direction has no buckets in the selected period | The direction's total still renders `$0`; the donut and its legend are replaced by an `EmptyState`. The two directions are independent |

Copy is authored in the catalogues following the house pattern the mockup uses for
`#screen=transactions&state=empty` (icon + `mu-h3` title + `mu-p` body). Because the mockup
declares no dashboard empty state, this Spanish copy is **not** copied from the contract — it is
the one place on this screen where that is true, it is flagged as Assumption A4, and the
developer files a follow-up to add an `empty` state to `#screen=dashboard` so a future item can
copy from the contract instead.

**(b) Arithmetic — division guards, tested.** Every ratio this screen computes has a zero
denominator in the empty case: polyline y-scaling (`max === 0`), bar height
(`maxPeriodTotal === 0`), the delta badge (`previousTotal === 0`), and apportionment (an empty
entry list). Each shaping function returns a defined, renderable value — an empty array, a
zero ratio, or `null` for "no badge" — and never `NaN`, `Infinity` or the string `"NaN"` inside
a `points` attribute. Scenarios 13-16 assert this directly; a `NaN` in an SVG attribute is the
"broken chart" AC4 names.

### Decision 12 — data access follows item #12's shape exactly: `getAppDatabase()` plus repository functions behind one feature hook. **No TanStack Query.**

The binding campaign-wide pattern (item #8's merged plan, item #12's Decision 7, and the parent
orchestrator's consistency decision) is: `apps/mobile/src/db/runtime.ts` exports a memoized
`getAppDatabase(): Promise<AppDatabase>`; feature hooks call it and then call repository
functions; screens call neither directly; **no query library is installed**, despite
`expo-react-native.md` → *Data fetching* still prescribing TanStack Query (item #8 owns
correcting that document). This item adds no provider, no query client and no change to
`apps/mobile/app/_layout.tsx`.

`src/features/dashboard/use-dashboard-data.ts` exports two symbols:

- `loadDashboardData({ getAppDatabase, params, isCancelled })` — the exported, hook-free,
  cancellation-guarded async read. Returns `undefined` once `isCancelled()` flips true, so the
  caller never `setState`s a superseded run's result, and resolves to
  `{ status: 'error', error }` rather than rejecting.
- `useDashboardData(params): DashboardDataState` — delegates to `loadDashboardData`, re-reads
  when `useFocusEffect` bumps a `reloadToken`, and re-throws a stored rejection **during
  render** so the route's `ErrorBoundary` sees it.

This is item #12's post-review shape (PR #60, open at plan time). It is adopted here on its
merits — the cancellation guard is testable without a renderer, and throwing inside the async
callback would produce an unhandled rejection instead of reaching the `ErrorBoundary` — and
step 4 of the implementation-start re-verification aligns it with whatever #12 actually shipped.
Either way the two screens use the same shape, which is the point.

`readDashboardData(db, params): DashboardData` is the pure composition of the five repository
calls in Decision 1's table, separated from the hook so it is testable against a real in-memory
store in the `db` tier (the `.db.test.ts` convention item #12 established). Every call is
synchronous — the driver is `BaseSQLiteDatabase<'sync', …>` — so the five reads happen in one
uninterrupted pass and the trend, the bars and the donuts are guaranteed to describe the same
store state, with no interleaved write. That is the mechanism behind Scenario 25's "one
internally consistent snapshot": not a transaction, and not luck.

### Decision 13 — `month` / `week` is local component state, not a route parameter

The manifest declares one route, `/dashboard`, with two *states*. Introducing
`/dashboard/[period]` or a query-param route would create a route file the manifest does not
declare and break `route-manifest-parity.test.ts`, which asserts set equality between the derived
route set and the manifest's. The segment therefore drives a `useState<'month' | 'week'>` in
`app/dashboard.tsx`, whose value is a dependency of the data hook's params — switching the
segment re-derives the periods and re-reads.

The fidelity harness overrides it: when `useFidelityPreview()` reports `{ active: true, state }`,
the route renders `state` instead of the local value (Decision 14). This mirrors how #13's plan
uses the same helper.

The card-local *Este mes* / *Mes anterior* segment is a second, independent `useState` inside
`CategoryReportCard`; it selects between the current-period and previous-period bucket sets that
`readDashboardData` has **already read**, so toggling it performs no database access. Its labels
follow the active period type (*Esta semana* / *Semana anterior* in the `week` state); the
mockup draws only the month wording because it draws the inner segment once (Assumption A5).

### Decision 14 — the two `dashboard` fidelity targets flip `planned` → `wired` in this item

Item #47's Decision 2 states that flipping a target from `planned` to `wired` is *"the concrete
task each screen item inherits, and it is machine-checked"*, and its `coverage_sets` already
carries `{ "issue": 17, "targets": [{ "screen_id": "dashboard", "states": "all" }] }`. This item:

- adds `testID={fidelityTestId('dashboard')}` — i.e. `fidelity-dashboard` — to the route's root
  view;
- reads `useFidelityPreview()` in `app/dashboard.tsx` and, when `active`, renders the requested
  state instead of the local segment value;
- edits the two `dashboard` mappings in `scripts/mobile-ui/fidelity-targets.json` to
  `status: "wired"` with `app_file: "apps/mobile/app/dashboard.tsx"`,
  `deep_link: "finanzas:///dashboard?fidelity=1&fidelityScreen=dashboard&fidelityState=month"`
  (and `…&fidelityState=week`) and `ready_test_id: "fidelity-dashboard"`;
- **keeps `fixture: "seed-default"`, `max_mismatch_pct: 5.0` and the existing
  `threshold_note` byte-identical.** Item #47's Decision 4 is the anti-gaming rule: a threshold
  above the default requires a note, and raising one is a visible diff. This item raises nothing.

`pnpm fidelity:contract` validates that the file exists, that the `ready_test_id` string
literally appears in it, and that the deep link's `fidelityScreen` / `fidelityState` match the
target — so a half-done wiring fails CI rather than a reviewer. If #47 has not merged when
implementation starts, Step 0 stops the run rather than inventing a parallel mechanism.

### Decision 15 — the dashed trend line is the trailing three-period moving average of **expenses**

The mockup's third polyline is `#cbd5e1`, `stroke-dasharray="4 4"`, legend *"Promedio 3
períodos"*, and it is drawn beneath the expense line across all six points. A trailing average
of a rising series sits below the series, which is what is drawn; the card's neighbours
(*Resumen de gastos*, *Total gastado*) make expenses the screen's subject.

`buildTrailingAverage(series, DASHBOARD_TREND_AVERAGE_WINDOW)` with
`DASHBOARD_TREND_AVERAGE_WINDOW = 3` produces, for period *i*, the mean of periods
`max(0, i-2)…i` — i.e. **the average over the periods available inside the window**, so the
first two points average one and two periods rather than being omitted or reaching outside the
six periods already read. Extending the read to eight periods to make points 1 and 2 true
three-period averages would grow the single query by a third for two pixels of accuracy; that
trade is recorded rather than taken (Assumption A6). Integer arithmetic with floor division on
minor units — no float ever enters the money path (non-negotiable 2).

### Decision 16 — the spending overview: two bars scaled against the trend window, and a delta badge that hides rather than lies

The card draws a total, a `mu-badge--ok` reading `▼ 12% vs período anterior`, and two bars at
`78%` (muted, previous) and `68%` (warm, current).

**Bars.** Neither drawn bar is at `100%`, so their heights are not relative to each other. They
are relative to the **largest expense period total in the six-period trend window** — the same
series the trend card charts, which is already in memory and makes the two cards visibly agree:
a bar that is short here corresponds to a low point there. `heightRatio = periodTotal /
maxPeriodTotal`, clamped to `[0, 1]`, `0` when `maxPeriodTotal === 0` (Assumption A7,
Decision 11b).

**Labels.** `month` → `formatMonthAbbreviation(period.start, locale)` → `dic`, `ene`. `week` →
the drawn strings `S-1`, `S-2`, which are **positional within the two-bar comparison** (previous,
current), rendered from one catalogue key with an index interpolation rather than a computed
week number (Assumption A8).

**Delta badge.** `describeSpendingDelta({ current, previous })` returns
`{ direction: 'down' | 'up' | 'flat', percentWhole }` or `null`:

- `null` when `previous === 0` — a percentage change from nothing is undefined, and the badge is
  **not rendered** rather than showing `∞%` or a misleading `100%`;
- `percentWhole = round(|current − previous| × 100 / previous)` — a **whole** percent, because
  the mockup draws `12%`, not `12,0%`. This is the one percentage on the screen that is not a
  share of a total, so it does not go through `apportionTenths` or `formatPercentTenths`; it is
  interpolated into a catalogue string that carries the `%` and the `▼` / `▲` glyph;
- tone: `down` → `Badge tone="ok"` (spending less is good — the drawn case); `up` →
  `tone="warn"`; `flat` → `tone="neutral"`. Only the `ok` case is drawn; the other two are the
  inferred counterparts (Assumption A9).

---

## Assumptions

Every 🟡- and 🔴-marked statement this plan builds on, per `BEHAVIOR.md`'s own rule (*"Una spec
puede construir sobre él, pero debe listarlo en sus supuestos"*), plus the inferences this plan
makes from the drawing where the behaviour contract is silent. Each is reversible in one named
place.

| # | Assumption | Source / derivation | Reversal cost |
| --- | --- | --- | --- |
| A1 | 🔴 **D2** on `dashboard` resolves to *full* amounts, because the mockup draws every amount in full on this screen | The parent orchestrator's default (*"abbreviated exactly where the mockup draws them, nowhere else"*) applied to the drawing (Decision 5) | Five call sites in `src/features/dashboard/`, one helper swap |
| A2 | The donut track is `theme.colors.surface3`, and arc colours are **indices** into `theme.chart.series` rather than hex values | `theme.colors.surface3` is `#f1f5f9`, the exact track colour drawn; `design/tokens.json`'s `chart` group carries no track entry; `no-style-literals.test.ts` forbids a hex literal outside `theme.ts` (Decision 7) | One constant in `dashboard-palette.ts` |
| A3 | 🟡 `dashboard` shows only the period in progress; the `‹ ›`-style past-period navigation `BEHAVIOR.md` makes conditional does not exist because the mockup draws none | `BEHAVIOR.md` → `dashboard`: *"Navegación a períodos anteriores si el mockup la dibuja; si no, solo período vigente"* (Decision 3) | `dashboard-period.ts` plus two `Pressable`s |
| A4 | The dashboard's empty-state copy is authored rather than copied from the mockup, because `#screen=dashboard` declares no empty state | Non-negotiable 8 says the Spanish comes from the mockup; here there is none to come from (Decision 11) | Six catalogue keys; a follow-up adds the state to the mockup |
| A5 | The category report's inner segment reads *Este mes* / *Mes anterior* in the `month` state and *Esta semana* / *Semana anterior* in the `week` state | The mockup draws the inner segment once, without `data-states`, while the outer segment is state-driven (Decision 13) | Two catalogue keys and one ternary |
| A6 | 🟡 The dashed series is the trailing 3-period **expense** average, averaged over the periods available inside the six-period window | The drawn z-order, colour and legend text; the card's expense subject (Decision 15) | One pure function, `buildTrailingAverage` |
| A7 | 🟡 Bar heights are relative to the largest expense period total in the six-period trend window, not to each other | Reproduces the drawn `78%` / `68%`, neither of which is `100%` (Decision 16) | One line in `buildSpendingOverview` |
| A8 | The `week` bar labels `S-1` / `S-2` are positional within the two-bar comparison, not absolute week numbers | The mockup pairs them one-for-one with `dic` / `ene` (Decision 16) | One catalogue key |
| A9 | A rising spend renders `▲` with `Badge tone="warn"`; an unchanged spend renders `tone="neutral"`; a zero previous period renders **no badge** | Only the `▼` / `ok` case is drawn; the others are its inferred counterparts (Decision 16) | `describeSpendingDelta` |
| A10 | The donut displays the top 5 buckets; the remainder is left as visible track | The expense donut's five arcs sum to `77.4`, over a visible track; the income donut's two sum to `100.0` (Decision 6) | One constant, `DASHBOARD_DONUT_SEGMENT_LIMIT` |
| A11 | A foreign-currency movement is silently absent from every peso total on this screen, with no on-screen indication, and that is accepted for the MVP | #10 Decision 15 defers the person-facing half here; no on-device rate source exists (Decision 4) | A named follow-up; no code in this item |
| A12 | The topbar is composed screen-locally and `mu-topbar*` stays `deferred` | Three merged plans (#8 D12, #13 D13, #9 D10) do the same (Decision 9) | A named follow-up to extract `TopBar` |
| A13 | While the database handle is resolving, `dashboard` renders nothing; a bootstrap failure propagates to the route's `ErrorBoundary` rather than being caught by this screen | The mockup declares no loading state for `dashboard`; launch-failure handling belongs to #8. Mirrors item #12's Assumption A15 | `use-dashboard-data.ts` |
| A14 | The two flat tiles in the trend card render the **current period's** income and expense totals, not the six-period window's | They sit above a six-period chart but carry the same figures the category report shows for the current period (`$3.700.000` / `$1.352.470`), which is only consistent with the current period | One line in `buildTrendReport` |

---

## Layer-by-Layer Changes

### Database / Data Layer

**No migration, no schema change, no new seed data, no new repository function, no new query,
no fragment import, and no new file under `apps/mobile/src/db/`.** This is the whole point of
Decision 1. The functions consumed — `sumIncludedByDirectionAndCategory`,
`sumIncludedByDirectionAndDay` (both from item #12) and `listCategories` (merged in item #3) —
are called unchanged.

The only obligation this layer carries is the Step-0 branch in Decision 4 for
`isPesoDenominated`, which is a verification, not an edit.

### Shared Packages / Libraries

**`@finanzas/shared-domain`** — **not modified**. `apportionTenths` and
`PERCENTAGE_TENTHS_TOTAL` are consumed (Decision 6).

**`@finanzas/shared-utils`** — **not modified**. `formatClp`, `formatPercentTenths`,
`deriveDateLocal`, `getMonthPeriod`, `getWeekPeriod`, `shiftMonthPeriod`, `shiftWeekPeriod` and
`formatMonthAbbreviation` are consumed. This item writes no money, date or percentage
arithmetic.

**`@finanzas/bank-scraper`** — untouched.

### Frontend / UI

**New design-system primitives** (Decision 8), in `apps/mobile/src/components/ui/`, exported
from `index.ts`, composing `theme` / `componentMetrics` with no style literal:

- [ ] `DonutChart.tsx` — `react-native-svg`; `segments`, `trackColor`, `strokeWidth`;
      `React.memo`. Renders arcs from pre-computed tenths; owns no arithmetic.
- [ ] `BarChart.tsx` — `columns: { heightRatio, color, label }[]`; clamps ratios; `React.memo`.

**Modified design-system primitives** (both additive; existing call sites unchanged):

- [ ] `LineChart.tsx` — `additionalSeries?: readonly LineChartSeries[]`.
- [ ] `Legend.tsx` — optional `value?: string` per item; takes ownership of `mu-legend__name`
      and `mu-legend__val`.
- [ ] `_internal/touch-metrics.ts` — no new entry unless the implementer makes a chart element
      pressable; the dashboard's only touch targets are the two segments (already covered) and
      the two topbar buttons, which reuse the existing `headerAction` metric if #12 added it and
      otherwise add one entry, automatically covered by `touch-targets.test.ts`.
- [ ] `index.ts` — two new exports plus their prop types.

**`apps/mobile/src/theme.ts`** — **modified**: `componentMetrics` entries for `donutChart`
(`viewBox`, radius, stroke width) and `barChart` (column width, gap, track height, label
spacing), each citing its `.mu-*` selector and the mockup line number per the existing
convention; plus a `dashboard` group in the `screenMetrics` export (item #8) for the trend
`viewBox` and the card rhythm. The `theme` object itself is **not** touched.

**`apps/mobile/src/features/dashboard/`** — new.

- [ ] `use-dashboard-data.ts` — `loadDashboardData` and `useDashboardData` (Decision 12).
- [ ] `read-dashboard-data.ts` — `readDashboardData(db, params): DashboardData`, the pure
      composition of the five repository calls in Decision 1's table. No React.
- [ ] `dashboard-period.ts` — `DashboardPeriodType`, `resolveDashboardPeriods(today, periodType)`
      returning `{ period, previousPeriod, trendWindow, periodStarts }`, `toRepositoryPeriod`,
      and `DASHBOARD_TREND_PERIOD_COUNT` (Decision 3).
- [ ] `trend-report.ts` — `foldDailyTotalsIntoPeriods(dailyTotals, periodStarts)`,
      `buildTrendReport(...)`, `buildTrailingAverage(series, window)` and
      `DASHBOARD_TREND_AVERAGE_WINDOW` (Decisions 2, 15). Pure integer arithmetic.
- [ ] `spending-overview.ts` — `buildSpendingOverview(periodSeries)` and
      `describeSpendingDelta({ current, previous })` (Decision 16). Pure.
- [ ] `category-report.ts` — `buildDonutReport(totals, direction, catalogue)`: filters to the
      direction, apportions over **all** buckets via `apportionTenths`, sorts by total
      descending with the uncategorized bucket last among equals, takes the top
      `DASHBOARD_DONUT_SEGMENT_LIMIT`, and attaches label, emoji and palette index
      (Decisions 6, 7). Pure.
- [ ] `dashboard-palette.ts` — `DONUT_SERIES_ORDER` and the direction colour lookups
      (Decision 7). Indices and token references only; no hex.
- [ ] `components/DashboardTopBar.tsx` — screen-local (Decision 9).
- [ ] `components/TrendCard.tsx` — two flat tiles, `LineChart` with three series, `Legend`;
      `React.memo`, memoized on its series data.
- [ ] `components/SpendingOverviewCard.tsx` — total, delta `Badge`, `BarChart`, `Legend`;
      `React.memo`.
- [ ] `components/CategoryReportCard.tsx` — inner `Segment`, then one
      `components/DonutSection.tsx` per direction (total + `DonutChart` + `Legend`);
      `React.memo`.

**`apps/mobile/app/dashboard.tsx`** — **rewritten** from the `RoutePlaceholder`: derives `now` →
`deriveDateLocal` → periods once, owns the `month` / `week` `useState`, reads
`useFidelityPreview()`, calls `useDashboardData`, and composes the topbar, the segment and the
three cards. Carries `testID={fidelityTestId('dashboard')}` on its root view. No SQL, no
business logic, no literal copy. **No new route file is created**, so
`route-manifest-parity.test.ts` and `DEV_ONLY_ROUTES` are untouched.

**`apps/mobile/src/dev/DesignSystemGallery.tsx`** — **modified**: a section for `DonutChart` and
one for `BarChart`, plus a `Legend` sample showing the new `value` slot, with their `ds.*` keys.

**`apps/mobile/src/test-utils/mu-class-map.ts`** — **modified**: the nine reassignments in
Decision 8. The four `mu-topbar*` entries are **not** touched (Decision 9).

**`apps/mobile/src/i18n/es.json` and `en.json`** — **modified**: `dashboard.*` keys for every
string the mockup draws (copied verbatim into `es`) plus the empty-state copy of Assumption A4,
and `ds.*` keys for the new gallery sections. Flat, lowercase, snake_case, identical key sets —
the shape `catalogue-parity.test.ts` enforces.

### Infrastructure / Configuration

- [ ] **No new dependency.** `react-native-svg` is installed by item #12 (its Decision 6); this
      item imports it. `pnpm check:layout` must stay green, and the PR must state that a **dev
      build** is required — Expo Go cannot run this screen.
- [ ] **No `jest.config.js` change.** Item #12 adds `'<rootDir>/src/features/**/*.db.test.ts'`
      to the `db` project's `testMatch` and `'\\.db\\.test\\.ts$'` to the `app` project's
      `testPathIgnorePatterns`; `read-dashboard-data.db.test.ts` is routed by that existing
      wiring. Step 4's verification confirms the file runs under the `db` project exactly once.
- [ ] `scripts/mobile-ui/fidelity-targets.json` — **modified**: the two `dashboard` mappings
      flip to `wired` (Decision 14). No other mapping, threshold or coverage set is touched.
- [ ] No new CI job, no new script, no `metro.config.js` or `babel.config.js` change.

This item adds no executable shell guidance to a framework-owned surface, so no shell contract
(`bash` / `bash-zsh`) needs naming and the snippet linter is not in scope.

---

## Testing Strategy

**Test types**: unit (Jest `db` project, Node + `better-sqlite3`), unit (Jest `app` project),
source-scanning enforcement tests, the fidelity contract validator, and a manual smoke runbook
on a dev build.

`@testing-library/react-native` is **not** installed and this item does not add it — following
item #2's precedent, component-level assertions call the component function directly and inspect
the returned element tree; everything else is a pure function or a real-SQLite test.

### Scenario map

| # | Scenario | Maps to | Test file | Tier |
| --- | --- | --- | --- | --- |
| 1 | `resolveDashboardPeriods` for `month` returns the calendar month of the local day, the previous calendar month, and a trend window whose start is the first day of the fifth previous month and whose end is the current month's last day — correct across a February and a leap year | Decision 3, brief AC1 (periods) | `apps/mobile/src/features/dashboard/__tests__/dashboard-period.test.ts` | app |
| 2 | `resolveDashboardPeriods` for `week` returns Monday-start weeks and a six-week window, and is correct across a month boundary and a year boundary | Decision 3 | `dashboard-period.test.ts` | app |
| 3 | The composed dashboard totals over a fixture with one full, one partially included and one excluded movement equal a **hand-derived literal**, and equal what `totalForCategoryInPeriod` reports for the same category and period — an equivalence check against an independent aggregate **and** against a literal, so a shared mistake still fails | brief AC1, BR4, Decisions 1-2 | `apps/mobile/src/features/dashboard/__tests__/read-dashboard-data.db.test.ts` | db |
| 4 | `readDashboardData` issues exactly the five calls in Decision 1's table — asserted by spying on the repository module — and issues **no** row-level read (`listMonth`, `listRecentMovements`, `listByMerchant` are never called) | Decisions 1-2 | `read-dashboard-data.db.test.ts` | db |
| 5 | `readDashboardData` returns one internally consistent snapshot over a **real** in-memory store: the current period's slice of the trend series, the spending-overview current total, and the sum of the expense donut's buckets are the same number | Decision 12 | `read-dashboard-data.db.test.ts` | db |
| 6 | The inclusion-rule scanner finds **zero** restatements across the whole tree, including every file this item adds — rules A, B **and** C, so a `src/features/dashboard/` file mentioning `excluded_at` in a comment fails | brief AC1, BR4, Decision 1 | `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` (existing, must stay green) | db |
| 7 | No file outside `src/db/**` imports a SQL library — including the new hook, the six pure modules and the four components | Decision 1 | `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` (existing) | db |
| 8 | `foldDailyTotalsIntoPeriods` assigns each day row to exactly one period, drops nothing, produces one entry per period per direction including periods with no rows (as `0`), and is order-independent with respect to the input rows | Decision 2 | `apps/mobile/src/features/dashboard/__tests__/trend-report.test.ts` | app |
| 9 | `buildTrailingAverage` averages the previous three periods, averages only the periods available for points 1 and 2, and uses integer division (no float leaks into a money value) | Decision 15, Assumption A6 | `trend-report.test.ts` | app |
| 10 | `buildDonutReport` percentages sum to exactly `PERCENTAGE_TENTHS_TOTAL` over **all** buckets — including a three-equal-bucket tie and a single-bucket case — while the returned display list is capped at `DASHBOARD_DONUT_SEGMENT_LIMIT`; the uncategorized bucket participates and sorts last among equals | brief AC2, Decision 6, Assumption A10 | `apps/mobile/src/features/dashboard/__tests__/category-report.test.ts` | app |
| 11 | Each returned donut record carries the same `tenths` value that its legend row renders, so the arc and the legend cannot disagree — asserted by rendering both from one record and comparing | brief AC2 ("match the legend") | `category-report.test.ts` | app |
| 12 | Arc colours resolve through `DONUT_SERIES_ORDER`: the expense donut's ranks map to `theme.chart.series[0..4]` in order, and the income donut's rank 0 resolves to `theme.colors.success` and rank 1 to `theme.chart.series[0]` — reproducing the mockup | brief AC3, Decision 7 | `apps/mobile/src/features/dashboard/__tests__/dashboard-palette.test.ts` | app |
| 13 | An all-zero six-period series yields a `LineChart` `points` string containing no `NaN` and no `Infinity`, and a single-period non-zero series scales without dividing by zero | brief AC4, Decision 11b | `trend-report.test.ts` | app |
| 14 | `buildSpendingOverview` returns `heightRatio === 0` for every column when the window maximum is `0`, and clamps a ratio into `[0, 1]` | brief AC4, Decision 16, Assumption A7 | `apps/mobile/src/features/dashboard/__tests__/spending-overview.test.ts` | app |
| 15 | `describeSpendingDelta` returns `null` when `previous === 0`, `'down'` with a whole percent when spending fell, `'up'` when it rose, and `'flat'` when the two are equal | Decision 16, Assumption A9 | `spending-overview.test.ts` | app |
| 16 | `buildDonutReport` over an empty bucket list returns an empty display list and no `NaN`, and `apportionTenths` is not called with an empty entry list in a way that throws | brief AC4, Decision 11b | `category-report.test.ts` | app |
| 17 | Every `mu-*` class is classified exactly once and every `primitive` owner resolves to a barrel export — with `mu-donut`, the six `mu-bars*` and the two `mu-legend__*` classes now resolving to `DonutChart`, `BarChart` and `Legend`, and the four `mu-topbar*` entries still `deferred` | Decisions 8-9 | `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (existing) | app |
| 18 | No hex, `rgb()` or numeric style-property literal outside `theme.ts` — including in the two chart primitives and `dashboard-palette.ts` | #2's still-enforced AC | `apps/mobile/src/__tests__/no-style-literals.test.ts` (existing) | app |
| 19 | A string icon or a formatted amount passed to `DonutChart`, `BarChart` or the widened `Legend` never lands as a bare child of a non-text host | Regression class found in item #2's review | `apps/mobile/src/__tests__/no-naked-text.test.ts` (extend) | app |
| 20 | `LineChart`'s and `Legend`'s existing call sites compile and render unchanged when the new optional props are omitted — the additive-widening claim | Decision 8 | `apps/mobile/src/components/ui/__tests__/line-chart.test.ts`, `legend.test.ts` (extend the files #12 creates) | app |
| 21 | Route/manifest parity still holds and `DEV_ONLY_ROUTES` is unchanged — this item creates no route file | Decision 13 | `apps/mobile/src/__tests__/route-manifest-parity.test.ts` (existing) | app |
| 22 | `es` and `en` carry identical key sets and every new key matches the flat snake_case pattern | Non-negotiable 8 | `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` (existing) | app |
| 23 | `TrendCard`, `SpendingOverviewCard` and `CategoryReportCard` are wrapped in `React.memo` and receive `useMemo`-stabilised series/segment objects — asserted by a source scan over `src/features/dashboard/` plus a referential-stability test on the shaping functions' outputs | brief AC (charts must not recompute on unrelated re-renders) | `apps/mobile/src/features/dashboard/__tests__/memoization.test.ts` | app |
| 24 | `pnpm fidelity:contract` passes with both `dashboard` targets `wired`: the `app_file` exists, `fidelity-dashboard` literally appears in it, and both deep links' `fidelityScreen` / `fidelityState` match their target | Decision 14 | `scripts/mobile-ui/fidelity-contract.test.mjs` + `pnpm fidelity:contract` (existing, item #47) | contract |
| 25 | Both manifest states render end to end, compared against the mockup side by side | brief AC5, non-negotiable 6 | `docs/testing/mobile/17-dashboard.smoke-test.md` | smoke |
| 26 | `loadDashboardData` returns `undefined` (so the hook never calls `setState`) once `isCancelled()` flips true, for both a resolved and a rejected `getAppDatabase()`; called a second time with a fresh `isCancelled` it models a second focus event superseding an in-flight read | Concurrency addendum | `apps/mobile/src/features/dashboard/__tests__/use-dashboard-data.test.ts` — `loadDashboardData` is called directly with a stubbed `getAppDatabase` and a manually-flipped `isCancelled`, with no renderer | app |
| 27 | Once #10 has merged, the peso-total guard finds zero unguarded sums across the tree, including every file this item adds | Decision 4 | `apps/mobile/src/db/__tests__/peso-total-guard.test.ts` (arrives with #10; must stay green) | db |

**Seed data for the automated tiers**: the `db` scenarios build their own fixtures with the
existing `createTestConnection` / `createTestProduct` helpers from
`apps/mobile/src/db/testing/product-fixture.ts` and the deterministic ports from `memory-db.ts`.
No new fixture file is committed, and `src/db/__fixtures__/store-v1.sql` is **not** regenerated —
this item changes no schema and no seed.

### Parser-risk addendum

**Not applicable.** No file in this plan lives under `scripts/lint/`, `scripts/parse/` or a
comparable parse/scan directory; no new module has lint, parser, scanner, tokenizer or
regex-engine responsibilities; and no behaviour is described as regex-heavy scanning or
structured-text parsing. The source-scanning tests this item must satisfy
(`no-style-literals`, `mu-class-coverage`, `inclusion-rule-single-definition`,
`db-access-boundary`, and `peso-total-guard` once it exists) are consumed unchanged; their
scanners are not modified. `scripts/mobile-ui/fidelity-contract.mjs` is a validator this item
*runs*, not one it edits.

### Concurrent-event-source addendum

**Applicable.** `useDashboardData`'s asynchronous `getAppDatabase()` await runs concurrently with
React lifecycle events, with screen-focus events that trigger a re-read, and with the segment
toggle that changes the read's parameters — over shared mutable state (the hook's `state`,
`reloadToken` and the route's `periodType`).

- **Shared mutable state guards** — the database handle is not this hook's state to guard: item
  #8's `getAppDatabase()` is a module-level memoized `Promise<AppDatabase>` wrapping
  `ensureDatabaseReady`, which itself serialises through the module-level single-flight promise
  in `apps/mobile/src/db/bootstrap.ts`. Two screens mounting at once share one open-and-bootstrap,
  not two. The hook's own state has exactly one writer — its effect — and is only ever replaced
  wholesale, never mutated in place. `periodType` and the category card's local segment value are
  ordinary React state with a single writer each (their own `Pressable`), and `periodType` is a
  dependency of the effect rather than something the effect writes.
- **Re-entrancy / in-flight tracking** — a second focus event, or a segment toggle, can arrive
  while the first read is still awaiting the handle. Both re-run the effect (via `reloadToken` or
  via the changed `periodType` dependency), and React runs the previous effect's cleanup first,
  which sets `cancelled = true` on the superseded run. `loadDashboardData` observes that through
  `isCancelled()` and resolves to `undefined`, so the earlier read's result is discarded rather
  than racing the later one into state. Last write wins, deterministically.
- **Event deduplication** — `useFocusEffect` fires on every focus, including a re-focus with no
  intervening navigation, and a person can tap the already-selected segment item. A duplicate
  costs one extra pass of five bounded `SELECT`s and cannot corrupt anything: every call in
  `readDashboardData` is a read, and the whole result is replaced atomically in one `setState`.
  No debounce is added; a redundant local SQLite read is cheaper than the state machine that
  would avoid it.
- **Listener and resource cleanup** — `useFocusEffect` returns its own cleanup, and the data
  effect returns a cleanup that sets `cancelled`. Unmounting mid-read therefore cannot `setState`
  on an unmounted component. The SQLite handle is process-lived and deliberately **not** closed:
  it is owned by `src/db/runtime.ts`, not by any screen. `DonutChart` and `BarChart` register no
  listener, no timer and no animation handle, so they have nothing to tear down.
- **Race conditions at initialization** — a focus event or a segment toggle can arrive before the
  handle resolves. Each only re-runs the same effect, which awaits the same memoized promise, so
  nothing reads an unready database. The screen renders nothing while `status === 'pending'`
  (Assumption A13).
- **Race conditions at teardown** — after unmount, the `cancelled` flag discards both a resolved
  and a rejected read. Because every call is a read, a discarded result has no side effect and
  nothing needs draining.
- **Error propagation across async boundaries** — `getAppDatabase()` rejects with the typed
  `DatabaseBootstrapError` from `bootstrap.ts` (and clears its own memo, so the next mount
  genuinely retries rather than replaying a cached failure). `loadDashboardData` catches it and
  **resolves** to `{ status: 'error', error }` rather than rejecting, so the hook's `.then`
  always runs; the hook stores that value and re-throws it **during render** on the next pass,
  which is what makes it reachable by the route's `ErrorBoundary` — throwing inside the async
  callback would produce an unhandled rejection instead. It is never `console.log`ged
  (`no-console` is on) and carries no credential, because none is in scope here. This screen
  renders no read-error state of its own: the mockup declares none for `dashboard`.

**New concurrent patterns**: none. This is item #12's shape with one additional effect
dependency (`periodType`), handled by the same cleanup ordering.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Bank connection, products and movements for the on-device smoke test | The committed deterministic snapshot: one `banco-de-chile` connection with `sync_status = 'ok'`, two products, and movements covering every person-owned state (categorized, uncategorized, excluded, partially included) | `apps/mobile/src/db/__fixtures__/store-v1.sql` — **existing, unchanged**; loaded on device by item #12's `__DEV__`-only sample-data panel |
| An empty period, for brief AC4 | The bootstrapped store with starter content only, or the fixture with the device clock in a period the fixture has no movements in | Produced by item #12's dev panel action *Vaciar datos de ejemplo*; the runbook also reaches it by switching to `week` when the fixture's movements fall outside the current week |
| `db`-tier scenarios | Built per-test from `createTestConnection` / `createTestProduct` and the deterministic ports | `apps/mobile/src/db/testing/product-fixture.ts`, `memory-db.ts` — **existing, unchanged** |
| Fidelity captures | `fixture: "seed-default"`, carried over unchanged from the two `planned` mappings | `scripts/mobile-ui/fidelity-targets.json` |

No seed file is added or regenerated: this item changes no schema and no starter content, and it
adds no dev-only surface of its own.

---

## Documentation Updates

To be executed by the developer **during implementation**, not now.

- [ ] `docs/project/3-software-architecture.md` — record that `dashboard` reads through
      `getAppDatabase()` plus item #12's repository functions behind one feature hook, and that
      it adds no aggregate of its own (Decisions 1, 12). One paragraph; the chart-library entry
      is already written by #12.
- [ ] `docs/best-practices/stack/design-tokens.md` — add the `donutChart` and `barChart`
      `componentMetrics` groups and the `screenMetrics.dashboard` group to the list of documented
      groups, if that document enumerates them.
- [ ] `docs/best-practices/stack/sqlite-drizzle.md` — under *Queries*, record the reading of
      "aggregate in SQL, not in JS" that Decision 2 relies on: day-grained SQL aggregates folded
      into periods by a pure function are compliant, because the row count is bounded by the
      window rather than by movement volume. This is the single most likely place a future item
      re-litigates the decision.
- [ ] `AGENTS.md` — **no edit expected.** The troubleshooting row *"`home` and `dashboard`
      totals disagree"* already names the correct cause and remains accurate; verify that it
      still reads correctly now that both screens call the same functions, and only adjust if it
      does not.
- [ ] `docs/project/4-database-model.md` — **no edit.** No schema change, no new access pattern.
- [ ] `docs/project/2-repo-architecture.md` — **no edit.** No new dependency, no new top-level
      directory; `src/features/` is already documented.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — **no edit in this PR.** D2 stays 🔴 open; this plan
      records the chosen reversible default (Decision 5) and flags it. Closing D2 is LH's call
      and belongs in a `BEHAVIOR.md` PR, per that document's own rule. The same applies to
      A3 (past-period navigation), which this plan resolves *from the drawing* as that document
      instructs.
- [ ] Two follow-up tracker items the developer files (not documentation, but recorded here so
      they are not lost): the foreign-currency user-visible treatment (Decision 4) and the
      `TopBar` primitive extraction (Decision 9). A third, optional: adding an `empty` state to
      `#screen=dashboard` so a future item can copy its Spanish from the contract (Assumption A4).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Item #12's implementation ships aggregates with different names or signatures than its merged plan**, invalidating Decision 1 | Medium | High | Every symbol this plan consumes from #12 is re-verified by Step 0 against merged `develop`, not against #12's plan document. A mismatch stops the run before any edit and returns the evidence to the parent |
| A reviewer reads Decision 2's period folding as a violation of brief AC1 | Medium | Medium | Decision 2 quotes the rule's own text and shows the bound (≤ 368 rows, independent of movement volume), names the alternative it rejected and why, and cites #12's already-reviewed `buildCumulativeSeries` precedent. Scenario 4 asserts mechanically that no row-level read happens |
| `home` and `dashboard` still diverge later, despite calling the same functions | Low | High | There is no second query to diverge — Decision 1's table plus the three tree-wide scans (Scenarios 6, 7, 27). Scenario 3 additionally pins the composed totals against an independent aggregate **and** a hand-derived literal |
| #10 merges after #12 and the two aggregates never get `isPesoDenominated` | Low | High | `peso-total-guard.test.ts` is the mechanism, not a convention: it goes red on `develop` the moment #10 lands with an unguarded sum. Decision 4's Branch A makes that a hard stop for this item rather than something to work around |
| D2 is decided the other way after this item merges | Medium | Low | Five call sites, all in `src/features/dashboard/`, all through one already-tested helper. No `@finanzas/shared-utils` change is needed either way (Decision 5) |
| Assumption A6 (trailing-average definition) or A7 (bar scale) is wrong | Medium | Low | Each is contained in one pure function with its own tests (`buildTrailingAverage`, `buildSpendingOverview`); a different definition is a rewrite of that function, not of the card |
| The `week` state's fidelity capture is not reproducible, because the bundled fixture's movements may fall outside the current week | Medium | Medium | The capture uses `fixture: "seed-default"` and the `fidelityState=week` deep link, so it captures whatever the fixture yields — including the empty-state rendering, which is a legitimate and *stable* target. The runbook records this explicitly so a reviewer does not read an empty `week` capture as a defect |
| The donut's antialiasing differs enough between Chromium SVG and React Native to fail the fidelity comparison | Medium | Medium | Item #47 already seeded `dashboard--*` at `max_mismatch_pct: 5.0` with exactly that `threshold_note`; this item carries it over unchanged and does **not** raise it. If 5.0 proves insufficient, the finding is reported rather than the threshold silently raised (#47 Decision 4) |
| Scope creep into a `TopBar` primitive | Low | Low | Decision 9 follows three merged plans and files a follow-up instead |
| `LineChart`'s shipped prop shape cannot express three series additively | Low | Medium | Step 0 check 4 reads the shipped prop types before any edit. If `additionalSeries` does not fit what shipped, the equivalent additive prop is chosen then — the constraint that binds is "existing call sites unchanged", not the prop's name |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation.

The read composition. The only thing that matters here is that every entry is a call to a
function this item did not write, and that no filter, weight or column name appears anywhere in
the file:

```ts
// apps/mobile/src/features/dashboard/read-dashboard-data.ts — Illustrative, adapt during implementation
export function readDashboardData(db: AppDatabase, params: DashboardDataParams): DashboardData {
  const { period, previousPeriod, trendWindow, locale } = params;
  return {
    windowDailyTotals: sumIncludedByDirectionAndDay(db, toRepositoryPeriod(trendWindow)),
    currentCategoryTotals: sumIncludedByDirectionAndCategory(db, toRepositoryPeriod(period)),
    previousCategoryTotals: sumIncludedByDirectionAndCategory(db, toRepositoryPeriod(previousPeriod)),
    categories: [
      ...listCategories(db, { income: 0, locale }),
      ...listCategories(db, { income: 1, locale }),
    ],
  };
}
```

The period model — every boundary from `@finanzas/shared-utils`, no date arithmetic here:

```ts
// apps/mobile/src/features/dashboard/dashboard-period.ts — Illustrative, adapt during implementation
export const DASHBOARD_TREND_PERIOD_COUNT = 6;

export type DashboardPeriodType = 'month' | 'week';

/** Decision 3. `periodStarts` is ascending and has exactly DASHBOARD_TREND_PERIOD_COUNT entries. */
export function resolveDashboardPeriods(today: DateLocal, periodType: DashboardPeriodType) {
  const period = periodType === 'month' ? getMonthPeriod(today) : getWeekPeriod(today);
  const shift = (offset: number): Period =>
    periodType === 'month' ? shiftMonthPeriod(period, offset) : shiftWeekPeriod(period, offset);

  const periods: Period[] = [];
  for (let offset = DASHBOARD_TREND_PERIOD_COUNT - 1; offset >= 0; offset -= 1) {
    periods.push(shift(-offset));
  }

  return {
    period,
    previousPeriod: shift(-1),
    trendWindow: { start: periods[0].start, end: period.end },
    periodStarts: periods.map((p) => p.start),
  };
}
```

The donut report — apportionment over every bucket, display capped, one record feeding both the
arc and the legend row:

```ts
// apps/mobile/src/features/dashboard/category-report.ts — Illustrative, adapt during implementation
import { apportionTenths } from '@finanzas/shared-domain';

export const DASHBOARD_DONUT_SEGMENT_LIMIT = 5;
const UNCATEGORIZED_KEY = ' uncategorized';

export function buildDonutReport(
  totals: readonly DirectionCategoryTotal[],
  direction: 'debit' | 'credit',
  /* …catalogue lookup… */
): DonutReport {
  const buckets = totals.filter((row) => row.type === direction);
  // Apportion over EVERY bucket, not only the five the donut shows (Decision 6).
  const tenths = apportionTenths(
    buckets.map((row) => ({ key: row.transactionCategoryId ?? UNCATEGORIZED_KEY, weight: row.total })),
  );
  // …sort by total desc, uncategorized last among equals, take DASHBOARD_DONUT_SEGMENT_LIMIT,
  // attach label, emoji and DONUT_SERIES_ORDER[direction][rank]…
  return { total: sumOf(buckets), segments: /* … */ [] };
}
```

The delta badge — the one place a percentage is not a share of a total, and the one place a
figure is deliberately withheld:

```ts
// apps/mobile/src/features/dashboard/spending-overview.ts — Illustrative, adapt during implementation
export interface SpendingDelta {
  direction: 'down' | 'up' | 'flat';
  percentWhole: number;
}

/** Decision 16. `null` means "render no badge" — a change from zero has no percentage. */
export function describeSpendingDelta({ current, previous }: { current: number; previous: number }): SpendingDelta | null {
  if (previous === 0) return null;
  if (current === previous) return { direction: 'flat', percentWhole: 0 };
  const percentWhole = Math.round((Math.abs(current - previous) * 100) / previous);
  return { direction: current < previous ? 'down' : 'up', percentWhole };
}
```

---

## Implementation Order

Each step is independently committable and leaves the repository green. Steps 1-4 are invisible
to a person using the app; the screen appears at Step 7.

0. **Implementation-start re-verification.** Run the seven checks in the *Cross-Cutting
   Operational Assumption Check* section and record `Still valid` or `Stale or conflicting` in
   the PR body. Stop before any edit if **#12**, **#5** or **#47** has not merged, if either
   aggregate differs from its recorded signature, or if Decision 4's Branch A finds the peso
   guard present in `fragments.ts` but absent from the two aggregates.
1. **Period model.** `dashboard-period.ts` plus Scenarios 1-2. No React, no database. Verify:
   `pnpm --filter @finanzas/mobile test` — read the output and confirm the two new period suites
   ran and passed.
2. **Pure shaping functions.** `trend-report.ts`, `spending-overview.ts`, `category-report.ts`,
   `dashboard-palette.ts`, plus Scenarios 8-16. Still no React and no database. Verify:
   `pnpm --filter @finanzas/mobile test` and `pnpm --filter @finanzas/mobile typecheck`.
3. **The read composition.** `read-dashboard-data.ts` plus Scenarios 3-5 in
   `read-dashboard-data.db.test.ts`. Verify: `pnpm --filter @finanzas/mobile test` — read the
   output and confirm the new file runs under the **`db`** project exactly once, that every
   pre-existing test still runs under the project it ran under before, and that
   `inclusion-rule-single-definition` and `db-access-boundary` are still green (Scenarios 6-7),
   and — when #10 has merged — that `peso-total-guard` is green too (Scenario 27); and
   `pnpm lint` reports no `dbAccessBoundary` violation.
4. **Design-system primitives.** `DonutChart`, `BarChart`, the `LineChart` and `Legend`
   widenings, the `componentMetrics` groups, the barrel exports, and Scenarios 19-20. Then update
   `MU_CLASS_MAP` per Decision 8 — the nine reassignments, and **nothing else**. Verify:
   `pnpm --filter @finanzas/mobile test` and confirm `mu-class-coverage`, `no-style-literals`,
   `touch-targets` and `no-naked-text` all pass; paste the `mu-class-coverage` per-status
   breakdown line into the PR body as residual evidence (Scenarios 17-18).
5. **Gallery.** A section for each new primitive and a `Legend` sample with the `value` slot in
   `DesignSystemGallery.tsx`, with their `ds.*` keys in both catalogues. Verify:
   `gallery-catalogue-keys.test.ts` and `catalogue-parity.test.ts` pass, and `/gallery` renders
   the new sections on a dev build.
6. **Dashboard copy.** Every `dashboard.*` key in `es.json` and `en.json`, with the Spanish
   copied verbatim from `#screen=dashboard` — and the empty-state copy of Assumption A4 marked
   with a comment naming that assumption. Verify: `catalogue-parity.test.ts` passes and
   `pnpm --filter @finanzas/mobile lint` reports no `i18next/no-literal-string` error.
7. **The hook, the components and the route.** `use-dashboard-data.ts`, the five feature
   components, and the rewritten `app/dashboard.tsx` including
   `testID={fidelityTestId('dashboard')}` and the `useFidelityPreview()` override. Plus
   Scenarios 23 and 26. Verify: `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass, and
   `route-manifest-parity.test.ts` is unchanged and green (Scenario 21).
8. **Fidelity wiring.** Flip the two `dashboard` mappings in
   `scripts/mobile-ui/fidelity-targets.json` to `wired` per Decision 14, keeping `fixture`,
   `max_mismatch_pct` and `threshold_note` byte-identical. Verify: `pnpm fidelity:contract`
   passes (Scenario 24), and `pnpm fidelity --issue 17` runs both captures on the dedicated
   simulator; record the two mismatch percentages in the PR body.
9. **Smoke runbook execution.** Run
   [`docs/testing/mobile/17-dashboard.smoke-test.md`](../../../testing/mobile/17-dashboard.smoke-test.md)
   end to end on a dev build, comparing both states against the mockup side by side. Record the
   device, viewport, screenshots and any accepted difference in the PR, per
   `mobile-ui-fidelity.md` → *Review evidence*.
10. **Documentation updates.** Execute the *Documentation Updates* section above, and file the
    two (optionally three) follow-up tracker items it names.
11. **CHANGELOG.** Add, under `## [Unreleased]` → `### Added`, exactly:

    ```markdown
    - **Dashboard** (#17): the trend, spending-overview and category-report cards in both
      manifest states (`month`, `week`), with month/week period toggles, donut and bar charts
      on `react-native-svg`, and per-card empty states. Every figure is produced by the same
      `apps/mobile/src/db/repositories/transactions.ts` aggregates the home screen calls, so
      the two screens cannot diverge; this item adds no SQL. Adds the `DonutChart` and
      `BarChart` design-system primitives and wires the two `dashboard` design-fidelity targets
    ```

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — all five brief acceptance criteria map to implementation
  steps and tests. AC1 (*aggregation in SQL*) → Decisions 1-2 + Scenarios 3, 4, 6, 7;
  AC2 (*donut percentages sum to 100 and match the legend*) → Decision 6 + Scenarios 10, 11;
  AC3 (*income and expense colours*) → Decision 7 + Scenario 12; AC4 (*empty periods, not a
  broken chart*) → Decision 11 + Scenarios 13-16 + runbook Step 6; AC5 (*compare against the
  mockup side by side*) → the runbook's per-state fidelity steps + Decision 14 + Scenario 24.
  Both manifest states (`month`, `week`) are built; the screen carries no `mvp: false` state.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  exactly one Implementation Order step. `DonutChart`, `BarChart`, `LineChart`, `Legend`,
  `readDashboardData`, `loadDashboardData`, `useDashboardData`, `resolveDashboardPeriods`,
  `toRepositoryPeriod`, `foldDailyTotalsIntoPeriods`, `buildTrendReport`,
  `buildTrailingAverage`, `buildSpendingOverview`, `describeSpendingDelta`, `buildDonutReport`,
  `DONUT_SERIES_ORDER`, `DASHBOARD_TREND_PERIOD_COUNT`, `DASHBOARD_TREND_AVERAGE_WINDOW` and
  `DASHBOARD_DONUT_SEGMENT_LIMIT` are spelled identically in the Summary, Decisions,
  Layer-by-Layer, Testing Strategy, Code Samples and Implementation Order sections. Decision
  indices 1-16 and assumption indices A1-A14 are referenced consistently. Paths
  (`apps/mobile/app/dashboard.tsx`, `apps/mobile/src/features/dashboard/`,
  `apps/mobile/src/components/ui/`, `scripts/mobile-ui/fidelity-targets.json`,
  `docs/testing/mobile/17-dashboard.smoke-test.md`) and the route `/dashboard` agree everywhere.
  The consumed repository functions are named identically in Decision 1's table, the Verification
  Log, the Code Samples and the Testing Strategy.
- **Verification support**: Checked — every claim about existing behaviour (what the mockup
  draws, the manifest's two states, the chart tokens, the `mu-*` deferral counts, the topbar
  ownership across four merged plans, the aggregate signatures, the peso-guard obligation, the
  fidelity contract's seeded targets and threshold, the period helpers, the `formatClp`
  defaults, the route placeholder) cites a Verification Log command with its result. The claims
  about #47's contract are read from the **live file on its open PR head**, not from its plan
  text.
- **Behavioural guarantees**: Checked — *"home and dashboard cannot diverge"* names the
  mechanism (the same functions, plus `dbAccessBoundary`, `inclusion-rule-scan` rules A/B/C and
  `peso-total-guard`, Decision 1); *"percentages sum to 100"* names `apportionTenths` and
  `PERCENTAGE_TENTHS_TOTAL` (Decision 6); *"the arcs match the legend"* names the single record
  array both are rendered from (Decision 6); *"no broken chart"* names the division guards and
  the four scenarios that assert no `NaN` (Decision 11b); *"the widenings are additive"* names
  the unchanged-call-site constraint and Scenario 20; *"a superseded read cannot race a later
  one"* names React's run-cleanup-before-next-effect ordering plus the `cancelled` flag; *"a
  bootstrap failure reaches the route's `ErrorBoundary`"* names `loadDashboardData` resolving
  rather than rejecting and the re-throw **during render**; *"the aggregates are peso-guarded"*
  names `peso-total-guard.test.ts` rather than a convention.
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes no workflow
  documentation, protocol or decision gate. Its multi-input tables (`describeSpendingDelta`'s
  four outcomes, the per-card empty conditions, Decision 4's two merge-order branches) are
  product and sequencing behaviour, and each is enumerated exhaustively where it is defined and
  mapped to a scenario.
- **Parser/API/concurrency checklist**: Parser-risk — Not applicable, with the rationale in the
  Parser-risk addendum. API-surface / snapshot semantics — covered where it applies: the two
  primitive widenings are declared additive with Scenario 20 as the mechanical check, and the
  single-snapshot claim names the synchronous driver (Decision 12, Scenario 5).
  Concurrent-event-source — **applicable and completed**: all seven checklist items are answered
  in the Concurrent-event-source addendum.
- **Cross-cutting checklist**: Not applicable — this plan introduces or modifies no safety,
  quality or compliance category that applies across multiple feature implementations. It adds
  no checklist to `REVIEW.md`, to any protocol, or to any agent or skill file.
- **CHANGELOG literal format**: Checked — Implementation Order Step 11 carries the entry
  verbatim in the project's `**Bold Title** (#N):` format, under `### Added`.
- **Not-applicable rationale**: Checked — the three skipped categories (parser-risk, workflow
  decision-gate matrix, cross-cutting checklist) each carry a rationale above.
