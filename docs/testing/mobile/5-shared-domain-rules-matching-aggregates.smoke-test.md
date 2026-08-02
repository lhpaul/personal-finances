# Smoke Test Runbook: shared-domain — Rules, Matching and Aggregates

**Feature**: `@finanzas/shared-domain` — the inclusion rule as domain logic, merchant alias
matching, category suggestion with provenance, and period aggregates
**Spec**: None — this is a **Refactor**-routed item. The work item brief is
[GitHub issue #5](https://github.com/lhpaul/personal-finances/issues/5).
**Implementation plan**: [`../../specs/developments/20260802125300_5-shared-domain-rules-matching-aggregates/2_5-shared-domain-rules-matching-aggregates_implementation-plan.md`](../../specs/developments/20260802125300_5-shared-domain-rules-matching-aggregates/2_5-shared-domain-rules-matching-aggregates_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

This item ships a pure TypeScript library with no UI, no database, no network and no async. The
entire runbook runs on the command line; there is no simulator step and no device step.

- [ ] Node 22 active (`nvm use`; the repository pins Node 22 via `.nvmrc`)
- [ ] `pnpm install --node-linker=hoisted` has been run from the repository root. The explicit
      flag is required until item #35 (PR #39) lands the `.npmrc` fix; a plain `pnpm install`
      will not honour `node-linker=hoisted` in this worktree
- [ ] You are on the implementation branch for issue #5, with a clean working tree
- [ ] `design/mockups/mobile/index.html` opens in a browser (`pnpm mockups:mobile`)

---

## Test Data

Every value below is either transcribed from the UI contract
(`design/mockups/mobile/index.html`) or hand-derived in the implementation plan's *AC2* section.
No database seed data is required.

| Item | Value |
| --- | --- |
| Command prefix | `pnpm --filter @finanzas/shared-domain` |
| Inclusion vector — full | `{ amount: 42000, includedAmount: null, excludedAt: null }` → contributes `42000` |
| **Inclusion vector — partial (the blocking case)** | `{ amount: 42000, includedAmount: 21000, excludedAt: null }` → contributes **`21000`** |
| Inclusion vector — partial zero | `{ amount: 42000, includedAmount: 0, excludedAt: null }` → contributes `0` |
| Inclusion vector — excluded | `{ amount: 15000, includedAmount: null, excludedAt: '2025-01-21T10:00:00Z' }` → contributes `0` |
| Fixture A (period aggregate) | `42000` full + `42000/21000` partial + `15000` excluded, all `debit`, in `2025-01-01`…`2025-01-31`, `asOf: '2025-01-29'` |
| Fixture A expected | `expenseTotal` `63000`; buckets `comida` `42000` / `667` tenths and `compras` `21000` / `333` tenths; `excludedCount` `1`; `dailyAverageExpense` `2172` |
| Fixture C expected (uncategorized bucket) | `expenseTotal` `84000`; buckets `500` / `250` / `250` tenths; `dailyAverageExpense` `2897` |
| Fixture D expected (tie-break) | three weights of `1000` → `334` / `333` / `333` tenths, sum `1000` |
| Delta vectors | `(88000, 100000)` → `-120` tenths; `(2001, 2000)` → `1`; `(50000, 0)` → `null`; `(0, 80000)` → `-1000` |
| Normalization vectors | `MERPAGO*MERCADOLIBRE` → `MERPAGO MERCADOLIBRE`; `FARMACIA ÑUÑOA` → `FARMACIA NUNOA`; `***` → `` (empty) |
| Matching negatives | `prefix 'LIDER'` vs `LIDERAZGO CAPACITACION` → `false`; `contains 'UBER'` vs `UBERTO PANADERIA` → `false` |
| Matching positives | `contains 'LIDER'` vs `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` → `true`; `contains 'UBER'` vs `UBER BV` → `true` |
| Mockup reference | `design/mockups/mobile/index.html`, screens `#screen=home`, `#screen=dashboard`, `#screen=categorize-complete`, `#screen=merchant-edit&state=suggestions`, `#screen=transaction-detail` |

---

## Smoke Test Steps

### Step 0: Clean baseline

1. From the repository root, run `pnpm install --node-linker=hoisted`.
2. Run `git status --short` and confirm the working tree is clean apart from this item's own
   changes.

**Expected result**: install completes; no unexpected modified files, and in particular no
change to `.npmrc`, to `packages/shared-domain/package.json`, or to anything under `apps/`.

### Step 1: The package's own suite is green

**Maps to**: AC1, AC2, AC4

1. Run `pnpm --filter @finanzas/shared-domain test`.
2. Read the summary line and the test names.

**Expected result**: every test passes and zero are skipped. The output includes test names for
`inclusion`, `apportionment`, `merchant-matching`, `category-suggestion`, `aggregates`,
`clock-injection` and `domain-surface`.

### Step 2: The partial-inclusion branch computes the right number — **the blocking check**

**Maps to**: AC2

Partial inclusion has no UI in the MVP (`included_amount` is always `null` in the shipping app),
so this is the one step that proves the branch is correct rather than merely present. It asserts
arithmetic, not the existence of a field.

1. Run `pnpm --filter @finanzas/shared-domain test -- inclusion` and confirm the `partial` case
   (`amount` `42000`, `includedAmount` `21000`, not excluded) asserts a contribution of exactly
   **`21000`** — not `42000`.
2. Run `pnpm --filter @finanzas/shared-domain test -- aggregates` and confirm the Fixture A test
   asserts `expenseTotal` of exactly **`63000`** (`42000 + 21000`), and that the excluded
   movement's `15000` appears in no assertion's expected value.
3. Confirm the Fixture A test also asserts the `compras` bucket's `total` is **`21000`**, not
   `42000` — the partial amount reaching the per-category breakdown, not just the grand total.
4. Confirm the `partial-zero` case asserts `0` (an `includedAmount` of `0` is a real partial
   amount, not an absence).
5. **Planted-violation cycle.** Temporarily change `effectiveAmount` in
   `packages/shared-domain/src/inclusion.ts` from `m.includedAmount ?? m.amount` to
   `m.includedAmount || m.amount`, re-run step 1, and read the failure.
6. Revert the change and re-run step 1.

**Expected result**: steps 1-4 pass with the exact numbers named. Step 5 fails at the
`partial-zero` case's named assertion (expected `0`, received `42000`), proving the test would
catch the `||` bug rather than tolerating it. Step 6 is green again. The temporary change is
**never** committed.

> Do **not** relax any of these numbers on the grounds that partial inclusion is out of MVP
> scope. That is a UI-layer fact; the rule is general, and this is the only place it is
> exercised until partial inclusion ships.

### Step 3: The inclusion rule agrees with its SQL twin — without either being used as evidence

**Maps to**: AC2

1. Open `packages/shared-domain/src/inclusion.ts` and read the header comment. Confirm it
   quotes Business Rule 4 verbatim, names `apps/mobile/src/db/fragments.ts` as the SQL twin,
   carries the clause-by-clause equivalence table, and states that a third statement of the rule
   is a review blocker.
2. Confirm `INCLUSION_RULE_CASES` is exported and contains the seven rows of the implementation
   plan's AC2 table, with the expected values written as literals.
3. Run `grep -rn 'excludedAt\|includedAmount' packages/shared-domain/src --include='*.ts'` and
   confirm the only files that *compute* the rule are `inclusion.ts` (the definition) and
   `aggregates.ts` (which calls `contributedAmount`, never restating `?? ` or `=== null`
   itself).
4. Confirm no test in this package imports anything from `apps/` (it cannot — the purity rule
   forbids it — but confirm the tests do not attempt to compare against the SQL side at all).

**Expected result**: the cross-reference is documented, the expected values are literals, and
the domain implementation is asserted against those literals rather than against the SQL
fragment's output. Agreement between the two implementations is nowhere used as evidence.

### Step 4: Percentages sum to 100, explicitly

**Maps to**: AC4

1. Run `pnpm --filter @finanzas/shared-domain test -- apportionment`.
2. Confirm the three-equal-thirds fixture asserts `334` / `333` / `333` and a sum of `1000`.
3. Confirm the two documented exceptions are asserted explicitly: a total weight of `0` yields
   every bucket `0` (sum `0`, not `1000`), and an empty input yields an empty result.
4. **Planted-violation cycle.** Temporarily replace the leftover-tenth distribution with
   per-bucket `Math.round(weight * 1000 / total)`, re-run, and read the failure.
5. Revert and re-run.

**Expected result**: step 1 is green. Step 4 fails at the three-equal-thirds fixture's
`expect(sum).toBe(1000)` (received `999`), proving the invariant test is load-bearing. Step 5 is
green again.

### Step 5: The clock is injected, and the purity rules are enforced rather than assumed

**Maps to**: AC3

Part A — the **existing** rule (confirm it is wired into this package's own lint run; do not
re-invent it):

1. Temporarily add `import 'drizzle-orm';` to `packages/shared-domain/src/index.ts`.
2. Run `pnpm --filter @finanzas/shared-domain lint` and read the failure.
3. Remove the line and re-run; confirm clean.

Part B — the **new** React restriction (positive and negative case):

1. Temporarily add `import 'react';` to `packages/shared-domain/src/index.ts`.
2. Run `pnpm --filter @finanzas/shared-domain lint`; confirm it fails naming
   `no-restricted-imports` and the React message.
3. Remove the line, and instead temporarily add `import 'node:assert';` alongside the existing
   `@finanzas/shared-utils` import.
4. Run `pnpm --filter @finanzas/shared-domain lint`; confirm it **passes** — the rule must not
   over-fire on an unrestricted import.
5. Remove the line and confirm clean.

Part C — the **new** clock restriction (positive and negative case):

1. Temporarily add `const t = Date.now();` and `const d = new Date();` to
   `packages/shared-domain/src/aggregates.ts`.
2. Run `pnpm --filter @finanzas/shared-domain lint`; confirm it fails **once per occurrence**,
   naming the rule and the "the instant is injected as a `DateLocal`" message.
3. Remove both lines; confirm clean.
4. If step 2 does **not** fail, the `no-restricted-globals` mechanism is not honoured by this
   toolchain version: switch to the `no-restricted-syntax` fallback named in the implementation
   plan's Decision 8, repeat steps 1-3, and record the substitution in the PR description.

Part D — behavioural proof:

1. Run `pnpm --filter @finanzas/shared-domain test -- clock-injection` and confirm the full
   aggregate output is asserted byte-identical under both fake system times and with no fake
   timers.
2. Run the suite three times: `TZ=Pacific/Kiritimati pnpm --filter @finanzas/shared-domain test`,
   `TZ=UTC pnpm --filter @finanzas/shared-domain test`, and
   `TZ=America/Santiago pnpm --filter @finanzas/shared-domain test`.

**Expected result**: every planted violation fails at the named rule and every removal returns
to clean; the negative control in Part B step 4 passes, proving the rule does not over-fire. All
three `TZ` runs report the same number of passing tests — a difference between any two means a
code path is reading the host zone. No planted violation is **ever** committed.

> Do not run this step against `packages/shared-domain/src/domain-purity-lint.test.ts` if that
> file exists. It is item #35's file (PR #39), and its assertions — the verbatim message string,
> the finding count of 4, and the `node:assert` negative control — must not be altered.

### Step 6: The domain has no identity, credential or clock surface

**Maps to**: AC3, Business Rules 0, 1, 2

1. Run `pnpm --filter @finanzas/shared-domain test -- domain-surface` and confirm it passes.
2. **Planted-violation cycle.** Temporarily add
   `export const credentialHelper = () => null;` to `packages/shared-domain/src/index.ts`,
   re-run, read the failure, then remove it and re-run.
3. Runtime reflection cannot see erased TypeScript types, so cover type names by hand:
   run `grep -rniE 'password|credential|secret|token|session|\brut\b' packages/shared-domain/src`
   and read every match.
4. Run `grep -rn 'Date' packages/shared-domain/src` and read every match.

**Expected result**: step 1 passes; step 2 fails naming `credentialHelper` and then returns to
clean. Step 3's only matches are in comments explaining what the package deliberately does not
carry — no type, field or parameter name. Step 4's only matches are `DateLocal` (the injected
civil-date string type) and comments; there is no `Date.now()`, no `new Date(`, and no
`setSystemTime(new Date(` in any test.

### Step 7: Merchant matching does not over-fire

**Maps to**: brief Scope bullet 2

1. Run `pnpm --filter @finanzas/shared-domain test -- merchant-matching`.
2. Confirm the run reports a passing test for each negative case: `prefix 'LIDER'` against
   `LIDERAZGO CAPACITACION` is `false`, `contains 'UBER'` against `UBERTO PANADERIA` is `false`,
   `exact 'ML CHILE SPA'` against `ML CHILE SPA LTDA` is `false`, and an empty (or
   all-punctuation) pattern matches nothing.
3. Confirm the permutation test asserts `resolveMerchant` returns the same merchant for every
   ordering of the same alias array.
4. Confirm the idempotence test asserts `normalizeDescription(normalizeDescription(x))` equals
   `normalizeDescription(x)` for every normalization fixture.

**Expected result**: every case passes. A matcher that only ever fires is not verified; the
negative cases are what prove it discriminates.

### Step 8: The package is still pure and its one consumer still builds

**Maps to**: AC3, brief Scope bullet 5

1. Run `pnpm --filter @finanzas/shared-domain typecheck` and `pnpm --filter @finanzas/shared-utils typecheck`.
2. Run `pnpm --filter @finanzas/mobile test` and confirm
   `apps/mobile/src/__tests__/workspace-wiring.test.ts` still passes — `PACKAGE_NAME` must still
   be exported from `packages/shared-domain/src/index.ts`.
3. Run `pnpm build` and confirm it emits `dist/` with declarations for
   `packages/shared-domain`, `packages/shared-utils` and `packages/bank-scraper`.
   (`apps/mobile` has no `build` script; step 2 covers that consumer.)
4. Confirm `packages/shared-domain/package.json` is **unmodified** by this item
   (`git diff --name-only` must not list it) and that its only dependency is still
   `@finanzas/shared-utils: workspace:*`.
5. Run `pnpm lint` from the repository root.

**Expected result**: all five commands succeed, and `packages/shared-domain/package.json` is
untouched — it is item #35's file in the current window.

### Step 9: Design fidelity — expected vs actual

**Maps to**: AC4, and AGENTS.md non-negotiable 6 (the mockups are the UI contract)

Design assets were discovered per
[`../../workflow/development-workflow/design-assets.md`](../../workflow/development-workflow/design-assets.md):
issue #5 has no `## Design assets` section and there are no tracker attachments, so the
authoritative reference is the repository's own UI contract,
`design/mockups/mobile/index.html`. This item ships no screen, so the comparison is between the
package's **output numbers** and the mockup's rendered numbers, not between a rendered React
Native screen and the mockup.

1. Open the reference asset: `design/mockups/mobile/index.html` (`pnpm mockups:mobile`).
2. Navigate to `#screen=dashboard`. In the income donut legend, confirm the two slices read
   `67,6%` and `32,4%` — summing to exactly `100,0%`. Confirm that the package's
   `apportionTenths` produces tenths (`676` and `324` for the corresponding weights), i.e. the
   same one-decimal granularity, and that its sum invariant is `1000`.
3. On the same screen, confirm the expense donut legend reads `20,6% / 17,4% / 14,3% / 13,3% /
   11,8%` — one decimal place with a comma separator. Confirm the package returns tenths and
   leaves the comma and the `%` sign to the formatter, producing no string of its own.
4. Navigate to `#screen=home` and find the "Análisis por categorías" card. Confirm
   `Sin categorizar` is rendered as a **category row** with its own amount, count and
   percentage — and that the package's breakdown therefore emits a bucket with
   `transactionCategoryId: null` rather than filtering uncategorized movements out.
5. Navigate to `#screen=categorize-complete`. Confirm the tiles read "Gasto diario promedio"
   (a month-to-date average, `este mes`) and "vs mes pasado" `−12%` (zero decimals). Confirm the
   package's `dailyAverageExpense` is an integer over **elapsed** days and that
   `computePeriodDelta(88000, 100000).percentageTenths` is `-120`, which the caller renders as
   `−12%`.
6. Navigate to `#screen=merchant-edit&state=suggestions`. Confirm the three detected names are
   `MERCADOLIBRE COMPRA ONLINE`, `MERPAGO*MERCADOLIBRE` and `ML CHILE SPA`, and that
   `normalizeDescription` maps the second to `MERPAGO MERCADOLIBRE` so a `contains
   'MERCADOLIBRE'` alias folds all three into one merchant.
7. Navigate to `#screen=transaction-detail` and confirm the bank description reads
   `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` and the caption reads "Categoría
   sugerida automáticamente según el comercio" — the `auto` provenance this package emits.
8. Record PASS/FAIL, with expected-vs-actual detail on any failure.

**Expected result**: the package's numeric granularity, sum invariant, bucket set and provenance
values match what the mockup renders. Differences that matter for the acceptance criteria are
absent.

> Do **not** "fix" the mockup's percentages. `#screen=home`'s `Sin categorizar · 11,6%` sits
> against an *abbreviated* `$156K` amount, so it cannot be reproduced exactly from the displayed
> figures. The mockup is authoritative for granularity and for the sum invariant, not for
> deriving expected quotients.

### Last Step: Validate & shut down

- Verify every assertion in the checklist below is met
- Confirm no planted violation, temporary import, scratch file or logging statement remains
  (`git status --short`, then `git diff`)
- Confirm nothing under `apps/`, nothing in `.npmrc`, and neither
  `packages/shared-domain/package.json` nor
  `packages/shared-domain/src/domain-purity-lint.test.ts` was modified by this item

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from
[issue #5](https://github.com/lhpaul/personal-finances/issues/5).

- [ ] **AC1** — Every business rule in `docs/project/1-business-domain.md` has a test. All nine
      rules (0-8) appear in the implementation plan's Business Rule coverage matrix, each mapped
      to a named test in this package or to a named owner in `apps/mobile/src/db/` with the
      reason (Steps 1, 6; plus the residual `grep` check in the plan's Implementation Order
      step 15)
- [ ] **AC2** — Excluded and partially-included movements are honoured by every aggregate. A
      movement with `amount` `42000` and `included_amount` `21000` contributes exactly
      **`21000`** to `expenseTotal` and to its category bucket; a separately-excluded `15000`
      movement contributes `0` and produces no bucket; the whole-period total is `63000`
      (Steps 2, 3)
- [ ] **AC3** — No React, no SQL, no `expo-*`, no `Date.now()`; the clock is injected as a
      `DateLocal`. Each restriction is proven by a planted violation that fails at a named rule
      and a negative control that does not over-fire, plus a fake-system-time determinism test
      and three `TZ` runs (Steps 5, 6)
- [ ] **AC4** — Percentages sum to 100 with rounding handled explicitly. Largest-remainder
      apportionment in tenths sums to exactly `1000` on every non-degenerate fixture, with the
      two zero-total exceptions asserted explicitly and the invariant test shown to fail under
      naive rounding (Step 4)
- [ ] Merchant matching discriminates: every negative lookalike (`LIDERAZGO`, `UBERTO`,
      `ML CHILE SPA LTDA`, the empty pattern) is asserted `false`, and resolution is independent
      of input order (Step 7)
- [ ] The inclusion rule's two sanctioned statements are cross-referenced in documentation and
      each asserted against hand-derived literals — never against each other (Step 3)
- [ ] The package remains pure, adds no dependency, keeps `PACKAGE_NAME` exported, and its one
      consumer still builds and passes its wiring test (Step 8)
- [ ] The package's output granularity, sum invariant, bucket set and provenance values match
      the UI contract (Step 9)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| — | None. Every input is an inline literal in a test file, in `INCLUSION_RULE_CASES`, or in the Test Data table above. The values are either hand-derived in the implementation plan's *AC2* section or transcribed from `design/mockups/mobile/index.html`, which is committed repository content. This item touches no database. | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| A partially included movement contributes its **full** amount | `effectiveAmount` uses `\|\|` instead of `??`, or a caller reads `amount` directly instead of going through `contributedAmount` | Use `??`. `COALESCE` returns the first non-`NULL` argument; `0` is a real partial amount, not an absence. Step 2's planted-violation cycle is the check that catches this |
| An excluded movement's amount appears in a total | An aggregate read `amount` or `effectiveAmount` without gating on `isIncludedInAnalysis` | Every aggregate reads through `contributedAmount`. A hand-rolled filter that forgets exclusions is a review blocker, not a nit (`docs/best-practices/STACK-SPECIFIC.md`) |
| Percentages sum to `999` or `1001` | Per-bucket rounding instead of largest-remainder apportionment | Restore `apportionTenths`. Naive rounding cannot satisfy AC4 — three equal thirds are the counterexample |
| Percentages differ from one run to the next, or depend on the order of the input array | The tie-break is not a total order (for example remainder-only, leaving equal remainders resolved by sort stability) | Restore the remainder-desc → weight-desc → key-asc total order of the plan's Decision 5, and re-run the permutation test |
| A total is off by a factor of 100, or has decimals | A float entered the money pipeline upstream. CLP has no cents; the minor unit is the peso | Do not add rounding here. Find the caller that produced the float — the domain's `TypeError` on a non-integer amount is the intended alarm |
| `pnpm --filter @finanzas/shared-domain lint` fails on `node:child_process` or `process` | A Node-I/O or `process` ban was added to `sharedDomainPurity` | Remove it. Item #35's `domain-purity-lint.test.ts` legitimately uses both to drive the real ESLint CLI; the plan records this as an explicit non-goal |
| PR #39's `domain-purity-lint.test.ts` starts failing on the finding count | A pattern was added that also matches an already-restricted specifier — most likely `react-*` matching `react-native` | Use the explicit `['react', 'react/*', 'react-dom', 'react-dom/*']` list. One import must produce one finding |
| PR #39's `domain-purity-lint.test.ts` starts failing on the message text | The **existing** `no-restricted-imports` group's `message` was edited | Restore it byte-identically. New restrictions go in a new group object with their own message |
| A movement lands in the wrong month | The caller derived `dateLocal` from a UTC timestamp instead of via `@finanzas/shared-utils`'s `deriveDateLocal` | Fix the caller. This package never converts an instant; it compares `DateLocal` strings lexicographically, which is only correct for a correctly derived `YYYY-MM-DD` |
| `resolveMerchant` returns the wrong merchant when two aliases match | The precedence order was changed, or the tie-break is not total | Restore `exact` > `prefix` > `contains`, then longest normalized pattern, then lowest `aliasId`. Re-run the permutation test |
| A real merchant stops matching after normalization | Token-boundary matching (plan Decision 6) is stricter than raw substring | This is deliberate — a wrong merchant produces a wrong auto-category on every future movement. If a real bank feed needs raw substring behaviour, that is a plan change: remove the two space-pads and update the two negative tests |
| `suggestCategory` overwrote a category the user chose | The `currentCategorySource === 'user'` guard was removed or reordered | Restore it. Business Rule 6 and the mockup's "sugerida automáticamente" vs user-confirmed distinction both require that a suggestion never overrides a human |
| `pnpm --filter @finanzas/mobile test` fails after this item | `PACKAGE_NAME` was dropped from `packages/shared-domain/src/index.ts` | Restore it verbatim; `apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it |
| `pnpm install` does not produce a working `node_modules` | `.npmrc`'s `node-linker=hoisted` is not honoured until item #35 (PR #39) lands | Run `pnpm install --node-linker=hoisted` explicitly. Do not edit `.npmrc` — it is item #35's file |

---

## Known Limitations

- **This item ships no UI.** Step 9 compares the package's *output numbers* against the mockup,
  not a rendered React Native screen against the mockup. The screens that consume these
  aggregates arrive with later items, and their own runbooks carry the rendered-fidelity checks.
- **The mockup cannot supply exact expected percentages.** Its category amounts are abbreviated
  (`$156K`, `$279K`), so the displayed quotients cannot be reproduced from the displayed
  figures. The mockup is authoritative for granularity (one decimal) and for the sum invariant
  (`67,6%` + `32,4%` = `100,0%`); the expected values in Step 2 and Step 4 come from the
  implementation plan's hand-derived fixtures instead.
- **Step 3 proves the cross-reference is documented, not that the two implementations agree.**
  That is deliberate. Agreement between the SQL fragment and the domain function is explicitly
  not accepted as evidence by either item's plan, because two implementations wrong in the same
  way would still agree. Each side asserts against the same hand-derived literals independently.
- **The exported-surface test (Step 6) can only see runtime values.** TypeScript types are
  erased, so a type named `Credential` would not be caught by the automated assertion. Step 6's
  manual `grep` is what covers type and field names; treat it as a required part of the step,
  not an optional extra.
- **Step 5 Part C's mechanism is determined empirically.** Whether `no-restricted-globals` fires
  on the `Date` global under this ESLint / typescript-eslint version is verified by the planted
  violation, not assumed. If it does not, the `no-restricted-syntax` fallback is used and the
  substitution is recorded in the PR description; AC3 is satisfied either way.
- **No real Banco de Chile description fixtures exist yet.** The matching vectors come from the
  mockup's own strings. When item #6 lands captured, scrubbed HTML fixtures, the token-boundary
  decision should be re-examined against real bank descriptions.
