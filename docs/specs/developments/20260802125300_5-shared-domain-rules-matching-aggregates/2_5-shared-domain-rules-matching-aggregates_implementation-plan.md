# shared-domain: Rules, Matching and Aggregates — Implementation Plan

**Spec**: None — this is a **Refactor**-routed item
([`../../../project/2-repo-architecture.md`](../../../project/2-repo-architecture.md), *Backlog
routing*: `Refactor` → plan → implementation, no spec). The work item brief is
[GitHub issue #5](https://github.com/lhpaul/personal-finances/issues/5) and it is the
specification of record for this plan.
**Smoke test runbook**: [`../../../testing/mobile/5-shared-domain-rules-matching-aggregates.smoke-test.md`](../../../testing/mobile/5-shared-domain-rules-matching-aggregates.smoke-test.md)
**Issue**: lhpaul/personal-finances#5

---

## Summary

**Approach**: Fill in the empty `@finanzas/shared-domain` workspace with six pure modules —
`types.ts`, `inclusion.ts`, `merchant-matching.ts`, `category-suggestion.ts`,
`apportionment.ts`, `aggregates.ts` — re-exported from `index.ts`. Every function is a pure
function of its arguments over plain objects: no React, no SQL, no `expo-*`, no I/O, and — the
strongest form of the brief's clock rule — **no use of the `Date` global at all**. The clock
enters the package as a `DateLocal` (`YYYY-MM-DD`) string produced by
`@finanzas/shared-utils`'s `deriveDateLocal(instant)`, so the timezone seam stays in the one
package that already owns it (issue #4, merged) and this package needs no instant-to-civil
conversion. Money arithmetic is integer-only; the two places that divide (per-category
percentages and the daily average) round explicitly and deterministically over `BigInt`.
Percentages are apportioned by **largest remainder (Hamilton)** in tenths of a percent, the
granularity the UI contract actually renders (`20,6%`, `67,6%` + `32,4%` = `100,0%`), so the
buckets sum to exactly `1000` tenths by construction rather than by luck. The inclusion rule
(`excluded_at IS NULL`, at `COALESCE(included_amount, amount)`) is implemented here as the
**domain-logic twin** of item #3's SQL fragment, and the two are kept in sync by a shared
hand-derived expected-value table — never by comparing one implementation's output to the
other's.

**Estimated complexity**: M

<!-- S: < 1 day | M: 1-3 days | L: 3+ days -->

**Rationale**: Roughly 550 lines of source across six new files in one workspace, plus two
small additive exports in `@finanzas/shared-utils` and one additive edit to the root
`eslint.config.mjs`. No new dependencies, no new toolchain, no UI, no database, no async, no
concurrency. The complexity is concentrated in three places, all of them verification work
rather than integration work: getting the apportionment invariant provably exact, enumerating
the merchant-matching edge cases (token boundaries, normalization, deterministic tie-breaks),
and proving the partial-inclusion branch computes the right *number* rather than merely
running. It is above S because the brief demands exhaustive enumeration (AC1: "every business
rule … has a test") and because a same-surface open pull request constrains what may be added
to the shared ESLint rule (see the Cross-Cutting Operational Assumption Check).

**Dependencies**: Issue #3 (local database schema, migrations, seed data) and issue #4
(shared-utils: CLP money, dates, RUT) — both **merged into `develop`**, per the brief's
`## Depends on`. Nothing in this item blocks on either at build time: it consumes
`@finanzas/shared-utils` by package name, and it does **not** import from `apps/mobile/src/db/`
(it cannot — the purity rule forbids it). Items #3 (implementation stage), #6 and #35 run
concurrently on disjoint surfaces; item #35's open pull request #39 touches this package and is
accounted for below.

---

## Verification Log

> Reproducible plan-time verification. Repo revision for every row: `54d4390`
> (`implementation-plan/5-shared-domain-rules-matching-aggregates`, branched from `develop`,
> HEAD identical to `origin/develop`). Verified 2026-08-02T12:50Z in the isolated worktree
> `.claude/worktrees/item-5`.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `54d4390`; `git worktree list` shows `item-5` on `implementation-plan/5-shared-domain-rules-matching-aggregates` at that SHA |
| Existing package surface (what this item fills in, rather than creates) | `find packages/shared-domain -type f -not -path '*/node_modules/*'` | 6 files: `package.json`, `tsconfig.json`, `jest.config.js`, `eslint.config.mjs`, `src/index.ts`, `src/index.test.ts`. `src/index.ts` contains only `export const PACKAGE_NAME = '@finanzas/shared-domain';` — **it must stay exported** (`apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it) |
| Business-rule enumeration driving AC1 (pattern-completeness claim, re-run live rather than copied) | `grep -nE '^[0-9]+\. \*\*' docs/project/1-business-domain.md` and `grep -cE '^[0-9]+\. \*\*' …` | **9 rules, numbered 0-8**, at lines 53, 58, 61, 63, 66, 69, 71, 74, 76. Every one appears in the Business Rule coverage matrix below |
| The inclusion rule's authoritative wording | `sed -n '66,68p' docs/project/1-business-domain.md`; `grep -n 'Analysis rule' docs/project/4-database-model.md` | Business Rule 4: "A transaction counts toward totals and charts when `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`. This rule is implemented once and every aggregate reads through it." Data model line 274-275 states the identical rule as the "Analysis rule (single source of truth)" |
| `included_amount` MVP status (why the partial branch would otherwise ship unverified) | `grep -n 'included_amount' docs/project/4-database-model.md` | Line 262: "**No UI in the MVP** — always null. Kept as a column so the inclusion rule below never has to change when partial inclusion ships." Line 359-362: partial inclusion is resolved as out of the MVP; `#screen=categorize&state=advanced` stays `mvp: false`. **This is a UI-layer fact; the rule itself is general** |
| The SQL twin this plan must stay consistent with | `sed -n '215,236p' docs/specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/2_3-local-database-schema-migrations-seed-data_implementation-plan.md` | Item #3 Decision 9: `apps/mobile/src/db/fragments.ts` exports exactly `isIncluded = sql\`${transactions.excludedAt} is null\`` and `includedAmount = sql\`coalesce(${transactions.includedAmount}, ${transactions.amount})\``, plus a scanner proving no second SQL statement of the rule exists |
| Item #3's own result-level assertion for the same rule (the numbers this plan must independently reproduce) | `sed -n '664,675p'` of the same file | "agreement between two consumers of one wrong fragment is not evidence" — `totalForCategoryInPeriod` over one full movement (`amount` 42000), one partially included movement (`amount` 42000, `included_amount` 21000) and one excluded movement (`amount` 15000) returns **`63000`** |
| Domain-type ownership today | `grep -n 'shared-domain' docs/specs/developments/20260801171546_3-local-database-schema-migrations-seed-data/2_3-local-database-schema-migrations-seed-data_implementation-plan.md` | Item #3 line 564: "`packages/shared-domain/` and `packages/bank-scraper/` are untouched … Domain types for this item live beside their repositories in `apps/mobile/src/db/types.ts` **until a later item promotes them**; promoting them is a pure move with no schema consequence" |
| Percentage granularity actually rendered by the UI contract | `grep -oE '[0-9]{1,3},[0-9]%' design/mockups/mobile/index.html \| sort -u` | `11,6%`, `11,8%`, `13,3%`, `14,3%` (×2), `17,4%` (×2), `20,6%` (×2), `32,4%`, `67,6%`. **One decimal place**, comma decimal separator. The income donut's two slices are `67,6%` + `32,4%` = **exactly `100,0%`** (`#screen=dashboard`, lines 1879-1880) |
| Delta percentages rendered by the UI contract | `grep -n -i 'vs mes anterior\|período anterior\|vs mes pasado' design/mockups/mobile/index.html` | `−55% vs mes anterior` (line 1340), `−12%` under "vs mes pasado" (line 1396), `▼ 12% vs período anterior` (line 1830). **Zero decimals at the display layer**; the domain returns tenths and the caller decides the display precision |
| Daily-average label in the UI contract | `sed -n '1395p' design/mockups/mobile/index.html` | `Gasto diario promedio` / `$46.700` / `este mes` — an expense-side average over the *elapsed* part of the month, not over all 31 days |
| The uncategorized bucket is a real breakdown row, not a filter | `sed -n '1525p' design/mockups/mobile/index.html` | `Sin categorizar` `$156K` `3 transacciones · 11,6%` on `#screen=home` — an uncategorized, non-excluded movement counts toward the total and gets its own bucket |
| Raw bank descriptions the matcher must handle | `grep -n -oE '(MERPAGO\|MERCADOLIBRE\|ML CHILE\|LIDER\|UBER)[^<]{0,50}' design/mockups/mobile/index.html` | `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO` (line 1189), `MERCADOLIBRE COMPRA ONLINE` / `MERPAGO*MERCADOLIBRE` / `ML CHILE SPA` (lines 1360-1362, `#screen=merchant-edit&state=suggestions`), `UBER BV` (lines 1618/1648/1653), `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` (line 1736) |
| Alias schema the matcher reads | `sed -n '219,236p' docs/project/4-database-model.md` | `merchant_aliases(id, merchant_id, raw_pattern, match_type, match_count)`; `match_type` is `prefix \| contains \| exact` defaulting to `prefix`; `raw_pattern` is a "Normalized fragment of the bank description"; unique on `(raw_pattern)` |
| Provenance values and their source | `sed -n '43,43p' docs/project/4-database-model.md`; `sed -n '1733p' design/mockups/mobile/index.html` | `transactions.category_source` is `auto \| user \| rule` (gap #4). The mockup's `#screen=transaction-detail&state=categorized` renders "Categoría sugerida automáticamente según el comercio" |
| Merchant "seeded vs user-created" distinction | `sed -n '216,216p' docs/project/4-database-model.md` | `merchants.user_id`: "Null = seeded; set = created by the user" — the only distinction in the schema that can separate `auto` from `rule` without inventing a new column |
| Existing purity enforcement (confirm, do not re-invent) | `sed -n '64,103p' eslint.config.mjs`; `cat packages/shared-domain/eslint.config.mjs` | `sharedDomainPurity` exists in the root config and is applied by `packages/shared-domain/eslint.config.mjs` (`export default [...rootConfig, sharedDomainPurity]`). Its `no-restricted-imports` group covers Expo, React Native, `@finanzas/mobile`, `**/apps/**` and every SQL library. **It does not cover bare `react`/`react-dom`, and nothing anywhere bans `Date.now()` or a no-arg `new Date()`** — the two AC3 gaps this plan closes |
| `Date` usage in the package today (the ban must not break existing code) | `grep -rn 'Date' packages/shared-domain/src` | **No matches.** Banning the `Date` global today costs nothing |
| Same-surface open PR — files changed | `gh pr list --state open --json number,title,headRefName`; `gh pr view 39 --json files --jq '.files[].path'` | Exactly one open PR: **#39** (item #35, `feature/35-pnpm-hoisted-layout-ci-bundle-check`). It changes `packages/shared-domain/package.json` (adds `@types/node`, `eslint` devDeps) and **creates `packages/shared-domain/src/domain-purity-lint.test.ts`**. See the three constraint rows below |
| PR #39 constraint 1 — the message string is asserted verbatim | `git show origin/feature/35-pnpm-hoisted-layout-ci-bundle-check:packages/shared-domain/src/domain-purity-lint.test.ts` | It asserts every finding contains `'@finanzas/shared-domain may not depend on the app, on Expo modules, or on any SQL library.'`. **The existing group's `message` must stay byte-identical**; new restrictions go in a *new* group object with their own message |
| PR #39 constraint 2 — the violating probe's finding count is asserted | same file | The probe `expo-sqlite` + `drizzle-orm` + `react-native` + `../../apps/mobile/src/theme` asserts `messages).toHaveLength(4)`. **A new pattern that also matches `react-native` (such as `react-*`) would produce a fifth finding and break it** — hence the explicit `react` / `react/*` / `react-dom` / `react-dom/*` list chosen below instead of `react-*` |
| PR #39 constraint 3 — the negative control, and what it forbids adding | same file | Negative control probe is `import '@finanzas/shared-utils';` + `import 'node:assert';`, asserting **zero** findings. The test file itself imports `node:child_process` and `node:path` and reads `process.execPath`. **A Node-I/O import ban or a `process` global ban mirroring `sharedUtilsPurity` would fail that file's own lint** — recorded as an explicit non-goal below |
| Consumers that must keep building | `grep -n '@finanzas/shared-domain' apps/*/package.json packages/*/package.json` | `apps/mobile` only (`docs/project/2-repo-architecture.md` line 91). `packages/shared-domain/package.json` already declares `@finanzas/shared-utils: workspace:*` — **this plan adds no dependency and does not modify that file** (PR #39 does) |
| `shared-utils` is unowned by any concurrent item | `git diff --name-only origin/develop origin/feature/35-pnpm-hoisted-layout-ci-bundle-check -- packages/shared-utils`; item #3's plan line 564 | No changes on the open PR's branch; item #3's plan states it "adds nothing to it". The two additive `shared-utils` exports below are collision-free |
| TypeScript strictness the implementer must code against | `cat tsconfig.base.json` | `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `lib: ["ES2022"]`, `isolatedModules: true`. Indexed access returns `T \| undefined` — this shapes the apportionment loop |
| Design-asset discovery | Issue #5 body has no `## Design assets` section; no tracker attachments; no `<dev-folder>/assets/` directory | The authoritative visual reference is the repository's own UI contract, `design/mockups/mobile/index.html` (AGENTS.md non-negotiable 6). The runbook's fidelity step names it and the two screens (`#screen=home`, `#screen=dashboard`) whose numbers this package produces |
| Board membership | `ensure_on_project_board 5 "Writing Plan"` (via `bash -c "source scripts/development-workflow/workflow-lib.sh && …"`) | `Board membership check: issue #5 already on project board.` |

> **Note on the mockup's own percentages.** `#screen=home` renders `Sin categorizar` as
> `$156K · 11,6%` against a `$1.352.470` total; the exact quotient of `156000 / 1352470` is
> `11,53%`, which naive rounding renders `11,5%`. The mockup's amounts are *abbreviated*
> (`$156K` is a rounded display of an unshown exact amount), so the mockup cannot be used to
> derive exact expected percentages. It is authoritative for the **granularity** (one decimal)
> and for the **sum invariant** (`67,6%` + `32,4%` = `100,0%`), and this plan derives its
> expected values from its own fixtures instead. Do not "fix" the mockup's percentages.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode` key present) — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml`: no `mode`, no `workflow_hub`, no `product_repo` section; `template.is_template: false` (line 176), so Protocol 02 Step 0 does not apply | 2026-08-02T12:50Z, `54d4390` | Current invocation items `{#3, #5, #6, #35}`; the single open PR (#39) does not change artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* ("spec/plan/feature/fix PRs target `develop`") | 2026-08-02T12:50Z, `54d4390` | Current invocation items `{#3, #5, #6, #35}`; no open PR changes branching policy | `Verified` |
| **The inclusion rule's canonical statement, and the fact that it now has a second sanctioned implementation** | `excluded_at IS NULL`, contributing `COALESCE(included_amount, amount)`. **Two** sanctioned statements after this item: the SQL fragment in `apps/mobile/src/db/fragments.ts` (item #3) for set-based queries, and the domain functions in `packages/shared-domain/src/inclusion.ts` (this item) for in-memory plain objects. A third is a review blocker | `docs/project/1-business-domain.md` Business Rule 4 (line 66-68); `docs/project/4-database-model.md` line 274-275; item #3's implementation plan Decision 9 (lines 215-236) | 2026-08-02T12:50Z, `54d4390` | Item #3 is at implementation stage in `.claude/worktrees/item-3` and owns `apps/mobile/src/db/`. **This plan writes no file under `apps/`.** The two implementations are file-disjoint and are reconciled by the shared expected-value table of Decision 2, not by cross-comparison | `Verified` |
| Files owned by concurrently running items (write-collision surface) | Item #3 owns `apps/mobile/src/db/`; item #6 owns `packages/bank-scraper/`; item #35 owns `.npmrc`, `.github/workflows/`, `pnpm-workspace.yaml`, `scripts/check-node-linker-layout.mjs`, **and `packages/shared-domain/package.json` + `packages/shared-domain/src/domain-purity-lint.test.ts`** | Parent orchestrator handoff; `git worktree list`; `gh pr view 39 --json files` | 2026-08-02T12:50Z, `54d4390` | The Files to Create / Files to Modify sections below contain no path under `apps/`, none under `packages/bank-scraper/`, and neither of item #35's two `packages/shared-domain` paths | `Verified` |
| **Shared file this plan does modify: root `eslint.config.mjs` (`sharedDomainPurity`)** | Two additive changes only: (a) a **new** `no-restricted-imports` group object for `['react', 'react/*', 'react-dom', 'react-dom/*']` with its own message, appended after the existing group; (b) a **new** `no-restricted-globals` entry banning `Date`. The existing group's `group` array and `message` string are left byte-identical, and no existing entry is renamed, removed or reordered | `eslint.config.mjs` lines 71-103 at `54d4390`; PR #39's `domain-purity-lint.test.ts` assertions (three Verification Log rows above); Decision 8 below | 2026-08-02T12:50Z, `54d4390` | PR #39 is the only open PR and is the only same-surface consumer of `sharedDomainPurity`. Its three assertions — verbatim message, `toHaveLength(4)` on the violating probe, and zero findings on the `@finanzas/shared-utils` + `node:assert` negative control — all survive the two additive changes. `react-*` was **rejected** as a pattern precisely because it would match `react-native` and break the count assertion | `Verified` |
| **Restrictions deliberately NOT added to `sharedDomainPurity`** | No Node-I/O import ban and no `process` global ban, despite `sharedUtilsPurity` carrying both and `docs/project/2-repo-architecture.md` line 91 describing this package as "no … I/O" | PR #39's `packages/shared-domain/src/domain-purity-lint.test.ts` imports `node:child_process` and `node:path` and reads `process.execPath` — legitimately, to drive the real ESLint CLI in a child process | 2026-08-02T12:50Z, `54d4390` | Adding either ban would make that incoming file fail `pnpm lint` the moment PR #39 merges. Issue #5's AC3 requires "No React, no SQL, no `expo-*`, no `Date.now()`" and does **not** require a Node-I/O ban. A rule that must be exempted on arrival is worse than no rule | `Verified` |
| Shared package this plan extends: `@finanzas/shared-utils` | Two additive exports, no behaviour change to any existing export: `differenceInDays(a, b)` in `src/dates.ts`, and `divideRoundHalfUp(numerator, denominator)` promoted from module-private to exported in `src/money.ts` with a widened, tested contract | `packages/shared-utils/src/dates.ts`, `src/money.ts` (line 103) at `54d4390`; `docs/project/2-repo-architecture.md` line 92 assigns "date/period helpers" to this package | 2026-08-02T12:50Z, `54d4390` | `git diff --name-only origin/develop origin/feature/35-pnpm-hoisted-layout-ci-bundle-check -- packages/shared-utils` is empty; item #3's plan line 564 states it "adds nothing to it"; item #6 owns `packages/bank-scraper/` only. No concurrent owner | `Verified` |
| Canonical percentage granularity established by this plan | Tenths of a percent; `PERCENTAGE_TENTHS_TOTAL = 1000` | `design/mockups/mobile/index.html` (`67,6%` + `32,4%` = `100,0%`, lines 1879-1880); no prior repository constant exists (`grep -rn 'percent' apps packages docs/project` finds no numeric convention) | 2026-08-02T12:50Z, `54d4390` | No open PR and no sibling item defines a percentage unit. Item #3's repositories return money and counts, never percentages | `Verified` |
| Clock-injection convention inherited from issue #4 | Every date/time-dependent function takes the instant (or the derived civil date) as a parameter; nothing reads the host clock | `packages/shared-utils/src/dates.ts` header, lines 14-15: "Nothing in this module calls `Date.now()` or a no-arg `new Date()`; the instant is always passed in" | 2026-08-02T12:50Z, `54d4390` | Issue #4 is merged; no open PR changes it. This plan tightens the convention for `shared-domain` (Decision 1: the clock enters as a `DateLocal` string, so the package needs no `Date` at all) | `Verified` |

No `Conflict` rows. Nothing in this check blocks implementation.

### Implementation-start re-verification (mandatory before the first file edit)

Two rows above depend on the *current* state of PR #39. Per protocol 02's implementation-start
gate, the developer must re-run these two commands before editing any file and record
`Still valid` or `Stale or conflicting`:

```bash
gh pr view 39 --json state,mergedAt,files --jq '{state, mergedAt, files: [.files[].path]}'
git show origin/develop:packages/shared-domain/src/domain-purity-lint.test.ts >/dev/null 2>&1 \
  && echo "MERGED: domain-purity-lint.test.ts is on develop" \
  || echo "NOT MERGED: domain-purity-lint.test.ts is not on develop"
```

- **`NOT MERGED`** (the state at plan time): do not create, modify or anticipate
  `packages/shared-domain/src/domain-purity-lint.test.ts`. The two new ESLint restrictions are
  verified by the runbook's planted-violation cycle (Step 5), and extending that file with
  cases for the new categories is recorded as a named follow-up below.
- **`MERGED`**: the file exists on the implementation base. Extend it with one new `describe`
  block covering the two new restriction categories, following its existing stdin-driven
  pattern. **Do not alter its existing assertions, its `SHARED_DOMAIN_MESSAGE` constant, its
  `toHaveLength(4)` count, or its `node:assert` negative control.**
- **Anything else** (the file exists but its assertions differ from those recorded above): stop
  before file edits and return the evidence to the parent orchestrator.

---

## Key Decisions

Each decision is referenced by index from the Layer-by-Layer, Testing and Implementation Order
sections. Indices are stable within this document.

**Decision 1 — the clock enters as a `DateLocal` string, and the package uses no `Date` at
all.** AC3 says "no `Date.now()` — the clock is injected". The strongest form of that is for the
package to have no reachable clock: every date-dependent function
(`countElapsedDaysInPeriod`, `summarizePeriod`) takes an `asOf: DateLocal` parameter, and the
caller produces it with `@finanzas/shared-utils`'s `deriveDateLocal(instant, timeZone)`. That
keeps the single Chilean-timezone `Intl` seam in the package issue #4 built it in, and it lets
this package's purity be enforced by banning the `Date` global outright (Decision 8) rather than
by pattern-matching two specific call shapes. `excludedAt` stays an opaque `string | null` that
is only ever compared to `null`; the domain never parses an instant.

**Decision 2 — the inclusion rule's twin is kept honest by a shared expected-value table, never
by comparing the two implementations.** `packages/shared-domain/src/inclusion.ts` exports
`INCLUSION_RULE_CASES`: a frozen array of `{ key, amount, includedAmount, excludedAt,
expectedIsIncluded, expectedEffectiveAmount, expectedContribution }` whose expected values are
**hand-derived in this plan** (see the table under *Testing Strategy → AC2*) from
`docs/project/4-database-model.md`'s "Analysis rule (single source of truth)", and copied
verbatim by the implementer. The domain tests assert the implementation **against those
literals**. Because `@finanzas/shared-domain` is already a dependency of `apps/mobile`, a later
item can have `apps/mobile/src/db/__tests__/transactions.test.ts` assert the SQL fragment
against the *same literals* — the shared artifact is the **expected numbers**, never an
implementation. Item #3's plan makes the same point from the other side ("agreement between two
consumers of one wrong fragment is not evidence"), and its own result-level assertion
independently produces `63000` from the same three-movement shape. Two implementations, two
independent assertions against one hand-derived table; matching each other is explicitly *not*
accepted as evidence by either plan.

**Decision 3 — the conceptual cross-reference is one-directional and documented, because this
plan may not write into item #3's files.** `packages/shared-domain/src/inclusion.ts` carries a
header comment that (a) quotes Business Rule 4 verbatim, (b) names
`apps/mobile/src/db/fragments.ts` as the SQL twin and states the clause-by-clause equivalence,
and (c) states that a third statement of the rule anywhere is a review blocker. The reverse
pointer (from `fragments.ts` back to here) and the update to
`docs/best-practices/STACK-SPECIFIC.md`'s "The inclusion rule is written once" bullet are listed
under **Documentation Updates** for the developer to execute; `fragments.ts` itself is item #3's
in-flight file and is not touched by this item. The equivalence table:

| SQL fragment (item #3, `apps/mobile/src/db/fragments.ts`) | Domain function (this item, `packages/shared-domain/src/inclusion.ts`) |
| --- | --- |
| `isIncluded = sql\`${t.excludedAt} is null\`` | `isIncludedInAnalysis(m) => m.excludedAt === null` |
| `includedAmount = sql\`coalesce(${t.includedAmount}, ${t.amount})\`` | `effectiveAmount(m) => m.includedAmount ?? m.amount` |
| `where(isIncluded)` + `sum(includedAmount)` | `contributedAmount(m) => isIncludedInAnalysis(m) ? effectiveAmount(m) : 0` |

SQL `COALESCE` returns the first non-`NULL` argument, so its JavaScript twin is `??` (nullish
coalescing), **not** `||`. `||` would return `amount` when `includedAmount` is `0`, which is a
real value, not an absence. `INCLUSION_RULE_CASES` carries a `partial-zero` case for exactly
this trap.

**Decision 4 — percentages are apportioned by largest remainder (Hamilton) in tenths of a
percent.** AC4 requires percentages to "sum to 100 with rounding handled explicitly". Naive
per-bucket rounding does not: three equal thirds each round to `33,3%` and sum to `99,9%`.
`apportionTenths(weights)` computes each bucket's floor quota and remainder exactly in `BigInt`
(`floorᵢ = aᵢ * 1000n / Tn`, `remᵢ = aᵢ * 1000n % Tn`), then distributes the
`1000 - Σfloorᵢ` leftover tenths one each to the buckets with the largest remainders. The unit
is tenths because that is the granularity the UI contract renders (`20,6%`), and `1000` is
exported as `PERCENTAGE_TENTHS_TOTAL`. This mirrors the deterministic-integer-arithmetic
convention issue #4 established with `divideRoundHalfUp`: exact over `BigInt`, no floats
anywhere in the path.

**Decision 5 — apportionment ties are broken by a total order, so input order never matters.**
Leftover tenths go to buckets sorted by: remainder descending, then weight descending, then
bucket key ascending (`localeCompare`-free ASCII `<`). Bucket keys are unique by construction
(one bucket per `transactionCategoryId`), so this is a total order and the result is a pure
function of the *set* of buckets. A test feeds every permutation of a three-way tie and asserts
byte-identical output. Two documented exceptions to the sum invariant, both tested: a total
weight of `0` (every bucket gets `0`, sum `0`, because there is no whole to apportion), and an
empty bucket list (empty result). Negative weights throw `RangeError` — `transactions.amount`
is "always positive" per the data model, so a negative weight is a caller bug.

**Decision 6 — merchant matching normalizes both sides and matches on token boundaries.**
`normalizeDescription(raw)` is: Unicode `NFKD` → strip combining marks (`U+0300`-`U+036F`) →
`toUpperCase()` (the locale-independent one, never `toLocaleUpperCase`) → replace every
character outside `[A-Z0-9]` with a space → collapse runs of spaces → trim. `MERPAGO*MERCADOLIBRE`
becomes `MERPAGO MERCADOLIBRE`; `FARMACIA ÑUÑOA` becomes `FARMACIA NUNOA` (Chilean bank feeds
are inconsistent about diacritics, so folding them is what makes the alias table stable); the
function is idempotent (`normalize(normalize(x)) === normalize(x)`), which is asserted for every
fixture. `merchant_aliases.raw_pattern` is documented as already normalized, but the matcher
normalizes it too — defensively, and so a seeded pattern containing a `*` cannot silently fail.

Matching then runs on the normalized strings with token boundaries enforced by space padding:

```ts
// Illustrative — adapt during implementation
const s = normalizeDescription(rawDescription);
const p = normalizeDescription(alias.rawPattern);
if (s === '' || p === '') return false;          // an empty pattern must never match anything
switch (alias.matchType) {
  case 'exact':    return s === p;
  case 'prefix':   return `${s} `.startsWith(`${p} `);
  case 'contains': return ` ${s} `.includes(` ${p} `);
}
```

Token boundaries are the point: a bare substring `contains 'UBER'` would claim
`UBERTO PANADERIA`, and a bare `prefix 'LIDER'` would claim `LIDERAZGO CAPACITACION`. A wrong
merchant produces a wrong *auto-category*, so a false positive is more expensive than a miss.
**Reversibility**: if a real bank feed later needs raw substring behaviour, the change is
deleting the two space-pads and updating the two negative tests — a bounded, one-function
change.

**Decision 7 — merchant resolution is deterministic by specificity, then length, then id.**
When several aliases match one description, `resolveMerchant` picks by: `exact` > `prefix` >
`contains`; then the **longest normalized pattern**; then the lowest `alias.id` (ASCII). This is
a total order over a set of aliases with unique ids, so the resolved merchant does not depend on
the order the caller passed them in — asserted by a shuffled-input test. `resolveMerchant`
returns `null` when nothing matches; it never guesses.

**Decision 8 — the two AC3 gaps are closed in `sharedDomainPurity`, additively, within the
constraints PR #39 imposes.** The existing rule already bans Expo, React Native,
`@finanzas/mobile`, `**/apps/**` and every SQL library, and
`packages/shared-domain/eslint.config.mjs` already applies it — that is confirmed, not
re-invented. Two gaps remain against AC3, and each gets one additive entry:

1. Bare `react` / `react-dom` are not covered. A **new group object** is appended to the same
   `patterns` array with `group: ['react', 'react/*', 'react-dom', 'react-dom/*']` and its own
   message. `react-*` is deliberately **not** used: it would also match `react-native`, which
   the existing group already matches, producing two findings for one import and breaking PR
   #39's `expect(messages).toHaveLength(4)`.
2. Nothing bans the clock. A **new `no-restricted-globals` entry** bans the `Date` global
   (`checkGlobalObject: true`, so `globalThis.Date` is caught too). Banning the whole global —
   rather than pattern-matching `Date.now()` and `new Date()` — is possible only because
   Decision 1 leaves the package with no legitimate use for it, and `grep -rn 'Date'
   packages/shared-domain/src` confirms there is none today. Tests use
   `jest.setSystemTime(<epoch ms number>)` rather than `setSystemTime(new Date(...))` so they
   comply with the rule they exist to verify.

   **Fallback, if `no-restricted-globals` proves not to fire on `Date` under this ESLint /
   typescript-eslint version** (the runbook's planted-violation cycle is what determines this,
   empirically, not assumption): replace it with two `no-restricted-syntax` selectors —
   `NewExpression[callee.name='Date'][arguments.length=0]` and
   `MemberExpression[object.name='Date'][property.name='now']` — and record the substitution in
   the PR description. Either mechanism satisfies AC3; the plan does not assume which one the
   toolchain honours.

Not added, with evidence: a Node-I/O import ban and a `process` global ban. See the
*Restrictions deliberately NOT added* row of the Cross-Cutting Operational Assumption Check.

**Decision 9 — direction comes from `type`, not from the category's `income` flag.**
`transactions.type` is `debit | credit`, the scraper's own vocabulary, and it is immutable bank
fact; `transaction_categories.income` is a taxonomy attribute that drives the tabs in
`#screen=settings-categories`. A movement's `MovementDirection` is therefore `debit → 'expense'`
and `credit → 'income'`, computed by `movementDirection(m)`. A debit filed under an income
category is a *mis-categorization*, not an income; it stays on the expense side and appears in
the expense breakdown under that category. `summarizePeriod` computes the two breakdowns
independently over the two direction partitions, which is what `#screen=dashboard` renders (a
`$1.352.470` expense donut and a `$3.700.000` income donut, each summing to 100% on its own).

**Decision 10 — uncategorized movements are a bucket, not a filter.** `#screen=home` renders
`Sin categorizar` as a category row with its own amount, count and percentage. The breakdown
therefore keys buckets by `transactionCategoryId: string | null`, with the `null` bucket
carrying every included movement that has no category. Buckets sort by total descending, then by
`transactionCategoryId` ascending, with the `null` bucket last among equals. This is also what
mechanizes Business Rule 6 ("categorization is never mandatory"): an uncategorized movement is
never silently dropped from a total.

**Decision 11 — a category whose every movement is excluded produces no bucket.** Buckets are
built only from movements that pass `isIncludedInAnalysis`. A category with three excluded
movements and nothing else would otherwise render as a `$0 · 0,0%` row that the mockup never
shows. Exclusion stays *visible* at the summary level instead: `PeriodTotals` carries
`excludedCount` alongside `includedCount`, which is how Business Rule 3 ("bank data is never
deleted, only excluded") is observable in this package rather than merely respected.

**Decision 12 — the daily average is over elapsed days, and it is `null` rather than a lie when
there are none.** `#screen=categorize-complete` renders "Gasto diario promedio … este mes", a
month-to-date figure. `countElapsedDaysInPeriod(period, asOf)` returns the inclusive day count
from `period.start` to `min(asOf, period.end)`, clamped to `0` when `asOf < period.start`.
`dailyAverage(total, dayCount)` throws `RangeError` when `dayCount < 1` — dividing by zero days
is a caller bug, not a value — and `summarizePeriod` returns `dailyAverageExpense: null` in that
case rather than calling it. Rounding is half-up over `BigInt` via the promoted
`divideRoundHalfUp`.

**Decision 13 — period-over-period deltas are signed tenths, and `null` when there is no
baseline.** `computePeriodDelta(currentTotal, previousTotal)` returns
`{ currentTotal, previousTotal, absoluteDelta, percentageTenths }`. `absoluteDelta` is
`current - previous` (signed minor units). `percentageTenths` is the signed half-away-from-zero
rounding of `(current - previous) * 1000 / previous`, computed as `divideRoundHalfUp` on the
magnitude and then re-signed — the same half-away-from-zero convention
`formatClpAbbreviated` already uses. When `previousTotal === 0`, `percentageTenths` is `null`
(there is no percentage change from nothing), and the caller renders the absolute figure
instead. The domain returns tenths even though the mockup displays deltas with zero decimals;
display precision is a formatting decision that belongs to the caller, and returning one unit
everywhere avoids two percentage conventions in one package.

**Decision 14 — category suggestion never overrides a human, and `rule` means "the merchant
default the user configured".** `suggestCategory` returns `null` when
`currentCategorySource === 'user'`, no matter what the merchant says: Business Rule 6 and the
mockup's distinction between "Categoría sugerida automáticamente" and a user-confirmed category
both require it. Otherwise it returns the resolved merchant's `transactionCategoryId` with
`source: merchant.isUserDefined ? 'rule' : 'auto'`, where `isUserDefined` maps to
`merchants.user_id !== null` — the data model's own "Null = seeded; set = created by the user"
distinction, and the only signal in the schema that separates the three provenance values
without inventing a column. It returns `null` when no merchant resolved or the merchant has no
default. It never mutates; persistence is the app's decision.

> **Open question for the human (low risk, reversible, default chosen).** The `auto` / `rule`
> split above is the least-inventive reading of a three-valued column the mockup only ever
> renders two ways. If `rule` should instead be reserved for a future explicit rules engine, the
> change is one ternary and one test — `suggestCategory` would always emit `auto` in the MVP.
> The plan proceeds with the seeded-vs-user-configured reading; flag it at plan review if the
> other reading is intended.

**Decision 15 — Business Rules 5 and 7 are named as owned elsewhere rather than reimplemented
here.** Business Rule 5 (re-sync idempotency) is `apps/mobile/src/db/dedup.ts` +
`upsertBankTransactions` (item #3, Decision 14/15). Business Rule 7 (deleting a category
re-parents to ✨ Otros) is `apps/mobile/src/db/repositories/categories.ts`'s transactional
`deleteCategory` plus a database trigger (item #3, Decision 16, AC8-AC10). Adding a domain twin
for either would create a second statement of a rule that already has exactly one — the same
anti-pattern the inclusion-rule scanner exists to prevent. AC1 is satisfied by the **Business
Rule coverage matrix** below, which maps all nine rules to either a named test in this package
or a named owner elsewhere with the reason.

**Decision 16 — domain types are defined here now; promoting `apps/mobile/src/db/types.ts` is a
named follow-up, not this item.** Item #3's plan states its types "live beside their
repositories in `apps/mobile/src/db/types.ts` until a later item promotes them; promoting them
is a pure move with no schema consequence". Item #3 is mid-implementation in a parallel
worktree, so editing that file now is a write collision. This item defines the canonical types
in `packages/shared-domain/src/types.ts` per
[`../../../best-practices/stack/typescript.md`](../../../best-practices/stack/typescript.md)
("Domain types are defined once, in `@finanzas/shared-domain`, and re-exported"), and accepts a
**documented, temporary duplication** of the four literal unions (`CategorySource`,
`ReviewFlag`, `ExclusionReason`, and the alias `match_type`) across the two packages until the
promotion lands. The reconciliation is listed under Documentation Updates and in the Risks
table; the parent orchestrator should file it as a follow-up item.

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **None.** This package may not import any SQL library (`sharedDomainPurity`), touches no
      migration and no seed, and writes no file under `apps/`. The SQL statement of the
      inclusion rule stays exactly where item #3 put it (Decision 3).

### Backend / API

- [ ] **None.** The product has no backend (AGENTS.md, "There is no backend").

### Shared Packages / Libraries

**`@finanzas/shared-domain` — the substance of this item.**

- [ ] `src/types.ts` — the canonical domain types (Decision 16). `MovementType`
      (`'debit' | 'credit'`), `MovementDirection` (`'expense' | 'income'`), `CategorySource`
      (`'auto' | 'rule' | 'user'`), `ReviewFlag` (`'review_later' | 'uncertain'`),
      `ExclusionReason` (`'personal_transfer' | 'shared_expense' | 'not_relevant' |
      'cash_withdrawal' | 'other'`), `MerchantMatchType` (`'prefix' | 'contains' | 'exact'`),
      and the interfaces `Movement`, `Merchant`, `MerchantAlias`, `TransactionCategory`. The
      inclusion functions take `MovementInclusionFields =
      Pick<Movement, 'amount' | 'includedAmount' | 'excludedAt'>` so the field shape is defined
      once and cannot drift. `DateLocal` and `Period` are **type-only re-exports** from
      `@finanzas/shared-utils`, so a screen importing domain types needs one import site; the
      *values* that build them stay in `shared-utils`.
- [ ] `src/inclusion.ts` — `isIncludedInAnalysis`, `effectiveAmount`, `contributedAmount`, and
      the `INCLUSION_RULE_CASES` specification artifact (Decisions 2, 3). Header comment quotes
      Business Rule 4 verbatim, names `apps/mobile/src/db/fragments.ts` as the SQL twin with the
      clause-by-clause equivalence table, and states that a third statement is a review blocker.
- [ ] `src/merchant-matching.ts` — `normalizeDescription`, `aliasMatches(description, alias)`,
      `resolveMerchant(description, aliases): MerchantMatch | null` (Decisions 6, 7).
      `MerchantMatch` is `{ merchantId, aliasId, matchType, normalizedDescription,
      normalizedPattern }`.
- [ ] `src/category-suggestion.ts` — `suggestCategory(input): CategorySuggestion | null`
      (Decision 14). `CategorySuggestion` is `{ transactionCategoryId, source }`.
- [ ] `src/apportionment.ts` — `PERCENTAGE_TENTHS_TOTAL = 1000` and
      `apportionTenths(entries: readonly { key: string; weight: number }[]):
      Map<string, number>` (Decisions 4, 5). No knowledge of movements or categories; it
      apportions integers.
- [ ] `src/aggregates.ts` — `movementDirection`, `countDaysInPeriod`,
      `countElapsedDaysInPeriod`, `dailyAverage`, `computePeriodDelta`, `buildCategoryBreakdown`
      and `summarizePeriod` (Decisions 9-13). Result types `PeriodTotals`, `CategoryBucket`,
      `CategoryBreakdown`, `PeriodDelta`, `PeriodSummary`. `summarizePeriod` filters its input
      to the period by lexicographic `DateLocal` comparison (`period.start <= dateLocal <=
      period.end` — valid because `YYYY-MM-DD` sorts lexicographically) so an over-fetching
      caller cannot corrupt a total.
- [ ] `src/index.ts` — re-export every module. **`PACKAGE_NAME` stays exported verbatim**;
      `apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it.
- [ ] Test files — see **Testing Strategy**.

**`@finanzas/shared-utils` — two additive exports, no behaviour change.**

- [ ] `src/dates.ts` — add `differenceInDays(from: DateLocal, to: DateLocal): number`, the
      signed inclusive-exclusive day difference over the existing pure UTC civil-date
      arithmetic (`differenceInDays('2025-01-01', '2025-01-31') === 30`). It belongs here, not
      in `shared-domain`: `docs/project/2-repo-architecture.md` line 92 assigns "date/period
      helpers" to this package, and keeping it here is what lets `shared-domain` ban the `Date`
      global outright (Decision 1). Throws `RangeError` on an invalid `DateLocal`, via the
      existing `parseDateLocal`.
- [ ] `src/money.ts` — promote the existing module-private `divideRoundHalfUp(numerator,
      denominator)` to an export, widening its documented contract from "one of this module's
      two compile-time constants" to "any positive integer denominator, non-negative integer
      numerator", and adding tests for odd denominators. The implementation does not change:
      with an odd `d`, an exact `n/d = k + 0.5` tie is arithmetically impossible for integer
      `n`, so the truncating `BigInt(d) / 2n` loses nothing. No existing call site changes.

**`packages/shared-domain/package.json` — not modified.** No new dependency is needed
(`@finanzas/shared-utils: workspace:*` is already declared) and PR #39 is editing that file.

**`packages/bank-scraper` — untouched.**

### Frontend / UI

- [ ] **None.** This item ships no screen and no component. It produces the numbers that
      `#screen=home`, `#screen=dashboard`, `#screen=categorize-complete`,
      `#screen=transaction-detail` and `#screen=merchant-edit` will render in later items; the
      smoke runbook's fidelity step compares those numbers against the mockup, not a rendered
      screen.

### Infrastructure / Configuration

- [ ] `eslint.config.mjs` (repo root) — two additive changes to the `sharedDomainPurity` export
      only (Decision 8): one new `no-restricted-imports` group object for React, and one new
      `no-restricted-globals` entry for `Date`. The existing group's patterns and message string
      are byte-identical afterwards. `sharedUtilsPurity` and the default shared config array are
      untouched.
- [ ] **Executable shell guidance**: this plan adds no executable shell guidance on a
      framework-owned surface. The runbook's commands are ordinary `pnpm` / `grep` invocations
      with no iteration and no positional-argument splitting, so no shell contract
      (`bash` / `bash-zsh`) declaration and no snippet-linter run apply.

---

## Testing Strategy

**Test types**: Unit (Jest, `ts-jest`, `testEnvironment: node`) + a command-line smoke runbook.
No integration tier and no device tier: the package has no I/O, no database and no UI.

Every test file lives beside its module in `packages/shared-domain/src/`, matching the existing
`index.test.ts` convention and `docs/project/3-software-architecture.md`'s testing table
(`packages/shared-domain/**/*.test.ts` — "Every rule in 1-business-domain.md. Mandatory").

### Evidence standard applied to every check in this plan

For every check this plan proposes — the two new ESLint restrictions, the percentage-sum
invariant, the clock-injection guard, and the exported-surface guard — the verification is a
**clean → planted violation fails at a named assertion → violation removed → clean again**
cycle, and the implementer pastes the captured output of all four phases into the PR
description. For the checks that are **pattern-matching** (the two ESLint restrictions, the
merchant matcher, the exported-surface guard) both a **positive** and a **negative** case are
required, so the check is shown not to over-fire as well as to fire. Plain arithmetic unit tests
(apportionment, deltas, daily average, the inclusion rule) need only the assertion against their
hand-derived expected value; they have nothing to over-fire on.

Concretely, per check:

| Check | Positive case | Negative case | Planted-violation cycle |
| --- | --- | --- | --- |
| `no-restricted-imports` React group | `import 'react';` in a scratch file under `packages/shared-domain/src/` → `pnpm --filter @finanzas/shared-domain lint` fails naming the React message | `import '@finanzas/shared-utils';` and `import 'node:assert';` → lint passes with zero findings | Runbook Step 5 (or the extended `domain-purity-lint.test.ts` if PR #39 has merged — see the implementation-start re-verification) |
| `no-restricted-globals` `Date` | `const t = Date.now();` and `const d = new Date();` → lint fails, once per occurrence | A file using only `DateLocal` strings → lint passes | Runbook Step 5 |
| Percentage-sum invariant | Every fixture in `apportionment.test.ts` asserts `Σ === 1000` | The two documented exceptions (`totalWeight === 0` → sum `0`; empty input → empty map) assert the invariant is *not* claimed where it does not hold | `apportionment.test.ts` — flip the leftover distribution to a naive `Math.round` and confirm the three-equal-thirds case fails at `expect(sum).toBe(1000)` |
| Clock injection | `clock-injection.test.ts` runs the full aggregate fixture under two wildly different fake system times and asserts byte-identical output | The same fixture under no fake timers produces the same output — proving the fake timer is not itself the thing making it deterministic | Insert `dayCount` derived from the system clock into `summarizePeriod` and confirm the test fails at the named `toEqual` |
| Exported-surface guard | An export named `credentialHelper` added to `index.ts` → `domain-surface.test.ts` fails naming it | The real export list (`isIncludedInAnalysis`, `summarizePeriod`, …) passes | Runbook Step 6 |

### Business Rule coverage matrix (AC1)

Nine rules, 0-8, enumerated live at plan time (Verification Log). Re-run
`grep -nE '^[0-9]+\. \*\*' docs/project/1-business-domain.md` at implementation time and confirm
the count is still 9 before claiming AC1; that grep output is the residual evidence.

| Rule | Covered by | Test |
| --- | --- | --- |
| 0. No account, no sign-in | **This package, by absence** — no identity, session or account type exists, and the exported surface is asserted to contain no such name | `domain-surface.test.ts` — `Object.keys(await import('./index'))` matches none of `/password\|credential\|secret\|token\|session\|auth\|rut/i` |
| 1. Credentials never leave the device | **This package, by absence** — no function accepts a credential and no thrown message interpolates its input | `domain-surface.test.ts` (same assertion) + `inclusion.test.ts` / `merchant-matching.test.ts` assert every thrown message is a fixed sentence containing no input value |
| 2. One RUT per user | **This package, by absence** — the RUT lives in `expo-secure-store` and its helpers live in `@finanzas/shared-utils`; no domain type carries it | `domain-surface.test.ts` (the `/rut/i` branch of the same assertion) |
| 3. Bank data is never deleted, only excluded | **This package** — exclusion is a state, not a removal; an excluded movement stays in the input and stays counted in `excludedCount` | `aggregates.test.ts` — `summarizePeriod` over Fixture A returns `excludedCount: 1` while `expenseTotal` omits that movement's amount |
| 4. Counts when `excluded_at IS NULL`, at `COALESCE(included_amount, amount)` | **This package** — the core of the item (Decisions 2, 3) | `inclusion.test.ts` (all seven `INCLUSION_RULE_CASES`) + `aggregates.test.ts` (the AC2 fixtures below) |
| 5. Re-syncing is idempotent | **`apps/mobile/src/db/`** (item #3, `dedup.ts` + `upsertBankTransactions`). Decision 15: a domain twin would be a second statement of a rule that already has one | Item #3's `transactions.test.ts`; named here, not reimplemented |
| 6. Categorization is never mandatory | **This package** — an uncategorized movement is a bucket, never a drop (Decision 10), and `suggestCategory` never forces a value and never overrides `user` (Decision 14) | `aggregates.test.ts` (Fixture C's `null` bucket) + `category-suggestion.test.ts` (`currentCategorySource: 'user'` → `null`) |
| 7. Deleting a category re-parents to ✨ Otros | **`apps/mobile/src/db/repositories/categories.ts`** (item #3, Decision 16, AC8-AC10). Decision 15 | Item #3's `categories.test.ts`; named here, not reimplemented |
| 8. Amounts are integers in minor units | **This package** — every money input is validated with `isValidMoneyMinorUnits` from `@finanzas/shared-utils` and a non-integer throws `TypeError`; every returned money value is an integer | `inclusion.test.ts`, `aggregates.test.ts`, `apportionment.test.ts` — non-integer and non-safe-integer inputs throw; every returned total, average and delta satisfies `Number.isSafeInteger` |

### AC2 — excluded and partially-included movements are honoured by every aggregate

**This is the blocking criterion of the item.** Partial inclusion has no UI in the MVP, so
`included_amount` is always `null` in the shipping app today — but that is a *UI-layer* fact.
The rule is general, and if the partial branch is not asserted on a real computed number now, it
ships unverified and stays unverified until the day partial inclusion lands. The tests below
assert the arithmetic, not the presence of a field.

**`INCLUSION_RULE_CASES` — the hand-derived expected-value table (Decision 2).** Every value is
derived from `COALESCE(included_amount, amount)` gated by `excluded_at IS NULL`, by hand, at
plan time. The implementer copies these literals verbatim into
`packages/shared-domain/src/inclusion.ts`; they are never computed from the implementation.

| `key` | `amount` | `includedAmount` | `excludedAt` | `expectedIsIncluded` | `expectedEffectiveAmount` | `expectedContribution` | Why this case exists |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `full` | `42000` | `null` | `null` | `true` | `42000` | `42000` | The ordinary MVP case |
| `partial` | `42000` | `21000` | `null` | `true` | `21000` | **`21000`** | **The blocking gate: a non-null, computed `included_amount` contributing its own value, not the full one** |
| `partial-zero` | `42000` | `0` | `null` | `true` | `0` | `0` | `??` vs `\|\|`: `0` is a real partial amount, not an absence. `\|\|` would wrongly yield `42000` |
| `partial-equal` | `42000` | `42000` | `null` | `true` | `42000` | `42000` | A partial equal to the full amount must not be special-cased |
| `excluded` | `15000` | `null` | `'2025-01-21T10:00:00Z'` | `false` | `15000` | `0` | Exclusion zeroes the contribution while `effectiveAmount` is still well-defined |
| `excluded-partial` | `42000` | `21000` | `'2025-01-21T10:00:00Z'` | `false` | `21000` | `0` | Exclusion wins over a set partial — the two clauses are independent |
| `zero-amount` | `0` | `null` | `null` | `true` | `0` | `0` | A zero movement is *included* and contributes nothing; `isIncludedInAnalysis` must not be inferred from the amount |

`inclusion.test.ts` iterates the table with one `it(...)` per case per function
(`isIncludedInAnalysis`, `effectiveAmount`, `contributedAmount`), asserting `toBe` against the
literal.

**Fixture A — the aggregate-level blocking-gate assertion.** Period
`{ start: '2025-01-01', end: '2025-01-31' }`, `asOf: '2025-01-29'`, all `type: 'debit'`:

| id | `dateLocal` | `transactionCategoryId` | `amount` | `includedAmount` | `excludedAt` | Contributes |
| --- | --- | --- | --- | --- | --- | --- |
| `m1` | `2025-01-05` | `comida` | `42000` | `null` | `null` | `42000` |
| `m2` | `2025-01-12` | `compras` | `42000` | `21000` | `null` | **`21000`** |
| `m3` | `2025-01-20` | `salud` | `15000` | `null` | `2025-01-21T10:00:00Z` | `0` |

`summarizePeriod` over Fixture A asserts, as literal numbers:

- `totals.expenseTotal` is **`63000`** — that is `42000 + 21000`. The partially included
  movement contributed **`21000`**, not `42000`; the excluded movement contributed nothing and
  its `15000` appears nowhere in the result.
- `totals.includedCount` is `2`, `totals.excludedCount` is `1`, `totals.incomeTotal` is `0`.
- `expenseBreakdown.buckets` has length **`2`**, and no bucket has
  `transactionCategoryId === 'salud'` (Decision 11).
- `comida`: `{ total: 42000, movementCount: 1, percentageTenths: 667 }`;
  `compras`: `{ total: 21000, movementCount: 1, percentageTenths: 333 }`. Derivation:
  `42000 * 1000 / 63000 = 666.66…` → floor `666`, remainder `42000`;
  `21000 * 1000 / 63000 = 333.33…` → floor `333`, remainder `21000`;
  `1000 - (666 + 333) = 1` leftover tenth goes to the larger remainder (`comida`) → `667` and
  `333`, summing to `1000`.
- `dailyAverageExpense` is **`2172`**. Derivation: elapsed days from `2025-01-01` to
  `2025-01-29` inclusive is `29`; `63000 / 29 = 2172.41…`; `2172 * 29 = 62988`, leftover `12`,
  and `12 / 29 < 0.5`, so half-up gives `2172`.

`63000` is also the number item #3's `totalForCategoryInPeriod` test asserts for the same
three-movement shape. **That agreement is not evidence and is not asserted anywhere.** Both
numbers are derived independently from the hand-computed table above; if the SQL fragment and
the domain function were both wrong in the same way they would still agree, which is exactly why
each side asserts against the literal rather than against the other.

**Fixture B — no partial, to prove the partial branch is not load-bearing for the ordinary
case.** Fixture A with `m2.includedAmount` set to `null`: `expenseTotal` becomes `84000` and
`comida` / `compras` both become `500` tenths. Two fixtures differing in exactly one field, with
different asserted totals, is the canary that `includedAmount` is actually read.

**Fixture C — the uncategorized bucket (Business Rule 6, Decision 10).** Fixture A plus `m4`
(`2025-01-25`, `transactionCategoryId: null`, `amount: 21000`, not excluded):
`expenseTotal` `84000`; three buckets — `comida` `42000` → `500`, `compras` `21000` → `250`,
`null` `21000` → `250` (all exact quotients, no leftover); `uncategorizedCount` `1`;
`dailyAverageExpense` **`2897`** (`84000 / 29 = 2896.55…`; `2896 * 29 = 83984`, leftover `16`,
`16 / 29 ≥ 0.5` → half-up `2897`). Bucket order: `comida`, then `compras`, then the `null`
bucket last among the tied `21000` totals.

**Fixture D — apportionment tie-break determinism (Decision 5).** Three included expense
movements of `1000` each in `comida`, `compras`, `salud`. Each quota is
`1000 * 1000 / 3000 = 333.33…` → floor `333`, remainder `1000`; `Σfloor = 999`, one leftover
tenth, all three remainders and weights equal → the key-ascending tie-break gives it to
`comida`. Result `334 / 333 / 333`, summing to `1000`. All six input permutations produce
byte-identical output.

**Fixture E — period-over-period deltas (Decision 13).** `computePeriodDelta` cases:
`(88000, 100000)` → `{ absoluteDelta: -12000, percentageTenths: -120 }` (`-12,0%`);
`(3200, 3000)` → `{ absoluteDelta: 200, percentageTenths: 67 }` (`200 * 1000 / 3000 = 66.66…`,
half-up `67`); `(2001, 2000)` → `percentageTenths: 1` (exactly `0.5`, half-away-from-zero rounds
up); `(0, 80000)` → `{ absoluteDelta: -80000, percentageTenths: -1000 }` (`-100,0%`);
`(50000, 0)` → `{ absoluteDelta: 50000, percentageTenths: null }`; `(0, 0)` →
`{ absoluteDelta: 0, percentageTenths: null }`.

**Fixture F — day counts and the daily average (Decision 12).**
`countDaysInPeriod({ start: '2025-01-01', end: '2025-01-31' })` → `31`;
February 2024 → `29`, February 2025 → `28`;
`countElapsedDaysInPeriod(jan2025, '2025-01-29')` → `29`;
`countElapsedDaysInPeriod(jan2025, '2025-02-14')` → `31` (clamped to the period end);
`countElapsedDaysInPeriod(jan2025, '2024-12-31')` → `0`;
`dailyAverage(63000, 0)` throws `RangeError`; `summarizePeriod` with `asOf` before the period
start returns `dailyAverageExpense: null`.

**Period-boundary filtering.** A movement on `period.start` and one on `period.end` are both
included; one on `2024-12-31` and one on `2025-02-01` are both excluded from every figure. This
is what proves the lexicographic `DateLocal` comparison `summarizePeriod` filters with (see its
Layer-by-Layer entry) is correct.

### AC3 — no React, no SQL, no `expo-*`, no `Date.now()`; the clock is injected

Three layers, each independently verified:

1. **Existing, confirmed:** `packages/shared-domain/eslint.config.mjs` spreads
   `sharedDomainPurity` from the root config, whose `no-restricted-imports` group already covers
   Expo, React Native, `@finanzas/mobile`, `**/apps/**` and every SQL library. This is confirmed
   by reading both files (Verification Log), not re-invented. It is wired into the package's own
   lint run — `pnpm --filter @finanzas/shared-domain lint` — and the runbook proves it fires
   with a planted `import 'drizzle-orm';`.
2. **New, this item:** the React group and the `Date` global ban (Decision 8), each verified by
   the planted-violation cycle in runbook Step 5.
3. **Behavioural, this item:** `clock-injection.test.ts`. Every exported function is a pure
   function of its arguments, so the strongest available evidence is that the full Fixture A / C
   aggregate output is byte-identical (`toEqual`) under two deliberately hostile fake system
   times — `jest.useFakeTimers(); jest.setSystemTime(1735689600000)` (`2025-01-01T00:00:00Z`)
   and `jest.setSystemTime(2208988800000)` (`2040-01-01T00:00:00Z`) — and identical again with
   no fake timers at all. The epoch-millisecond **number** form of `setSystemTime` is used
   deliberately: `setSystemTime(new Date(...))` would itself violate the `Date` ban this test
   exists to support. The whole suite additionally runs green under
   `TZ=Pacific/Kiritimati`, `TZ=UTC` and `TZ=America/Santiago`, mirroring issue #4's runbook
   Step 2.

### AC4 — percentages sum to 100 with rounding handled explicitly

`apportionment.test.ts`, over `apportionTenths`:

- **Sum invariant**, asserted on every non-degenerate fixture: `Σ === PERCENTAGE_TENTHS_TOTAL`
  (`1000`). Fixtures include the three-equal-thirds case that naive rounding gets wrong
  (`334/333/333`), Fixture A's `667/333`, Fixture C's `500/250/250`, a seven-bucket case, a
  1000-bucket case built by a documented deterministic generator, and the mockup-shaped
  five-bucket expense distribution.
- **The two documented exceptions**, asserted explicitly so the invariant is not silently
  over-claimed: total weight `0` → every bucket `0`, sum `0`; empty input → empty map.
- **Zero-weight buckets never take a leftover tenth ahead of a positive-remainder bucket** — a
  three-bucket case with weights `1000 / 1000 / 0`.
- **Exactness**: a case whose quotients are exact (`500/250/250`) distributes no leftover at all;
  a case designed so that a `Number`-based (float) implementation would drift — weights near
  `Number.MAX_SAFE_INTEGER / 1000` — still sums to `1000`, proving the `BigInt` path.
- **Determinism**: every permutation of a fully tied input yields identical output (Fixture D).
- **Guards**: a negative weight throws `RangeError`; a non-integer weight throws `TypeError`;
  duplicate keys throw `RangeError` (they would silently merge otherwise).

### Merchant matching and category suggestion (brief Scope bullets 2 and 3)

`merchant-matching.test.ts` and `category-suggestion.test.ts`. The full edge-case enumeration
and its test mapping are in the parser-risk addendum below.

### Parser-risk addendum

**Classification: applies (conservatively).** None of protocol 02's three deterministic signals
fires cleanly — there is no file under `scripts/lint/` or `scripts/parse/`, no module named
`*lint*` / `*parser*` / `*scanner*`, and no scanning of markdown, code, config or logs. But
`merchant-matching.ts` is normalization plus three rule-driven strategies over free-form
third-party text, which is the risk profile the addendum exists for, and the cost of applying it
is one table. It is applied.

**Edge-case enumeration — `normalizeDescription`.** Every row is one `it(...)` in
`merchant-matching.test.ts`:

| Input | Expected output | What it covers |
| --- | --- | --- |
| `'MERPAGO*MERCADOLIBRE'` | `'MERPAGO MERCADOLIBRE'` | The `*` separator the mockup actually shows |
| `'MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO'` | unchanged | An already-normalized string is a fixed point |
| `'  compra   lider  express '` | `'COMPRA LIDER EXPRESS'` | Case folding, leading/trailing space, runs of spaces |
| `'FARMACIA ÑUÑOA'` | `'FARMACIA NUNOA'` | `Ñ` → `N` (boundary character; Chilean feeds are inconsistent) |
| `'CAFÉ ALTURA'` | `'CAFE ALTURA'` | Accented vowel |
| `'SUSHI EXPRESS'` | `'SUSHI EXPRESS'` | Non-breaking space is punctuation-class, not a letter |
| `'PAGO-SERVICIO/AGUA'` | `'PAGO SERVICIO AGUA'` | **Multiple separators on one string** |
| `'TRANSFERENCIA A JUAN P.'` | `'TRANSFERENCIA A JUAN P'` | Trailing punctuation must not leave a trailing space |
| `'***'` | `''` | An all-punctuation string normalizes to empty |
| `''` | `''` | Empty input |
| `'   '` | `''` | Whitespace-only input |
| `'UBER BV 1234'` | `'UBER BV 1234'` | Digits survive; they are legitimate alias content |
| `normalize(normalize(x))` for every row above | `normalize(x)` | **Idempotence**, asserted as a loop over the whole table |

**Edge-case enumeration — `aliasMatches`.** Positive and negative for each strategy:

| `matchType` | Pattern | Description | Expected | What it covers |
| --- | --- | --- | --- | --- |
| `exact` | `ML CHILE SPA` | `ML CHILE SPA` | `true` | The happy path |
| `exact` | `ML CHILE SPA` | `ML CHILE SPA LTDA` | `false` | **Negative lookalike**: exact is not a prefix |
| `prefix` | `MERCADOLIBRE COMPRA` | `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO` | `true` | The mockup's own alias and description |
| `prefix` | `MERCADOLIBRE COMPRA` | `MERCADOLIBRE COMPRA` | `true` | A prefix equal to the whole string |
| `prefix` | `LIDER` | `LIDERAZGO CAPACITACION` | **`false`** | **Negative lookalike**: token boundary, not raw `startsWith` |
| `contains` | `LIDER` | `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` | `true` | The mockup's own description |
| `contains` | `UBER` | `UBER BV` | `true` | Boundary at the start of the string |
| `contains` | `UBER` | `UBERTO PANADERIA` | **`false`** | **Negative lookalike**: token boundary, not raw `includes` |
| `contains` | `MERCADOLIBRE` | `MERPAGO*MERCADOLIBRE` | `true` | Normalization creates the boundary the raw string lacked |
| `contains` | `PEDRO DE VALDIVIA` | `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` | `true` | **Multi-token pattern**, boundary on both ends |
| `contains` | `CL` | `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` | `true` | Boundary at the end of the string |
| any | `''` (or `'***'`) | any non-empty | **`false`** | An empty pattern must never match everything |
| any | any non-empty | `''` | `false` | An empty description matches nothing |

**Edge-case enumeration — `resolveMerchant` (overlapping and ambiguous matches).**

| Aliases | Description | Expected | What it covers |
| --- | --- | --- | --- |
| `a1{exact, 'ML CHILE SPA', m1}`, `a2{contains, 'ML', m2}` | `ML CHILE SPA` | `m1` via `a1` | Specificity: `exact` beats `contains` |
| `a1{prefix, 'MERCADOLIBRE', m2}`, `a2{prefix, 'MERCADOLIBRE COMPRA', m1}` | `MERCADOLIBRE COMPRA ONLINE` | `m1` via `a2` | **Overlapping constructs**: longest pattern wins within one strategy |
| `a1{prefix, 'MERCADOLIBRE', m2}`, `a2{exact, 'MERCADOLIBRE COMPRA ONLINE', m1}` | `MERCADOLIBRE COMPRA ONLINE` | `m1` via `a2` | Specificity beats length |
| `a2{contains, 'UBER', m2}`, `a1{contains, 'UBER', m1}` | `UBER BV` | `m1` via `a1` | Full tie → lowest `aliasId`; asserted with the array passed in both orders |
| the four-alias set above, all 24 permutations | `ML CHILE SPA` | identical result every time | **Input order never affects the result** |
| any alias set | `'***'` | `null` | No match is a `null`, never a guess |
| `[]` | `UBER BV` | `null` | Empty alias table |

**Unit test mapping.** Every row of all three tables above is one `it(...)` in
`packages/shared-domain/src/merchant-matching.test.ts`. No row is covered by a smoke step alone.

**Suppression semantics.** **Not applicable.** Nothing in this package supports, recognizes or
should recognize an inline directive: there is no scanner, no rule engine over source text, and
no finding to suppress. The one thing a contributor might want to suppress — the
`sharedDomainPurity` lint rule — is explicitly forbidden by
[`../../../best-practices/stack/typescript.md`](../../../best-practices/stack/typescript.md)
("Do not add an eslint-disable to work around it — it is the boundary that keeps the domain
testable in milliseconds").

### Concurrent-event-source addendum

**Classification: does not apply.** None of protocol 02's three signals fires: every exported
function is synchronous and returns a value; there is no listener, socket callback, timer, async
queue or Promise anywhere in the package; there is no module-level mutable state (the one
module-level value, `INCLUSION_RULE_CASES`, is a frozen constant); and there is no
initialization or teardown sequence to race with. There is nothing to guard, deduplicate, clean
up or propagate across an async boundary. Recorded here rather than omitted so a reviewer can
see the classification was performed.

### Residual verification strategy

AC1 ("every business rule … has a test") is a pattern-completeness claim over a list that lives
outside this plan. The residual strategy is:

- **Evidence source**: the live output of
  `grep -nE '^[0-9]+\. \*\*' docs/project/1-business-domain.md`, re-run at implementation time
  and pasted into the PR description alongside the Business Rule coverage matrix.
- **Acceptance**: the count must still be **9** (rules 0-8) and every returned line number must
  appear in the matrix. If the count has changed, the new rule is either added to the matrix
  with a test or recorded as owned elsewhere with a named owner and reason — silently leaving it
  out is not acceptable.
- **Out-of-scope rationale is explicit, not implied**: rules 5 and 7 are recorded in the matrix
  with their owning file in `apps/mobile/src/db/` and the Decision-15 reason. Rules 0, 1 and 2
  are recorded as satisfied *by absence*, with the exported-surface test naming the limit of
  what runtime reflection can prove (values, not erased types) and the runbook supplying the
  `grep` that covers type names.

**Smoke test runbook**:
`docs/testing/mobile/5-shared-domain-rules-matching-aggregates.smoke-test.md`

**Regression suite**: none applies. `e2e/` is a disabled Playwright placeholder (this product
has no web surface, `docs/project/2-repo-architecture.md`, *A note on `e2e/`*), and `.maestro/`
covers device happy paths, none of which this pure package can reach on its own.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| `INCLUSION_RULE_CASES` | The seven-row table under *AC2* above, verbatim: `full`, `partial` (`42000` / `21000` → `21000`), `partial-zero`, `partial-equal`, `excluded`, `excluded-partial`, `zero-amount` | `packages/shared-domain/src/inclusion.ts` (exported — it is a specification artifact both this package's tests and, later, the SQL side's tests assert against) |
| Period fixtures A, B, C, D | The four movement sets under *AC2* above, as module-local `const`s | `packages/shared-domain/src/aggregates.test.ts` |
| Delta and day-count vectors | Fixtures E and F under *AC2* above | `packages/shared-domain/src/aggregates.test.ts` |
| Apportionment vectors | The fixtures listed under *AC4*, including the deterministic 1000-bucket generator | `packages/shared-domain/src/apportionment.test.ts` |
| Description and alias vectors | The three parser-risk tables above, transcribed from `design/mockups/mobile/index.html` where the mockup supplies a real string | `packages/shared-domain/src/merchant-matching.test.ts` |
| Merchant / suggestion vectors | Seeded merchant (`isUserDefined: false`) and user merchant (`isUserDefined: true`), each with and without a default category; `currentCategorySource` of `null`, `'auto'`, `'rule'`, `'user'` | `packages/shared-domain/src/category-suggestion.test.ts` |

No database seed data is required — this item touches no database. Item #3's
`merchants` / `merchant_aliases` starter rows are the *runtime* source of the alias table these
functions will read; nothing here depends on them existing.

---

## Documentation Updates

> Identified here only. The developer executes these after implementation; they are not
> performed during Plan Ready.

- [ ] `docs/best-practices/STACK-SPECIFIC.md` — the bullet "**The inclusion rule is written
      once.** … Import the shared query fragment from `apps/mobile/src/db`" becomes incomplete
      the moment this item merges. Update it to name **two** sanctioned statements — the SQL
      fragment `apps/mobile/src/db/fragments.ts` for set-based queries and
      `packages/shared-domain/src/inclusion.ts` for in-memory plain objects — say which to use
      when, and keep "a hand-rolled `WHERE` that forgets exclusions is a review blocker" while
      extending it to a hand-rolled JavaScript restatement. Also extend the
      "`@finanzas/shared-domain` stays pure" bullet to mention that the clock now enters as a
      `DateLocal` and the `Date` global is banned by ESLint.
- [ ] `AGENTS.md` (and therefore the `CLAUDE.md` symlink) — the Troubleshooting row "`home` and
      `dashboard` totals disagree … Both must use the shared `isIncluded` / `includedAmount`
      fragments from `apps/mobile/src/db`" must also name the domain twin, so an agent reading
      only that table does not conclude the SQL fragment is the only correct path.
- [ ] `docs/project/2-repo-architecture.md` — the purity paragraph (lines 107-109) describes
      `sharedDomainPurity` as covering "`apps/mobile`, `expo-*`, or any SQL library". Add React
      and the `Date` global ban. The package table at line 91 already describes this item's
      scope correctly and needs no change.
- [ ] `docs/project/3-software-architecture.md` — *Design Decision 3* ("Domain logic is pure and
      separate") can now name the concrete modules instead of the four capabilities. The Testing
      Strategy table already points at `packages/shared-domain/**/*.test.ts` and needs no
      change; the "Non-negotiable cases" list already contains "Excluded and partially-included
      movements are honoured by every aggregate" — add the pointer to this item's fixtures.
- [ ] `docs/best-practices/stack/typescript.md` — the *Domain types* section says domain types
      are "defined once, in `@finanzas/shared-domain`". Record the temporary exception
      (Decision 16): `apps/mobile/src/db/types.ts` holds item #3's pre-promotion copies of four
      literal unions, and name the promotion as a follow-up so the duplication is documented
      rather than discovered.
- [ ] `docs/project/1-business-domain.md` — Business Rule 4 says "This rule is implemented once
      and every aggregate reads through it". Reword to "implemented once per layer" and name
      both implementations, so the sentence stays literally true.
- [ ] `docs/project/4-database-model.md` — **no change.** The schema is unchanged and the
      "Analysis rule (single source of truth)" line already states the rule this item
      implements.
- [ ] `docs/best-practices/stack/turborepo-pnpm.md` — **no change.** It already states that
      `packages/shared-domain` "has no runtime dependencies" beyond the workspace ones and that
      cross-package imports go by package name; both remain true.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| PR #39 merges between plan and implementation, changing what may be added to `packages/shared-domain/src/` | High | Med | The mandatory implementation-start re-verification above turns this from a surprise into a branch: extend `domain-purity-lint.test.ts` if it exists, rely on the runbook cycle if it does not. Neither path modifies the file's existing assertions |
| `no-restricted-globals` does not fire on `Date` under this ESLint / typescript-eslint version | Med | Med | Decision 8 names the exact `no-restricted-syntax` fallback, and the runbook's planted-violation cycle is what determines which mechanism the toolchain honours — the plan does not assume. AC3 is satisfied either way |
| Token-boundary matching (Decision 6) rejects a real alias a Chilean bank actually emits | Med | Med | The false-positive cost (wrong merchant → wrong auto-category on future movements) exceeds the miss cost (the movement stays uncategorized, which the product already handles gracefully — Business Rule 6). Reversal is deleting two space-pads and updating two negative tests. No real Banco de Chile description fixtures exist yet; item #6 will produce them, and this decision should be re-examined against them |
| Diacritic folding maps `Ñ` to `N`, colliding two genuinely different merchant names | Low | Low | No Chilean merchant pair is known to differ only by `Ñ`/`N`. `resolveMerchant`'s specificity and longest-pattern ordering resolves any collision deterministically rather than arbitrarily, and the `exact` strategy remains available for a merchant that needs to be pinned |
| Temporary duplication of four literal unions between `packages/shared-domain/src/types.ts` and `apps/mobile/src/db/types.ts` (Decision 16) | High | Low | Documented, not silent: recorded in the Cross-Cutting check, in Decision 16, and in Documentation Updates. The unions are closed sets copied from `docs/project/4-database-model.md`, so drift would require someone editing one copy and not the schema doc. The parent orchestrator should file the promotion follow-up |
| `auto` vs `rule` provenance reading (Decision 14) turns out not to be what the product intends | Low | Low | Flagged as an open question at plan review with the alternative named and costed (one ternary, one test). Nothing downstream is built on it yet |
| The `INCLUSION_RULE_CASES` export ships in the app bundle | High | Negligible | Seven frozen objects. Item #35's incoming CI bundle check is the mechanism that would surface it if that assessment is ever wrong |
| Percentages returned in tenths are rendered as `20,6%` by one caller and `21%` by another | Low | Low | The domain returns one unit; display precision is the caller's. `#screen=dashboard` (one decimal) and `#screen=categorize-complete` (zero decimals) are both derivable from tenths, and the runbook's fidelity step compares against both |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation.

The inclusion rule, in its one domain-layer place (Decisions 2, 3):

```ts
// packages/shared-domain/src/inclusion.ts — Illustrative, adapt during implementation
import type { MovementInclusionFields } from './types';

/**
 * Business Rule 4 (docs/project/1-business-domain.md): "A transaction counts toward totals and
 * charts when `excluded_at IS NULL`, at `COALESCE(included_amount, amount)`."
 *
 * SQL twin: apps/mobile/src/db/fragments.ts (`isIncluded`, `includedAmount`). These are the two
 * — and only two — sanctioned statements of this rule. A third anywhere is a review blocker.
 * The two are kept honest by INCLUSION_RULE_CASES below, not by comparing their outputs:
 * two implementations wrong in the same way would still agree.
 */
export function isIncludedInAnalysis(m: MovementInclusionFields): boolean {
  return m.excludedAt === null;
}

/** `??`, never `||`: an `includedAmount` of 0 is a real partial amount, not an absence. */
export function effectiveAmount(m: MovementInclusionFields): number {
  return m.includedAmount ?? m.amount;
}

export function contributedAmount(m: MovementInclusionFields): number {
  return isIncludedInAnalysis(m) ? effectiveAmount(m) : 0;
}
```

Largest-remainder apportionment (Decisions 4, 5):

```ts
// packages/shared-domain/src/apportionment.ts — Illustrative, adapt during implementation
export const PERCENTAGE_TENTHS_TOTAL = 1000;

export function apportionTenths(
  entries: readonly { key: string; weight: number }[],
): Map<string, number> {
  // …guards: unique keys, safe non-negative integer weights…
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (entries.length === 0 || total === 0) {
    // Documented exceptions to the sum invariant: nothing to apportion.
    return new Map(entries.map((e) => [e.key, 0]));
  }
  const totalBig = BigInt(total);
  const scale = BigInt(PERCENTAGE_TENTHS_TOTAL);
  const rows = entries.map((e) => ({
    key: e.key,
    weight: e.weight,
    floor: Number((BigInt(e.weight) * scale) / totalBig),
    remainder: (BigInt(e.weight) * scale) % totalBig,
  }));
  let leftover = PERCENTAGE_TENTHS_TOTAL - rows.reduce((s, r) => s + r.floor, 0);
  // Total order (Decision 5): remainder desc, weight desc, key asc. Never input order.
  const ranked = [...rows].sort(
    (a, b) =>
      (a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1) ||
      b.weight - a.weight ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const result = new Map(rows.map((r) => [r.key, r.floor]));
  for (const row of ranked) {
    if (leftover <= 0) break;
    result.set(row.key, (result.get(row.key) ?? 0) + 1);
    leftover -= 1;
  }
  return result;
}
```

The two additive `sharedDomainPurity` entries (Decision 8). The **existing** group object above
these is left byte-identical — PR #39 asserts its message verbatim and asserts a finding count
of exactly 4 on a probe that includes `react-native`:

```js
// eslint.config.mjs — Illustrative, adapt during implementation.
// Appended INSIDE the existing sharedDomainPurity `patterns` array, after the existing group:
{
  group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  // NOT 'react-*': that would also match 'react-native', which the existing group already
  // matches, producing two findings for one import and breaking PR #39's toHaveLength(4).
  message: '@finanzas/shared-domain may not depend on React.',
},
```

```js
// eslint.config.mjs — Illustrative. A NEW rule alongside no-restricted-imports in
// sharedDomainPurity.rules. Fallback if this does not fire: two no-restricted-syntax
// selectors, per Decision 8.
'no-restricted-globals': [
  'error',
  {
    globals: [
      {
        name: 'Date',
        message:
          '@finanzas/shared-domain must not read the clock. The instant is injected as a ' +
          'DateLocal produced by @finanzas/shared-utils deriveDateLocal(instant).',
      },
    ],
    checkGlobalObject: true,
  },
],
```

Token-boundary matching (Decision 6) is shown in full under that decision and is not repeated
here.

---

## Implementation Order

1. **Run the implementation-start re-verification** of the Cross-Cutting Operational Assumption
   Check (the two commands above). Record `Still valid` or `Stale or conflicting` in the PR
   description. If `Stale or conflicting`, stop before any file edit and return the evidence to
   the parent orchestrator.
   *Verification*: the recorded result names PR #39's state and whether
   `packages/shared-domain/src/domain-purity-lint.test.ts` exists on the implementation base.

2. **Install with the hoisted linker.** `pnpm install --node-linker=hoisted` from the repository
   root. (`.npmrc` is item #35's surface and is not touched here; the explicit flag is the
   documented workaround until PR #39 lands.)
   *Verification*: `pnpm --filter @finanzas/shared-domain test` runs the existing
   `index.test.ts` green before any change is made.

3. **`@finanzas/shared-utils`: `differenceInDays`.** Add it to `src/dates.ts` beside the other
   pure civil-date functions, with tests for a same-day difference (`0`), a month boundary
   (`'2025-01-31'` → `'2025-02-01'` is `1`), a leap February, a year boundary, a negative
   direction, and an invalid `DateLocal` throwing `RangeError`.
   *Verification*: `pnpm --filter @finanzas/shared-utils test -- dates` is green, and the run
   reports more tests than before.

4. **`@finanzas/shared-utils`: export `divideRoundHalfUp`.** Change the declaration to an
   export, widen the doc comment from "one of this module's two compile-time constants" to "any
   positive integer denominator", and add tests for odd denominators (`5/3 → 2`, `1/3 → 0`,
   `2/3 → 1`), the exact-half tie (`1/2 → 1`, `3/2 → 2`), a zero numerator, and a denominator of
   `1`. Do not change the implementation body.
   *Verification*: `pnpm --filter @finanzas/shared-utils test -- money` is green and every
   pre-existing `formatClpAbbreviated` assertion still passes unchanged — proving the promotion
   changed no behaviour.

5. **`packages/shared-domain/src/types.ts`.** The types listed in Layer-by-Layer, plus the
   type-only re-export of `DateLocal` and `Period`. No test file; the types are exercised by
   every module below.
   *Verification*: `pnpm --filter @finanzas/shared-domain typecheck` passes.

6. **`packages/shared-domain/src/inclusion.ts` + `inclusion.test.ts`.** Implement the three
   functions and copy `INCLUSION_RULE_CASES` verbatim from the AC2 table — the seven rows, with
   their hand-derived expected values. Write the header comment of Decision 3, including the
   equivalence table and the "third statement is a review blocker" sentence.
   *Verification*: `pnpm --filter @finanzas/shared-domain test -- inclusion` is green. Then
   temporarily change `effectiveAmount` from `??` to `||` and confirm the `partial-zero` case
   fails at its named `expect(...).toBe(0)`; revert and confirm green again. Paste all four
   phases into the PR description.

7. **`packages/shared-domain/src/apportionment.ts` + `apportionment.test.ts`.** Implement
   `apportionTenths` and every fixture and guard listed under AC4.
   *Verification*: `pnpm --filter @finanzas/shared-domain test -- apportionment` is green. Then
   temporarily replace the leftover distribution with per-bucket `Math.round` and confirm the
   three-equal-thirds fixture fails at `expect(sum).toBe(1000)`; revert and confirm green.

8. **`packages/shared-domain/src/merchant-matching.ts` + `merchant-matching.test.ts`.**
   Implement `normalizeDescription`, `aliasMatches` and `resolveMerchant`, with one `it(...)`
   per row of all three parser-risk tables.
   *Verification*: `pnpm --filter @finanzas/shared-domain test -- merchant-matching` is green,
   and the run reports at least one passing test for each of the three tables' negative rows
   (`LIDERAZGO`, `UBERTO`, `ML CHILE SPA LTDA`, the empty pattern).

9. **`packages/shared-domain/src/category-suggestion.ts` + `category-suggestion.test.ts`.**
   Implement `suggestCategory` per Decision 14 and the vectors in the Seed Data table.
   *Verification*: `pnpm --filter @finanzas/shared-domain test -- category-suggestion` is green,
   including the `currentCategorySource: 'user'` → `null` case with a merchant default present.

10. **`packages/shared-domain/src/aggregates.ts` + `aggregates.test.ts`.** Implement
    `movementDirection`, `countDaysInPeriod`, `countElapsedDaysInPeriod`, `dailyAverage`,
    `computePeriodDelta`, `buildCategoryBreakdown` and `summarizePeriod`, and every Fixture
    A-F assertion.
    *Verification*: `pnpm --filter @finanzas/shared-domain test -- aggregates` is green, and the
    output shows the Fixture A assertions on `expenseTotal` `63000`, the `compras` bucket total
    `21000`, and `dailyAverageExpense` `2172` all passing.

11. **`packages/shared-domain/src/clock-injection.test.ts` and `domain-surface.test.ts`.** The
    fake-system-time determinism test (epoch-millisecond numbers, never `new Date(...)`) and the
    exported-surface guard.
    *Verification*: both green. Then plant an export named `credentialHelper` in `index.ts` and
    confirm `domain-surface.test.ts` fails naming it; remove it and confirm green. Then run the
    whole suite under `TZ=Pacific/Kiritimati`, `TZ=UTC` and `TZ=America/Santiago` and confirm
    all three runs report the same number of passing tests.

12. **`packages/shared-domain/src/index.ts`.** Re-export every module, keeping `PACKAGE_NAME`
    exported verbatim.
    *Verification*: `pnpm --filter @finanzas/mobile test` still passes
    `apps/mobile/src/__tests__/workspace-wiring.test.ts`, and `pnpm build` emits `dist/` with
    declarations for `packages/shared-domain`.

13. **Root `eslint.config.mjs`: the two additive `sharedDomainPurity` entries** (Decision 8).
    Append the React group inside the existing `patterns` array — do not touch the existing
    group object or its message — and add the `no-restricted-globals` entry.
    *Verification*: `pnpm lint` passes across the repository. Then run the planted-violation
    cycle for each new restriction (`import 'react';` and `const t = Date.now();` in a scratch
    file under `packages/shared-domain/src/`), confirm
    `pnpm --filter @finanzas/shared-domain lint` fails naming the right rule and message each
    time, remove them, and confirm clean again. Then confirm the negative control still passes:
    a file importing only `@finanzas/shared-utils` and `node:assert` produces no finding. If
    `no-restricted-globals` does not fire on `Date`, switch to the `no-restricted-syntax`
    fallback of Decision 8 and record the substitution. Paste all phases into the PR
    description.

14. **Execute the smoke test runbook**
    `docs/testing/mobile/5-shared-domain-rules-matching-aggregates.smoke-test.md` end to end and
    record PASS/FAIL per step, including the design-fidelity step against
    `design/mockups/mobile/index.html`.

15. **Re-run the AC1 residual check.** `grep -nE '^[0-9]+\. \*\*' docs/project/1-business-domain.md`;
    confirm the count is still 9 and every line appears in the Business Rule coverage matrix.
    Paste the output into the PR description.

16. **Update project docs** per the **Documentation Updates** section above.

17. **Update `CHANGELOG.md`** under `[Unreleased]` → `### Added`, exactly:

    ```markdown
    - **shared-domain: rules, matching and aggregates** (#5): `@finanzas/shared-domain` now ships the inclusion rule as domain logic (the twin of the SQL fragment in `apps/mobile/src/db/fragments.ts`), merchant alias matching with `prefix` / `contains` / `exact` strategies and normalization, category suggestion with `auto` / `rule` / `user` provenance, and period aggregates — totals, per-category breakdown with largest-remainder percentages that sum to exactly 100%, period-over-period deltas and daily average. The clock is injected as a `DateLocal`; ESLint bans the `Date` global and React imports inside the package.
    ```

18. **Final gate.** `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all green from
    the repository root; `git status --short` shows no scratch file, no planted violation and no
    temporary logging left behind.

---

## Document Quality Gate

> Copy this block into the draft PR description.

- **Spec/brief coverage**: Checked — issue #5's four acceptance criteria map to the Business
  Rule coverage matrix (AC1), the AC2 fixture section (AC2), the three-layer AC3 section, and
  the AC4 apportionment section; its five Scope bullets map to the five source modules in
  Layer-by-Layer, each with a named test file.
- **Implementation-order consistency**: Checked — file paths, function names
  (`isIncludedInAnalysis`, `effectiveAmount`, `contributedAmount`, `normalizeDescription`,
  `aliasMatches`, `resolveMerchant`, `suggestCategory`, `apportionTenths`, `summarizePeriod`,
  `computePeriodDelta`, `dailyAverage`, `countDaysInPeriod`, `countElapsedDaysInPeriod`,
  `differenceInDays`, `divideRoundHalfUp`), constants (`PERCENTAGE_TENTHS_TOTAL = 1000`,
  `INCLUSION_RULE_CASES`), fixture labels (A-F) and decision indices (1-16) were cross-read and
  agree in every section they appear in.
- **Verification support**: Checked — every claim about existing behaviour (the current
  `sharedDomainPurity` coverage, PR #39's three assertions, item #3's `63000`, the mockup's
  percentage granularity, the nine business rules) cites a Verification Log row with the exact
  command and result.
- **Behavioural guarantees**: Checked — "percentages sum to 1000 tenths" names largest-remainder
  apportionment with a total-order tie-break and two documented exceptions; "input order never
  affects the result" names the total order and the permutation test; "the clock is injected"
  names the `DateLocal` parameter, the ESLint ban and the fake-system-time test.
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes no workflow
  documentation, protocol, status label or decision gate. Its only conditional branch (the
  implementation-start re-verification) is enumerated with all three outcomes and their required
  next actions inline.
- **Parser/API/concurrency checklist**: Parser-risk **applied conservatively** with a full
  edge-case enumeration (three tables) mapped one-to-one to `it(...)` cases in
  `merchant-matching.test.ts`, plus an explicit not-applicable rationale for suppression
  semantics. Concurrent-event-source **not applicable** — no listener, timer, async queue or
  module-level mutable state; rationale recorded rather than omitted. API-surface and
  single-snapshot signals do not apply: the package has no network, storage or snapshot
  semantics.
- **CHANGELOG literal format**: Checked — Implementation Order step 17 gives the entry in the
  project's `**Bold Title** (#N):` format under `### Added`, not conventional-commit format.
- **Not-applicable rationale**: Checked — every skipped category above carries a one-line
  reason.
