# Merchant editor and alias grouping — Implementation Plan

**Work item brief**: [`lhpaul/personal-finances#14`](https://github.com/lhpaul/personal-finances/issues/14)
(Refactor-type item — there is no spec; the issue body is the brief)
**Smoke test runbook**: [`docs/testing/mobile/14-merchant-editor-alias-grouping.smoke-test.md`](../../../testing/mobile/14-merchant-editor-alias-grouping.smoke-test.md)

---

## Summary

**Approach**: Build `#screen=merchant-edit` as a draft-form screen at the existing route
`/categorize/merchant/[merchantId]`, backed by four new functions on the merged
`apps/mobile/src/db/repositories/merchants.ts` and one new pure module in
`@finanzas/shared-domain`. The screen reads a single consistent snapshot through a feature hook
that calls `getAppDatabase()` (no TanStack Query), renders all three MVP manifest states from that
one snapshot, persists the merchant profile (name + default category) on the drawn "Guardar", and
persists an alias grouping immediately when the person taps "Agrupar". Grouping re-points or
creates one `merchant_aliases` row, re-links unattributed movements whose raw description matches
it, and recomputes every alias's `match_count` from the movements table — all inside one SQLite
transaction. Setting a default category writes only the `merchants` row: no movement is ever
re-categorized, which is what makes "user decisions are never overwritten" true by construction
rather than by a guard.

**Estimated complexity**: L

**Rationale**: Three manifest states, a new pure domain module with its own edge-case surface, four
new repository functions of which one is a multi-statement transaction with re-link and recount
semantics, the first `apps/mobile/src/features/` folder in the repository, a new i18n key family in
two catalogues, a seed-catalogue and dev-fixture extension, and the design-fidelity contract flip
for three targets. Individually each is small; together they cross five layers and the transaction
semantics need real tests.

**Dependencies**:

| Item | Kind | Why |
| --- | --- | --- |
| #5 — shared-domain rules, matching and aggregates (open PR [#44](https://github.com/lhpaul/personal-finances/pull/44)) | **Blocking** | This plan consumes `normalizeDescription`, `aliasMatches`, `resolveMerchant`, `computePeriodDelta` and the `MerchantAlias` type, and adds a sibling module to the same package |
| #47 — design-fidelity gate | **Blocking** | Step 12 flips this screen's three targets from `planned` to `wired` in `scripts/mobile-ui/fidelity-targets.json` and consumes `useFidelityPreview()` / `fidelityTestId()` from `apps/mobile/src/lib/fidelity-preview.ts`. Neither exists until #47 lands |
| #3 — local database, schema, migrations, seed data | Merged | `merchants`, `merchant_aliases`, the seed ledger and `src/db/fragments.ts` already exist |
| #2 — theme and design-system primitives | Merged | `Card`, `TextField`, `CategoryChip`, `Badge`, `Button`, `Amount`, `Text` |
| #34 — i18n infrastructure | Merged | Flat-key catalogues and `i18next/no-literal-string` |
| #8 — onboarding | **Interface, first-lander creates** | `apps/mobile/src/db/runtime.ts` (`getAppDatabase()`) is specified by #8's merged plan but does not exist on `develop`. See [Decision 2](#decision-2--getappdatabase-is-created-by-whichever-item-lands-first) |
| #13 — categorization flow | Sequencing only, **not blocking** | #13 provides the in-app entry point and must pass the `categoryId` route param defined in [Decision 3](#decision-3--the-a9-seam-is-one-optional-route-param-named-categoryid). #14 imports nothing from #13 and is reachable by deep link without it |

---

## Verification Log

All commands were run in the worktree
`/Users/lhpaul/Git/personal-finances/.claude/worktrees/item-14` at repo revision `1c7af24`
(`implementation-plan/14-merchant-editor-alias-grouping`, created from `origin/develop` at the same
SHA), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `1c7af24`; `git rev-parse origin/develop` is the same SHA |
| MVP states of `merchant-edit` | `node -e` over `design/mockups/mobile/mockup-manifest.js`, reading `screens[screen_id='merchant-edit'].states` and filtering `mvp !== false` | `default`, `suggestions`, `category-picker` — no state is flagged `mvp: false`, so all three are in scope |
| Which cards belong to which state | `awk '/<section class="app-screen" id="s-merchant-edit">/,/<\/section>/' design/mockups/mobile/index.html \| grep -o 'data-states="[^"]*"' \| sort \| uniq -c` | `category-picker` ×1, `default suggestions` ×2, `default` ×1, `suggestions` ×1. Everything without `data-states` (top bar, name card, "Guardar") renders in every state |
| Existing merchants repository surface | `grep -c "^export function" apps/mobile/src/db/repositories/merchants.ts` | `1` — only `deleteMerchant`. Everything this screen reads or writes is new |
| Existing merchant copy in the catalogues | `grep -c "merchant" apps/mobile/src/i18n/es.json` | `0` — the whole `merchant.edit.*` key family is new in both `es.json` and `en.json` |
| Files this plan assumes are missing | `for p in apps/mobile/src/features apps/mobile/src/db/runtime.ts apps/mobile/src/lib scripts/mobile-ui/fidelity-targets.json packages/shared-domain/src/merchant-matching.ts; do [ -e "$p" ] && echo "PRESENT $p" \|\| echo "ABSENT  $p"; done` | All five `ABSENT` on `develop` |
| Delivered `@finanzas/shared-domain` surface | `git show origin/feature/5-shared-domain-rules-matching-aggregates:packages/shared-domain/src/index.ts` and `:packages/shared-domain/src/merchant-matching.ts` | `index.ts` re-exports `./types`, `./inclusion`, `./apportionment`, `./merchant-matching`, `./category-suggestion`, `./aggregates`. `merchant-matching.ts` exports `normalizeDescription`, `aliasMatches`, `resolveMerchant`, `MerchantMatch`. Normalization is NFKD → strip combining marks → `toUpperCase()` → non-`[A-Z0-9]` → space → collapse → trim |
| Seeded merchants and their aliases | `sed -n '196,240p' apps/mobile/src/db/seeds/catalogue.ts` | `lider`, `jumbo`, `uber`, `copec`, `netflix`; one alias each. No merchant matching the mockup's `MERCADOLIBRE` family exists |
| Seed-count assertions that a new merchant seed could break | `grep -rn "toHaveLength\|toBeGreaterThanOrEqual" apps/mobile/src/db/__tests__/seeds.test.ts` | The merchant assertion is `expect(merchantRows.length).toBeGreaterThanOrEqual(5)` — additive-safe. Institution counts are exact (`6`) but institutions are untouched here |
| Seeded rows are protected from person edits | `sed -n '30,110p' apps/mobile/src/db/seeds/apply.ts` | `applySeedRecord` compares a canonical hash of the seed-owned values against `seed_ledger.seeded_hash` and returns without writing when they differ. A renamed or re-categorized seeded merchant is therefore never overwritten by a later `applySeeds` |
| `match_count` is not seed-owned | `sed -n '283,290p' apps/mobile/src/db/seeds/apply.ts` | `const seedOwnedValues = { rawPattern: seed.rawPattern, matchType: seed.matchType };` — `matchCount` is deliberately excluded, so recomputing it at runtime is the intended design |
| The alias uniqueness constraint | `sed -n '162,177p' apps/mobile/src/db/schema.ts` | `uniqueIndex('merchant_aliases_raw_pattern_unique').on(t.rawPattern)` — global, not per merchant. Grouping must re-point an existing row, never insert a second one |
| Chart primitives available | `grep -rn "mu-bars" docs/specs/developments/20260801172100_2-theme-design-system-primitives/2_*.md` | `.mu-bars*` is listed as **deferred to #17 (Dashboard charts)**. There is no `Bars` export in `apps/mobile/src/components/ui/index.ts` |
| Bounded same-surface open PRs | `gh pr list --repo lhpaul/personal-finances --state open --limit 50 --json number,title,headRefName,baseRefName` | `#59` plan/#13, `#57` plan/#9, `#46` feature/#6, `#44` feature/#5 — all based on `develop`. Only `#44` touches a surface this plan consumes |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode and plan artifact owner | `single_repo` (no `mode` key), so this repository owns the plan | `.ai-dev-workflow.yaml` — no `mode:` key; `template.is_template: false` | 2026-08-02, repo `1c7af24` | Current invocation (item #14) only; no open PR changes `.ai-dev-workflow.yaml` | `Verified` |
| Approved artifact base branch | `develop` | `AGENTS.md` → "Integration branch: `develop` (spec/plan/feature/fix PRs target `develop`)"; `git rev-parse origin/develop` == worktree base SHA | 2026-08-02, repo `1c7af24` | The four open PRs (`#44`, `#46`, `#57`, `#59`) all target `develop` | `Verified` |
| `@finanzas/shared-domain` export surface this plan consumes | `normalizeDescription`, `aliasMatches`, `resolveMerchant`, `computePeriodDelta`, `MerchantAlias`, `MerchantMatchType`; `src/index.ts` re-exports each module with `export *` | `git show origin/feature/5-shared-domain-rules-matching-aggregates:packages/shared-domain/src/{index,merchant-matching,aggregates}.ts` (open PR `#44`) | 2026-08-02, branch head fetched from `origin` on the same date | Open PR `#44` is the only writer of `packages/shared-domain/src/**`; no other open PR touches that path | `Verified` |
| Ownership of `scripts/mobile-ui/fidelity-targets.json` | Owned and created by item #47; this plan only flips its three `merchant-edit` rows from `planned` to `wired` | `docs/specs/developments/20260802132243_47-design-fidelity-gate/2_47-design-fidelity-gate_implementation-plan.md` → "Coverage sets" table, row `#14 · merchant-edit · 3` | 2026-08-02, repo `1c7af24` | No open PR creates or edits `scripts/mobile-ui/**`; the path is `ABSENT` on `develop` | `Verified` |
| Ownership of `apps/mobile/src/db/runtime.ts` (`getAppDatabase()`) | Specified by #8's merged plan; absent on `develop`; created by whichever of #8 / #12 / #14 implements first | `docs/specs/developments/20260802132343_8-onboarding-intro-value-ready/2_8-onboarding-intro-value-ready_implementation-plan.md` → Decision 1 | 2026-08-02, repo `1c7af24` | No open PR creates `apps/mobile/src/db/runtime.ts` (`#44` and `#46` touch `packages/**` only; `#57` and `#59` are plan-only branches) | `Verified` |

No row resolved to `Conflict`. Shared keywords between this item and #13 / #47 (merchant, fidelity)
are not treated as conflict evidence: no open PR changes the same operational assumption surface.

---

## Decisions

### Decision 1 — Data access is `getAppDatabase()` + repository functions behind a feature hook

Campaign-wide binding decision inherited from #8's merged plan: the app tier never imports Drizzle.
`apps/mobile/app/categorize/merchant/[merchantId].tsx` renders and delegates; the hook
`useMerchantEditor` in `apps/mobile/src/features/merchants/useMerchantEditor.ts` awaits
`getAppDatabase()` and calls repository functions in `apps/mobile/src/db/repositories/merchants.ts`.
**TanStack Query is not used and is not installed.** The `dbAccessBoundary` ESLint rule
(`eslint.config.mjs`, applied by `apps/mobile/eslint.config.mjs`) and its companion test
`apps/mobile/src/db/__tests__/db-access-boundary.test.ts` enforce this mechanically.

This item introduces `apps/mobile/src/features/` — it does not exist on `develop` (Verification
Log). The folder shape is `features/merchants/{useMerchantEditor.ts, types.ts, components/,
__tests__/}`.

### Decision 2 — `getAppDatabase()` is created by whichever item lands first

`apps/mobile/src/db/runtime.ts` does not exist on `develop`. #8's merged plan specifies it in full
(its Decision 1). The developer of #14:

- **If the file exists**: import `getAppDatabase` from it and change nothing.
- **If it does not**: create it exactly as #8's plan Decision 1 specifies (memoised
  `Promise<AppDatabase>`, `openAppDatabase()` + `ensureDatabaseReady`, clearing the memo on
  failure), quote that plan section in the implementation PR description, and note that #8 will
  find the file already present.

No third variant is acceptable — two divergent runtimes would be a merge conflict nobody can
resolve safely.

### Decision 3 — The A9 seam is one optional route param named `categoryId`

The merged #13 spec resolves its Conflict 2 by making the merchant name on the categorize card the
only "remember as the merchant's default" affordance: tapping it opens this editor "with the
selected category offered as the default (A9)". This plan fixes the wire format:

```text
/categorize/merchant/[merchantId]?categoryId=<transaction_category_id>
```

`useMerchantEditor` reads it with `useLocalSearchParams()`. When present **and** it resolves to a
real category row, it becomes the draft default category — pre-selected, visibly, but **not
persisted** until the person taps "Guardar". When absent or unresolvable, the draft starts at the
merchant's stored `transaction_category_id`. This is the contract #13's implementation must emit;
it is recorded here because #14 owns the reading side and #13's plan is not yet written.

Nothing about this param re-categorizes the movement the person just categorized — that write
belongs to #13 and happened before navigation.

### Decision 4 — The screen is a draft form; only alias grouping writes immediately

Read straight off the mockup's own `onclick` handlers:

- `Cambiar` → `go('merchant-edit','category-picker')` — pure navigation.
- `Guardar categoría` (inside the picker) → `go('merchant-edit','default')` — closes the picker and
  keeps the chosen chip in the draft. **It does not write.**
- `Guardar` (bottom, no `data-states`) → leaves the screen. This is the single write of name +
  default category, through `saveMerchantProfile`.
- `Agrupar` on a suggestion row → writes immediately through `groupAliasIntoMerchant`, because the
  row's movement count must change under the person's finger and the drawn card gives no second
  confirmation.

Leaving with the top-bar `←` discards the draft. The mockup draws no confirmation dialog and this
plan does not invent one.

### Decision 5 — Setting a default category writes exactly one row, and never a movement

`BEHAVIOR.md → merchant-edit` marks the question "does it re-categorize past movements that were
not hand-edited?" as 🟡 and answers **no** — "las decisiones del usuario nunca se pisan". The domain
doc says a merchant's default category is "applied to future movements".

`saveMerchantProfile` therefore issues one `UPDATE merchants SET name = ?, transaction_category_id
= ?, user_id = ? WHERE id = ?` and touches no other table. AC2 ("setting a default category does
not overwrite categories the user already confirmed") is satisfied **by construction**, not by a
filter that could be got wrong: there is no code path in this item that writes
`transactions.transaction_category_id` at all. A repository test asserts that every column of every
`transactions` row is byte-identical before and after a default-category change.

"Applies to future movements" needs no code here: #5's `suggestCategory` already reads the
merchant's `transactionCategoryId`, and #10's sync applies it on ingest.

### Decision 6 — Configuring a seeded merchant marks it person-owned (`merchants.user_id`)

`merchants.user_id` is documented as "Null = seeded; set = created by the user", and #5's
`suggestCategory` maps `isUserDefined` (`user_id !== null`) to `categorySource: 'rule'` rather than
`'auto'`. The merged #13 spec's provenance table reads `rule` as "the app applied a merchant
default **the person configured** (#14)".

So when `saveMerchantProfile` changes `name` or `transaction_category_id` on a merchant whose
`user_id` is null, it sets `user_id` to the single local `users` row's id in the same statement.
Future auto-categorization from that merchant is then correctly labelled `rule`, using the existing
schema and inventing no column.

This does not fight the seed ledger: `applySeedRecord` already stops writing as soon as the stored
seed-owned values diverge from `seeded_hash` (Verification Log), and `user_id` is not among a
merchant's seed-owned values.

### Decision 7 — `match_count` is recomputed, never incremented

AC3 requires `match_count` to reflect the real number of movements. An incrementing counter drifts
the moment a movement is deleted, re-linked, or attributed by a different alias.

`recountMerchantAliases(db, merchantId)` therefore recomputes from the movements table:

1. Read this merchant's aliases.
2. Read `id, raw_description` for every movement with `merchant_id = merchantId`.
3. For each movement, call `resolveMerchant(rawDescription, aliasesOfThisMerchant)` and attribute
   the movement to the winning `aliasId`. Because `resolveMerchant` is a total order over aliases
   with unique ids (#5 Decision 7), a movement is counted **once**, and the counts partition the
   merchant's movements exactly.
4. Write each alias's count (including zero).

Movements attributed to the merchant that no alias explains — a hand-attributed movement, or one
whose alias was later re-pointed elsewhere — are counted by no alias. That is intentional and is
asserted by a test: `match_count` counts *what this alias explains*, not *what this merchant owns*.

`recountMerchantAliases` runs on every editor load and inside `groupAliasIntoMerchant`'s
transaction, so the counts the person reads are the counts the store holds.

### Decision 8 — Grouping re-points an existing alias row rather than inserting a duplicate

`merchant_aliases_raw_pattern_unique` is a **global** unique index on `raw_pattern`. So
`groupAliasIntoMerchant` normalizes the pattern, looks the row up by that normalized value, and:

- row absent → insert `{ id: newId(), merchantId, rawPattern, matchType: 'prefix' }`;
- row present and already on this merchant → leave it (grouping is idempotent);
- row present on another merchant → `UPDATE merchant_aliases SET merchant_id = ?` — the alias moves.

The insert path can therefore never violate the unique index, and re-tapping "Agrupar" is a no-op
rather than an error.

### Decision 9 — Re-linking touches `merchant_id` only, and only unattributed movements

AC1: "Grouping an alias re-links existing movements and applies to future ones."

Re-link selects `id, raw_description` from `transactions` **where `merchant_id IS NULL`**, keeps the
rows for which `aliasMatches(rawDescription, { rawPattern, matchType })` is true, and updates those
rows' `merchant_id` and `updated_at`. Nothing else.

Movements already attributed to a *different* merchant are left alone: re-attributing them would
silently move money between merchants, and the mockup draws no affordance that promises it. Recorded
as [A3](#assumption-register) with confirmation requested.

Matching runs in TypeScript, not SQL, because normalization is a pure domain function
(`normalizeDescription`) and SQL cannot call it. `src/db/` is allowed to import
`@finanzas/shared-domain` — the package is pure, and `dbAccessBoundary` restricts SQL imports
leaving `src/db/`, not domain imports entering it.

"Applies to future ones" requires no further code: the new alias row is exactly what #5's
`resolveMerchant` and #10's sync read.

### Decision 10 — Suggestions are derived on-device from the person's own movements

The manifest labels the state "Sugerencias de la comunidad", but the drawn card title is **"Nombres
detectados en tus movimientos"**, `BEHAVIOR.md` describes it as "alias crudos sugeridos para plegar
bajo este comercio", and `docs/project/1-business-domain.md` puts "the community-sourced merchant
suggestions that would require it" explicitly **out of the MVP** (there is no backend — non-negotiable
#1). The drawn card title and `BEHAVIOR.md` win: the MVP derives candidates from local data only.

The derivation is a pure rule and lives in a new `@finanzas/shared-domain` module,
`packages/shared-domain/src/merchant-suggestions.ts`, exporting `suggestAliasCandidates`. See
[Suggestion rule](#suggestion-rule-suggestaliascandidates) for the algorithm and
[Edge-case enumeration](#edge-case-enumeration--suggestaliascandidates) for the test vectors.

### Decision 11 — The monthly bar chart is screen-local, not a design-system primitive

`.mu-bars*` is assigned to item #17 (Dashboard charts) by #2's merged plan, and
`apps/mobile/src/components/ui/index.ts` exports no `Bars` (Verification Log). Adding it to the
design system here would pre-empt #17 and require a `#screen=ds-components` entry this item does not
own.

So `MonthlyBars` lives at `apps/mobile/src/features/merchants/components/MonthlyBars.tsx`: three
`View`s with percentage heights, colours and radii read from `apps/mobile/src/theme.ts`, no literal
hex or spacing. When #17 promotes a real chart primitive it replaces this file; the PR description
says so.

### Decision 12 — The statistics window is the current month and the two before it, anchored to today

Brief Scope: "Spending statistics over the last three months." The window is
`getMonthPeriod(today)`, `shiftMonthPeriod(period, -1)` and `shiftMonthPeriod(period, -2)` from
`@finanzas/shared-utils`, with `today = deriveDateLocal(new Date())` — the local Santiago day, never
the UTC one. Month labels come from `formatMonthAbbreviation` (the mockup's `nov` / `dic` / `ene`).

Per month, the total is `sum(includedAmount)` over this merchant's **expense** movements
(`type = 'debit'`) in that month, read through the shared `isIncluded` / `includedAmount` fragments
in `apps/mobile/src/db/fragments.ts`. This is a *consumer* of the inclusion rule, not a second
statement of it — `src/db/checks/inclusion-rule-scan.ts` enforces that.

- "Promedio mensual" = `Math.round(sum(monthTotals) / 3)` — an integer number of pesos, because CLP
  minor units are integers.
- "−55% vs mes anterior" = `computePeriodDelta(currentMonthTotal, previousMonthTotal)` from
  `@finanzas/shared-domain`.
- Bar heights are each month's total over the largest of the three; all-zero renders three
  zero-height bars and `$0`.

`today` is a parameter of `readMerchantEditor` and of `useMerchantEditor`, so tests pin it instead of
mocking the clock.

### Decision 13 — All three states render from one snapshot read inside one transaction

`readMerchantEditor` runs its merchant read, alias read, candidate derivation, picker-category read
and three monthly totals inside a single `db.transaction(...)`, and returns one
`MerchantEditorSnapshot`:

```ts
// Illustrative — adapt during implementation.
export interface MerchantEditorSnapshot {
  merchant: MerchantProfile; // id, name, transactionCategoryId, isUserDefined
  aliases: MerchantAliasView[]; // id, rawPattern, matchType, matchCount — the "Actual" rows
  candidates: AliasCandidate[]; // from suggestAliasCandidates — the "Agrupar" rows
  categories: Category[]; // the picker grid, for the merchant's observed direction (A5)
  stats: MerchantSpendingStats; // months: MerchantMonthTotal[], monthlyAverage, delta
}
```

Switching
between `default`, `suggestions` and `category-picker` is local state over that snapshot and issues
no further reads, so the counts in the suggestions card can never disagree with the totals in the
stats card. The snapshot is re-read only after `groupAliasIntoMerchant` succeeds.

---

## Suggestion rule: `suggestAliasCandidates`

`packages/shared-domain/src/merchant-suggestions.ts` — pure, no I/O, no React, no SQL.

```ts
// Illustrative — adapt during implementation.
export const MIN_SIGNIFICANT_TOKEN_LENGTH = 4;
export const MIN_SHARED_PREFIX_LENGTH = 6;
export const CANDIDATE_TOKEN_COUNT = 2;
export const MAX_ALIAS_CANDIDATES = 5;

/** Tokens a Chilean bank statement puts on almost every line. Evidence from one of these
 *  alone is not evidence. */
export const GENERIC_TOKENS: readonly string[] = [
  'CHILE', 'SANTIAGO', 'COMPRA', 'PAGO', 'PAGOS', 'TRANSFERENCIA', 'ONLINE',
  'SERVICIO', 'SERVICIOS', 'COMERCIAL', 'LTDA', 'LIMITADA', 'SPA',
];

export interface AliasCandidate {
  /** Normalized leading token run — what becomes `merchant_aliases.raw_pattern`. */
  rawPattern: string;
  /** How many unattributed movements this candidate would fold in. */
  movementCount: number;
  /** One observed description, for display. */
  sampleDescription: string;
}

export function suggestAliasCandidates(input: {
  merchantName: string;
  existingPatterns: readonly string[];
  descriptions: readonly string[];
}): AliasCandidate[];
```

**Algorithm**:

1. `merchantTokens` = tokens of `normalizeDescription(merchantName)` plus tokens of every
   `normalizeDescription(existingPattern)`, keeping only tokens with length
   `>= MIN_SIGNIFICANT_TOKEN_LENGTH` that are not in `GENERIC_TOKENS`.
2. Normalize each input description. Drop empties. Group descriptions by their first
   `CANDIDATE_TOKEN_COUNT` tokens joined by a single space (the whole normalized string when it has
   fewer tokens). That join is the candidate `rawPattern`; the group size is `movementCount`; the
   ASCII-lowest normalized description in the group is `sampleDescription`.
3. Drop any candidate whose `rawPattern` equals an existing normalized pattern (it is already an
   alias, shown under "Actual" instead).
4. Keep a candidate when **any** predicate holds against the group's descriptions and pattern:
   - **P1 shared significant token** — a candidate token is exactly a `merchantTokens` member.
   - **P2 containment** — a `merchantTokens` member is a substring of a candidate token, or a
     candidate token of length `>= MIN_SIGNIFICANT_TOKEN_LENGTH` and not in `GENERIC_TOKENS` is a
     substring of a `merchantTokens` member.
   - **P3 shared prefix** — the candidate `rawPattern` and some normalized existing pattern share a
     common prefix of at least `MIN_SHARED_PREFIX_LENGTH` characters.
5. Sort by `movementCount` descending, then `rawPattern` ascending (ASCII). Return the first
   `MAX_ALIAS_CANDIDATES`. The order is total, so the same input always produces the same list.

Worked against the mockup's own strings, with the merchant "MercadoLibre Chile" and existing pattern
`MERCADOLIBRE COMPRA`: `merchantTokens` is `{MERCADOLIBRE}` — `CHILE` and `COMPRA` are generic.
`MERPAGO*MERCADOLIBRE` normalizes to `MERPAGO MERCADOLIBRE`, candidate pattern `MERPAGO
MERCADOLIBRE`, kept by **P1**. `ML CHILE SPA` normalizes to `ML CHILE SPA`, candidate pattern `ML
CHILE`; `ML` is below the length floor and `CHILE` is generic, so **no predicate holds and it is not
suggested**. That is the deliberate precision/recall trade recorded as [A4](#assumption-register):
grouping re-links real movements and the screen draws no undo, so a false suggestion costs more than
a missing one. The mockup's `ML CHILE SPA` row is exactly the community knowledge the domain doc puts
out of MVP scope.

---

## Layer-by-Layer Changes

### Shared packages / libraries — `@finanzas/shared-domain`

- [ ] `packages/shared-domain/src/merchant-suggestions.ts` — new pure module: `suggestAliasCandidates`,
      `AliasCandidate`, and the four exported constants plus `GENERIC_TOKENS`
      ([Suggestion rule](#suggestion-rule-suggestaliascandidates)). Reuses `normalizeDescription`
      from `./merchant-matching`; imports nothing else.
- [ ] `packages/shared-domain/src/index.ts` — add `export * from './merchant-suggestions';`,
      preserving the existing order and the `PACKAGE_NAME` export that
      `apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on.
- [ ] `packages/shared-domain/src/domain-surface.test.ts` — add `suggestAliasCandidates` to the
      negative-control "expected surface" assertion. No exported name may match that file's
      credential/identity pattern; `suggestAliasCandidates`, `AliasCandidate` and `GENERIC_TOKENS`
      do not.
- [ ] `packages/shared-domain/src/merchant-suggestions.test.ts` — one `it(...)` per row of
      [Edge-case enumeration](#edge-case-enumeration--suggestaliascandidates).

### Database / Data Layer — `apps/mobile/src/db`

- [ ] `apps/mobile/src/db/repositories/merchants.ts` — add `readMerchantEditor`,
      `saveMerchantProfile`, `groupAliasIntoMerchant`, `recountMerchantAliases`. Keep
      `deleteMerchant` and its doc comment unchanged.
- [ ] `apps/mobile/src/db/types.ts` — add the returned domain shapes so no caller sees a Drizzle
      row: `MerchantProfile`, `MerchantAliasView`, `MerchantMonthTotal`, `MerchantSpendingStats`,
      `MerchantEditorSnapshot`.
- [ ] `apps/mobile/src/db/seeds/catalogue.ts` — add one entry to `MERCHANTS`:
      `{ slug: 'mercadolibre', name: 'MercadoLibre Chile', countryCode: null, defaultCategorySlug:
      'compras', aliases: ['MERCADOLIBRE COMPRA'] }`. Purely additive; the seed ledger and the
      `>= 5` assertion in `seeds.test.ts` both tolerate it.
- [ ] `apps/mobile/scripts/db/build-fixture.ts` — add the merchant-editor scenario movements
      ([Seed Data](#seed-data)). Ids and timestamps continue to come from
      `createDeterministicPorts()`, so `pnpm --filter @finanzas/mobile db:seed` stays byte-reproducible.
- [ ] `apps/mobile/src/db/__fixtures__/store-v1.sql` — regenerated, not hand-edited.
- [ ] **No migration.** `merchants`, `merchant_aliases` and every column this item reads or writes
      already exist at `schema_version` 1 (`apps/mobile/src/db/schema.ts`). Non-negotiable #5
      (migrations are additive) is untouched because there is no migration.

### Frontend / UI — `apps/mobile`

- [ ] `apps/mobile/app/categorize/merchant/[merchantId].tsx` — replace `RoutePlaceholder` with the
      real screen. Reads `merchantId` and the optional `categoryId` param
      ([Decision 3](#decision-3--the-a9-seam-is-one-optional-route-param-named-categoryid)), calls
      `useMerchantEditor`, renders the top bar, the name card, the state-dependent cards and the
      always-present "Guardar". Carries `testID={fidelityTestId('merchant-edit')}` →
      `fidelity-merchant-edit`.
- [ ] `apps/mobile/src/features/merchants/useMerchantEditor.ts` — the feature hook. Awaits
      `getAppDatabase()`, calls `readMerchantEditor`, owns `state: MerchantEditorState`, the draft
      `name` and draft `transactionCategoryId`, and exposes `setName`, `openCategoryPicker`,
      `selectCategory`, `confirmCategory`, `closeSuggestions`, `openSuggestions`, `groupCandidate`,
      `save`.
- [ ] `apps/mobile/src/features/merchants/types.ts` — `MerchantEditorState`
      (`'default' | 'suggestions' | 'category-picker'`) and the hook's public return type.
- [ ] `apps/mobile/src/features/merchants/components/MerchantNameCard.tsx` — `Card` + `TextField`
      (`label`, `hint`). Renders in every state (it has no `data-states` in the mockup).
- [ ] `apps/mobile/src/features/merchants/components/MerchantDefaultCategoryCard.tsx` — `Card` with
      `title` + `headerRight` "Cambiar" `Button` (`variant="outline"`, `size="sm"`), the category
      emoji, name and sub-line. States `default` and `suggestions`.
- [ ] `apps/mobile/src/features/merchants/components/MerchantCategoryPickerCard.tsx` — `Card` with a
      two-column `CategoryChip` grid and the "Guardar categoría" `Button`. State `category-picker`.
- [ ] `apps/mobile/src/features/merchants/components/MerchantSpendingStatsCard.tsx` — `Card` with the
      average `Amount`, the delta line and `MonthlyBars`. States `default` and `suggestions`.
- [ ] `apps/mobile/src/features/merchants/components/MonthlyBars.tsx` — the screen-local bar chart
      ([Decision 11](#decision-11--the-monthly-bar-chart-is-screen-local-not-a-design-system-primitive)).
- [ ] `apps/mobile/src/features/merchants/components/MerchantAliasesCard.tsx` — the `default`-state
      disclosure row ("Posibles nombres legales (N)") **and** the `suggestions`-state card with the
      "Actual" / "Agrupar" `Badge` rows and the "Cerrar" `Button`. Both live in one file because
      they are two faces of the same list.
- [ ] `apps/mobile/src/i18n/es.json` and `apps/mobile/src/i18n/en.json` — the `merchant.edit.*` key
      family ([i18n keys](#i18n-keys)). Flat dotted keys; `keySeparator` is `false`.
- [ ] Not-found branch: an unresolvable `merchantId` renders `EmptyState` with
      `merchant.edit.not_found_title` and a back action. Defensive, not a manifest state
      ([A6](#assumption-register)).

### Infrastructure / Configuration

- [ ] `scripts/mobile-ui/fidelity-targets.json` — flip the three `merchant-edit` rows from
      `planned` to `wired`, each gaining `app_file`, `deep_link` and `ready_test_id`
      ([Design-fidelity contract](#design-fidelity-contract)). This file is created by #47; #14 edits
      three rows and nothing else.
- [ ] No new dependency, no Expo config change, no CI change. `pnpm fidelity:contract` and
      `pnpm fidelity:test` already run on every PR once #47 has landed.

### Executable workflow shell snippets

Not applicable — this item adds no executable shell guidance on a framework-owned surface. The only
commands it introduces are the existing `pnpm` scripts quoted in the Implementation Order and the
runbook.

---

## Testing Strategy

**Test types**: Unit (domain), integration (repository against an in-memory SQLite), component
(hook + screen with React Native Testing Library), smoke (device runbook), fidelity (`pnpm fidelity
--issue 14`).

**Key scenarios**:

1. Grouping a candidate re-links the unattributed movements that match it and leaves every other
   column untouched — **AC1**.
2. Grouping the same candidate twice changes nothing the second time — **AC1**, idempotency.
3. Grouping a pattern that already exists on another merchant moves the alias row instead of
   inserting a duplicate — **AC1**, [Decision 8](#decision-8--grouping-re-points-an-existing-alias-row-rather-than-inserting-a-duplicate).
4. Saving a default category changes exactly one `merchants` row and leaves every `transactions` row
   byte-identical, including movements whose `category_source` is `'user'` — **AC2**.
5. `match_count` equals the number of merchant movements each alias explains, after grouping, after a
   re-point, and after a merchant loses all its movements — **AC3**.
6. All three manifest states render from one snapshot, and the disclosure count equals
   `aliases.length + candidates.length` — **AC4** (mockup parity) and non-negotiable #6.
7. `suggestAliasCandidates` is deterministic under input permutation and never suggests an existing
   alias — supports AC1.
8. A `categoryId` route param pre-selects the draft default without writing anything until "Guardar"
   — merged #13 spec A9 / Conflict 2.

**Test files**:

| File | Covers |
| --- | --- |
| `packages/shared-domain/src/merchant-suggestions.test.ts` | Scenario 7 and every row of the edge-case enumeration below |
| `apps/mobile/src/db/__tests__/merchants.test.ts` (extended) | Scenarios 1–5, plus the existing `deleteMerchant` cases |
| `apps/mobile/src/features/merchants/__tests__/useMerchantEditor.test.tsx` | Scenarios 6 and 8 |
| `docs/testing/mobile/14-merchant-editor-alias-grouping.smoke-test.md` | All four acceptance criteria on a device |

The hook test opens an in-memory store with `openMigratedMemoryDb()` from
`apps/mobile/src/db/testing/memory-db.ts` and mocks `apps/mobile/src/db/runtime` so
`getAppDatabase()` resolves to it. No test loads a native module.

**Regression suite**: the repository has no separate automated regression suite beyond Jest and the
fidelity gate; both are covered above.

### Parser-risk addendum

**Classification: parser-risk applies.** `suggestAliasCandidates` performs structured-text scanning
over free-form bank descriptions — tokenizing, normalizing and substring/prefix matching — and a
wrong match re-links real movements. The module is named for that responsibility
(`merchant-suggestions.ts`) and its behavior is described in scanning terms.

#### Edge-case enumeration — `suggestAliasCandidates`

Every row is one `it(...)` in `packages/shared-domain/src/merchant-suggestions.test.ts`. Unless
stated otherwise the merchant is `MercadoLibre Chile` with existing pattern `MERCADOLIBRE COMPRA`.

| # | Input descriptions | Expected | What it covers |
| --- | --- | --- | --- |
| 1 | `MERPAGO*MERCADOLIBRE` | one candidate, `rawPattern` `MERPAGO MERCADOLIBRE` | The mockup's own string; **P1** after normalization creates the token boundary the raw string lacked |
| 2 | `ML CHILE SPA` | no candidate | Boundary: `ML` is below `MIN_SIGNIFICANT_TOKEN_LENGTH`, `CHILE` and `SPA` are generic. Negative lookalike |
| 3 | `BANCO DE CHILE COMISION` | no candidate | Negative: shares only generic tokens with the merchant name |
| 4 | `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO` | no candidate | Its leading-two-token pattern equals the existing alias, so it is already "Actual", never a suggestion |
| 5 | `MERCADOPAGO SERVICIOS` | one candidate | **P3**: shares the prefix `MERCADO` (7 chars `>= MIN_SHARED_PREFIX_LENGTH`) with `MERCADOLIBRE COMPRA` |
| 6 | `MERCADOLIBRECL PAGO` | one candidate | **P2** containment: `MERCADOLIBRE` is a substring of the candidate token `MERCADOLIBRECL` |
| 7 | `TIENDA MERCADOLIBRE SUCURSAL MERCADOLIBRE` | one candidate, `movementCount` 1 | Multiple occurrences on one line collapse to one candidate, not two |
| 8 | Three identical `MERPAGO*MERCADOLIBRE` rows | one candidate, `movementCount` 3 | Grouping by pattern, not by row |
| 9 | `MERPAGO*MERCADOLIBRE` and `MERPAGO MERCADOLIBRE 0001` | one candidate, `movementCount` 2, `rawPattern` `MERPAGO MERCADOLIBRE` | The leading token run is the shared stable part; the variable tail is dropped |
| 10 | `MERCADOLIBRE` (single token) | one candidate, `rawPattern` `MERCADOLIBRE` | Fewer tokens than `CANDIDATE_TOKEN_COUNT` |
| 11 | `***` | no candidate | An all-punctuation description normalizes to empty and is dropped, never crashes |
| 12 | `` (empty string) | no candidate | Empty input |
| 13 | `MERPAGO*MERCADOLIBRE` with `merchantName: ''` and `existingPatterns: []` | no candidate | No evidence source means no suggestion, never "suggest everything" |
| 14 | Six distinct qualifying families | exactly `MAX_ALIAS_CANDIDATES` candidates, highest `movementCount` first | The cap, and the primary sort |
| 15 | Two qualifying families with equal `movementCount` | ASCII-ascending `rawPattern` order | The deterministic tie-break |
| 16 | The row-15 input in both array orders | identical output | Input order never affects the result |
| 17 | `MERPAGO*MÉRCADOLÍBRE` | same candidate as row 1 | Diacritic folding through `normalizeDescription` |
| 18 | `merpago*mercadolibre` (lower case) | same candidate as row 1 | Case folding |
| 19 | `  MERPAGO*MERCADOLIBRE   ` | same candidate as row 1 | Leading/trailing and collapsed inner whitespace |
| 20 | Merchant `Uber`, existing pattern `UBER *TRIP`, description `UBERTO PANADERIA` | no candidate | The classic false positive a bare substring search would produce. `UBER` is a substring of `UBERTO`, so this row also pins **P2**'s direction: containment is accepted only when the *merchant* token is contained in the candidate token **and** the candidate token is not itself a longer unrelated word — implemented by requiring the candidate token to start with the merchant token **or** the merchant token to start with the candidate token |

Row 20 is the one that constrains P2's exact form; implement P2 as prefix-containment in either
direction, not arbitrary substring, and keep row 6 green.

#### Suppression semantics

Not applicable — `suggestAliasCandidates` recognizes no inline or directive-based suppressions. There
is no comment syntax in a bank description, and adding one would be inventing a control the mockups
do not draw.

### Concurrent-event-source addendum

**Classification: not applicable.** The screen registers no event listener, socket callback, timer or
async queue. Its only asynchrony is the awaited `getAppDatabase()` and the awaited repository calls,
each driven by a user gesture. For completeness, the two places where an in-flight operation could
overlap are handled explicitly rather than left to chance:

- The load `useEffect` sets a `cancelled` flag in its cleanup and drops a late snapshot if the screen
  unmounted, so no state is set on an unmounted component.
- `groupCandidate` and `save` set a `busy` flag that disables the "Agrupar" rows and the "Guardar"
  button while a write is in flight, so a double tap cannot start two transactions. Both operations
  are additionally idempotent at the repository layer
  ([Decision 8](#decision-8--grouping-re-points-an-existing-alias-row-rather-than-inserting-a-duplicate)),
  so a race that got past the flag would still not corrupt the store.

---

## Design-fidelity contract

`AGENTS.md` non-negotiable #6, as extended by #47, requires every screen item to register its targets
in `scripts/mobile-ui/fidelity-targets.json`, flip them to `wired`, and paste the fidelity summary
into its PR. #47's coverage table already reserves three targets for `#14 · merchant-edit`, all
`planned`.

This item flips all three, each gaining `app_file`, `deep_link` and `ready_test_id`:

| `screen_id` | `state_id` | `app_file` | `deep_link` | `ready_test_id` |
| --- | --- | --- | --- | --- |
| `merchant-edit` | `default` | `apps/mobile/app/categorize/merchant/[merchantId].tsx` | `finanzas:///categorize/merchant/mercadolibre?fidelity=1&fidelityScreen=merchant-edit&fidelityState=default` | `fidelity-merchant-edit` |
| `merchant-edit` | `suggestions` | `apps/mobile/app/categorize/merchant/[merchantId].tsx` | `finanzas:///categorize/merchant/mercadolibre?fidelity=1&fidelityScreen=merchant-edit&fidelityState=suggestions` | `fidelity-merchant-edit` |
| `merchant-edit` | `category-picker` | `apps/mobile/app/categorize/merchant/[merchantId].tsx` | `finanzas:///categorize/merchant/mercadolibre?fidelity=1&fidelityScreen=merchant-edit&fidelityState=category-picker` | `fidelity-merchant-edit` |

The screen honours the requested state by seeding `MerchantEditorState` from
`useFidelityPreview().state` when `active` is true (`__DEV__`-only by #47's Decision 9), falling back
to `default`.

Two per-target `threshold_note` entries are required because this screen's fixture data cannot match
the mockup's illustrative numbers:

- `default` and `suggestions`: the stats card's three bars are computed from the *current* three
  calendar months ([Decision 12](#decision-12--the-statistics-window-is-the-current-month-and-the-two-before-it-anchored-to-today)),
  while the committed fixture's movements are dated 2025-11 → 2026-01, so the bars and amounts differ
  from the mockup's `$60.200 / −55%` sample. Raise `max_mismatch_pct` for these two targets and record
  the reason in `threshold_note`.
- `category-picker`: the mockup draws six chips; the app draws the full taxonomy for the merchant's
  observed direction ([A5](#assumption-register)), so the grid is taller.

If `scripts/mobile-ui/fidelity-targets.json` does not exist when implementation starts, **stop and
escalate** — #47 has not landed and this obligation cannot be met by inventing the contract.

---

## i18n keys

Flat dotted keys, Spanish copied verbatim from `design/mockups/mobile/index.html`, English written to
match. `apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` requires both catalogues to hold the
same key set.

| Key | Spanish (from the mockup) |
| --- | --- |
| `merchant.edit.title` | `Configurar comercio` |
| `merchant.edit.back_a11y` | `Volver` |
| `merchant.edit.name_label` | `Nombre del comercio` |
| `merchant.edit.name_hint` | `Este nombre se usará para agrupar todas las transacciones futuras.` |
| `merchant.edit.default_category_title` | `Categoría por defecto` |
| `merchant.edit.default_category_change` | `Cambiar` |
| `merchant.edit.default_category_sub` | `Se aplicará automáticamente a futuras transacciones` |
| `merchant.edit.default_category_none` | `Sin categoría por defecto` |
| `merchant.edit.picker_title` | `Elige una categoría` |
| `merchant.edit.picker_save` | `Guardar categoría` |
| `merchant.edit.stats_title` | `Estadísticas de gasto` |
| `merchant.edit.stats_average_label` | `Promedio mensual` |
| `merchant.edit.stats_delta` | `{{percent}} vs mes anterior` |
| `merchant.edit.aliases_disclosure` | `Posibles nombres legales ({{count}})` |
| `merchant.edit.aliases_title` | `Nombres detectados en tus movimientos` |
| `merchant.edit.alias_movements_one` | `{{count}} movimiento` |
| `merchant.edit.alias_movements_other` | `{{count}} movimientos` |
| `merchant.edit.alias_badge_current` | `Actual` |
| `merchant.edit.alias_badge_group` | `Agrupar` |
| `merchant.edit.aliases_empty` | `Aún no detectamos otros nombres para este comercio.` |
| `merchant.edit.aliases_close` | `Cerrar` |
| `merchant.edit.save` | `Guardar` |
| `merchant.edit.not_found_title` | `No encontramos este comercio` |
| `merchant.edit.not_found_action` | `Volver` |

`_one` / `_other` are i18next's plural suffixes; they work with `keySeparator: false` because the
suffix is appended to the flat key, not nested under it. The mockup only draws the plural form —
the singular is required by i18next and is the honest Spanish for a count of one. `merchant.edit.aliases_empty`
and the two `not_found_*` keys have no mockup source and are recorded as
[A6](#assumption-register) / [A7](#assumption-register).

Category names and emoji come from `listCategories(db, locale)` in
`apps/mobile/src/db/repositories/categories.ts` — they are data, not copy, and never enter the
catalogues.

---

## Assumptions

No human was available for the alignment conversation, so every gap was resolved from, in order: the
work item brief, the merged #13 spec, `design/mockups/mobile/BEHAVIOR.md`,
`design/mockups/mobile/index.html`, `docs/project/1-business-domain.md` and
`docs/project/4-database-model.md`. Each is a reversible default.

### Assumption register

| # | Assumption | Source | Confirmation requested |
| --- | --- | --- | --- |
| A1 | The screen is a draft form: name and default category persist only on the bottom "Guardar"; "Guardar categoría" only closes the picker. | The mockup's own `onclick` handlers — both category buttons call `go('merchant-edit', …)`, only the bottom button leaves the screen | No |
| A2 | Alias grouping persists immediately on "Agrupar" rather than joining the draft. | The row's movement count is the feedback; the mockup draws no confirmation | Yes |
| A3 | Re-linking claims only movements with no merchant. A movement already attributed to another merchant is never moved. | Derived: silently moving money between merchants has no drawn affordance and no undo | Yes |
| A4 | Suggestions come from the person's own movements with the significant-token / containment / shared-prefix rule, so the mockup's `ML CHILE SPA` row is not reproduced by the MVP. | Card title "Nombres detectados en tus movimientos"; `BEHAVIOR.md`; `1-business-domain.md` puts community suggestions out of MVP | Yes |
| A5 | The category picker lists the **full** taxonomy for the merchant's observed direction — the direction of most of its included movements, expense on a tie or with no movements. The mockup's six chips are sample data. | Mockup grid vs. the seeded taxonomy of ten expense and six income categories; #13 spec's precedent that mockup digits are samples | Yes |
| A6 | A merchant with neither aliases nor candidates still renders the disclosure row, with `(0)`, opening a card that shows `merchant.edit.aliases_empty`. | Derived: the manifest declares no fourth state, and hiding the row would create an undrawn render branch | Yes |
| A7 | An unresolvable `merchantId` renders an `EmptyState` with a back action rather than crashing or rendering an empty form. | Derived: the route is deep-linkable, so a bad id is reachable | No |
| A8 | The stats card totals expense movements only, matching its drawn title "Estadísticas de gasto"; an income-only merchant shows three zero bars and `$0`. | Mockup card title | Yes |
| A9 | The three-month window is anchored to today, not to the merchant's last activity, so a dormant merchant shows empty bars. | Brief Scope "over the last three months"; `BEHAVIOR.md → home` "mes por `deriveDateLocal`, nunca UTC" | Yes |
| A10 | Configuring a seeded merchant sets `merchants.user_id`, which makes future auto-categorization from it read as `rule` rather than `auto`. | `4-database-model.md` `user_id` note; #5 `suggestCategory`; #13 spec's provenance table | Yes |
| A11 | A grouped candidate is stored with `match_type: 'prefix'`, matching the schema default and the seed catalogue, so future movements with the same leading tokens and a variable tail also resolve. | `schema.ts` default `'prefix'`; `catalogue.ts` seeds every alias as `'prefix'` | No |
| A12 | The `categoryId` route param is the A9 wire format; #13's implementation must emit it. | Merged #13 spec A9 / Conflict 2, which fixes the behaviour but not the param name | Yes |
| A13 | `MercadoLibre Chile` joins the seed catalogue as starter content alongside Líder, Jumbo, Uber, Copec and Netflix, so the drawn merchant is real on a fresh install. | `catalogue.ts` MERCHANTS list; the mockup's own merchant | Yes |

---

## Seed Data

Two additive changes. Neither alters an existing row.

| Entity | Values / Scenario | File |
| --- | --- | --- |
| `merchants` (starter content) | `mercadolibre` → name `MercadoLibre Chile`, `countryCode: null`, `defaultCategorySlug: 'compras'` | `apps/mobile/src/db/seeds/catalogue.ts` (`MERCHANTS`) |
| `merchant_aliases` (starter content) | One alias for `mercadolibre`: `MERCADOLIBRE COMPRA`, `matchType: 'prefix'` | `apps/mobile/src/db/seeds/catalogue.ts` (`MERCHANTS[].aliases`) |
| `transactions` (dev fixture) | Three movements already attributed to `mercadolibre`, `rawDescription: 'MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO'`, `type: 'debit'`, dated `2025-11-18`, `2025-12-09`, `2026-01-14`, amounts `74300`, `52100`, `24000` — gives the stats card a non-empty total in each of three consecutive months | `apps/mobile/scripts/db/build-fixture.ts` |
| `transactions` (dev fixture) | Two movements with `merchantId: null`, `rawDescription: 'MERPAGO*MERCADOLIBRE'`, dated `2025-12-20` and `2026-01-06` — the candidate the suggestions state must offer, `movementCount = 2` | `apps/mobile/scripts/db/build-fixture.ts` |
| `transactions` (dev fixture) | One movement with `merchantId: null`, `rawDescription: 'ML CHILE SPA'`, dated `2026-01-10` — the negative control: it must **not** appear as a candidate ([A4](#assumption-register)) | `apps/mobile/scripts/db/build-fixture.ts` |
| `transactions` (dev fixture) | One movement already attributed to `mercadolibre`, `rawDescription: 'MERCADOLIBRE COMPRA ONLINE SUSCRIPCION'`, `type: 'debit'`, dated `2026-01-16`, amount `18990`, with `transactionCategoryId: 'comida'` and `categorySource: 'user'` — the AC2 witness: changing the merchant default must leave this row untouched. With the three rows above it, the seeded alias `MERCADOLIBRE COMPRA` explains four movements, so its `match_count` is `4` | `apps/mobile/scripts/db/build-fixture.ts` |
| `apps/mobile/src/db/__fixtures__/store-v1.sql` | Regenerated by `pnpm --filter @finanzas/mobile db:seed`; must be byte-identical when run twice | generated |

The fixture's existing movements (`LIDER`, `UBER *TRIP`, `JUMBO`, `COPEC`, the excluded ones) are
untouched. Home and dashboard aggregates in #12's and #17's runbooks shift by the added amounts; #12's
runbook already states that fixture amounts differ from the mockup's sample numbers, so the shape
assertions it makes still hold.

---

## Documentation Updates

Identified here, executed by the developer during implementation.

- [ ] `docs/project/4-database-model.md` — in the `merchants` table, note that
      `transaction_category_id` is set by this editor and that `user_id` transitions from null to the
      local user when a seeded merchant is configured
      ([Decision 6](#decision-6--configuring-a-seeded-merchant-marks-it-person-owned-merchantsuser_id)).
      In `merchant_aliases`, replace the bare `match_count` description with the recompute semantics
      from [Decision 7](#decision-7--match_count-is-recomputed-never-incremented).
- [ ] `docs/project/1-business-domain.md` — extend the **Merchant** entity paragraph with what a
      person can now do: rename it, fold raw bank strings into it, and set a default category that
      applies to future movements only and never rewrites a category the person confirmed.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — in `### merchant-edit`, resolve the 🟡 markers this item
      settles (renaming, accepting an alias, and the "does it re-categorize the past?" question,
      answered **no**). Leave any marker this item does not decide.
- [ ] `docs/project/2-repo-architecture.md` and `docs/project/3-software-architecture.md` — **only if
      this item is the first to create `apps/mobile/src/features/`**: record the feature-hook layer
      (`app/ → feature hooks → src/db`) with `getAppDatabase()` and no TanStack Query. If #8 or #12
      landed first and already documented it, skip both.
- [ ] `AGENTS.md` — **None**. Non-negotiable #6's fidelity clause is #47's edit, and no command,
      convention or troubleshooting row changes here.
- [ ] `CHANGELOG.md` — under `[Unreleased]`, in the implementation PR only. Not in this plan PR.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The suggestion rule surfaces a wrong family and grouping re-links unrelated movements, with no undo drawn | Med | High | Precision over recall: generic-token stop list, a four-character significant-token floor, prefix-containment rather than arbitrary substring (edge-case row 20), and re-linking restricted to movements with no merchant ([Decision 9](#decision-9--re-linking-touches-merchant_id-only-and-only-unattributed-movements)). Reversal is grouping the family back onto its original merchant, which [Decision 8](#decision-8--grouping-re-points-an-existing-alias-row-rather-than-inserting-a-duplicate) supports |
| `#5` (PR `#44`) merges with a changed export surface, breaking the imports this plan names | Low | Med | The surface was read from the branch head, not from the plan (Verification Log). Implementation step 1 re-verifies it before writing any consumer, and stops if it moved |
| `#47` has not landed, so the fidelity targets cannot be flipped | Med | Med | Listed as a blocking dependency; the Design-fidelity contract section says to stop and escalate rather than invent the contract file |
| Re-link and recount scan the movements table in TypeScript rather than SQL | Med | Low | Both read only `id` plus one text column, and recount is bounded to one merchant's movements. If a device with tens of thousands of movements ever makes this visible, the fix is a `LIKE` pre-filter on the pattern's alphanumeric head before the exact matcher — additive, no schema change |
| The stats card shows three empty bars because the committed fixture is dated 2025-11 → 2026-01 and the window is anchored to today | High | Low | Numbers are proven by repository tests with an injected `today`; the runbook verifies shape on device and records the limitation; the fidelity targets carry a `threshold_note` |
| Extending the dev fixture shifts totals that #12's and #17's runbooks read | Med | Low | The additions are all in Nov 2025 – Jan 2026 and #12's runbook already states fixture amounts differ from the mockup samples. `pnpm test` must be green after regeneration, which is Implementation Order step 11's verification |
| Two items create `apps/mobile/src/db/runtime.ts` concurrently | Med | Med | [Decision 2](#decision-2--getappdatabase-is-created-by-whichever-item-lands-first) makes the content identical to #8's plan, so the conflict resolves to "take either side" |

---

## Code Samples

All samples are illustrative — adapt during implementation.

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/db/repositories/merchants.ts

export function groupAliasIntoMerchant(
  db: AppDatabase,
  params: {
    merchantId: string;
    rawPattern: string;
    matchType?: MerchantMatchType; // defaults to 'prefix' (A11)
    newId: NewId;
    now: Now;
  },
): void {
  const pattern = normalizeDescription(params.rawPattern);
  // Fixed sentence, no interpolation of the input — the house rule in shared-domain and in
  // src/db: a thrown message never echoes caller-supplied content (Business Rule 1).
  if (pattern === '') throw new RangeError('groupAliasIntoMerchant: empty pattern');

  db.transaction((tx: AppDatabase) => {
    // 1. One row per raw_pattern, globally (Decision 8).
    const existing = tx
      .select()
      .from(merchantAliases)
      .where(eq(merchantAliases.rawPattern, pattern))
      .get();

    if (!existing) {
      tx.insert(merchantAliases)
        .values({
          id: params.newId(),
          merchantId: params.merchantId,
          rawPattern: pattern,
          matchType: params.matchType ?? 'prefix',
        })
        .run();
    } else if (existing.merchantId !== params.merchantId) {
      tx.update(merchantAliases)
        .set({ merchantId: params.merchantId })
        .where(eq(merchantAliases.id, existing.id))
        .run();
    }

    // 2. Re-link only unattributed movements, and only their merchant_id (Decision 9).
    const orphans = tx
      .select({ id: transactions.id, rawDescription: transactions.rawDescription })
      .from(transactions)
      .where(sql`${transactions.merchantId} is null`)
      .all();

    const matched = orphans
      .filter((row) =>
        aliasMatches(row.rawDescription, {
          rawPattern: pattern,
          matchType: params.matchType ?? 'prefix',
        }),
      )
      .map((row) => row.id);

    if (matched.length > 0) {
      tx.update(transactions)
        .set({ merchantId: params.merchantId, updatedAt: params.now() })
        .where(inArray(transactions.id, matched))
        .run();
    }

    // 3. Counts are recomputed, never incremented (Decision 7).
    recountMerchantAliases(tx, params.merchantId);
  });
}
```

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/merchants/useMerchantEditor.ts

export function useMerchantEditor(params: {
  merchantId: string;
  initialCategoryId?: string; // the `categoryId` route param (Decision 3)
  today: DateLocal;
  initialState?: MerchantEditorState; // seeded from useFidelityPreview() in __DEV__
}) {
  const [snapshot, setSnapshot] = useState<MerchantEditorSnapshot | null>(null);
  const [state, setState] = useState<MerchantEditorState>(params.initialState ?? 'default');
  const [draftName, setDraftName] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = await getAppDatabase();
    return readMerchantEditor(db, { merchantId: params.merchantId, today: params.today });
  }, [params.merchantId, params.today]);

  useEffect(() => {
    let cancelled = false;
    void load().then((next) => {
      if (cancelled || !next) return setSnapshot(next ?? null);
      setSnapshot(next);
      setDraftName(next.merchant.name);
      // The carried category wins only when it resolves to a real category (Decision 3).
      const carried = next.categories.some((c) => c.id === params.initialCategoryId)
        ? (params.initialCategoryId ?? null)
        : null;
      setDraftCategoryId(carried ?? next.merchant.transactionCategoryId);
    });
    return () => {
      cancelled = true;
    };
  }, [load, params.initialCategoryId]);

  // groupCandidate / save both guard on `busy` and re-read the snapshot on success.
}
```

---

## Implementation Order

1. **Verify the dependency surfaces.** Confirm `packages/shared-domain/src/merchant-matching.ts`
   exports `normalizeDescription`, `aliasMatches` and `resolveMerchant`, that
   `packages/shared-domain/src/aggregates.ts` exports `computePeriodDelta`, and that
   `scripts/mobile-ui/fidelity-targets.json` exists with three `planned` `merchant-edit` rows.
   *Verify*: `pnpm --filter @finanzas/shared-domain test` is green and
   `pnpm fidelity:contract` prints a valid summary line. If either is missing, stop and escalate —
   #5 or #47 has not landed.

2. **`packages/shared-domain/src/merchant-suggestions.ts` + its test.** Implement
   `suggestAliasCandidates` and the exported constants, then write one `it(...)` per row of the
   edge-case enumeration.
   *Verify*: `pnpm --filter @finanzas/shared-domain test -- merchant-suggestions` is green, and the
   run reports one test per enumerated row.

3. **Export it and update the surface guard.** Add `export * from './merchant-suggestions';` to
   `packages/shared-domain/src/index.ts` and `suggestAliasCandidates` to the expected-surface
   assertion in `domain-surface.test.ts`.
   *Verify*: `pnpm --filter @finanzas/shared-domain test` and `pnpm --filter @finanzas/shared-domain
   lint` are both green — the purity lint must still pass, so the new module imports no React, no
   SQL and no `Date`.

4. **`apps/mobile/src/db/runtime.ts`** — if the file is absent, create it exactly as #8's plan
   Decision 1 specifies ([Decision 2](#decision-2--getappdatabase-is-created-by-whichever-item-lands-first)).
   If it exists, change nothing.
   *Verify*: `pnpm --filter @finanzas/mobile lint` reports no `dbAccessBoundary` violation, and
   `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` is green.

5. **Domain types.** Add `MerchantProfile`, `MerchantAliasView`, `MerchantMonthTotal`,
   `MerchantSpendingStats` and `MerchantEditorSnapshot` to `apps/mobile/src/db/types.ts`.
   *Verify*: `pnpm --filter @finanzas/mobile typecheck` is green.

6. **Repository writes.** Implement `recountMerchantAliases`, `groupAliasIntoMerchant` and
   `saveMerchantProfile` in `apps/mobile/src/db/repositories/merchants.ts`, each with the doc comment
   style the file already uses (naming the decision and the acceptance criterion).
   *Verify*: new cases in `apps/mobile/src/db/__tests__/merchants.test.ts` cover scenarios 1–5 of the
   Testing Strategy; `pnpm --filter @finanzas/mobile test -- merchants` is green.

7. **Repository read.** Implement `readMerchantEditor` — merchant, aliases with recomputed counts,
   candidates via `suggestAliasCandidates`, the categories for the picker, and the three monthly
   totals through the `isIncluded` / `includedAmount` fragments, all inside one `db.transaction`.
   *Verify*: `pnpm --filter @finanzas/mobile test -- merchants` is green and
   `apps/mobile/src/db/__tests__/inclusion-rule-single-definition.test.ts` still passes — the
   inclusion rule must not be restated.

8. **i18n keys.** Add the `merchant.edit.*` family to `es.json` and `en.json`.
   *Verify*: `pnpm --filter @finanzas/mobile test -- catalogue-parity` is green.

9. **The feature hook and its components.** Create `apps/mobile/src/features/merchants/` with
   `types.ts`, `useMerchantEditor.ts`, and the `components/` files listed under
   [Frontend / UI](#frontend--ui--appsmobile).
   *Verify*: `pnpm --filter @finanzas/mobile lint` reports no `i18next/no-literal-string` and no
   `no-restricted-imports` violation.

10. **The screen.** Replace the `RoutePlaceholder` body of
    `apps/mobile/app/categorize/merchant/[merchantId].tsx` with the real screen, including the
    `testID` and the fidelity-preview state seed.
    *Verify*: `apps/mobile/src/features/merchants/__tests__/useMerchantEditor.test.tsx` covers
    scenarios 6 and 8; `pnpm --filter @finanzas/mobile test` is green.

11. **Seed catalogue and dev fixture.** Add the `mercadolibre` merchant and its alias to
    `catalogue.ts`, add the movements from [Seed Data](#seed-data) to `build-fixture.ts`, then run
    `pnpm --filter @finanzas/mobile db:seed`.
    *Verify*: run `db:seed` twice; `git status` must be clean after the second run. Then run
    `pnpm test` at the repo root and confirm the output lists no failures — in particular
    `seeds.test.ts` and `transactions.test.ts`.

12. **Design-fidelity contract.** Flip the three `merchant-edit` rows in
    `scripts/mobile-ui/fidelity-targets.json` to `wired` with the `app_file`, `deep_link` and
    `ready_test_id` values in the [Design-fidelity contract](#design-fidelity-contract) table, adding
    the two `threshold_note` entries.
    *Verify*: `pnpm fidelity:contract` passes and its summary line reports three more `wired` targets
    than before; `pnpm fidelity --issue 14` on the simulator produces a comparison for each of the
    three states. Paste the summary table into the PR.

13. **Walk the runbook.** Execute
    `docs/testing/mobile/14-merchant-editor-alias-grouping.smoke-test.md` end to end on a dev build,
    with `design/mockups/mobile/index.html#screen=merchant-edit` open beside it.
    *Verify*: every assertion in the runbook's checklist is ticked, including the fidelity step.

14. **Project docs.** Apply every item in [Documentation Updates](#documentation-updates).
    *Verify*: `npx markdownlint-cli2 "docs/specs/developments/**/*.md" "docs/testing/workflow/**/*.md" "CHANGELOG.md"` is clean.

15. **CHANGELOG.** Add under `[Unreleased]`, verbatim:

    ```markdown
    - **Merchant editor and alias grouping** (#14): `#screen=merchant-edit` ships all three of its MVP states. A person can rename a merchant, fold several raw bank descriptions into it, and set a default category that applies to future movements only — a category the person already confirmed is never overwritten. Grouping an alias re-points or creates one `merchant_aliases` row, re-links unattributed movements that match it, and recomputes every alias's `match_count` from the movements table in one transaction. Alias suggestions are derived on device from the person's own movements; there is no backend and no community source. The screen also shows the merchant's spending over the current month and the two before it.
    ```

---

## Handoff Notes

**Residual verification strategy** (required for the pattern-completeness parts of this item):

- *All MVP manifest states implemented*: the evidence is
  `pnpm fidelity:contract` reporting three `wired` `merchant-edit` targets plus the `pnpm fidelity
  --issue 14` run producing one comparison per state. A `planned` target left behind is a contract
  failure, not a judgement call.
- *All Spanish copy sourced from the mockup*: the evidence is the [i18n keys](#i18n-keys) table read
  against `awk '/id="s-merchant-edit"/,/<\/section>/' design/mockups/mobile/index.html`, plus a clean
  `i18next/no-literal-string` lint run. The three keys with no mockup source are named in that table
  and justified in the assumption register.
- *All enumerated parser edge cases tested*: the evidence is one named `it(...)` per row of
  [Edge-case enumeration](#edge-case-enumeration--suggestaliascandidates) in
  `packages/shared-domain/src/merchant-suggestions.test.ts`.
