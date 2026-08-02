# Settings: categories management — Implementation Plan

**Work item**: [#21 Settings: categories management](https://github.com/lhpaul/personal-finances/issues/21)
— a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the three contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` — `#screen=settings-categories`, states
  `expense`, `income`, `edit`, `delete-confirm` (manifest entry in
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js))
- **Behaviour contract**: [`BEHAVIOR.md` → `settings-categories`](../../../../design/mockups/mobile/BEHAVIOR.md)
- **Domain contract**: [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md)
  BR7 (*"Deleting a category re-parents its transactions to ✨ Otros. Never orphans, never cascades
  to transactions."*) and the *Transaction category* entity (*"One system category per direction
  (✨ Otros) acts as the fallback and cannot be deleted"*)

**Smoke test runbook**: [`docs/testing/mobile/21-settings-categories.smoke-test.md`](../../../testing/mobile/21-settings-categories.smoke-test.md)

---

## Summary

**Approach**: One composition-only route (`app/settings/categories.tsx`) over one
`src/features/categories/` folder, reading through `getAppDatabase()` and repository functions
behind a single feature hook — the pattern items #8, #12 and #19 established. **No TanStack Query.**
The deletion half of this item is **already built and merged**: item #3's
`apps/mobile/src/db/repositories/categories.ts` ships the transactional re-parenting cascade and the
`protect_otros_categories` trigger lives in the first migration. This plan therefore *consumes*
`deleteCategory` unchanged and spends its budget on the four things the repository does **not**
provide yet: per-category usage counts for the row captions and the delete confirmation, a unique
slug for a user-created category, a rename that cannot move a category's direction or its stable
slug, and a persisted reorder that keeps ✨ Otros pinned last.

The one structural idea worth stating up front: **ordering has exactly one reader**. The brief's
*"reflected in the categorization pickers"* is satisfied by not introducing a second source — the
pickers (#13, #16) already call `listCategories(db, { income, locale })`, which orders by
`sort_order`, so persisting `sort_order` is the whole of that acceptance criterion. The proof is a
`.db.test.ts` that reorders through this item's write path and then asserts the **pickers' own read
function** returns the new order.

**Estimated complexity**: **M**

**Rationale**: one screen, four manifest states, no new route, no migration, no new dependency, and
a repository file that already owns the hard part (BR7's cascade). The depth is in two places: a
drag-to-reorder interaction implemented with React Native core only (this repository has neither
`react-native-gesture-handler` nor `react-native-reanimated`, and item #8's plan recorded that they
are *"not installed and are not needed"*), and the small pile of invariants around ✨ Otros —
pinned last, never deleted, never renamed — which must hold across three different write paths.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | `transaction_categories`, the `protect_otros_categories` trigger, `listCategories`, `getCategory`, `createCategory`, `updateCategory`, **`deleteCategory` (the BR7 cascade)**, `resolveLabel`, the two-project Jest config, `store-v1.sql` | Satisfied |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | `Segment`, `Sheet`, `Modal`, `TextField`, `CategoryChip`, `Button`, `Text`, `Note` — every primitive this screen composes except the three it borrows from #19 | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues, `toSupportedLocale`, the `no-literal-string` rule | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `deriveDateLocal`, `getMonthPeriod` — the month window for the row captions | Satisfied |
| [#19 settings hub](https://github.com/lhpaul/personal-finances/issues/19) | Plan merged; implementation not started | Owns `ScreenTopBar`, `ListGroup` and `ListRow` (the `mu-topbar*`, `mu-list` and `mu-item*` classes this screen draws), and the `/settings` hub row that navigates here | **Yes** — see Resolution R1 |
| [#12 home screen](https://github.com/lhpaul/personal-finances/issues/12) | Plan merged; implementation not started | Owns the two additive `jest.config.js` lines that route `src/features/**/*.db.test.ts` to the `db` project, and the `__DEV__` sample-data panel the runbook prefers | **No** — consumed if present, added if not (Decision 12) |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | **Implementation open as PR [#61](https://github.com/lhpaul/personal-finances/pull/61)** | This item's four fidelity targets flip `planned` → `wired` | **No** — contingent, see Resolution R3 |
| [#13 categorization](https://github.com/lhpaul/personal-finances/issues/13) / [#16 transaction detail](https://github.com/lhpaul/personal-finances/issues/16) | Plans merged; implementation not started | They *consume* the ordering this item writes. Nothing here blocks on them; the ordering contract is verified against `listCategories`, which both read | No |

**Not built here**: nothing in the categorization flow, no picker UI, no budget or recurring-rule
surface. `user_budgets` and `user_recurring_transactions` are touched only by the merged
`deleteCategory` this item calls.

---

## Verification Log

All commands were run in the plan worktree `.claude/worktrees/item-21` at repo revision `961cc69`,
on 2026-08-02. `961cc69` is an ancestor of `origin/develop` (`13cecd5`) — the branch is behind by
three plan-document commits and is not stacked on unmerged work
(`git merge-base --is-ancestor HEAD origin/develop` exits 0; `git log --oneline HEAD..origin/develop`
lists `7b14899`, `1bacb6e`, `98a29d2`, all `docs/specs/**` plan edits for items #11 and #12).

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `961cc69` |
| Template-fit check applies? | `sed -n '171,176p' .ai-dev-workflow.yaml` | `is_template: false` → Protocol 02 **Step 0 does not apply** |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | `0 matches` → default `single_repo`; this repository owns the plan and the plan PR |
| Manifest entry for this screen | `grep -n -A12 "screen_id: 'settings-categories'" design/mockups/mobile/mockup-manifest.js` | `route: '/settings/categories'`, `title: 'Categorías'`, `state_label: 'Pestañas y modales'`, states `expense` *(initial)*, `income`, `edit`, `delete-confirm` — **4 targets**, no `mvp: false` flag |
| **What the merged repository already provides** | `grep -nE "^export (function\|interface\|type)" apps/mobile/src/db/repositories/categories.ts` | `listCategories`, `getCategory`, `CategoryWritable`, `UpdateCategoryInput`, `createCategory`, `updateCategory`, `deleteCategory`. **No** usage counts, **no** slug generator, **no** reorder, **no** rename guard |
| That `deleteCategory` is the BR7 cascade, already written | `sed -n '134,181p' apps/mobile/src/db/repositories/categories.ts` | One `db.transaction`: refuses `otros-gasto` / `otros-ingreso` by slug, finds the same-direction fallback **by slug**, re-points `transactions.transaction_category_id`, nulls the merchant default, deletes budget and recurring rows, then deletes the category. This item calls it and adds nothing to it |
| That the store-level protection exists and is DELETE-only | `grep -n -B4 -A8 protect_otros apps/mobile/drizzle/0000_bumpy_mikhail_rasputin.sql` | `CREATE TRIGGER protect_otros_categories BEFORE DELETE ON transaction_categories … WHEN old.slug IN ('otros-gasto','otros-ingreso') … RAISE(ABORT, …)`. **There is no `BEFORE UPDATE` trigger** → rename protection has no store-level backstop today (Decision 3) |
| `createCategory` / `updateCategory` shapes | `sed -n '75,132p' apps/mobile/src/db/repositories/categories.ts` | `CategoryWritable { slug; income; labels; assets?; sortOrder }` — the **caller** supplies slug and sortOrder. `UpdateCategoryInput = Omit<CategoryWritable,'income'>` and `updateCategory` strips `income` at runtime too, so no call shape can change a direction |
| The `slug` column is unique | `grep -n -A20 'transactionCategories = sqliteTable' apps/mobile/src/db/schema.ts` | `uniqueIndex('transaction_categories_slug_unique').on(t.slug)`; `index('transaction_categories_income_sort_order_idx').on(t.income, t.sortOrder)`; columns `id, slug, income, labels, assets, user_id, parent_category_id, sort_order, created_at` |
| No slug generator exists anywhere | `grep -rnE "slugif\|toSlug" apps/mobile/src packages/*/src` | `0 matches` → Decision 4 adds one |
| Seeded taxonomy and ✨ Otros' position | `python3 -c "import json;d=json.load(open('design/tokens.json'));print(d['categoryIcons'])"` | expense: `comida, supermercado, transporte, compras, entretenimiento, servicios, salud, educacion, hogar, otros` (**10**); income: `sueldo, freelance, ingresos-extra, inversiones, bonos, otros` (**6**). `otros` is **last in both**, so the seed's `sortOrder` already puts the fallback last (`buildCategoriesForDirection` assigns `index + 1`) |
| **The mockup draws fewer rows than the seed ships** | `sed -n '2405,2422p' design/mockups/mobile/index.html` | Expense list: 8 rows (`educacion` and `hogar` absent). Income list: 5 rows (`bonos` absent). → Assumption A6 and the fidelity consequence in Risks |
| What the row actually draws | same lines | emoji, title, an **optional** `mu-item__sub` (*"5 transacciones este mes"* on 3 of 7 rows), and `mu-item__chev` = `☰` on every row **except** ✨ Otros, whose sub reads *"Categoría por defecto · no se puede eliminar"* (expense) / *"Categoría por defecto"* (income) |
| What the edit sheet draws | `sed -n '2429,2454p' design/mockups/mobile/index.html` | `mu-sheet`: title *Editar categoría*; field *Nombre* (`mu-input`, value `Comida`); field *Ícono* (`mu-grid-3` of 6 `mu-chip`s carrying **only** `mu-chip__emoji`, one `is-selected`); `Cancelar` / `Guardar`; then a ghost danger button *Eliminar categoría*. **No direction control, no colour, no parent** |
| What the create affordance draws | `sed -n '2424,2425p' design/mockups/mobile/index.html` | Two outline buttons, one per tab: *+ Nueva categoría de gasto* / *+ Nueva categoría de ingreso*. **The mockup draws no create sheet** → Assumption A3 |
| What the delete modal draws | `sed -n '2456,2466p' design/mockups/mobile/index.html` | `mu-modal`, icon `🗑`, title *Eliminar categoría*, body *"¿Eliminar «🍔 Comida»? Las 5 transacciones de esta categoría se moverán a **✨ Otros**."*, buttons *Cancelar* / *Eliminar* (`mu-btn--danger`) |
| Every `mu-*` class this screen draws already has an owner | `grep -nE "'mu-(segment\|chip\|sheet\|modal\|overlay\|field\|input\|label\|grid-3\|btn-row\|list\|item\|topbar)" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-segment*`→`Segment`; `mu-chip*`→`CategoryChip`; `mu-sheet*`/`mu-overlay`→`Sheet`; `mu-modal*`/`mu-overlay--center`→`Modal`; `mu-field`/`mu-input`→`TextField`; `mu-label`→`Text`; `mu-grid-3`/`mu-btn-row`→`utility`; `mu-list`/`mu-item*`/`mu-topbar*`→**`deferred` to #19/#12**. → **`MU_CLASS_MAP` needs no edit by this item** (Decision 13) |
| `CategoryChip` cannot draw an emoji-only chip today | `sed -n '15,70p' apps/mobile/src/components/ui/CategoryChip.tsx` | `label: string` is **required** and is rendered as a second `Text` plus the `accessibilityLabel`. The mockup's icon-grid chip has no label → Decision 9 makes `label` optional (additive) |
| Primitive prop shapes this plan composes | `grep -nE "export type .*Props" -A8 apps/mobile/src/components/ui/{Segment,Sheet,Modal,TextField,Button}.tsx` | `Segment { options: {value,label}[]; value; onChange }`; `Sheet { visible; onRequestClose; children }`; `Modal { visible; onRequestClose; icon?; title; children? }`; `TextField { label?; value; onChangeText; placeholder?; hint?; error?; locked?; secureTextEntry? }`; `ButtonVariant = 'primary'\|'muted'\|'outline'\|'ghost'\|'danger'\|'dangerSoft'` (camelCase) |
| No gesture/animation library is installed | `grep -cE "gesture-handler\|reanimated\|draggable" apps/mobile/package.json`; `grep -nE "react-native-gesture-handler\|react-native-reanimated\|draggable-flatlist" pnpm-lock.yaml` | `0` in the app manifest. The lockfile has **4** matches, all inside `expo-router`'s `peerDependencies` / `peerDependenciesMeta` blocks (lines 3198-3213) and all marked `optional: true` — declared as optional peers, **not installed**. Item #8's merged plan (line 384) states they *"are not installed and are not needed"* → Decision 10 |
| **Runtime APIs this plan names but cannot execute here** | `ls node_modules/react-native node_modules/expo-router` from the repo root | **Not installed in the current tree** — the same situation items #8 and #19 recorded. `PanResponder`, `Animated`, `View.onLayout` (React Native core) and `useFocusEffect` (re-exported by `expo-router`) are therefore **unverified — the implementer must confirm each against the installed packages before proceeding** (Implementation Order steps 3 and 6; Risks table). All four are used by items #8/#12's merged plans under the same flag |
| The `db` Jest project's match rules | `cat apps/mobile/jest.config.js` | Two projects: `app` (`jest-expo`, ignores `src/db/`) and `db` (`testEnvironment: 'node'`, `testMatch: ['<rootDir>/src/db/**/*.test.ts']`). The `src/features/**/*.db.test.ts` routing is **item #12's** two additive lines and is **not present yet** (Decision 12) |
| The inclusion-rule scanner's three rules | `sed -n '1,50p' apps/mobile/src/db/checks/inclusion-rule-scan.ts` | A: a `sql` template mentioning `excluded` / `included_amount` / `includedAmount`; B: `isNull(`/`isNotNull(` on `.excludedAt`; C: the literals `excluded_at` / `included_amount`. A `count(*)` that names none of them is trivially compliant → Decision 6 |
| Aggregate-in-SQL rule | `sed -n '117,124p' docs/best-practices/stack/sqlite-drizzle.md` | *"Aggregate in SQL, not in JS"*, *"Repository functions return domain types, not Drizzle rows"*, *"Wrap multi-table writes"* → Decisions 2 and 6 |
| Compose-the-primitive rule | `sed -n '41,47p' docs/best-practices/stack/mobile-ui-fidelity.md` | *"Compose the shared primitives in `src/components/ui/` before writing a one-off style. A one-off is a signal the primitive is missing — add it there and to `#screen=ds-components`."* → Decisions 9 and 13 |
| **#47's live contract already carries this item's targets** | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-targets.json` | `coverage_sets` contains `{ "issue": 21, "targets": [{ "screen_id": "settings-categories", "states": "all" }] }`; four `mappings` rows for `settings-categories` (`expense`, `income`, `edit`, `delete-confirm`), each `"status": "planned"`, `"fixture": "seed-default"`. Defaults: `max_mismatch_pct: 3.0`, `pixel_threshold: 0.1`, `settle_ms: 2500` |
| How the validator proves a screen is wired | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-contract.mjs` lines 178-215 | A `wired` mapping needs `app_file`, `deep_link`, `ready_test_id`; the app file must contain **either** the literal selector **or** `fidelityTestId('<screen_id>')`; the deep link must be `finanzas:` with `fidelity=1`, `fidelityScreen === screen_id`, `fidelityState === state_id` |
| The app-side preview contract | `git show origin/feature/47-design-fidelity-gate:apps/mobile/src/lib/fidelity-preview.ts` | `fidelityTestId(screenId) => \`fidelity-${screenId}\``; `useFidelityPreview(): { active, state }`, inert unless `__DEV__ && params.fidelity === '1'` |
| Locale narrowing already exists twice | `cat apps/mobile/src/i18n/locale.ts`; `grep -n toSupportedLocale apps/mobile/src/db/labels.ts` | `toSupportedLocale(languageCode)` in **both** `src/i18n/locale.ts` (app tier) and `src/db/labels.ts` (db tier). This item uses the app-tier one on `i18n.language`; it adds no third copy |
| The plural convention for catalogue keys | Item #19's merged plan, Decision 15 | Explicit `_single` / `_plural` keys plus a `count === 1` check — **not** i18next's plural suffixes, which interact badly with `keySeparator: false`. Interpolation variables must not be named `count` (i18next reserves it) → the keys table uses `{{n}}` |
| Bounded same-surface open PRs | `gh pr list --state open --json number,title,headRefName` then a file-level read | Three: **#61** (item #47's implementation — same surface: `scripts/mobile-ui/fidelity-targets.json`), **#68** (a docs-only fix to item #12's plan), **#46** (`packages/bank-scraper`). Only **#61** touches a surface this plan writes to |

### Residual verification strategy

This plan makes two claims that a reviewer cannot check by reading it. Both have a mechanical
evidence source the implementation PR must paste:

| Claim | Evidence source | What the implementation PR pastes |
| --- | --- | --- |
| **Reordering is reflected in the categorization pickers** (brief AC3) | `apps/mobile/src/features/categories/categories-settings.db.test.ts` — reorders through this item's write path, then asserts `listCategories(db, { income, locale })` (the function #13's `CategoryGrid` and #16's `CategoryPickerSheet` read) returns the new order | The test's pass line, plus the output of `grep -rn "listCategories(" apps/mobile/src apps/mobile/app` showing that every category-listing surface in the tree at implementation time goes through it. If a surface does not, the developer stops and reports it rather than adding a second ordering |
| **The four manifest states are all implemented** (brief AC4, non-negotiable 6) | The four fidelity targets flipped to `wired` in `scripts/mobile-ui/fidelity-targets.json`, validated by `pnpm fidelity:contract` and exercised by `pnpm fidelity --issue 21` (R3-contingent); otherwise the runbook's manual side-by-side | `pnpm fidelity:contract` output plus the per-target summary table, or the runbook's manual comparison record |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — no `mode` key, so this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` | 2026-08-02T19:16Z, `961cc69` | Current invocation item `{#21}`; no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* | 2026-08-02T19:16Z, `961cc69` | Current invocation item `{#21}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/21-settings-categories` at `961cc69`, an ancestor of `origin/develop` (`13cecd5`); the three intervening commits are plan documents for #11 and #12 | `git merge-base --is-ancestor HEAD origin/develop`; `git log --oneline HEAD..origin/develop` | 2026-08-02T19:16Z | Isolated worktree at `.claude/worktrees/item-21` | `Verified` |
| **The BR7 deletion cascade is already implemented and is not re-implemented here** | `deleteCategory(db, categoryId)` in `apps/mobile/src/db/repositories/categories.ts`, plus the `protect_otros_categories` trigger in `drizzle/0000_bumpy_mikhail_rasputin.sql` | The merged item #3 source, read at `961cc69` (Verification Log rows 5-6); item #5's merged plan line 520 names the same file as the single home of BR7 | 2026-08-02T19:16Z, `961cc69` | Current invocation item `{#21}`; no open PR edits `repositories/categories.ts` | `Verified` |
| **Screen data-access pattern (cross-item consistency)** | `getAppDatabase()` from `src/db/runtime.ts` plus repository functions, behind one feature hook. **No TanStack Query**, despite `expo-react-native.md` prescribing it | Items #8, #12, #19 merged plans; the parent orchestrator's binding campaign-wide decision for this run | 2026-08-02T19:16Z, `961cc69` | Current invocation item `{#21}`; same-surface siblings #8/#12/#19 all use this pattern | `Verified` |
| **Feature-tier SQLite test convention** | `*.db.test.ts` under `src/features/`, routed to the `db` Jest project by two additive `jest.config.js` lines | Item #12's merged plan (Infrastructure block), quoted by items #9 and #13 as *"the convention every later screen item reuses"* | 2026-08-02T19:16Z, `961cc69` | Current invocation items `{#21}`; the lines are byte-identical in #12's, #9's and #13's plans, so the later lander is a no-op | `Verified` — see Decision 12 |
| **Design-system primitives for the list and the top bar** | `ScreenTopBar`, `ListGroup`, `ListRow` in `apps/mobile/src/components/ui/`, owning `mu-topbar*`, `mu-list`, `mu-item*` | Item #19's merged plan, Decision 12 and *Frontend/UI — new files* | 2026-08-02T19:16Z, `961cc69` | Same-surface sibling #19 (plan merged, implementation not started). No open PR creates a competing primitive | `Verified` — with the R1 contingency |
| **Fidelity contract file, target IDs and preview helpers** | `scripts/mobile-ui/fidelity-targets.json`; four `settings-categories` mappings; `fidelityTestId` / `useFidelityPreview` in `apps/mobile/src/lib/fidelity-preview.ts` | Read directly from `origin/feature/47-design-fidelity-gate` (open PR #61), not from #47's plan prose | 2026-08-02T19:16Z, `961cc69` | Same-surface open PR **#61** only | `Verified` — with the R3 contingency |

**Resolution R1 — the list and top-bar primitives are item #19's, and this item is second in line.**
Competing evidence: `mu-list`, `mu-item`, `mu-item__icon`, `mu-item__title` and `mu-topbar*` are
still `status: 'deferred'` in `MU_CLASS_MAP` at `961cc69`, deferred to #19 (and, for
`mu-item__txt` / `mu-item__sub` / `mu-item__chev`, additionally claimed by #12's `BankRow`).
This screen draws all of them. Affected plan statements: Decision 13, every Frontend/UI bullet that
names `ListRow`, `ListGroup` or `ScreenTopBar`, and Implementation Order step 6.
**Resolution: ownership stays with #19; this item consumes and never recreates.** If #19 has not
merged when this item is implemented, the implementer **stops and returns to the parent
orchestrator** rather than creating a second list primitive: a duplicate would have to re-decide
`MU_CLASS_MAP` ownership, the `#screen=ds-components` gallery entries and the `ds.*` catalogue keys,
all of which #19 has already reasoned about, and the duplicate would then have to be deleted when
#19 lands. The one extension this item may make is **additive**: if `ListRow`'s trailing slot
(`chevron`) does not accept a `ReactNode`, add an optional `trailing?: ReactNode` prop to it and
show it in the gallery — no existing call site changes. Decision owner: tech-lead agent for item
#21, under the parent orchestrator's no-human-available delegation.

**Resolution R2 — BEHAVIOR.md says ✨ Otros cannot be renamed, but the mockup's ✨ Otros row still
carries the same `onclick="go('settings-categories','edit')"` as every other row.** Competing
evidence: `BEHAVIOR.md` → `settings-categories`: *"✨ Otros no se puede borrar ni renombrar 🟡 (una
por dirección, es el fallback del sistema; protegida además por trigger en #3)"*; the mockup markup
at line 2413 attaches the edit navigation to the ✨ Otros row anyway. Affected plan statements:
Decision 3, Assumption A2, the route's row rendering, scenario 14.
**Resolution: the behaviour contract wins; the `onclick` is mockup navigation boilerplate.** Three
independent signals agree with `BEHAVIOR.md` and against the handler: the ✨ Otros row is the only
row **without** the `☰` handle, it is the only row whose subtitle says *"no se puede eliminar"*, and
the store-level trigger exists precisely to make its deletion impossible. Every other `mu-item` in
the mockup carries the same uniform handler, including rows that demonstrably do nothing. The
✨ Otros row therefore renders with **no `onPress`** (which, in #19's `ListRow`, also sets
`accessibilityState={{ disabled: true }}`). Decision owner: tech-lead agent for item #21.

**Resolution R3 — the fidelity kit exists on an open PR, not on `develop`.** #47's implementation is
PR #61; `scripts/mobile-ui/fidelity-targets.json` and `src/lib/fidelity-preview.ts` are not on
`develop` at `961cc69`. **Resolution: the flip is conditional and the runbook carries both paths.**
If the contract file exists at implementation time, Implementation Order step 8 flips this item's
four mappings to `wired` and the runbook's fidelity step runs `pnpm fidelity --issue 21`; if it does
not, step 8 is skipped with a note in the PR body, the route still carries
`testID={fidelityTestId('settings-categories')}` **only if** `src/lib/fidelity-preview.ts` exists
(otherwise a plain `testID="fidelity-settings-categories"` literal, which the validator also
accepts), and the runbook's manual side-by-side comparison is the evidence. The manual step is
**never** removed.

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved, and records
`Still valid` or `Stale or conflicting` in the implementation PR:

1. `git log --oneline -1 origin/develop` and
   `ls apps/mobile/src/components/ui/{ListRow,ListGroup,ScreenTopBar}.tsx` — confirm item #19 has
   merged. If not, **stop** (Resolution R1).
2. `grep -nE "export type ListRowProps" -A10 apps/mobile/src/components/ui/ListRow.tsx` — read the
   real prop names before composing them, and decide the `trailing` question (R1).
3. `grep -nE "^export (function|interface|type)" apps/mobile/src/db/repositories/categories.ts` —
   confirm `deleteCategory`, `createCategory`, `updateCategory`, `listCategories`, `getCategory`
   still have the shapes in the Verification Log, and that no sibling item added a competing
   `reorderCategories` / usage-count function (#13 adds `listMostUsedCategories`; that is a
   different function and does not conflict).
4. `grep -n 'db.test.ts' apps/mobile/jest.config.js` — confirm whether item #12 has landed the two
   additive lines; add them only if absent (Decision 12).
5. `ls scripts/mobile-ui/fidelity-targets.json apps/mobile/src/lib/fidelity-preview.ts` — decide the
   R3 branch, and re-read this item's four mappings from the file rather than from this plan.
6. `grep -n 'getAppDatabase' apps/mobile/src/db/runtime.ts` — confirm item #8's entry point exists
   and that no query library appeared in `apps/mobile/package.json`.
7. `grep -rn "gesture-handler\|reanimated" apps/mobile/package.json` — confirm the constraint behind
   Decision 10 still holds. If a sibling item has added either library, prefer it over the
   hand-rolled `PanResponder` and record the change in the PR body.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to the
parent orchestrator.

---

## Key Decisions

Decision indices are stable within this document and are referenced by the Layer-by-Layer, Testing
Strategy and Implementation Order sections.

### Decision 1 — deletion is called, not written

`deleteCategory(db, categoryId)` already is BR7: one transaction, re-parent by stable slug, clear
the merchant default, drop budget and recurring rows, delete the category, refuse the two fallbacks.
This item adds **no** deletion logic, **no** second cascade and **no** UI-side re-parenting loop. The
confirm button calls that function and nothing else. The only thing this item contributes to
deletion is the confirmation copy and the count in it (Decision 6).

Consequence for review: any diff in this item that writes `transaction_category_id` on a
`transactions` row is a defect, not a feature.

### Decision 2 — the gap is exactly four repository functions, all in the file that already owns categories

All four go in `apps/mobile/src/db/repositories/categories.ts`, beside the functions they reuse.
Screens never see a Drizzle row (`sqlite-drizzle.md`), and `src/db/` stays the only place with SQL.

| New function | Signature | Why it exists |
| --- | --- | --- |
| `listCategoriesWithUsage` | `(db, { income: 0 \| 1; locale: SupportedLocale; startDateLocal: string; endDateLocal: string }) => CategoryWithUsage[]` | The row caption needs a month count and the delete modal needs an all-time count. One grouped query, not one query per row (Decision 6) |
| `createUserCategory` | `(db, { income: 0 \| 1; name: string; emoji: string }, ports: { newId: () => string; now: () => string }) => Category` | `createCategory` requires a `slug` and a `sortOrder` the caller cannot compute without SQL. This wraps it in one transaction: derive a unique slug, take ✨ Otros' position, push ✨ Otros down (Decisions 4, 5) |
| `renameCategory` | `(db, id: string, { name: string; emoji: string }) => void` | `updateCategory` takes the full writable shape, so a naive caller could rewrite the stable slug or the sort order by accident. This reads the row, refuses the two fallback slugs, and delegates to `updateCategory` preserving `slug` and `sortOrder` (Decisions 3, 4) |
| `reorderCategories` | `(db, { income: 0 \| 1; orderedIds: readonly string[] }) => void` | Persists the drag result. One transaction; validates that `orderedIds` is exactly the set of non-fallback ids of that direction; assigns `1…n`; pins ✨ Otros at `n + 1` (Decision 5) |

`CategoryWithUsage` is added to `apps/mobile/src/db/types.ts` as
`interface CategoryWithUsage extends Category { monthCount: number; totalCount: number }`.

### Decision 3 — ✨ Otros is protected at three levels, and this item adds the missing one

| Operation | Store level | Repository level | UI level |
| --- | --- | --- | --- |
| Delete | `protect_otros_categories` trigger (#3) | `deleteCategory`'s slug guard (#3) | No delete affordance: the row has no `onPress`, so the edit sheet that hosts *Eliminar categoría* is unreachable for it |
| Rename / re-icon | **none** — the trigger is `BEFORE DELETE` only | **`renameCategory`'s slug guard (new)** | Same: no `onPress`, no sheet |
| Reorder | none | `reorderCategories` rejects an `orderedIds` list containing a fallback id, and re-pins it last | No `☰` handle on the row |

**No new migration.** Adding a `BEFORE UPDATE` trigger would be a second migration file on a store
whose first migration is already shipped, and the asymmetry is deliberate: a deletion moves other
users' rows irreversibly, while a rename is recoverable by renaming back. The store-level backstop
exists where the damage is unrecoverable. Recorded as a follow-up, not silently skipped.

### Decision 4 — the slug is stable identity; the name is a user copy

`deleteCategory` finds the fallback **by slug**, the merchant seeds reference categories by
`defaultCategorySlug`, and `seed_ledger` keys on `transaction_category:<slug>`. So:

- **Rename never touches `slug`.** `renameCategory` re-reads the row and passes the existing `slug`
  and `sortOrder` straight back into `updateCategory`.
- **Creation derives a slug once**, from the name, in `apps/mobile/src/db/slug.ts` (new, db tier
  because the repository is the only caller and `src/db/` may not import from `src/features/`):
  - `slugifyCategoryName(name: string): string` — NFD-normalise, strip combining marks (so
    `Educación` → `educacion`), lower-case, replace every run of non-`[a-z0-9]` with `-`, trim
    leading/trailing `-`. When the result is empty (a name made only of emoji or punctuation) it
    returns the constant `'categoria'`.
  - `nextAvailableSlug(base: string, taken: readonly string[]): string` — returns `base` when free,
    otherwise the first free `base-2`, `base-3`, … The `taken` list is read inside the same
    transaction that inserts, so the unique index cannot be raced by this app (there is exactly one
    process and one database handle).
- Renaming a category **never** re-derives its slug, so `Comida` renamed to `Almuerzos` keeps
  `comida`. That is intentional: the slug is machine identity, and a user-visible rename must not
  change what a merchant default or a seed ledger entry points at.

### Decision 5 — ✨ Otros is pinned last, and exactly two functions may write `sort_order`

The seed already puts `otros` last in both directions (`tokens.categoryIcons` order, Verification
Log). Every write path preserves it:

- `createUserCategory` gives the new category the fallback's current `sortOrder` and increments the
  fallback's own by one — so a new category always lands immediately **above** ✨ Otros.
- `reorderCategories` assigns `1…n` to the movable ids in the given order and sets the fallback to
  `n + 1`.

No other code writes `sort_order`. `renameCategory` explicitly passes the existing value through.

### Decision 6 — two counts, one query, and no restatement of the inclusion rule

The row caption is *"5 transacciones este mes"* and the modal says *"Las 5 transacciones de esta
categoría se moverán"*. They are **different counts** and the plan says so rather than letting the
mockup's coincidence hide it:

- **`monthCount`** — movements of this category whose `date_local` falls inside the current month
  window (`getMonthPeriod(deriveDateLocal(new Date()))`). Rendered as the row subtitle **only when
  it is greater than zero**, which is exactly how the mockup draws it (only 3 of the 7 non-fallback
  expense rows carry a subtitle; the other 4 rows have none).
- **`totalCount`** — every movement of this category, all time. This is the number the delete modal
  must state, because deletion re-parents *all* of them, not this month's.

One grouped query produces both:

```ts
// apps/mobile/src/db/repositories/categories.ts — Illustrative, adapt during implementation
const rows = db
  .select({
    /* …category columns… */
    totalCount: sql<number>`count(${transactions.id})`,
    monthCount: sql<number>`sum(case when ${transactions.dateLocal} between ${params.startDateLocal}
      and ${params.endDateLocal} then 1 else 0 end)`,
  })
  .from(transactionCategories)
  .leftJoin(transactions, eq(transactions.transactionCategoryId, transactionCategories.id))
  .where(eq(transactionCategories.income, params.income))
  .groupBy(transactionCategories.id)
  .orderBy(asc(transactionCategories.sortOrder))
  .all();
```

**Both counts include excluded movements**, and the function carries a one-line doc comment saying
why: an excluded movement is still stored, still belongs to the category, and still gets re-parented
when the category is deleted. This is a storage fact, not an analysis figure, so it neither imports
`isIncluded` / `includedAmount` nor names `excluded_at` — which is also what keeps it clear of the
`inclusion-rule-single-definition` scanner's rules A, B and C (Verification Log). The doc comment
exists so a later reader does not "fix" it into an inconsistency with the dashboard.

### Decision 7 — direction is the tab, never a field

The mockup's create buttons are direction-specific (*+ Nueva categoría de gasto* / *de ingreso*) and
the edit sheet has **no** direction control. That matches the repository exactly: `income` is set by
`createCategory` and structurally omitted from `UpdateCategoryInput` (and stripped at runtime). So:

- The active `Segment` tab is the only place direction is chosen.
- `createUserCategory` receives `income` from the active tab.
- `renameCategory` cannot express a direction change, and no UI affordance suggests one.

Moving a category between directions is not in the brief, not in the mockup, and not expressible in
the merged repository. It is not built and not stubbed.

### Decision 8 — one overlay union, because the mockup never shows two at once

```ts
// apps/mobile/src/features/categories/use-categories-settings.ts — Illustrative
type CategoriesOverlay =
  | { kind: 'none' }
  | { kind: 'editor'; mode: 'create' | 'edit'; categoryId: string | null }
  | { kind: 'delete-confirm'; categoryId: string };
```

`editor` renders the `Sheet` (manifest state `edit`); `delete-confirm` renders the `Modal` (manifest
state `delete-confirm`). Neither is a route — the manifest declares them as `state_id`s of
`settings-categories`, so `route-manifest-parity.test.ts` is untouched.

Transitions follow the mockup's own handlers: the sheet's *Eliminar categoría* goes
`editor → delete-confirm`; the modal's *Cancelar* goes `delete-confirm → none` (back to the list,
**not** back to the sheet — the mockup's `go('settings-categories','expense')`); *Eliminar* runs
`deleteCategory` and returns to `none`.

The union is also the re-entrancy guard: `confirmDelete()` returns immediately unless the overlay is
`delete-confirm`, and `saveEditor()` unless it is `editor`.

### Decision 9 — the icon grid needs an emoji-only chip, so `CategoryChip.label` becomes optional

The mockup's icon-grid chip is `<button class="mu-chip"><span class="mu-chip__emoji">🍔</span></button>`
— emoji, no label. `CategoryChip` requires `label` and renders it. Per `mobile-ui-fidelity.md`
(*"Compose the shared primitives … a one-off is a signal the primitive is missing"*), the fix goes in
the primitive, additively:

- `label?: string`; the label `Text` renders only when `label !== undefined`;
  `accessibilityLabel={label ?? emoji}` (a screen reader announces the emoji's own name, which is
  language-independent and therefore not catalogue copy).
- Every existing call site passes `label` and is unaffected.
- The `__DEV__` gallery gains an emoji-only chip beside the existing ones, reusing the existing
  chips section keys, so `gallery-catalogue-keys.test.ts` stays green with no new `ds.*` key.

The rejected alternative was a screen-local emoji button drawing `mu-chip` / `mu-chip__emoji`
directly, which would give those classes a second, unregistered owner.

### Decision 10 — drag-to-reorder is React Native core only, and its geometry is a pure function

Neither `react-native-gesture-handler` nor `react-native-reanimated` is installed, and item #8's
merged plan records that deliberately. Adding both for one screen means two native modules, a dev
client rebuild for every contributor, and a compatibility question (Reanimated 4 / New Architecture)
this item cannot answer from inside the repository. So the interaction is built on
`PanResponder` + `Animated`, which ship with React Native:

- `src/features/categories/reorder.ts` is **pure and React-free** and carries the tests:
  - `moveItem<T>(items: readonly T[], from: number, to: number): T[]`
  - `resolveDropIndex({ offsets, fromIndex, translationY }): number`, where `offsets` is the
    measured `{ top, height }` of each row (`onLayout`), so variable-height rows (some have a
    subtitle, some do not) are handled by measurement rather than by an assumed row height.
- `components/CategoryReorderList.tsx` is the thin gesture shell: the `☰` handle owns the
  `PanResponder`, the dragged row gets an `Animated.Value` `translateY` and a raised elevation, the
  parent `ScrollView` is given `scrollEnabled={false}` for the duration of the drag, and on release
  the component calls `onReorder(orderedIds)` once.
- Accessibility: the handle exposes `accessibilityActions` `increment` / `decrement` so a
  screen-reader user can move a row without a drag. This adds no drawn element.

**Escalation rule**: if the `PanResponder` interaction cannot be made to work on a device during
implementation, the developer **stops and returns to the parent orchestrator**. Substituting a
different affordance (arrow buttons, a "reorder mode") would contradict the mockup, which draws a
grab handle; adding a native gesture library is a dependency decision that belongs to the parent,
not to a screen item.

Auto-scrolling the list while dragging past its edge is **out of scope** (follow-up 1): the seeded
lists are 10 and 6 rows and fit on one screen at the reference profile.

### Decision 11 — a failed write reverts, and says so inline

Optimistic order is applied locally the moment the drag ends, then persisted. On a failure — of the
reorder, the save or the delete — the hook restores the last persisted state from a fresh read and
sets an error key, which the route renders as an inline `Note tone="danger"` above the list. The
mockup draws no failure state and this item does not invent a manifest state for one; an inline
`Note` is the same shape item #19 chose for its undrawn failure (its Assumption A3).

The error value is a closed union of catalogue keys (`'reorder' | 'save' | 'delete'`), never an
exception message: a raw SQLite error string in a UI surface is how internal identifiers leak into
screenshots.

### Decision 12 — feature-tier SQLite tests use the `.db.test.ts` convention

`src/features/categories/categories-settings.db.test.ts` runs in the `db` Jest project against
`better-sqlite3` in memory. That routing is item #12's two additive lines
(`testMatch` gains `'<rootDir>/src/features/**/*.db.test.ts'`; the `app` project's
`testPathIgnorePatterns` gains `'\\.db\\.test\\.ts$'`). This item **adds them only if #12 has not
landed them** — they are byte-identical in #12's, #9's and #13's plans, so the later lander is a
no-op.

### Decision 13 — this screen adds no `MU_CLASS_MAP` entry and no new design-system primitive

Every class the mockup draws for `settings-categories` already has an owner or a named owner-to-be
(Verification Log): `Segment`, `Sheet`, `Modal`, `TextField`, `CategoryChip`, `Button`, `Text`, the
two utility classes, and #19's `ScreenTopBar` / `ListGroup` / `ListRow`. The only primitive change is
Decision 9's additive `label?`. If, at implementation time, `mu-class-coverage.test.ts` disagrees
with this paragraph, the live map is the arbiter and the difference is recorded in the PR body.

### Decision 14 — the fidelity preview resolves its two overlay states deterministically

With `seed-default` loaded, `useFidelityPreview()` drives the screen so each of the four targets is
reachable by deep link alone:

| `fidelityState` | What the screen renders |
| --- | --- |
| `expense` (or absent) | the expense tab, overlay `none` |
| `income` | the income tab, overlay `none` |
| `edit` | the expense tab, overlay `{ kind: 'editor', mode: 'edit', categoryId: <first non-fallback expense category by sort order> }` — with the bundled seed that is **Comida**, exactly what the mockup draws |
| `delete-confirm` | the expense tab, overlay `{ kind: 'delete-confirm', categoryId: <same category> }` |

The preview only *opens* the overlay; it never writes. The route carries
`testID={fidelityTestId('settings-categories')}`, which is the form
`fidelity-contract.mjs` accepts as proof that `ready_test_id: "fidelity-settings-categories"` is
wired (Verification Log).

### Decision 15 — the screen renders the store, not the mockup's row list

The mockup draws 8 expense rows and 5 income rows; the seed ships 10 and 6, and `BEHAVIOR.md` says
the data is *"16 categorías seed desde `design/tokens.json` + las creadas por el usuario"*. The
screen renders what the store holds, in `sort_order`. The consequence is a real, expected pixel
difference on the two list targets, which is handled in Risks and follow-up 3 — **not** by trimming
the list to match a drawing, and **not** by raising a threshold to manufacture a pass (#47,
Decision 4).

---

## Assumptions

Every 🟡-marked statement this plan builds on, per `BEHAVIOR.md`'s own rule, plus the inferences this
plan makes from the drawing where the behaviour contract is silent. Each is reversible in one named
place.

| # | Assumption | Source / derivation | Reversal cost |
| --- | --- | --- | --- |
| A1 | 🟡 ✨ Otros cannot be deleted **or renamed**, there is exactly one per direction, and it is the system fallback | `BEHAVIOR.md` → `settings-categories` (🟡); `docs/project/1-business-domain.md` *Transaction category*; the `protect_otros_categories` trigger | The plan does not survive its reversal |
| A2 | The ✨ Otros row's `onclick="go(…,'edit')"` in the mockup is navigation boilerplate, not an affordance (Resolution R2) | Every `mu-item` in the mockup carries the same handler; the ✨ Otros row is the only one without a `☰` handle and the only one whose subtitle says *"no se puede eliminar"* | One `onPress` in `app/settings/categories.tsx` |
| A3 | The create flow reuses the edit sheet's two fields (*Nombre*, *Ícono*) with the create button's own copy as the sheet title, and **no** *Eliminar categoría* button | The mockup draws a create **button** but no create sheet. Inventing a different form would add fields the drawing does not have | The `mode` branch in `CategoryEditorSheet.tsx` and two catalogue keys |
| A4 | A row's subtitle is rendered only when its month count is greater than zero | Exactly how the mockup draws it — only 3 of the 7 non-fallback expense rows carry a `mu-item__sub`; the other 4 have none | One conditional in the row mapper |
| A5 | The delete modal's number is the **all-time** count of the category's movements, not the month count (Decision 6) | The modal copy says *"de esta categoría"* with no period qualifier, and deletion re-parents every movement. The mockup's two `5`s coincide because its sample device has only current-month data | One field in `CategoryWithUsage` and one catalogue argument |
| A6 | The mockup's 8-row / 5-row lists are sample data; the screen renders all 10 and 6 seeded categories plus user-created ones (Decision 15) | `BEHAVIOR.md` *"16 categorías seed desde `design/tokens.json`"*; the tokens file lists 10 + 6 | Not reversible in code — it is what the store contains |
| A7 | The icon grid offers the direction's seeded glyphs (from `design/tokens.json`, ✨ excluded because it is the fallback's identity), plus the edited category's current emoji when it is not among them, pre-selected | The mockup's six chips are food glyphs for a category called *Comida* — contextual sample data. The tokens file is the only shipped glyph set in the design contract | One constant in `emoji-palette.ts` |
| A8 | A write failure reverts the optimistic state and shows an inline `Note tone="danger"`; no manifest state is invented (Decision 11) | Not drawn — the mockup has no failure state for this screen. Item #19's Assumption A3 set the precedent | One `Note` in the route |
| A9 | The delete modal's *"✨ Otros"* is rendered unbolded, unlike the mockup's `<b>` | Bolding one interpolated fragment needs `<Trans>` machinery for two words. Recorded as follow-up 5 | One `<Trans>` usage |
| A10 | Open decision **D1** (the English labels of the 16 seed categories) does not block this item | `BEHAVIOR.md` marks D1 as a **seed** decision — *"El seed de #3 las hornea en la base de cada usuario"*. This screen never reads `design/tokens.json` labels: it reads and writes the **user's copy** in `transaction_categories.labels`. A later D1 resolution changes the seed for new installs, not this screen | None — the screen is already indifferent to it |
| A11 | The `☰` handle and `🗑` modal icon are decorative glyphs that live in the catalogues as values, like `ds.modal.icon` | The convention item #19 recorded for hub glyphs | Two catalogue values |

---

## Layer-by-Layer Changes

### Database / Data Layer

**No migration.** Every column this item writes already exists; non-negotiable 5 is not engaged.

- [ ] `apps/mobile/src/db/slug.ts` — **new**: `slugifyCategoryName(name: string): string` and
      `nextAvailableSlug(base: string, taken: readonly string[]): string` (Decision 4). Pure, no
      SQL, no imports beyond the standard library.
- [ ] `apps/mobile/src/db/repositories/categories.ts` — add the four functions of Decision 2
      (`listCategoriesWithUsage`, `createUserCategory`, `renameCategory`, `reorderCategories`).
      `deleteCategory`, `listCategories`, `getCategory`, `createCategory` and `updateCategory` are
      **consumed unchanged**. The two fallback slug constants (`OTROS_EXPENSE_SLUG`,
      `OTROS_INCOME_SLUG`) are already module-private there and are reused, not re-declared.
- [ ] `apps/mobile/src/db/types.ts` — add
      `CategoryWithUsage extends Category { monthCount: number; totalCount: number }`.
- [ ] `apps/mobile/src/db/__tests__/categories.test.ts` — extend with scenarios 1-8.
- [ ] `apps/mobile/src/db/__tests__/slug.test.ts` — **new**, scenario 9.

### Backend / API

**None.** There is no backend.

### Shared Packages / Libraries

**None.** `@finanzas/shared-utils`' `deriveDateLocal` and `getMonthPeriod` are consumed as they are;
`@finanzas/shared-domain` is not touched — nothing here is a domain rule (item #5's plan already
names `repositories/categories.ts` as BR7's single home).

### Frontend / UI — new files

All under `apps/mobile/src/features/categories/`:

- [ ] `direction.ts` — `type CategoryDirection = 'expense' | 'income'`,
      `CATEGORY_DIRECTIONS`, `incomeFlagFor(direction): 0 | 1`. The single translation between the
      tab and the column.
- [ ] `emoji-palette.ts` — `emojiPaletteFor(direction: CategoryDirection): readonly string[]`,
      generated from `design/tokens.json`'s `categoryIcons[direction]` minus the `otros` glyph
      (Assumption A7), plus `paletteWithCurrent(palette, currentEmoji)` which prepends the edited
      category's emoji when it is not already in the list. Importing the tokens file from app source
      follows the precedent of `src/db/seeds/catalogue.ts`.
- [ ] `editor-form.ts` — pure `initialEditorForm(category | null)` and
      `validateEditorForm({ name, emoji }): { valid: boolean; canSave: boolean }`: the name must be
      non-empty after trimming and an emoji must be selected. No length ceiling is invented.
- [ ] `reorder.ts` — pure `moveItem` and `resolveDropIndex` (Decision 10).
- [ ] `read-categories.ts` — React-free
      `readCategoriesSettings(db, { direction, locale, todayDateLocal }): CategoryWithUsage[]`:
      derives the month window with `getMonthPeriod` and calls `listCategoriesWithUsage`. This is
      the seam that makes the `.db.test.ts` possible.
- [ ] `use-categories-settings.ts` — the hook: awaits `getAppDatabase()` once, holds
      `{ status, direction, rows, overlay, error }`, exposes `setDirection`, `openCreate`,
      `openEdit`, `closeOverlay`, `saveEditor`, `requestDelete`, `confirmDelete`, `commitReorder`.
      Cancellation-guarded (`let cancelled = false`, checked before every `setState`) and re-reads on
      focus via `useFocusEffect` bumping a `reloadToken`, matching `useHomeData`.
- [ ] `components/CategoryReorderList.tsx` — the `ListGroup` of `ListRow`s plus the drag shell of
      Decision 10.
- [ ] `components/CategoryEditorSheet.tsx` — `Sheet` + `TextField` (*Nombre*) + the emoji grid of
      `CategoryChip`s in a 3-column layout (`mu-grid-3`) + `Cancelar` / `Guardar` + the
      `variant="ghost"` danger *Eliminar categoría* button, which is rendered **only** in
      `mode: 'edit'` (Assumption A3).
- [ ] `components/DeleteCategoryModal.tsx` — `Modal` with the `🗑` icon, the interpolated body of
      Decision 6 and the `Cancelar` / `Eliminar` pair.
- [ ] `__tests__/{direction,emoji-palette,editor-form,reorder}.test.ts` — app Jest project.
- [ ] `categories-settings.db.test.ts` — `db` Jest project (Decision 12), scenarios 10-11.

### Frontend / UI — modified files

- [ ] `apps/mobile/app/settings/categories.tsx` — replaces `RoutePlaceholder`: `ScreenTopBar`
      (title *Categorías*, back to `/settings`), the `Segment`, the reorder list, the two create
      buttons, the inline error `Note`, the sheet and the modal. Carries
      `testID={fidelityTestId('settings-categories')}` and consumes `useFidelityPreview()`
      (Decision 14, R3-contingent).
- [ ] `apps/mobile/src/components/ui/CategoryChip.tsx` — `label` becomes optional (Decision 9).
- [ ] `apps/mobile/src/components/ui/ListRow.tsx` (**#19's**) — **only if** its trailing slot cannot
      already take a `ReactNode`: add an optional `trailing?: ReactNode`. Additive; no existing call
      site changes (Resolution R1).
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — one emoji-only `CategoryChip` sample beside the
      existing chips, reusing that section's keys.
- [ ] `apps/mobile/src/theme.ts` — a `componentMetrics.categoryReorderRow` group for the handle's
      touch size, the drag elevation and the grid gap. `theme` itself is untouched, so
      `theme-tokens-parity.test.ts` stays green.
- [ ] `apps/mobile/src/i18n/es.json` and `en.json` — the `settings.categories.*` keys (Seed Data).
- [ ] `apps/mobile/jest.config.js` — **only if item #12 has not landed them**: the two additive
      `.db.test.ts` lines (Decision 12).

### Infrastructure / Configuration

- [ ] `scripts/mobile-ui/fidelity-targets.json` — **R3-contingent**: flip this item's four mappings
      from `planned` to `wired`, each gaining `app_file`, `deep_link` and `ready_test_id`:

      | `screen_id` | `state_id` | `app_file` | `deep_link` | `ready_test_id` |
      | --- | --- | --- | --- | --- |
      | `settings-categories` | `expense` | `apps/mobile/app/settings/categories.tsx` | `finanzas:///settings/categories?fidelity=1&fidelityScreen=settings-categories&fidelityState=expense` | `fidelity-settings-categories` |
      | `settings-categories` | `income` | `apps/mobile/app/settings/categories.tsx` | `finanzas:///settings/categories?fidelity=1&fidelityScreen=settings-categories&fidelityState=income` | `fidelity-settings-categories` |
      | `settings-categories` | `edit` | `apps/mobile/app/settings/categories.tsx` | `finanzas:///settings/categories?fidelity=1&fidelityScreen=settings-categories&fidelityState=edit` | `fidelity-settings-categories` |
      | `settings-categories` | `delete-confirm` | `apps/mobile/app/settings/categories.tsx` | `finanzas:///settings/categories?fidelity=1&fidelityScreen=settings-categories&fidelityState=delete-confirm` | `fidelity-settings-categories` |

- [ ] **No new dependency.** No gesture library, no animation library, no query library
      (Decision 10).
- [ ] `apps/mobile/eslint.config.mjs` — no change. This screen stays inside the existing
      `dbAccessBoundary` rule: it imports repository functions, never `drizzle-orm`.

---

## Testing Strategy

**Test types**: unit (Node `db` tier and RN `app` tier), integration against an in-memory SQLite
store, and smoke on a dev build.

### Scenario map

| # | Scenario | Maps to | Test file | Jest project |
| --- | --- | --- | --- | --- |
| 1 | **Deletion re-parents, and this item did not change it.** Seed two expense categories with movements (one of them excluded) plus a merchant defaulting to the deleted one; call `deleteCategory`; assert every movement — **including the excluded one** — now points at `otros-gasto`, the merchant default is `null`, and no `transactions` row was deleted | **brief AC1**; BR7; Decision 1 | `src/db/__tests__/categories.test.ts` (extends item #3's existing cases) | `db` |
| 2 | **✨ Otros refuses deletion at both levels.** `deleteCategory` on `otros-gasto` throws; a raw `db.delete(...)` on the same row is aborted by `protect_otros_categories` | **brief AC2**; Decision 3 | same file | `db` |
| 3 | **✨ Otros refuses renaming.** `renameCategory(db, otrosId, …)` throws and the row is unchanged | **brief AC2**; Decision 3, A1 | same file | `db` |
| 4 | **Rename keeps identity.** `renameCategory` on `comida` changes both locale labels and the emoji, and leaves `slug`, `income`, `sort_order`, `user_id` and `created_at` untouched; `getCategory` reflects the new name in `es` and in `en` | Decisions 4, 5 | same file | `db` |
| 5 | **Creation derives a unique slug and lands above ✨ Otros.** Creating *Mascotas* yields slug `mascotas`; creating a second *Mascotas* yields `mascotas-2`; creating *Educación* on a store that already has `educacion` yields `educacion-2`; in all cases the new row's `sort_order` is the old ✨ Otros position and ✨ Otros moved down by one | Decisions 4, 5 | same file | `db` |
| 6 | **Reorder persists and pins.** `reorderCategories` with a shuffled list of the direction's non-fallback ids assigns `1…n` in that order and sets ✨ Otros to `n + 1`; a list that omits an id, repeats one, includes a foreign-direction id, or includes the fallback id throws and leaves every `sort_order` unchanged | **brief AC3**; Decision 5 | same file | `db` |
| 7 | **Usage counts.** `listCategoriesWithUsage` returns `totalCount` over all time and `monthCount` over the window, counts **excluded** movements in both, returns `0`/`0` for a category with no movements, and does not double-count when a category has movements in two months | Decision 6; A4, A5 | same file | `db` |
| 8 | **Counts do not restate the inclusion rule.** The existing `inclusion-rule-single-definition` suite still passes with the new query in the file | Decision 6 | existing `src/db/__tests__/inclusion-rule-single-definition.test.ts` (no edit; must stay green) | `db` |
| 9 | **Slug helpers.** `slugifyCategoryName` over `'Comida'`, `'Educación'`, `'  Mi   Categoría  '`, `'Café & Té'`, `'🍔'`, `''`, `'---'`; `nextAvailableSlug` over a free base, a taken base, and a base whose `-2` is also taken | Decision 4 | `src/db/__tests__/slug.test.ts` | `db` |
| 10 | **Reorder is reflected in the pickers' own read.** Seed, reorder through `reorderCategories`, then assert `listCategories(db, { income, locale })` — the function #13's `CategoryGrid` and #16's `CategoryPickerSheet` call — returns the new order, with ✨ Otros last | **brief AC3**; Decision 2; residual verification | `src/features/categories/categories-settings.db.test.ts` | `db` |
| 11 | **The screen's read composition.** `readCategoriesSettings` returns the direction's rows in `sort_order` with the month window derived from the given `todayDateLocal`, and a movement dated in the previous month contributes to `totalCount` but not `monthCount` | Decision 6; A4 | same file | `db` |
| 12 | **Reorder geometry.** `moveItem` moves up, moves down, is a no-op for `from === to`, and never mutates its input; `resolveDropIndex` picks the right index for a drag over rows of **unequal** heights, clamps at both ends, and returns `fromIndex` for a translation smaller than half the neighbouring row | Decision 10 | `src/features/categories/__tests__/reorder.test.ts` | `app` |
| 13 | **Palette and form.** `emojiPaletteFor('expense')` equals the tokens' expense glyphs minus `✨`, and `'income'` likewise; `paletteWithCurrent` prepends an unknown current emoji and does not duplicate a known one; `validateEditorForm` rejects an empty or whitespace-only name and a missing emoji | A7; Decision 9 | `src/features/categories/__tests__/{emoji-palette,editor-form}.test.ts` | `app` |
| 14 | **The four manifest states render, and ✨ Otros is inert.** The route renders the list for each tab, the sheet when the overlay is `editor`, the modal when it is `delete-confirm`, and the ✨ Otros row with **no** `onPress` and **no** drag handle | non-negotiable 6; **brief AC2**; Decision 8, A2 | `apps/mobile/app/settings/__tests__/categories.test.tsx` | `app` |
| 15 | **Overlay transitions and re-entrancy.** *Eliminar categoría* moves `editor → delete-confirm`; the modal's *Cancelar* returns to `none` (not to the sheet); `confirmDelete()` called twice runs `deleteCategory` once; `saveEditor()` in overlay `none` is a no-op | Decision 8 | `src/features/categories/__tests__/use-categories-settings.test.tsx` | `app` |
| 16 | **Failure reverts.** A rejecting write leaves the rendered order and name unchanged after the reload and sets the error key; the error union contains no exception text | Decision 11; A8 | same file | `app` |
| 17 | **No literal copy, no naked text, no style literals, touch targets hold** for the new components and the modified `CategoryChip` | non-negotiable 8; `mobile-ui-fidelity.md` | existing `no-naked-text`, `no-style-literals`, `touch-targets`, `component-style-regressions` suites (no edit; must stay green) | `app` |
| 18 | **Catalogue parity and route parity** after the new keys and the replaced route file | non-negotiable 8; manifest contract | existing `catalogue-parity`, `route-manifest-parity`, `gallery-catalogue-keys` suites (no edit; must stay green) | `app` |

RN-tier component tests follow item #2's renderer-free convention: call the component function and
walk the returned element tree.

### Parser-risk addendum

**Classification: not applicable.** This item adds no file under `scripts/lint/` or a comparable
scanner directory, no module whose name implies lint/parser/scanner/tokenizer responsibilities, and
no regex-driven scanning of markdown, code, config or logs. `slugifyCategoryName` uses a regular
expression, but it transforms one short user-supplied string into an identifier — it recognises no
grammar and drives no rule engine. Its inputs are nonetheless enumerated in scenario 9, including
the accent, punctuation, emoji-only and empty cases.

### Concurrent-event-source addendum

**Classification: applicable.** Three event sources touch the same list state: the drag gesture's
completion, the sheet/modal write callbacks, and the `useFocusEffect` re-read that fires whenever the
screen regains focus.

| Checklist item | Design decision |
| --- | --- |
| **Shared mutable state guards** | The only shared mutable state is the hook's `{ rows, overlay, error }` and the measured row offsets. `rows` is written in exactly two places — the reload effect and the optimistic reorder — and both go through a single `setRows` reducer that stamps the `reloadToken` it was computed for, so a late-arriving read from an earlier token is discarded rather than overwriting a newer optimistic order. The measured offsets live in a `useRef` and are read only inside the gesture, which is single-touch by construction (`PanResponder` grants one responder) |
| **Re-entrancy / in-flight tracking** | The `CategoriesOverlay` union is the in-flight flag for writes: `confirmDelete()` and `saveEditor()` return immediately unless the overlay matches, and both close the overlay synchronously before the first `await` (scenario 15). `commitReorder` sets a `writing` ref that a second drag-end cannot pass |
| **Event deduplication** | The duplicable events are a double-tap on *Guardar* / *Eliminar* (handled by the overlay guard) and a drag release that fires `onPanResponderRelease` and `onPanResponderTerminate` in quick succession (handled by clearing the drag ref in whichever fires first). There is no subscription, no reconnect and no retry loop |
| **Listener and resource cleanup** | The read effect is cancellation-guarded and its `cancelled` flag is checked before every `setState`; `useFocusEffect`'s subscription is removed by Expo Router on unmount. The `PanResponder` is created once with `useRef` and holds no timer; the `Animated.Value` is released with the component. Unmounting mid-drag leaves nothing running |
| **Race conditions at initialization** | A drag cannot start before the first read resolves, because until then the list renders the pending state and there are no rows to grab. A focus re-read that arrives while `status === 'pending'` simply supersedes the in-flight one via the token stamp |
| **Race conditions at teardown** | Navigating away mid-write resolves the write into a cancelled effect: the repository call still commits (it is synchronous SQLite inside one transaction), and the discarded `setState` is what the `cancelled` guard exists for. No partial write is possible — every multi-row write is one `db.transaction` |
| **Error propagation across async boundaries** | Every repository call is wrapped in `try/catch` inside the hook; the catch sets the error key of Decision 11 and triggers a reload, so no rejection escapes into an unhandled-rejection handler and nothing is swallowed silently. Nothing is logged — an exception message from SQLite can carry row identifiers |

**New concurrent pattern**: the `PanResponder` drag is the first gesture-driven write in this
codebase. It is deliberately confined to `components/CategoryReorderList.tsx`, with all of its
decision logic in the pure `reorder.ts`, so the concurrency surface is one component and one ref.

---

## Seed Data

| What | Where | Used by |
| --- | --- | --- |
| **No new shipped seed data.** The 16 seeded categories item #3 generates from `design/tokens.json` are exactly what this screen renders. `pnpm --filter @finanzas/mobile db:seed` must produce **no diff** to `apps/mobile/src/db/__fixtures__/store-v1.sql` | `apps/mobile/src/db/seeds/catalogue.ts` (unchanged) | scenarios 1-11, smoke |
| Test store: the bootstrapped in-memory store from `src/db/testing/memory-db.ts`, plus movements planted across two months on two expense categories — at least one of them `excluded_at`-stamped — using the existing `src/db/testing/product-fixture.ts` helper | test-local in `src/db/__tests__/categories.test.ts` and `src/features/categories/categories-settings.db.test.ts` | scenarios 1, 6, 7, 10, 11 |
| A user-created category (`Mascotas`, emoji `🐶`) inserted through `createUserCategory` rather than through a fixture, so the slug path is exercised as it will run | same files | scenarios 5, 6 |
| On-device data for the runbook: the committed `apps/mobile/src/db/__fixtures__/store-v1.sql`, loaded through item #12's `__DEV__` sample-data panel if it has landed; otherwise a real Banco de Chile connection plus one sync | `docs/testing/mobile/21-settings-categories.smoke-test.md` | smoke steps 2-8 |

### Catalogue keys (`apps/mobile/src/i18n/es.json` + `en.json`)

Spanish copy is verbatim from the mockup except where marked. Keys are flat, lowercase, snake_case
and dotted, per `catalogue-parity.test.ts`. Interpolation variables are never named `count`
(i18next reserves it and would try its own plural resolution against `keySeparator: false` keys) —
`{{n}}` is the count variable, and singular/plural is chosen by an explicit `n === 1` check.

| Key | `es` |
| --- | --- |
| `settings.categories.title` | `Categorías` |
| `settings.categories.tab_expense` | `Gastos` |
| `settings.categories.tab_income` | `Ingresos` |
| `settings.categories.row_movements_single` | `{{n}} transacción este mes` *(singular form of the drawn string)* |
| `settings.categories.row_movements_plural` | `{{n}} transacciones este mes` |
| `settings.categories.fallback_sub_expense` | `Categoría por defecto · no se puede eliminar` |
| `settings.categories.fallback_sub_income` | `Categoría por defecto` |
| `settings.categories.reorder_handle` | `☰` *(decorative glyph, catalogue value — Assumption A11)* |
| `settings.categories.reorder_a11y` | `Reordenar {{category}}` *(accessibility label; not drawn — Decision 10)* |
| `settings.categories.create_expense` | `+ Nueva categoría de gasto` |
| `settings.categories.create_income` | `+ Nueva categoría de ingreso` |
| `settings.categories.editor_edit_title` | `Editar categoría` |
| `settings.categories.editor_create_expense_title` | `Nueva categoría de gasto` *(Assumption A3 — the create button's copy without the `+`)* |
| `settings.categories.editor_create_income_title` | `Nueva categoría de ingreso` *(Assumption A3)* |
| `settings.categories.name_label` | `Nombre` |
| `settings.categories.icon_label` | `Ícono` |
| `settings.categories.cancel` | `Cancelar` |
| `settings.categories.save` | `Guardar` |
| `settings.categories.delete_cta` | `Eliminar categoría` |
| `settings.categories.delete_modal_icon` | `🗑` |
| `settings.categories.delete_modal_title` | `Eliminar categoría` |
| `settings.categories.delete_modal_body_single` | `¿Eliminar «{{category}}»? La transacción de esta categoría se moverá a {{fallback}}.` |
| `settings.categories.delete_modal_body_plural` | `¿Eliminar «{{category}}»? Las {{n}} transacciones de esta categoría se moverán a {{fallback}}.` |
| `settings.categories.delete_modal_body_none` | `¿Eliminar «{{category}}»? No tiene transacciones que mover.` *(not drawn — the mockup's sample category has movements)* |
| `settings.categories.delete_modal_confirm` | `Eliminar` |
| `settings.categories.error_reorder` | `No pudimos guardar el orden. Inténtalo de nuevo.` *(Assumption A8)* |
| `settings.categories.error_save` | `No pudimos guardar la categoría. Inténtalo de nuevo.` *(Assumption A8)* |
| `settings.categories.error_delete` | `No pudimos eliminar la categoría. Inténtalo de nuevo.` *(Assumption A8)* |

`{{category}}` is the emoji and name joined (`🍔 Comida`), `{{fallback}}` is the direction's fallback
rendered the same way (`✨ Otros`) — both composed from store rows, never from a literal.

---

## Documentation Updates

The developer updates these **after** implementation; they are not edited during Plan Ready.

- [ ] `docs/project/1-business-domain.md` — the *Transaction category* entity says ✨ Otros *"cannot
      be deleted"*; extend it with *"and cannot be renamed; it is identified by its stable slug,
      never by its displayed name"* (Decisions 3, 4).
- [ ] `docs/project/4-database-model.md` — record the four new repository functions, the
      "✨ Otros is pinned last" invariant and the slug-derivation rule for user-created categories
      (Decisions 2, 4, 5).
- [ ] `docs/best-practices/stack/expo-react-native.md` — record the sanctioned drag pattern
      (`PanResponder` + `Animated` with the decision logic in a pure module; no gesture or animation
      dependency) so the next reorder surface does not re-open the question (Decision 10). This file
      also still prescribes TanStack Query; item #8 owns that correction — do **not** duplicate it
      here.
- [ ] `docs/best-practices/stack/design-tokens.md` — document the new
      `componentMetrics.categoryReorderRow` group.
- [ ] `AGENTS.md` — one Troubleshooting row: *"Category order differs between settings and a
      categorization picker"* → something sorted categories outside `listCategories`;
      `sort_order` is written only by `reorderCategories` and `createUserCategory`.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — **no edit.** The 🟡 on `settings-categories` is LH's to
      promote; this plan lists it as Assumption A1, which is what that document asks a spec to do.
      The open **D1** note also stays as it is (Assumption A10).
- [ ] `docs/testing/README.md` — no edit; it does not index individual runbooks.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Item #19 has not merged when this item is implemented, so `ListRow` / `ListGroup` / `ScreenTopBar` do not exist | Med | High | Resolution R1: the implementer stops and returns to the parent orchestrator rather than creating a second list primitive. Re-verification step 1 is the check |
| The hand-rolled `PanResponder` drag misbehaves on a device (scroll steals the responder, rows jump on variable heights) | Med | High | The decision logic is in a pure, unit-tested module (scenario 12), so only the shell can be wrong; `scrollEnabled={false}` during the drag is part of the design; and Decision 10's escalation rule forbids silently substituting a different affordance |
| The two list fidelity targets mismatch above the 3 % default **because the seed ships 10 and 6 categories while the mockup draws 8 and 5** (Decision 15) | High | Med | Expected and named in advance. The implementation PR pastes the measured mismatch and the diff image. If the difference is confined to the extra rows, record a `threshold_note` naming the data divergence and open follow-up 3 for the design owner; if the diff shows a **layout or token** difference as well, that is a real failure and is fixed, not thresholded (#47 Decision 4 forbids manufacturing a pass) |
| A user-chosen name collides with a seeded slug, and the unique index throws mid-write | Low | Med | `createUserCategory` reads the taken slugs and inserts inside one transaction (Decision 4); scenario 5 covers the `-2` and accent-folding cases |
| Making `CategoryChip.label` optional ripples into an existing screen | Low | Low | The change is additive and every current call site passes a label; `component-style-regressions`, `touch-targets` and the gallery suites are the check (scenarios 17, 18) |
| Item #47 (PR #61) merges with a different mapping shape than the one read at plan time | Low | Low | Re-verification step 5 re-reads the contract file rather than trusting this plan's table; the flip is R3-contingent either way |
| A sibling item adds its own reorder or usage-count function to `repositories/categories.ts`, causing a merge conflict | Low | Low | Re-verification step 3 lists the file's exports before editing; #13's `listMostUsedCategories` is the only known sibling addition and does not overlap |
| The optimistic reorder and a focus re-read disagree, showing a flicker back to the old order | Med | Low | The `reloadToken` stamp in the concurrency table discards a stale read; scenario 16 pins the failure branch |
| Four runtime APIs are **unverified** because `node_modules` is absent from the plan-time tree: `PanResponder`, `Animated`, `View.onLayout` and `useFocusEffect` | Med | Low | Flagged as *unverified — the implementer must confirm before proceeding* in the Verification Log. The plan names the **responsibility and the owning file**, not the call signature: the gesture stays inside `components/CategoryReorderList.tsx` whatever the API turns out to be, and if `useFocusEffect` is unavailable from `expo-router` the fallback is the `reloadToken` bump on screen mount, which items #8 and #12 already rely on |

---

## Follow-ups (explicitly out of scope)

1. **Auto-scrolling the list while dragging past its edge** (Decision 10) — needed once a user has
   more categories than fit on one screen.
2. **A store-level `BEFORE UPDATE` trigger protecting the two ✨ Otros rows' `slug` and `labels`**
   (Decision 3) — a second migration, justified only if a future write path bypasses the repository.
3. **Aligning the mockup's drawn category lists with `design/tokens.json`** — the drawing shows 8 of
   10 expense and 5 of 6 income categories (Decision 15). A design-contract edit for the design
   owner; this item does not edit `design/`.
4. **Free emoji entry for a custom category.** `design/tokens.json` says *"users may pick any emoji
   for custom categories"*, while the mockup draws a fixed chip grid. The MVP ships the grid
   (Assumption A7); an emoji-keyboard input is a separate, drawn decision.
5. **Bolding `✨ Otros` inside the delete-modal sentence** via `<Trans>` (Assumption A9).
6. **Moving a category between directions** — not in the brief, not drawn, and not expressible in
   the merged repository (Decision 7).

---

## Implementation Order

Each step ends in a state where `pnpm lint && pnpm typecheck && pnpm test` passes.

0. **Implementation-start re-verification.** Run the seven checks in the *Cross-Cutting Operational
   Assumption Check*, record `Still valid` / `Stale or conflicting` in the PR body, and stop if item
   #19 has not merged (Resolution R1).
   *Verification*: the recorded table appears in the PR description.

1. **Slug helpers.** Add `apps/mobile/src/db/slug.ts` and `src/db/__tests__/slug.test.ts`
   (Decision 4, scenario 9).
   *Verification*: `pnpm --filter @finanzas/mobile test` — read the output and confirm the `db`
   project ran the new file and that every enumerated input in scenario 9 has a case.

2. **Repository gap.** Add `listCategoriesWithUsage`, `createUserCategory`, `renameCategory` and
   `reorderCategories` to `src/db/repositories/categories.ts`, and `CategoryWithUsage` to
   `src/db/types.ts` (Decisions 2-6). Extend `src/db/__tests__/categories.test.ts` with scenarios
   1-7.
   *Verification*: `pnpm --filter @finanzas/mobile test` — the `db` project passes, including the
   pre-existing item #3 category cases, and `inclusion-rule-single-definition.test.ts` is still
   green (scenario 8). Confirm by reading the diff that `deleteCategory` is unmodified.

3. **Feature-tier pure modules.** Add `direction.ts`, `emoji-palette.ts`, `editor-form.ts`,
   `reorder.ts` and `read-categories.ts` with their tests (scenarios 12, 13), plus
   `categories-settings.db.test.ts` (scenarios 10, 11), adding the two `jest.config.js` lines only
   if item #12 has not (Decision 12).
   *Verification*: `pnpm --filter @finanzas/mobile test` — confirm from the output that the
   `.db.test.ts` file ran in the **`db`** project (Node), not in `app`.

4. **Catalogue keys.** Add the `settings.categories.*` keys of the Seed Data section to `es.json`
   and `en.json`.
   *Verification*: `pnpm --filter @finanzas/mobile test` — `catalogue-parity.test.ts` passes (flat
   keys, identical key sets).

5. **The primitive change.** Make `CategoryChip.label` optional, add the emoji-only gallery sample,
   and add the `componentMetrics.categoryReorderRow` group (Decision 9).
   *Verification*: `pnpm --filter @finanzas/mobile test` — `gallery-catalogue-keys`,
   `component-style-regressions`, `touch-targets` and `no-style-literals` all pass; confirm no
   existing `CategoryChip` call site changed.

6. **The screen.** Write `use-categories-settings.ts` and the three components, then replace
   `app/settings/categories.tsx` (Decisions 8, 10, 11, 13). Compose #19's `ScreenTopBar`,
   `ListGroup` and `ListRow`, applying the R1 `trailing` branch if needed.
   *Verification*: `pnpm lint` (the `no-literal-string` rule must report nothing);
   `pnpm --filter @finanzas/mobile test` — `no-naked-text`, `route-manifest-parity` and the two new
   route/hook suites (scenarios 14-16) pass. Then run the app and walk
   settings → categories → both tabs → edit → delete → create → drag a row → leave and return, and
   confirm the order survived.

7. **Fidelity wiring (R3-contingent).** If `apps/mobile/src/lib/fidelity-preview.ts` exists, wire
   `useFidelityPreview()` per Decision 14 and keep `testID={fidelityTestId('settings-categories')}`
   on the route root; if it does not, use the literal `testID="fidelity-settings-categories"` and
   say so in the PR body.
   *Verification*: deep-link each of the four states and confirm the screen opens in the expected
   overlay.

8. **Fidelity targets (R3-contingent).** If `scripts/mobile-ui/fidelity-targets.json` exists, flip
   this item's four mappings to `wired` with the `app_file` / `deep_link` / `ready_test_id` values in
   *Infrastructure / Configuration*; otherwise skip and say so in the PR body.
   *Verification*: `pnpm fidelity:contract` — read the output and confirm the wired count rose by
   four and every deep link was accepted. Then `pnpm fidelity --issue 21` and paste the per-target
   table, including the expected list-row divergence of Decision 15.

9. **Documentation.** Make the edits listed in *Documentation Updates*.
   *Verification*: `npx markdownlint-cli2` over the changed files.

10. **CHANGELOG.** Add exactly this entry under `[Unreleased] → ### Added`:

    ```markdown
    - **Settings: categories management** (#21): the categories screen — expense and income tabs,
      create, rename and re-icon, drag to reorder with persisted `sort_order`, and delete with
      re-parenting to ✨ Otros through the existing transactional cascade. The two ✨ Otros
      categories offer no edit, delete or reorder affordance.
    ```

11. **Smoke test.** Execute
    [`docs/testing/mobile/21-settings-categories.smoke-test.md`](../../../testing/mobile/21-settings-categories.smoke-test.md)
    on a dev build and record the result in the PR.

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — the brief's four acceptance criteria map as follows. AC1
  (deleting re-parents to the same-direction fallback) → Decision 1, scenario 1, runbook Step 6.
  AC2 (system categories offer no delete action) → Decisions 3 and 8, Resolution R2, scenarios 2, 3
  and 14, runbook Step 7. AC3 (reordering persists `sort_order` and is reflected in the
  categorization pickers) → Decisions 5 and 10, scenarios 6, 10 and 12, the residual verification
  table, runbook Step 8. AC4 (side-by-side mockup comparison) → Decisions 14 and 15, Resolution R3,
  Implementation Order steps 7-8, runbook Step 9. The brief's scope sentence also names *create* and
  *edit (name + emoji)* → Decisions 4, 7, 9, scenarios 4, 5, 13, runbook Steps 4-5.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  exactly one Implementation Order step, and every helper name (`listCategoriesWithUsage`,
  `createUserCategory`, `renameCategory`, `reorderCategories`, `slugifyCategoryName`,
  `nextAvailableSlug`, `readCategoriesSettings`, `moveItem`, `resolveDropIndex`, `emojiPaletteFor`,
  `paletteWithCurrent`, `initialEditorForm`, `validateEditorForm`, `incomeFlagFor`,
  `useCategoriesSettings`), type name (`CategoryWithUsage`, `CategoryDirection`,
  `CategoriesOverlay`), file path (`apps/mobile/src/db/slug.ts`,
  `apps/mobile/src/features/categories/**`, `apps/mobile/app/settings/categories.tsx`), route
  (`/settings/categories`), `testID` (`fidelity-settings-categories`), catalogue key prefix
  (`settings.categories.`), Decision index (1-15), Assumption label (A1-A11) and scenario number
  (1-18) is spelled identically in every section.
- **Verification support**: Checked — every claim about existing behaviour cites a Verification Log
  row with a command and a result, including the four claims that drive scope: what the merged
  repository already provides, that the trigger is `BEFORE DELETE` only, that no gesture library is
  installed, and what #47's live contract file already contains for this screen (read from PR #61's
  branch, not from its plan prose).
- **Technical accuracy**: Checked — every repository signature, primitive prop, variant string,
  trigger definition, lint-scanner rule and best-practice quote this plan names was read from the
  actual source file at `961cc69` and recorded in the Verification Log, including #47's contract and
  validator, which were read from PR #61's branch rather than from its plan prose. The four runtime
  APIs whose packages are absent from the plan-time `node_modules` tree (`PanResponder`, `Animated`,
  `View.onLayout`, `useFocusEffect`) and item #19's not-yet-written `ListRow` prop names are
  explicitly flagged **unverified — the implementer must confirm before proceeding**, each with an
  owning Implementation Order step, a re-verification check and a named fallback.
- **Behavioural guarantees**: Checked — "never orphans, never cascades" names its mechanism (the
  merged `deleteCategory` transaction, unmodified); "✨ Otros cannot be deleted or renamed" names
  three mechanisms and the one level where each applies (Decision 3's table); "✨ Otros stays last"
  names the two functions allowed to write `sort_order` (Decision 5); "runs at most once" names the
  overlay-union guard (Decision 8); "reordering is reflected in the pickers" names the single read
  function and the test that proves it (residual verification, scenario 10).
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes product code and
  project documentation only; it adds and modifies no workflow decision gate, protocol, status label
  or mirrored workflow surface.
- **Parser/API/concurrency checklist completeness**: Checked — parser-risk is classified **not
  applicable** with a rationale (no scanner, no rule engine; the one regex is a slug transformer
  whose inputs are still enumerated in scenario 9); concurrent-event-source **applies** (a gesture,
  two write callbacks and a focus re-read over one list state) and carries all seven checklist
  items. Single-snapshot / consistency-semantics signals do not apply: the screen reads one grouped
  query per render and makes no cross-query consistency claim.
- **CHANGELOG literal format**: Checked — Implementation Order step 10 gives the entry in the
  project's `**Bold Title** (#N):` format, under `### Added`, for the developer to copy verbatim.
- **Not-applicable rationale**: Checked — the two skipped categories above each carry a rationale.
