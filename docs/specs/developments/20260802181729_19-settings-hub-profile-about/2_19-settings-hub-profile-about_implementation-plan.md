# Settings: hub, local profile and about — Implementation Plan

**Work item**: [#19 Settings: hub, local profile and about](https://github.com/lhpaul/personal-finances/issues/19)
— a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the three contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` — `#screen=settings`,
  `#screen=settings-account` (states `default`, `delete-confirm`), `#screen=settings-about`
  (manifest entries in [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js))
- **Behaviour contract**: [`BEHAVIOR.md` → `settings`, `settings-account`, `settings-about`](../../../../design/mockups/mobile/BEHAVIOR.md)
- **Domain contract**: [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md)
  BR0 (no account, no sign-in, no server), BR1 (credentials never leave the device), BR3 (bank
  data is never deleted, only excluded)

**Smoke test runbook**: [`docs/testing/mobile/19-settings-hub-profile-about.smoke-test.md`](../../../testing/mobile/19-settings-hub-profile-about.smoke-test.md)

---

## Summary

**Approach**: Three composition-only routes over one `src/features/settings/` folder, reading
through `getAppDatabase()` and repository functions behind one feature hook per screen — the
pattern item #8 established and item #12 followed. **No TanStack Query.** The item's centre of
gravity is not the three screens; it is `wipeLocalData()`, the product's only destructive
operation, written as an **ordered, fail-closed sequence over injected ports** so that a Node-tier
test can prove all three halves of the brief's AC1/AC2 at once: no table has rows, no credential
entry survives, and the next launch resolves to `onboarding-intro`.

The one structural idea worth stating up front: **a keychain has no "list every key" API**, so
"every credential key" (AC1) is not a runtime enumeration — it is a *derivation* from the two
tables that name the key space, plus a repository-wide scan test that proves no other key
namespace is ever written. That is what makes AC1 verifiable rather than aspirational.

**Estimated complexity**: **M**

**Rationale**: three screens with four manifest targets, three new design-system primitives, six
small repository/runtime additions and one formatter — all of it shallow. The depth is in the
wipe: an ordered teardown that invalidates a memoized database handle other hooks may be holding,
across two storage systems, one of which cannot be enumerated and neither of which can be undone.
That is a day of careful work plus a day of tests, not a large surface.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#9 connect a bank](https://github.com/lhpaul/personal-finances/issues/9) | Plan open as PR [#57](https://github.com/lhpaul/personal-finances/pull/57); implementation not started | Owns the entire secure-store seam this item deletes through: `SecureStorePort`, the Expo adapter, `credentialsKeyFor` / `deleteCredentials`, `listConnectionsForCredentialLookup`, `listInstitutions`, `resolveLockedRut`, the `expo-secure-store` boundary lint + test, and the third `feature` Jest project | **Yes** — see Decision 2 and Resolution R1 |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged; implementation not started | Owns `src/db/runtime.ts` → `getAppDatabase()`, `src/db/repositories/connections.ts`, `readReminderSettings`, `src/features/reminders/summary.ts` → `summarizeReminderDays`, the `screenMetrics` theme export, and the `app_settings.onboarding_completed` launch gate that makes AC2 true after the wipe | **Yes** — see Decision 6 |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | `Card`, `Modal`, `Note`, `Badge`, `Button`, `Text` — every primitive these screens compose except the three this item adds | Satisfied |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | `app_settings`, `first_launch_at`, the repositories, `openAppDatabase()`, `ensureDatabaseReady()`, the two-project Jest config | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `formatRut`, `deriveDateLocal`; this item adds one sibling formatter | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues and the `no-literal-string` rule | Satisfied |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | Plan merged; implementation not started (`scripts/mobile-ui/` absent) | This item's four fidelity targets flip `planned` → `wired` | **No** — contingent, see Resolution R3 |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | PR [#44](https://github.com/lhpaul/personal-finances/pull/44) open | Nothing. This item calls no domain rule: it aggregates no money and evaluates no inclusion | No |

**Not built here** (navigation seams only — Decision 14): `settings-banks` and `bank-review`
(#20), `settings-notifications` (#18), `settings-categories` (#21). The hub links to their
existing placeholder routes.

---

## Verification Log

All commands were run in the plan worktree `.claude/worktrees/item-19` at repo revision
`1c7af24` (`git rev-parse HEAD` equals `git rev-parse origin/develop`), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse HEAD` and `git rev-parse origin/develop` | Both `1c7af24` — the plan branch is not stacked on unmerged work |
| Template-fit check applies? | `sed -n '171,176p' .ai-dev-workflow.yaml` | `is_template: false` → Protocol 02 **Step 0 does not apply**; no template-fit warning is required |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | `0 matches` → default `single_repo`; this repository owns the plan and the plan PR |
| Manifest entries for this item's screens | `sed -n '445,516p' design/mockups/mobile/mockup-manifest.js` | `settings` (`/settings`, no `states[]`), `settings-account` (`/settings/account`, states `default` *(initial)* and `delete-confirm`), `settings-about` (`/settings/about`, no `states[]`). **4 screen/state targets**, matching #47's coverage table (`#19 → 4`) |
| The destructive path as drawn | `sed -n '2216,2259p' design/mockups/mobile/index.html` | One `mu-btn--danger-soft` **Borrar todos mis datos** → `go('settings-account','delete-confirm')`; the overlay's **Cancelar** returns to `default` and **Borrar todo** calls `go('onboarding-intro')`. No third exit |
| No sign-out affordance is drawn anywhere in settings | `sed -n '2198,2214p' design/mockups/mobile/index.html` (hub) and the account section above | Hub rows: *Perfil local*, *Bancos conectados*, *Recordatorios*, *Categorías*, *Acerca de*. The account screen's only button is the destructive one. **Zero** sign-out / log-out / close-session affordances |
| The about screen's three list rows have no destination | `sed -n '2487,2491p' design/mockups/mobile/index.html` | *Política de privacidad*, *Términos de servicio*, *Enviar feedback* are `<button class="mu-item">` with **no `onclick`** — the mockup itself declares them non-navigating (Decision 8) |
| `mu-*` classes deferred to **this** item | `grep -nE "'mu-(list\|item)" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-list`, `mu-item`, `mu-item__chev`, `mu-item__icon`, `mu-item__sub`, `mu-item__title`, `mu-item__txt` — 7 classes, all `deferred` with note *"Deferred to #19 (Settings hub)."* |
| `mu-topbar*` ownership | `grep -nE "'mu-topbar" apps/mobile/src/test-utils/mu-class-map.ts`; item #8 plan Decision 12; item #12 plan Decision 5 | Still `deferred`. #12 **retargets the note to #8** but does not build it; #8 **explicitly declines** (*"build both as screen-local compositions … and leave `MU_CLASS_MAP` unchanged"*). All three of this item's screens draw a topbar → Decision 12 |
| Existing repository surface | `grep -rnE "^export (async )?function" apps/mobile/src/db/repositories/` | `listConnectableInstitutions`, `disconnectInstitution`, `getSetting`, `setSetting`, `listCategories`, `getCategory`, `createCategory`, `updateCategory`, `deleteCategory`, `deleteMerchant`, `upsertBankTransactions`, `countUncategorized`, `listMonth`, `totalForCategoryInPeriod`, `listByMerchant`. **No** total transaction count, **no** category count, **no** typed `first_launch_at` reader |
| `first_launch_at` is already written on first launch | `sed -n '52,55p' apps/mobile/src/db/bootstrap.ts` | `ensureFirstLaunchAt` writes it through `setSetting` when absent — the account screen's *"Usando la app desde"* needs no new write |
| The RUT is **not** in SQLite | `grep -n 'RUT' docs/project/4-database-model.md` lines 21, 62, 119 | *"Never in SQLite. Bank credentials **and the RUT** live in `expo-secure-store`"* → the account screen's RUT row is a secure-store read (Decision 5) |
| Credential key convention | `grep -n 'credentials_key' docs/project/4-database-model.md`; `sed -n '64,66p' apps/mobile/src/db/schema.ts` | `` `expo-secure-store` key, e.g. `bank_creds:banco-de-chile`. **The value never touches SQLite** ``; the column stores the *key name*, never the value |
| Seeded institution catalogue (the orphan-sweep key space) | `sed -n '77,126p' apps/mobile/src/db/seeds/catalogue.ts` (via item #9's Verification Log, re-read here) | Six banks: `banco-de-chile`, `santander`, `bci`, `banco-estado`, `falabella`, `itau` |
| Tables the wipe must leave empty | `grep -nE "sqliteTable" apps/mobile/src/db/schema.ts` | 12 tables: `users`, `financial_institutions`, `user_financial_institutions`, `user_financial_products`, `transaction_categories`, `merchants`, `merchant_aliases`, `transactions`, `app_settings`, `user_budgets`, `user_recurring_transactions`, `seed_ledger` — see Decision 4 for what "empty" means after re-bootstrap |
| `expo-sqlite` is imported in exactly one file today | `grep -rn "expo-sqlite" apps/mobile/src apps/mobile/app` | `apps/mobile/src/db/client.ts` only (plus the boundary test's literal list) — the file deletion must land there (Decision 3) |
| The SQL access boundary | `cat apps/mobile/src/db/__tests__/db-access-boundary.test.ts`; `sed -n '29,37p' apps/mobile/eslint.config.mjs` | `dbAccessBoundary` (lint) **and** a source scan forbid `drizzle-orm` / `expo-sqlite` / `better-sqlite3` anywhere under `app/**` or `src/**` except `src/db/**` |
| `expo-constants` is already a dependency | `grep -n 'expo-constants' apps/mobile/package.json` | `~18.0.13` — the about screen's version string needs no new dependency (Decision 9) |
| The app version today | `grep -n 'version' apps/mobile/app.config.js` | `'0.0.0'`. The mockup draws *"Versión 1.0.0 (MVP)"* — sample data, exactly like its RUT and its `57` movement count (Assumption A6) |
| Long month-year formatter exists? | `grep -nE '^export function format' packages/shared-utils/src/dates.ts` | `formatShortDate`, `formatLongDate`, `formatMonthYear` (`ene 2025`), `formatMonthAbbreviation`. **No** `enero 2025` formatter → Decision 10 |
| `formatRut` exists and is total on structurally-valid input | `sed -n '87,107p' packages/shared-utils/src/rut.ts` | `'123456789'` → `'12.345.678-9'`; throws `TypeError` on malformed input, so it must never be called unguarded |
| Catalogue key shape enforced by CI | `cat apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | Flat lowercase snake_case dotted keys, identical key sets in `es` and `en`, no nested values |
| Route files this item replaces | `cat apps/mobile/app/settings/index.tsx` (and `account.tsx`, `about.tsx`) | All three are `RoutePlaceholder`. The hub placeholder already links to all five sub-routes, so `route-manifest-parity.test.ts` stays green without a route-file change |
| Fidelity kit present? | `ls scripts/mobile-ui` | `No such file or directory` — item #47 is planned, not implemented → Resolution R3 |
| #19's fidelity coverage set | Item #47 merged plan, *Coverage sets* table | `#19 → settings, settings-account, settings-about → 4 targets`, all seeded `status: "planned"` |
| Item #9's secure-store contract (this item's hard dependency) | `git show origin/implementation-plan/9-connect-a-bank:docs/specs/developments/20260802131302_9-…_implementation-plan.md`, *Frontend/UI — new files* and Decisions 4-6 | `src/lib/secure-store/types.ts` → `SecureStorePort { getItem, setItem, deleteItem }` (**no list-keys method**); `expo-secure-store.adapter.ts` (only importer); `credential-store.ts` → `credentialsKeyFor(institutionId) === 'bank_creds:' + institutionId`, `writeCredentials`, `readCredentials`, `deleteCredentials`; `rut-lock.ts` → `resolveLockedRut(db, port)`; `connections.ts` → `listConnectionsForCredentialLookup(db)`, `listConnectedBankSummaries(db)`; `institutions.ts` → `listInstitutions(db)`; Decision 14 → a third `feature` Jest project matching `src/features/**/*.node.test.ts` |
| Design-system primitive variant names this plan cites | `grep -nE 'export type (NoteTone\|ButtonVariant\|CardVariant\|TextVariant)' apps/mobile/src/components/ui/{Note,Button,Card,Text}.tsx` | `NoteTone = 'info' \| 'ok' \| 'warn' \| 'danger'`; **`ButtonVariant = 'primary' \| 'muted' \| 'outline' \| 'ghost' \| 'danger' \| 'dangerSoft'`** (camelCase, **not** `'danger-soft'`); `CardVariant = 'default' \| 'tight' \| 'flat'`; `TextVariant` includes `h2`, `h3`, `small`, `body` |
| `Modal`'s prop contract | `sed -n '1,40p' apps/mobile/src/components/ui/Modal.tsx` | `{ visible, onRequestClose, icon?, title, children? }` — `onRequestClose` is **required**, and the title renders as `Text variant="h2"` (Assumption A12) |
| Gallery coverage is bidirectional | `cat apps/mobile/src/__tests__/gallery-catalogue-keys.test.ts` | Every `ds.*` catalogue key must be used by `src/dev/DesignSystemGallery.tsx`, and every key the gallery calls must exist in `es.json`. Adding a primitive without a gallery entry is a convention breach; adding a gallery entry without its `ds.*` keys fails the suite → Decision 12 |
| Best-practice quotes this plan relies on | `grep -n 'one-off' docs/best-practices/stack/mobile-ui-fidelity.md`; `grep -n 'Aggregate in SQL' docs/best-practices/stack/sqlite-drizzle.md`; `sed -n '149,152p' docs/project/3-software-architecture.md` | Lines 43-44, line 114 and the *Deletion* row respectively — all three quoted verbatim in the Decisions below |
| **Runtime APIs this plan names but cannot verify** | `ls node_modules/expo-sqlite apps/mobile/node_modules/expo-sqlite` | **Not installed in the current tree** — same situation item #8's plan recorded for `drizzle-orm`. `expo-sqlite`'s database-deletion and handle-close API, `expo-router`'s `router.dismissAll()`, and `expo-constants`' `Constants.expoConfig?.version` are therefore **unverified — the implementer must confirm each against the installed package before proceeding** (Implementation Order steps 2 and 8; Risks table) |
| Bounded same-surface open PRs | `gh pr list --state open --json number,title,headRefName` then a file-level read of each | Four: **#57** (item #9 plan — same surface, see the Assumption Check), **#59** (item #13 plan), **#46** (item #6 `packages/bank-scraper`), **#44** (item #5 `packages/shared-domain` + `packages/shared-utils`). Only #57 and #44 touch surfaces this plan names |

### Residual verification strategy

This plan makes exactly one pattern-completeness claim — brief AC1's *"every credential key"* —
and one enumeration claim — *"no sign-out affordance exists anywhere in settings"* (AC4). Neither
is left as prose in this document; both have a mechanical evidence source the implementation PR
must paste:

| Claim | Evidence source | What the implementation PR pastes |
| --- | --- | --- |
| The wipe covers **every** credential key | `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts` — asserts that every `setItem(` call site under `apps/mobile/src/**` passes a key produced by `credentialsKeyFor(...)`, so the derivation in Decision 2 is a complete cover of the written key space | The test's pass line plus the list of `setItem` call sites it found (the test prints them, so a vacuous pass on a broken walk is visible) |
| No sign-out affordance exists (AC4) | `apps/mobile/src/__tests__/no-sign-out.test.ts` — scans both i18n catalogues and every source file under `app/**` and `src/**` for session-ending copy and identifiers | The test's pass line and the number of files scanned |
| Every `mu-*` class these screens draw has an owner | The existing `apps/mobile/src/__tests__/mu-class-coverage.test.ts` set-equality assertion plus its per-status breakdown | The per-status breakdown, before and after |
| Every manifest state is implemented | The four fidelity targets flipped to `wired` in `scripts/mobile-ui/fidelity-targets.json`, validated by `pnpm fidelity:contract` (R3-contingent; the manual side-by-side otherwise) | `pnpm fidelity:contract` output, or the runbook's manual comparison record |

If the live `MU_CLASS_MAP` at implementation time differs from Decision 12's enumeration (because
#12 or #8 flipped a class first), the developer follows the live map and records the difference in
the PR body. The enumeration below is a plan-time snapshot, not a frozen scope.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — no `mode` key, so this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-02T18:17Z, `1c7af24` | Current invocation item `{#19}`; no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* (*"spec/plan/feature/fix PRs target `develop`"*) | 2026-08-02T18:17Z, `1c7af24` | Current invocation item `{#19}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/19-settings-hub-profile-about` at `1c7af24`, identical to `origin/develop` | `git rev-parse HEAD origin/develop` | 2026-08-02T18:17Z | Isolated worktree at `.claude/worktrees/item-19` | `Verified` |
| **The secure-store module path, port shape and key convention** | `src/lib/secure-store/{types,expo-secure-store.adapter,credential-store}.ts`; `SecureStorePort { getItem, setItem, deleteItem }`; `credentialsKeyFor(id) === 'bank_creds:' + id` | Item #9's plan on `origin/implementation-plan/9-connect-a-bank` (open PR #57), *Frontend/UI — new files* and Decisions 4-5; corroborated by `docs/project/4-database-model.md` line 151 | 2026-08-02T18:17Z, `1c7af24` | Same-surface open PR **#57** only. It **creates** this seam; this item **consumes** it and adds no competing one | `Verified` — see Resolution R1 for the ordering contingency |
| **Screen data-access pattern (cross-item consistency)** | `getAppDatabase()` from `src/db/runtime.ts` plus repository functions, behind one feature hook per screen. **No TanStack Query**, despite `expo-react-native.md` prescribing it | Item #8's merged plan (which establishes the pattern and queues the `expo-react-native.md` correction); item #12's merged plan Decision 7; the parent orchestrator's binding campaign-wide decision for this run | 2026-08-02T18:17Z, `1c7af24` | Current invocation item `{#19}`; same-surface siblings are #8 (plan merged) and #9 (PR #57), both of which use exactly this pattern | `Verified` |
| **The connection `status` value the credential-key derivation must not filter on** | The derivation reads **every** row of `user_financial_institutions` regardless of `status`, so the `'active'` / `'connected'` disagreement between item #9 and item #8 cannot affect it | Item #9's plan Resolution R2 (records the disagreement and rules `'active'` authoritative); this plan sidesteps it by not filtering | 2026-08-02T18:17Z, `1c7af24` | Same-surface open PR #57 and item #8's merged plan | `Verified` — deliberately insensitive to the open disagreement |
| Shared files this plan edits that a concurrent PR also edits | `packages/shared-utils/src/dates.ts` | `gh pr list --state open`; item #5's PR #44 adds date helpers inside `dates.ts` | 2026-08-02T18:17Z, `1c7af24` | Open PR #44 only | `Verified` — both edits are additive new exports in the same file, re-exported by the existing `export *`; #44 merges before this item is implemented (it is ahead in the queue) |
| Fidelity contract file and target IDs | `scripts/mobile-ui/fidelity-targets.json`; targets `settings`, `settings-account--default`, `settings-account--delete-confirm`, `settings-about` | Item #47's **merged** plan, *Contract file* and *Coverage sets* | 2026-08-02T18:17Z, `1c7af24` | Current invocation item `{#19}`; #47's implementation has not started | `Verified` — with the R3 contingency |

**Resolution R1 — the secure-store seam is item #9's, and this item is second in line.**
Competing evidence: item #9's plan (PR #57, **open**) creates `src/lib/secure-store/**`,
`credentialsKeyFor`, `listConnectionsForCredentialLookup`, `listInstitutions`, `resolveLockedRut`,
the `expo-secure-store` dependency, its ESLint boundary and its companion boundary test, and the
third `feature` Jest project. None of it exists in the codebase at `1c7af24`. Affected plan
statements: Decisions 2, 5 and 17, every Frontend/UI bullet that names a `src/lib/secure-store/`
export, and Implementation Order steps 1-3.
**Resolution: ownership stays with #9; this item consumes and extends, and never recreates.**
Concretely: `wipeLocalData` imports `credentialsKeyFor` and the `SecureStorePort` type rather than
redefining either; the *only* addition this item makes inside `src/lib/secure-store/` is
`deleteAllCredentials(port, keys)` appended to `credential-store.ts`. If item #9 has **not** merged
when this item is implemented, the implementer **stops and returns to the parent orchestrator**
rather than creating the seam — unlike item #9's own R1, this item cannot converge independently,
because it would have to invent `expo-secure-store`'s dependency version, keychain protection
class and boundary lint, all of which #9 has already reasoned about. Decision owner: tech-lead
agent for item #19, under the parent orchestrator's no-human-available delegation.

**Resolution R2 — BR3 ("bank data is never deleted") versus a full local wipe.** Competing
evidence: `docs/project/1-business-domain.md` BR3 says *"Eliminar" does not exist as a concept for
scraped movements*; `docs/project/3-software-architecture.md` line 151 says *"Deletion — 'Eliminar
cuenta' wipes the SQLite file and every `expo-secure-store` key, irreversibly and locally"*.
Affected plan statements: Decision 1 and every wipe test. **Resolution: both are true and they
address different objects.** BR3 governs the lifecycle of a *movement inside a living profile* —
the app offers exclusion, never per-row deletion. The wipe does not delete a movement; it destroys
the profile, which is the store itself. The mechanism keeps them from colliding: the wipe deletes
the **database file**, and no code path in this item issues a `DELETE` against any table. A
follow-up documentation update (see *Documentation Updates*) adds that one-sentence carve-out to
BR3 and corrects the architecture doc's *"Eliminar cuenta"* label, which contradicts BR0's *"there
is no account"* and the mockup's own copy (*"Borrar todos mis datos"*). Decision owner: tech-lead
agent for item #19, under the parent orchestrator's no-human-available delegation.

**Resolution R3 — design fidelity tooling may or may not exist.** Item #47's merged plan requires
screen items to flip their targets from `planned` to `wired` in
`scripts/mobile-ui/fidelity-targets.json` and run `pnpm fidelity --issue 19`. That directory does
not exist at `1c7af24`. **Resolution: the flip is conditional and the runbook carries both paths.**
If `scripts/mobile-ui/fidelity-targets.json` exists at implementation time, Implementation Order
step 9 flips the four targets and the runbook's fidelity step runs `pnpm fidelity --issue 19`; if
it does not, step 9 is skipped with a note in the PR body and the runbook's manual side-by-side
comparison against `design/mockups/mobile/index.html` is the evidence. The manual step is **never
removed** — it is the fallback, and it is also what a human reviewer reads.

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved, and
records `Still valid` or `Stale or conflicting` in the implementation PR:

1. `git log --oneline -1 origin/develop` — confirm items **#9 and #8** have merged. If #9 has not,
   stop (Resolution R1).
2. `ls apps/mobile/src/lib/secure-store/` and
   `grep -nE '^export (async )?(function|const|type)' apps/mobile/src/lib/secure-store/*.ts` —
   confirm `SecureStorePort`, `credentialsKeyFor`, `deleteCredentials` and the Expo adapter exist
   with the recorded shapes.
3. `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/connections.ts apps/mobile/src/db/repositories/institutions.ts`
   — confirm `listConnectionsForCredentialLookup` and `listInstitutions` exist and that
   `listConnectionsForCredentialLookup` does **not** filter by `status` (Decision 2 depends on it
   returning disconnected rows too; if it does filter, add an unfiltered sibling rather than
   changing #9's function).
4. `grep -n 'getAppDatabase' apps/mobile/src/db/runtime.ts` — confirm #8's entry point exists and
   that no query library appeared in `apps/mobile/package.json`.
5. `grep -n "status: 'deferred'" apps/mobile/src/test-utils/mu-class-map.ts` — confirm the classes
   in Decision 12 are still `deferred` and still needed.
6. `grep -n 'projects' -A 20 apps/mobile/jest.config.js` — confirm whether the third `feature`
   project (`src/features/**/*.node.test.ts`) exists; create it with #9's exact contract only if
   absent.
7. `ls scripts/mobile-ui/fidelity-targets.json` — decide the R3 branch.
8. `grep -nE '^export function format' packages/shared-utils/src/dates.ts` — confirm item #5's
   merge did not already add a long month-year formatter under a different name.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to the
parent orchestrator.

---

## Key Decisions

Decision indices are stable within this document and are referenced by the Layer-by-Layer,
Testing Strategy and Implementation Order sections.

### Decision 1 — the wipe is one ordered, fail-closed sequence, and credentials go first

`wipeLocalData` is a single function over injected ports, in
`apps/mobile/src/features/settings/wipe-local-data.ts`. The order is not cosmetic:

```text
wipeLocalData({ db, secureStore, resetStore }):
  1. keys = collectCredentialKeys(db)            // read the key space while the store still exists
  2. await deleteAllCredentials(secureStore, keys)
  3. survivors = for each key: await secureStore.getItem(key) !== null
     if survivors.length > 0  -> return { status: 'credentials_failed' }   // STOP. Do not touch the store.
  4. await resetStore()                          // close handle -> delete file -> clear memo + bootstrap
     on failure -> return { status: 'store_failed' }
  5. return { status: 'ok' }
```

**Why credentials first, and why step 3 is a hard stop.** The database is the *only* enumerable
index of the credential key space (Decision 2). If the file were deleted first and a keychain
delete then failed, the surviving secret would be unreachable by any later attempt — an
un-enumerable orphan credential on the device, which is precisely what non-negotiable 1 forbids.
Failing closed at step 3 leaves the app in a fully consistent pre-wipe state that the user can
retry, at the cost of the retry being visible. That trade is the right way round for the only
irreversible operation in the product.

`WipeResult` is `{ status: 'ok' } | { status: 'credentials_failed' } | { status: 'store_failed' }`
— a closed union with **no message, no key name and no cause payload**. An error string that
interpolated a key would put `bank_creds:banco-de-chile` in a log line; the union carries only
enough to choose one of two catalogue keys for the UI.

### Decision 2 — "every credential key" is a derivation plus a scan test, because a keychain cannot be enumerated

`SecureStorePort` has three methods and, deliberately, **no list-keys method** (item #9,
Decision 4) — because `expo-secure-store` has no such API. AC1 therefore needs a definition of
"every", and it is this union:

```ts
// apps/mobile/src/features/settings/wipe-local-data.ts — Illustrative, adapt during implementation
export function collectCredentialKeys(db: AppDatabase): string[] {
  const fromConnections = listConnectionsForCredentialLookup(db).map((c) => c.credentialsKey);
  const fromCatalogue = listInstitutions(db).map((i) => credentialsKeyFor(i.id));
  return [...new Set([...fromConnections, ...fromCatalogue])];
}
```

Two sources, because each covers the other's blind spot:

- **`user_financial_institutions`** carries the key that was actually written, for every
  connection, including rows whose `status` is `disconnected` (this is why the derivation must not
  filter on status — Assumption Check row 6).
- **`financial_institutions`** is the full seeded catalogue (six banks). It sweeps *orphans*: a key
  whose connection row was already deleted, or that was written by a connect attempt that crashed
  before its transaction committed. `credentialsKeyFor` is deterministic (`'bank_creds:' + id`), so
  the catalogue is a complete generator of the namespace.

The claim this makes — *`bank_creds:<institutionId>` is the only key namespace the app ever
writes* — is exactly the kind of statement that rots. It is therefore held by a test, not by this
paragraph: `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts` scans every `setItem(`
call site under `apps/mobile/src/**` and fails when one passes a key expression that is not a
`credentialsKeyFor(...)` call. A future item that adds a second namespace fails that test and is
forced to extend `collectCredentialKeys` in the same change.

### Decision 3 — the file deletion lands in `src/db/client.ts`, the only `expo-sqlite` importer

`client.ts` is already documented as *"the only `expo-sqlite` import in the repository"*, and the
`dbAccessBoundary` lint rule plus `db-access-boundary.test.ts` enforce it. Deleting the database
file is an `expo-sqlite` call, so it goes there:

- `openAppDatabase()` keeps its current shape and still returns `{ sqlite, db }`.
- `deleteAppDatabaseFile(sqlite): Promise<void>` (new) closes the handle and deletes the named
  database, so `DATABASE_NAME` stays a private constant of that module — no other file learns the
  filename.

`src/db/runtime.ts` (item #8's) gains `resetAppDatabase(): Promise<void>`, which is the **only**
way the memoized handle is invalidated: it clears the memo *before* awaiting the deletion, calls
`deleteAppDatabaseFile`, then calls `resetDatabaseBootstrap()` so the next `getAppDatabase()`
genuinely re-migrates and re-seeds rather than resolving the single-flight promise of a store that
no longer exists. `bootstrap.ts` gains the exported `resetDatabaseBootstrap()`; the existing
`__resetBootstrapForTests()` is kept and delegates to it, so no test changes.

### Decision 4 — after the wipe the app is in the *first-launch* state, not a flagged state

The brief's AC2 (*"After deletion the app returns to `onboarding-intro`"*) is satisfied
structurally, not by writing a flag:

1. The file is gone, so `app_settings` is gone, so `onboarding_completed` is gone.
2. `resetAppDatabase()` cleared the memo and the bootstrap single-flight, so the next
   `getAppDatabase()` opens a **new** file and runs `ensureDatabaseReady` end to end: migrations,
   `schema_version`, one `users` row, a fresh `first_launch_at`, and the seeds.
3. `useLaunchDecision()` (item #8) reads `isOnboardingCompleted(db)` → `false` → `/(onboarding)/intro`.

This is why the wipe test's third assertion is meaningful: after the wipe, every **user-owned**
table is empty and the only rows that exist are the ones bootstrap itself recreates — the seeded
catalogue (`financial_institutions`, `transaction_categories`, `merchants`, `merchant_aliases`,
`seed_ledger`), the single `users` row, and two `app_settings` keys (`schema_version`,
`first_launch_at`). The assertion is therefore stated precisely (Testing Strategy scenario 1):
**zero rows in `user_financial_institutions`, `user_financial_products`, `transactions`,
`user_budgets`, `user_recurring_transactions`, and no `onboarding_completed` key.**

Navigation after `status: 'ok'` is `router.dismissAll()` (drop the settings stack so Back cannot
return to a screen reading a deleted database) followed by
`router.replace('/(onboarding)/intro')`.

### Decision 5 — the account screen's RUT comes from the secure store, through item #9's resolver

`docs/project/4-database-model.md`: *"the RUT is credential material and belongs in
`expo-secure-store`"*. Item #9 already needs the identical read for its `rut-locked` state and
built `resolveLockedRut(db, port): Promise<string | null>` for it (its Decision 6), which walks
`listConnectionsForCredentialLookup` in `created_at` order and returns the first stored RUT.

This screen calls that function and formats with `formatRut`. Two consequences:

- **No second credential-reading code path exists.** Business Rule 6 in #9's spec allows exactly
  one read outside the write path; this reuses it rather than adding another.
- **When no credential entry exists** (no bank connected yet, or every bank disconnected) the row
  renders an em dash and the hub's *Perfil local* subtitle falls back to
  `settings.hub.account_sub_no_bank` (*"Sin bancos conectados"*) instead of a RUT. The mockup draws
  a RUT because its sample device has one connected bank; the screen must not fabricate one
  (Assumption A5).

`formatRut` **throws** on malformed input, so the call is guarded: format only when
`resolveLockedRut` returned a non-null value, and fall back to the raw stored string if
`formatRut` throws (a stored RUT that cannot be formatted is a #9 bug, not a reason to crash the
settings screen).

### Decision 6 — data access follows item #8's pattern: `getAppDatabase()` plus repository functions, behind one feature hook per screen. **No TanStack Query.**

`docs/best-practices/stack/expo-react-native.md` → *Data fetching* still prescribes TanStack Query
over repository functions. **That library is not installed**, item #8 deliberately did not add it,
item #12 followed #8, item #9 follows #8, and the parent orchestrator has made this binding for
every screen item in the campaign. Adopting a second pattern on the fourth screen item would be
the worse outcome even though the doc still describes the first.

Three hooks, one per screen, each awaiting `getAppDatabase()` once and then calling repository
functions synchronously (the Drizzle driver is `BaseSQLiteDatabase<'sync', …>`):

| Hook | File | Returns |
| --- | --- | --- |
| `useSettingsHub()` | `src/features/settings/use-settings-hub.ts` | `{ status: 'pending' } \| { status: 'ready'; rows: SettingsHubRow[] }` |
| `useLocalProfile()` | `src/features/settings/use-local-profile.ts` | `{ status: 'pending' } \| { status: 'ready'; profile: LocalProfile }` |
| `useWipeLocalData()` | `src/features/settings/use-wipe-local-data.ts` | `{ phase, requestDelete, cancelDelete, confirmDelete }` |

Each read hook is cancellation-guarded (`let cancelled = false` in the effect, checked before every
`setState`) and re-reads on focus via `useFocusEffect` bumping a `reloadToken`, exactly as
`useHomeData` does. The pure composition behind each hook lives in a React-free sibling
(`settings-hub.ts`, `local-profile.ts`, `wipe-local-data.ts`, `about.ts`) so it is unit-testable
without a renderer — the split item #8 established with `launch-decision.ts`.

### Decision 7 — `delete-confirm` is a state of the account route, not a route

The manifest declares `delete-confirm` as a `state_id` of `settings-account`, not a `screen_id`.
It is rendered by the existing `Modal` primitive with `visible={phase === 'confirming'}` and
`onRequestClose={cancelDelete}` (that prop is required — Verification Log), inside
`app/settings/account.tsx`. No new route file, so `route-manifest-parity.test.ts` is untouched.

`useWipeLocalData`'s `phase` is a four-value closed union — `'idle' | 'confirming' | 'wiping' |
'failed'` — and it is the single source of the modal's visibility, the confirm button's disabled
state and the failure note. `confirmDelete()` is a no-op unless `phase === 'confirming'`, which is
the re-entrancy guard (Concurrency checklist, item 2).

### Decision 8 — the about screen's three list rows are drawn exactly as the mockup draws them, and are inert

`BEHAVIOR.md` → `settings-about`: *"🟡 Sin telemetría ni links que envíen datos — no hay backend."*
The mockup's own markup agrees: *Política de privacidad*, *Términos de servicio* and *Enviar
feedback* are `<button class="mu-item">` elements with **no `onclick`**, unlike every other
`mu-item` on the hub screen, all five of which carry one (Verification Log).

**Decision**: render all three rows, visually identical to the mockup, **without an `onPress`** and
with `accessibilityState={{ disabled: true }}`. The alternatives were both worse:

- A remote URL is a network request to a server this product does not have, and a privacy-policy
  page hosted anywhere is a request that leaks that the app is installed.
- A `mailto:` for feedback exports whatever the user writes off the device through a third-party
  mail client, which is the shape of thing BR1 and the *"nada sale del dispositivo"* principle
  exist to prevent — and there is no privacy-policy or terms document in this repository to open
  locally either.

Bundling local policy documents is a real product need, but it is a content decision with no
content behind it today. Recorded as a follow-up (see *Follow-ups*), not silently invented here.

### Decision 9 — the version string is read from `expo-constants`, never from the mockup literal

`Constants.expoConfig?.version ?? '0.0.0'`, composed in the pure `about.ts` and rendered through
`settings.about.version` (`"Versión {{version}} (MVP)"`). The mockup's `1.0.0` is sample data of
exactly the same kind as its `18.456.789-0` and its `57` movements. `expo-constants` is already a
dependency; nothing is added.

Consequence to expect at fidelity time: the about screen and the hub's *Acerca de* subtitle will
read `0.0.0` until a release bumps `app.config.js`. That is a two-glyph difference in a short line
and is expected to stay under the default 3 % mismatch threshold; if it does not, the fix is a
`threshold_note` in the fidelity contract, **not** hard-coding the mockup's string (Assumption A6).

### Decision 10 — `formatLongMonthYear` lands in `@finanzas/shared-utils`, beside `formatMonthYear`

The account screen draws *"enero 2025"*: full month name, lower case, Spanish. `formatMonthYear`
renders `ene 2025` and `formatLongDate` renders the full weekday-day-month-year form. Neither
fits, and `AGENTS.md` plus `expo-react-native.md` both put date formatting in
`@finanzas/shared-utils`, not in `apps/mobile`.

`formatLongMonthYear(dateLocal: DateLocal, locale: SupportedLocale): string` goes in the existing
`packages/shared-utils/src/dates.ts` next to `formatMonthYear`, reusing the same cached
`getLabelFormatter` with `{ month: 'long', year: 'numeric' }` and the same UTC-midnight instant
construction, so it inherits the module's hostile-timezone guarantee. `es` renders `enero de 2025`
under `Intl`; the mockup draws `enero 2025` **without** `de`, so the function strips the connector
the same way the module's other formatters normalise their output — the unit test pins both
locales' exact strings (Assumption A7).

### Decision 11 — the wipe never issues a `DELETE`, and this is what keeps BR3 intact

There is no `deleteAllRows`, no `TRUNCATE`, no cascade helper. The store is destroyed as a file.
Besides being the plainest reading of the brief (*"removes the database file"*), it makes
Resolution R2 structural: no code added by this item can be reused to delete a movement, because
no code added by this item deletes a row.

### Decision 12 — three new design-system primitives, because these screens draw blocks nobody owns

`docs/best-practices/stack/mobile-ui-fidelity.md` lines 43-44: *"Compose the shared primitives in
`src/components/ui/` before writing a one-off style. A one-off is a signal the primitive is
missing — add it there and to `#screen=ds-components`."*

| New primitive | `mu-*` classes it takes ownership of | Why here | Later consumers |
| --- | --- | --- | --- |
| `ListGroup` | `mu-list` | `MU_CLASS_MAP` already defers it to *"#19 (Settings hub)"* | #20, #21, #18 |
| `ListRow` | `mu-item`, `mu-item__icon`, `mu-item__title` | Same deferral note | #20, #21, #18 |
| `ScreenTopBar` | `mu-topbar`, `mu-topbar__btn`, `mu-topbar__title`, `mu-topbar__title--left` | Deferred to #12, which does not draw it; retargeted by #12's plan to #8, which **explicitly declined** and composed locally. All three of this item's screens draw one. Leaving it deferred means a fourth screen-local copy | every screen with a topbar |

`ListRow` also becomes an **additional** owner of `mu-item__txt`, `mu-item__sub` and
`mu-item__chev` (the `owners` field is an array; `mu-overlay` already has two owners).

That best-practice line ends *"and to `#screen=ds-components`"*, and
`gallery-catalogue-keys.test.ts` makes the app-side half of that bidirectional (Verification Log).
So all three primitives also get a section in `apps/mobile/src/dev/DesignSystemGallery.tsx` with
its own `ds.*` catalogue keys — a new primitive with no gallery entry is a convention breach, and
a gallery entry whose keys are missing fails the suite. Updating the **mockup's** `ds-components`
page is deliberately **not** in scope: `design/mockups/` is the design contract and
`mu-class-coverage.test.ts` derives its class universe from it, so that edit belongs to the design
owner (recorded as a follow-up).

**Contingency, checked at implementation time**: item #12's plan flips those same three classes to
`primitive` with `owners: ['CategoryRow', 'BankRow']`. If #12 has landed, this item **appends**
`'ListRow'` to the existing arrays; if it has not, this item flips them with `owners: ['ListRow']`
and #12 appends later. Likewise for `mu-topbar*`: if some other item has already promoted them,
consume the existing primitive and record the difference in the PR body. Either way
`mu-class-coverage.test.ts` is the arbiter, not this table.

### Decision 13 — the "no sign-out" acceptance criterion is enforced by a test, not by review

AC4 (*"No sign-out affordance exists anywhere in settings"*) is an absence claim, and absence
claims decay silently. `apps/mobile/src/__tests__/no-sign-out.test.ts` holds it:

- **Catalogue rule**: no value in `src/i18n/es.json` or `en.json` matches
  `/cerrar sesi[oó]n|salir de (la|mi) cuenta|sign\s?out|log\s?out|iniciar sesi[oó]n|crear cuenta/i`.
- **Source rule**: no identifier matching `/\b(signOut|logOut|logout|signIn|logIn)\b/` appears in
  any `.ts`/`.tsx` file under `apps/mobile/app/**` or `apps/mobile/src/**`.

Both rules are scoped repository-wide rather than to settings, because BR0 makes them true
everywhere in the MVP and a narrower scope would let the affordance reappear one screen over. Edge
cases and their unit mapping are enumerated in the *Parser-risk addendum*.

### Decision 14 — this item defines navigation seams, not adjacent screens

| Hub row | Destination route | Owning item | State at plan time |
| --- | --- | --- | --- |
| 👤 Perfil local | `/settings/account` | **#19** | Built here |
| 🏦 Bancos conectados | `/settings/banks` | #20 | `RoutePlaceholder` |
| 🔔 Recordatorios | `/settings/notifications` | #18 | `RoutePlaceholder` |
| 🗂 Categorías | `/settings/categories` | #21 | `RoutePlaceholder` |
| ℹ️ Acerca de | `/settings/about` | **#19** | Built here |

The hub's back button targets `/(tabs)/home` (the mockup's `go('home')`); the two sub-screens'
back buttons target `/settings`.

### Decision 15 — the hub's five subtitles are real data, not decoration

The mockup draws a subtitle under every hub row, and each is a live figure. Rendering static copy
would make the hub the one screen in the app that lies:

| Row | Subtitle source | Fallback when empty |
| --- | --- | --- |
| Perfil local | `resolveLockedRut(db, port)` → `formatRut` (Decision 5) | `settings.hub.account_sub_no_bank` |
| Bancos conectados | `listConnectedBankSummaries(db)` (#9) — connection count and summed product count | `settings.hub.banks_sub_empty` |
| Recordatorios | `readReminderSettings(db)` (#8) + `summarizeReminderDays` (#8, `src/features/reminders/summary.ts`) + `formatWallClockLabel` (#8) | `settings.hub.reminders_sub_disabled` |
| Categorías | `countCategoriesByDirection(db)` (new, Layer-by-Layer) | no fallback needed — the seed guarantees both directions are non-empty |
| Acerca de | `Constants.expoConfig?.version` (Decision 9) | `'0.0.0'` |

Singular/plural uses the explicit `_single` / `_plural` catalogue keys and a `count === 1` check,
the convention item #8 fixed in its Decision 13 — **not** i18next's plural suffixes, which
interact badly with this repository's `keySeparator: false` typed key union.

### Decision 16 — the account screen counts **all** movements, and says so in the doc comment

*"Movimientos guardados"* is a storage fact, not an analysis figure: it counts every row in
`transactions`, including excluded ones. `countTransactions(db)` therefore does **not** import
`isIncluded`, and its doc comment says why in one line. This matters because
`inclusion-rule-scan.ts` rules A/B/C flag any file that restates the inclusion rule *or* mentions
the bare literals `excluded_at` / `included_amount`; a count that neither imports the fragment nor
names the column is trivially compliant, and the doc comment stops a future reader from "fixing"
it into an inconsistency with the dashboard.

### Decision 17 — the wipe takes its dependencies as arguments, so the proof runs in Node

`wipeLocalData({ db, secureStore, resetStore })` has no import of `expo-secure-store`, no import of
`expo-sqlite`, and no module-level singleton. The React wrapper `use-wipe-local-data.ts` is the
only file that assembles the real ports:
`{ db: await getAppDatabase(), secureStore: expoSecureStoreAdapter, resetStore: resetAppDatabase }`.

That is what makes the AC1 test a *proof* rather than a mock ceremony: it runs the real
`wipeLocalData` against a real `better-sqlite3` store seeded with real connections and a
`createMemorySecureStore()` fake whose entire contents can be asserted empty — the enumeration
that the real keychain cannot give us, in the one place where enumeration is what we need to
verify.

---

## Assumptions

Every 🟡-marked statement this plan builds on, per `BEHAVIOR.md`'s own rule (*"Una spec puede
construir sobre él, pero debe listarlo en sus supuestos"*), plus the inferences this plan makes
from the drawing where the behaviour contract is silent. Each is reversible in one named place.

| # | Assumption | Source / derivation | Reversal cost |
| --- | --- | --- | --- |
| A1 | 🟡 *"borrar mis datos"* means SQLite **+** every `expo-secure-store` key **+** settings, is local, requires explicit confirmation, and lands on `onboarding-intro` | `BEHAVIOR.md` → `settings-account` (🟡) — the item's whole premise; also `docs/project/3-software-architecture.md` line 151 | The plan does not survive its reversal; it would be a new item |
| A2 | The wipe's success path shows no confirmation toast — the app simply arrives at `onboarding-intro` | The mockup's `go('onboarding-intro')` draws no interstitial; there is nothing to confirm to on a screen the user can no longer return to | One branch in `use-wipe-local-data.ts` |
| A3 | A **failed** wipe stays on `settings-account` and renders a `Note tone="danger"` with a value-free message; the modal closes | Not drawn — the mockup has no failure state for this screen. A silent failure on the only irreversible operation is unacceptable, and inventing a manifest state is worse than reusing `Note` | One `Note` in `app/settings/account.tsx` |
| A4 | 🟡 The about screen has no telemetry and no data-sending link; its three rows are inert (Decision 8) | `BEHAVIOR.md` → `settings-about` (🟡) + the mockup's missing `onclick` | Three `onPress` handlers |
| A5 | When no credential entry exists, the RUT row renders `—` and the hub subtitle says *"Sin bancos conectados"* | Not drawn — the mockup's device has one connected bank. Fabricating a RUT is not an option | Two catalogue keys and one ternary in `local-profile.ts` |
| A6 | *"Versión 1.0.0 (MVP)"* in the mockup is sample data; the real string is read from `expo-constants` (Decision 9) | Consistent with the mockup's other sample values (RUT, `57` movements, `1 banco · 3 productos`) | One line in `about.ts` |
| A7 | `formatLongMonthYear` renders `enero 2025` (no `de`) in `es` and `January 2025` in `en` | The mockup draws *"enero 2025"*; `Intl`'s `es` long month-year is `enero de 2025`, so the connector is stripped | One line in `dates.ts` and its test |
| A8 | *"Datos almacenados: Solo en este dispositivo"* is static copy, not a computed value | There is no alternative storage location in the product to compute against (BR0) | One catalogue key |
| A9 | *"Este dispositivo"* / the 📱 avatar / the *"Sin cuenta · sin servidor"* badge are decorative and carry no data binding | Drawn as a static card in the mockup; no `BEHAVIOR.md` action or datum is attached | The header block of `app/settings/account.tsx` |
| A10 | The hub renders exactly the five rows the mockup draws, in that order, with no MVP filtering | All five destinations exist as routes; #18/#20/#21 are adjacent items, not deferred features | One array in `settings-hub.ts` |
| A11 | The wipe does not attempt to cancel an in-flight sync before running | No sync can be running: `settings-account` is reachable only from the hub, and #11's syncing screen is modal to its own flow. If #10/#11 later introduce background sync, the wipe needs a cancellation step | Recorded as a follow-up; one `await` in `wipeLocalData` |
| A12 | 🟡 The `Modal` primitive's `h2` title is close enough to the mockup's `mu-h3` modal title for the fidelity threshold | `Modal` renders `Text variant="h2"`; the mockup's `.mu-modal` title is `mu-h3`. Both are drawn from the same tokens | If fidelity fails on it, the fix is in `Modal` (a primitive change with `#screen=ds-components` consequences), **not** a screen-local override |

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration. Every value this item reads already exists; the only write is a file deletion.
Non-negotiable 5 (additive migrations) is not engaged at all.

- [ ] `apps/mobile/src/db/client.ts` — add
      `deleteAppDatabaseFile(sqlite: SQLiteDatabase): Promise<void>`: closes the handle, then
      deletes the database named by the existing private `DATABASE_NAME` constant. The **only**
      place in the repository that may call `expo-sqlite`'s deletion API (Decision 3).
- [ ] `apps/mobile/src/db/runtime.ts` (item #8's; **verify first, extend — never recreate**) —
      memoize the `sqlite` handle alongside `db`, and add
      `resetAppDatabase(): Promise<void>`: clear the memo first, then `deleteAppDatabaseFile`, then
      `resetDatabaseBootstrap()` (Decision 3).
- [ ] `apps/mobile/src/db/bootstrap.ts` — add exported `resetDatabaseBootstrap(): void` clearing
      the module-level single-flight promise; `__resetBootstrapForTests()` is kept and delegates to
      it, so no existing test changes.
- [ ] `apps/mobile/src/db/repositories/transactions.ts` — add `countTransactions(db): number`:
      `count(*)` over `transactions` with **no** `WHERE`, with the Decision 16 doc comment.
- [ ] `apps/mobile/src/db/repositories/categories.ts` — add
      `countCategoriesByDirection(db): { expense: number; income: number }`: one grouped
      `count(*) … group by income`, not two `listCategories(...).length` calls (which would be two
      full table reads plus a JS reduce, exactly what `sqlite-drizzle.md` forbids).
- [ ] `apps/mobile/src/db/repositories/settings.ts` — add
      `readFirstLaunchAt(db): string | undefined`, a typed, defensively-coerced accessor over the
      existing `getSetting(db, 'first_launch_at')`, so no caller handles `unknown`.
- [ ] `apps/mobile/src/db/types.ts` — add `LocalProfile` and `SettingsHubRow` so no screen sees a
      Drizzle row shape or a raw settings value.

### Backend / API

**None.** There is no backend. This is the item that most needs that sentence to stay true.

### Shared Packages / Libraries

- [ ] `packages/shared-utils/src/dates.ts` — add
      `formatLongMonthYear(dateLocal: DateLocal, locale: SupportedLocale): string` (Decision 10),
      beside `formatMonthYear`, reusing `getLabelFormatter` and `civilDateAsUtcMidnightInstant`.
- [ ] `packages/shared-utils/src/dates.test.ts` — pin both locales' exact output and the
      hostile-host-timezone case, matching the file's existing conventions.
- [ ] `@finanzas/shared-domain` is **not** touched: nothing here is a domain rule.

### Frontend / UI — new files

Secure store (an addition to item #9's module, not a new one — Resolution R1):

- [ ] `apps/mobile/src/lib/secure-store/credential-store.ts` — add
      `deleteAllCredentials(port: SecureStorePort, keys: readonly string[]): Promise<void>`,
      awaiting `port.deleteItem` for each key in order and tolerating a missing key. Contains no
      `console.` call and no error message that interpolates a key.

Settings feature:

- [ ] `apps/mobile/src/features/settings/wipe-local-data.ts` — `collectCredentialKeys(db)`,
      the `WipeResult` union, and `wipeLocalData(deps): Promise<WipeResult>` where
      `deps = { db, secureStore, resetStore }` (Decisions 1, 2, 17). No React, no module-level
      singleton, no direct `expo-*` import.
- [ ] `apps/mobile/src/features/settings/use-wipe-local-data.ts` — the React wrapper: assembles the
      real ports, owns the `phase` union (Decision 7), guards re-entrancy, and on `'ok'` calls
      `router.dismissAll()` then `router.replace('/(onboarding)/intro')`.
- [ ] `apps/mobile/src/features/settings/settings-hub.ts` — pure `SETTINGS_HUB_ROWS` descriptors
      (`{ screenId, href, glyph, titleKey }`) and the subtitle key selectors of Decision 15. No
      `t()` call: selectors return catalogue keys and interpolation values.
- [ ] `apps/mobile/src/features/settings/use-settings-hub.ts` — reads the five subtitle sources
      through `getAppDatabase()` and the secure-store port.
- [ ] `apps/mobile/src/features/settings/local-profile.ts` — pure
      `buildLocalProfile({ rut, firstLaunchAt, transactionCount, locale }): LocalProfile`, including
      the guarded `formatRut` call and the `formatLongMonthYear` call (Decisions 5, 10).
- [ ] `apps/mobile/src/features/settings/use-local-profile.ts` — the hook over it.
- [ ] `apps/mobile/src/features/settings/about.ts` — pure `resolveAppVersion(constants)` and the
      three inert `ABOUT_LINK_ROWS` descriptors (Decisions 8, 9).
- [ ] `apps/mobile/src/features/settings/components/ProfileFactRow.tsx` — the screen-local
      label/value row (`mu-row mu-row--between`, both already `utility` in `MU_CLASS_MAP`, so no map
      change). Screen-local, not a `components/ui/` primitive — it is two `Text`s in a flex row with
      no variant surface of its own.

Design-system primitives (Decision 12):

- [ ] `apps/mobile/src/components/ui/ScreenTopBar.tsx` — `{ title, onBack?, align? }`; renders the
      back affordance, the centred (or `align="left"`) title, and the 36 px spacer the mockup draws.
- [ ] `apps/mobile/src/components/ui/ListGroup.tsx` — the rounded, divided container (`mu-list`).
- [ ] `apps/mobile/src/components/ui/ListRow.tsx` — `{ icon, title, subtitle?, onPress?, chevron? }`.
      With no `onPress` it renders a non-pressable row with `accessibilityState={{ disabled: true }}`
      (Decision 8).
- [ ] `apps/mobile/src/components/ui/index.ts` — export all three plus their prop types, in
      alphabetical position, matching the barrel's existing convention.

### Frontend / UI — modified files

- [ ] `apps/mobile/app/settings/index.tsx` — replaces `RoutePlaceholder`: `ScreenTopBar` +
      `ListGroup` of five `ListRow`s from `useSettingsHub()`. Carries
      `testID="fidelity-settings"`.
- [ ] `apps/mobile/app/settings/account.tsx` — replaces `RoutePlaceholder`: `ScreenTopBar`, the
      decorative device card, the four `ProfileFactRow`s, the `Note tone="ok"`, the
      `Button variant="dangerSoft"`, the `Modal` for `delete-confirm`, and the A3 failure `Note`.
      Carries `testID="fidelity-settings-account"`.
- [ ] `apps/mobile/app/settings/about.tsx` — replaces `RoutePlaceholder`: `ScreenTopBar`, the brand
      block with the version line, the `Note tone="ok"` privacy paragraph, and the `ListGroup` of
      three inert `ListRow`s. Carries `testID="fidelity-settings-about"`.
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — add one section per new primitive
      (`ScreenTopBar`, `ListGroup` + `ListRow`) with sample data, plus their `ds.*` catalogue keys
      in both catalogues (Decision 12). `__DEV__`-only; never ships.
- [ ] `apps/mobile/src/test-utils/mu-class-map.ts` — flip the classes of Decision 12, honouring the
      contingency.
- [ ] `apps/mobile/src/theme.ts` — add a `settings` group to item #8's `screenMetrics` export, and
      `listRow` / `screenTopBar` groups to `componentMetrics`. `theme` itself is untouched, so
      `theme-tokens-parity.test.ts` still passes.
- [ ] `apps/mobile/src/i18n/es.json` and `en.json` — the `settings.*` keys (Seed Data section).
      Spanish copy comes verbatim from the mockup.
- [ ] `apps/mobile/jest.config.js` — **only if item #9 has not already added it**: the third
      `feature` project (`testEnvironment: 'node'`, `testMatch:
      ['<rootDir>/src/features/**/*.node.test.ts']`), with item #9's exact contract, and
      `src/features/**/*.node.test.ts` added to the `app` project's
      `testPathIgnorePatterns` (Resolution R1, re-verification step 6).

### Infrastructure / Configuration

- [ ] `scripts/mobile-ui/fidelity-targets.json` — **R3-contingent**: flip this item's four targets
      from `planned` to `wired`, each gaining `app_file`, `deep_link` and `ready_test_id`:

      | `screen_id` | `state_id` | `app_file` | `deep_link` | `ready_test_id` |
      | --- | --- | --- | --- | --- |
      | `settings` | `null` | `apps/mobile/app/settings/index.tsx` | `finanzas:///settings?fidelity=1&fidelityScreen=settings` | `fidelity-settings` |
      | `settings-account` | `default` | `apps/mobile/app/settings/account.tsx` | `finanzas:///settings/account?fidelity=1&fidelityScreen=settings-account&fidelityState=default` | `fidelity-settings-account` |
      | `settings-account` | `delete-confirm` | `apps/mobile/app/settings/account.tsx` | `finanzas:///settings/account?fidelity=1&fidelityScreen=settings-account&fidelityState=delete-confirm` | `fidelity-settings-account` |
      | `settings-about` | `null` | `apps/mobile/app/settings/about.tsx` | `finanzas:///settings/about?fidelity=1&fidelityScreen=settings-about` | `fidelity-settings-about` |

- [ ] `apps/mobile/app.config.js` — **no change**. Bumping `version` to `1.0.0` is a release
      decision (Decision 9), not this item's.
- [ ] **No new dependency.** `expo-constants` is installed; `expo-secure-store` arrives with #9.
- [ ] `apps/mobile/eslint.config.mjs` — no change. The `expo-secure-store` boundary is #9's, and
      this item stays inside it.

---

## Testing Strategy

**Test types**: unit (Node tier and RN tier), integration against an in-memory SQLite store plus an
in-memory secure-store fake, source-scan guards, and smoke on a dev build.

### Scenario map

| # | Scenario | Maps to | Test file | Jest project |
| --- | --- | --- | --- | --- |
| 1 | **The wipe proof.** Seed a store with two connections (one `active`, one `disconnected`), products, transactions, categories, an `onboarding_completed` key, and a memory secure store holding both connections' keys **plus one orphan** (`bank_creds:santander`, no connection row). Run `wipeLocalData`. Assert: (a) the fake secure store is **completely empty**, (b) `resetStore` was called **after** the credential deletes, (c) re-bootstrapping the store yields zero rows in `user_financial_institutions`, `user_financial_products`, `transactions`, `user_budgets`, `user_recurring_transactions` and no `onboarding_completed` key, (d) the result is `{ status: 'ok' }` | brief AC1, AC2; Decisions 1, 2, 4 | `apps/mobile/src/features/settings/wipe-local-data.node.test.ts` | `feature` |
| 2 | **Fail-closed.** A secure store whose `deleteItem` silently no-ops for one key. Assert the result is `{ status: 'credentials_failed' }`, `resetStore` was **never called**, and the database still has all its rows | Decision 1 | same file | `feature` |
| 3 | **Store failure.** Credentials delete cleanly, `resetStore` rejects. Assert `{ status: 'store_failed' }` and that the rejection does not escape as an unhandled rejection | Decision 1; concurrency checklist item 7 | same file | `feature` |
| 4 | **Key-space derivation.** `collectCredentialKeys` returns the union of connection keys and catalogue-derived keys, de-duplicated, including `disconnected` connections | AC1; Decision 2 | same file | `feature` |
| 5 | **No credential value is ever named.** Every `WipeResult` variant and every catalogue value this item adds is scanned for a RUT-shaped or key-shaped string, reusing `secrets.test.ts`'s pattern | BR1, non-negotiable 1 | same file | `feature` |
| 6 | **Re-entrancy.** `confirmDelete()` called twice in a row runs `wipeLocalData` exactly once; `confirmDelete()` in phase `'idle'` is a no-op | Decision 7; concurrency checklist item 2 | `apps/mobile/src/features/settings/__tests__/use-wipe-local-data.test.tsx` | `app` |
| 7 | **Hub rows and subtitles.** `SETTINGS_HUB_ROWS` has the five mockup rows in order with the five manifest routes; each subtitle selector returns the right key and interpolation for populated, empty and singular inputs | AC5; Decision 15; A10 | `apps/mobile/src/features/settings/__tests__/settings-hub.test.ts` | `app` |
| 8 | **Local profile composition.** `buildLocalProfile` formats a valid RUT, falls back to the raw string when `formatRut` throws, renders `—` when the RUT is `null`, and renders `enero 2025` from a January `first_launch_at` | AC-adjacent; Decisions 5, 10; A5 | `apps/mobile/src/features/settings/__tests__/local-profile.test.ts` | `app` |
| 9 | **About composition.** `resolveAppVersion` reads `expoConfig.version`, falls back to `'0.0.0'` when absent; the three link rows carry no `href` and no handler | AC-adjacent; Decisions 8, 9; A4 | `apps/mobile/src/features/settings/__tests__/about.test.ts` | `app` |
| 10 | **No sign-out affordance.** Catalogue rule and source rule of Decision 13, with the edge cases enumerated below | **brief AC4** | `apps/mobile/src/__tests__/no-sign-out.test.ts` | `app` |
| 11 | **Credential key namespace is closed.** Every `setItem(` call site under `apps/mobile/src/**` passes a `credentialsKeyFor(...)` key | AC1 residual verification; Decision 2 | `apps/mobile/src/__tests__/secure-store-key-namespace.test.ts` | `app` |
| 12 | **Repository counts.** `countTransactions` counts excluded rows too; `countCategoriesByDirection` matches `listCategories(...).length` per direction on the seeded store | Decisions 15, 16 | added to the existing `apps/mobile/src/db/__tests__/transactions.test.ts` and `categories.test.ts` | `db` |
| 13 | **`readFirstLaunchAt`** returns the bootstrap-written value and `undefined` on a store where the key was removed | Decision 15 | `apps/mobile/src/db/__tests__/settings-profile.test.ts` | `db` |
| 14 | **`resetDatabaseBootstrap`** makes the next `ensureDatabaseReady` re-run rather than resolving the stale single-flight promise | Decision 3 | added to `apps/mobile/src/db/__tests__/bootstrap.test.ts` | `db` |
| 15 | **`formatLongMonthYear`** renders `enero 2025` / `January 2025` and is stable under a hostile host timezone | Decision 10; A7 | `packages/shared-utils/src/dates.test.ts` | shared-utils |
| 16 | **Routes render every manifest state.** `settings-account` renders the modal when the phase is `'confirming'` and not otherwise; the three routes no longer render `RoutePlaceholder` | non-negotiable 6 | `apps/mobile/app/settings/__tests__/{index,account,about}.test.tsx` | `app` |
| 17 | **`mu-*` coverage stays exhaustive** after the Decision 12 flips | AC-adjacent; Decision 12 | existing `apps/mobile/src/__tests__/mu-class-coverage.test.ts` (no edit; must stay green) | `app` |
| 18 | **Gallery coverage stays bidirectional** — every new `ds.*` key is used by the gallery and every gallery key exists in `es.json` | Decision 12 | existing `apps/mobile/src/__tests__/gallery-catalogue-keys.test.ts` (no edit; must stay green) | `app` |

RN-tier component tests follow item #2's renderer-free convention: call the component function and
walk the returned element tree.

### Parser-risk addendum

**Classification: applicable.** Two of this item's guards are regex scanners over source text and
JSON (`no-sign-out.test.ts`, `secure-store-key-namespace.test.ts`). They are not under
`scripts/lint/`, but they are rule engines over source text and they are the mechanical evidence
for an acceptance criterion, so they get the full treatment. Item #9's `secure-store-boundary.test.ts`
set the precedent in this repository.

**Edge-case enumeration — the no-sign-out scanner** (scenario 10; every row is one `it` case in
`no-sign-out.test.ts`):

| # | Input | Expected |
| --- | --- | --- |
| N1 | `"settings.account.sign_out": "Cerrar sesión"` in `es.json` | flagged |
| N2 | `"…": "Cerrar sesion"` (no accent) | flagged — the pattern accepts `[oó]` |
| N3 | `"…": "CERRAR SESIÓN"` | flagged — case-insensitive |
| N4 | `"…": "Sign out"` / `"Signout"` / `"Log out"` in `en.json` | flagged — `\s?` between the words |
| N5 | `"…": "Salir de la cuenta"` and `"Salir de mi cuenta"` | flagged |
| N6 | `"…": "Salir de la app"` | **not** flagged — leaving the app is not ending a session |
| N7 | `"…": "Cierra la sesión de tu banco en el navegador"` | flagged — a false positive this item accepts: the MVP has no such copy, and a future item that needs it must justify the allowlist entry in review |
| N8 | `function signOut()` in a `.ts` file | flagged |
| N9 | `const designedOutcome = …` | **not** flagged — `\b` word boundaries, so `signOut` must be a whole identifier |
| N10 | `// there is no sign-out in this product (BR0)` in a comment | **not** flagged — the source rule matches identifiers (`signOut`, `logOut`, `logout`, `signIn`, `logIn`), not hyphenated prose |
| N11 | Two matches on one line (`signOut(); logOut();`) | flagged once per file, and the failure message lists **both** matches, not just the first |
| N12 | An empty file walk (bad glob) | the suite fails — a `expect(files.length).toBeGreaterThan(0)` assertion, mirroring `db-access-boundary.test.ts` |

**Edge-case enumeration — the credential-key-namespace scanner** (scenario 11, in
`secure-store-key-namespace.test.ts`):

| # | Input | Expected |
| --- | --- | --- |
| K1 | `port.setItem(credentialsKeyFor(id), value)` | allowed |
| K2 | `await secureStore.setItem(credentialsKeyFor(institutionId), payload)` | allowed — the receiver name is irrelevant |
| K3 | `port.setItem('bank_creds:' + id, value)` | flagged — a hand-built key bypasses the generator even though it produces the same string |
| K4 | `port.setItem(someKey, value)` | flagged — an opaque variable cannot be shown to be in the namespace |
| K5 | `setItem(key, value)` inside `credential-store.ts` itself | allowed — that file is the single allowlisted definition site |
| K6 | `localStorage.setItem(…)` / `map.setItem(…)` in unrelated code | flagged, deliberately: this repository has no other `setItem` API, and a new one must be added to the allowlist explicitly rather than being pattern-matched away |
| K7 | `port.setItem(\n  credentialsKeyFor(id),\n  value,\n)` across three lines | allowed — the scanner reads the file, not line by line |
| K8 | Empty file walk | the suite fails, as in N12 |

**Suppression semantics.** Neither scanner recognises an inline directive. Suppression is an
explicit, reviewable **allowlist constant** at the top of each test file
(`ALLOWLISTED_FILES: readonly string[]`), holding repository-relative paths and nothing else — no
globs, no regexes, no per-line escapes. Rationale: an inline `// eslint-disable`-style escape on a
credential guard is invisible in a diff of a different file; an allowlist entry shows up in the
diff of the guard itself and forces the reviewer to see it. Multiple entries are independent; there
is no ordering or precedence to reason about. Each scanner ships with one seeded entry
(`src/lib/secure-store/credential-store.ts` for K5) and the tests assert that an unknown path in
the allowlist fails the suite, so the list cannot rot into a list of files that no longer exist.

### Concurrent-event-source addendum

**Classification: applicable.** The wipe is a teardown sequence that races incoming events: three
feature hooks re-read on focus while the wipe invalidates the memoized handle they are holding, and
a double tap can dispatch two wipes.

| Checklist item | Design decision |
| --- | --- |
| **Shared mutable state guards** | Two pieces of shared mutable state: the memoized handle in `src/db/runtime.ts` and the single-flight promise in `bootstrap.ts`. Both are written only by `resetAppDatabase()`, which clears the memo **before** awaiting the file deletion, so any caller arriving mid-wipe starts a fresh bootstrap against a store that is about to exist, rather than receiving a handle to a deleted file. `wipeLocalData` itself holds no state: every value it needs is an argument (Decision 17) |
| **Re-entrancy / in-flight tracking** | `useWipeLocalData`'s `phase` union is the in-flight flag. `confirmDelete()` returns immediately unless `phase === 'confirming'`, and sets `'wiping'` synchronously before the first `await`. Scenario 6 pins it |
| **Event deduplication** | The only duplicable event is the confirm tap, handled by the phase guard. There is no reconnect, no subscription and no retry loop in this item |
| **Listener and resource cleanup** | The three read hooks are cancellation-guarded (`cancelled` flag checked before every `setState`) and their `useFocusEffect` subscriptions are removed by Expo Router on unmount. `deleteAppDatabaseFile` closes the SQLite handle before deleting, so no native handle leaks |
| **Race conditions at initialization** | A focus re-read can begin before the wipe finishes. It awaits `getAppDatabase()`, which either resolves the pre-wipe handle (harmless — the read completes against a file that is deleted a moment later, and the component unmounts on navigation) or triggers a fresh bootstrap. Neither path can observe a half-deleted store, because deletion is a single file operation, not a sequence of table drops |
| **Race conditions at teardown** | After `router.replace`, the settings screens unmount; any in-flight read resolves into a cancelled effect and is discarded. The `cancelled` guard is what makes this safe rather than a "setState on unmounted component" warning |
| **Error propagation across async boundaries** | `wipeLocalData` never throws: both failure modes are values in the `WipeResult` union, so a rejection cannot escape into an unhandled-rejection handler (scenario 3 asserts it). `use-wipe-local-data.ts` maps the two failure statuses to `phase: 'failed'` and a catalogue key; nothing is swallowed and nothing is logged |

**New concurrent pattern**: none. This item introduces no new concurrency machinery — it reuses
the cancellation-guard convention from item #8 and the single-flight promise from item #3.

---

## Seed Data

| What | Where | Used by |
| --- | --- | --- |
| **No new shipped seed data.** The wipe reads the six institutions item #3 already seeds; `pnpm --filter @finanzas/mobile db:seed` must produce **no diff** to `apps/mobile/src/db/__fixtures__/store-v1.sql` | `apps/mobile/src/db/seeds/catalogue.ts` (unchanged) | scenarios 1-4 |
| Test store for the wipe: the bootstrapped in-memory store from `src/db/testing/memory-db.ts`, plus two `user_financial_institutions` rows (one `active`, one `disconnected`) built with the existing `src/db/testing/product-fixture.ts` helper, plus a handful of transactions | `apps/mobile/src/features/settings/wipe-local-data.node.test.ts` (test-local, not committed fixture data) | scenarios 1-5 |
| In-memory secure-store fake: `createMemorySecureStore(): SecureStorePort & { entries(): Record<string, string> }`, seeded with `bank_creds:banco-de-chile`, `bank_creds:falabella` (the disconnected one) and the orphan `bank_creds:santander` | `apps/mobile/src/lib/secure-store/testing/memory-secure-store.ts` — **new**, unless item #9 already shipped an equivalent, in which case reuse it | scenarios 1-5 |
| Sentinel values: the fixture RUT `11.111.111-1` and the password `ZZWIPEFIXTUREZZ`, chosen so scenario 5's leak scan fails loudly if either reaches a result value or a catalogue string | same test file | scenario 5 |
| On-device data for the runbook: the committed `apps/mobile/src/db/__fixtures__/store-v1.sql`, loaded through item #12's `__DEV__` sample-data panel if it has landed; otherwise a real Banco de Chile connection | `docs/testing/mobile/19-settings-hub-profile-about.smoke-test.md` | smoke steps 2-6 |

### Catalogue keys (`apps/mobile/src/i18n/es.json` + `en.json`)

Spanish copy is verbatim from the mockup. Keys are flat, lowercase, snake_case and dotted, per
`catalogue-parity.test.ts`.

| Key | `es` |
| --- | --- |
| `settings.title` | `Configuración` |
| `settings.hub.account_title` | `Perfil local` |
| `settings.hub.account_sub_no_bank` | `Sin bancos conectados` |
| `settings.hub.banks_title` | `Bancos conectados` |
| `settings.hub.banks_sub_single` / `_plural` | `{{banks}} banco · {{products}} productos` / `{{banks}} bancos · {{products}} productos` |
| `settings.hub.banks_sub_empty` | `Sin bancos conectados` |
| `settings.hub.reminders_title` | `Recordatorios` |
| `settings.hub.reminders_sub` | `{{time}} · {{days}}` |
| `settings.hub.reminders_sub_disabled` | `Desactivados` |
| `settings.hub.categories_title` | `Categorías` |
| `settings.hub.categories_sub` | `{{expense}} de gastos · {{income}} de ingresos` |
| `settings.hub.about_title` | `Acerca de` |
| `settings.hub.about_sub` | `Versión {{version}}` |
| `settings.account.title` | `Perfil local` |
| `settings.account.device_title` | `Este dispositivo` |
| `settings.account.device_badge` | `Sin cuenta · sin servidor` |
| `settings.account.rut_label` | `RUT` |
| `settings.account.rut_empty` | `—` |
| `settings.account.since_label` | `Usando la app desde` |
| `settings.account.storage_label` | `Datos almacenados` |
| `settings.account.storage_value` | `Solo en este dispositivo` |
| `settings.account.movements_label` | `Movimientos guardados` |
| `settings.account.privacy_note` | `No hay cuenta que crear ni sesión que iniciar. Tus movimientos y credenciales viven cifrados en este teléfono; si borras la app, se borran contigo.` |
| `settings.account.delete_cta` | `Borrar todos mis datos` |
| `settings.account.delete_modal_title` | `Borrar todos mis datos` |
| `settings.account.delete_modal_body` | `¿Estás seguro? Esta acción es permanente y no se puede deshacer: se borran tus movimientos, categorías y las credenciales de tus bancos de este dispositivo.` |
| `settings.account.delete_modal_no_backup` | `No tenemos copia en ningún servidor.` |
| `settings.account.delete_modal_cancel` | `Cancelar` |
| `settings.account.delete_modal_confirm` | `Borrar todo` |
| `settings.account.delete_failed` | `No pudimos borrar todos tus datos. No se borró nada; inténtalo de nuevo.` |
| `settings.about.title` | `Acerca de` |
| `settings.about.app_name` | `Finanzas` |
| `settings.about.version` | `Versión {{version}} (MVP)` |
| `settings.about.privacy_title` | `Privacidad por diseño.` |
| `settings.about.privacy_body` | `Tus credenciales bancarias y tus movimientos se guardan cifrados solo en este teléfono. No tenemos servidores con tus datos financieros.` |
| `settings.about.privacy_policy` | `Política de privacidad` |
| `settings.about.terms` | `Términos de servicio` |
| `settings.about.feedback` | `Enviar feedback` |

Emoji glyphs (👤 🏦 🔔 🗂 ℹ️ 📱 🔒 💰 ❌ 📄 📑 💬) are catalogue values too, following the
`ds.*` convention already in `es.json` (`ds.note.ok_icon`, `ds.modal.icon`), so they are never JSX
literals.

---

## Documentation Updates

The developer updates these **after** implementation; they are not edited during Plan Ready.

- [ ] `docs/project/1-business-domain.md` — BR3 gains a one-sentence carve-out: per-movement
      deletion does not exist, and the full local wipe destroys the profile rather than a record
      (Resolution R2).
- [ ] `docs/project/3-software-architecture.md` — the *Deletion* row currently reads *"'Eliminar
      cuenta' wipes the SQLite file…"*, which contradicts BR0. Rename it to the mockup's *"Borrar
      todos mis datos"* and record the ordered sequence and the fail-closed rule (Decision 1).
- [ ] `docs/project/4-database-model.md` — record that the store is destroyed as a **file**, that
      `first_launch_at` is a user-visible value, and that the credential key space is derived from
      `user_financial_institutions` ∪ `financial_institutions` (Decision 2).
- [ ] `docs/best-practices/stack/expo-react-native.md` — add the wipe/reset contract
      (`resetAppDatabase()` is the only way to invalidate the memoized handle) to the secure-store
      section item #9 introduces. This file also still prescribes TanStack Query; item #8 owns that
      correction — do **not** duplicate it here.
- [ ] `docs/best-practices/stack/design-tokens.md` — document the new `screenMetrics.settings`,
      `componentMetrics.listRow` and `componentMetrics.screenTopBar` groups.
- [ ] `AGENTS.md` — add one Troubleshooting row: *"Settings still shows data after 'Borrar todos
      mis datos'"* → the memoized handle was not reset; `resetAppDatabase()` is the only sanctioned
      invalidation path.
- [ ] `design/mockups/mobile/BEHAVIOR.md` — **no edit.** The 🟡 marks on `settings-account` and
      `settings-about` are LH's to promote; this plan lists them as assumptions A1 and A4, which is
      what that document asks a spec to do.
- [ ] `docs/testing/README.md` — no edit; it does not index individual runbooks.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Item #9 has not merged when this item is implemented | Med | High | Resolution R1: the implementer stops and returns to the parent orchestrator rather than inventing the secure-store seam. Re-verification step 1 is the check |
| A credential key namespace is added later and the wipe silently misses it | Low | **Critical** | Scenario 11's scanner fails the build; a new namespace forces an edit to `collectCredentialKeys` in the same change (Decision 2) |
| The wipe half-succeeds on a real device (keychain delete refused while locked) | Low | High | Decision 1's fail-closed step 3 verifies each key reads back `null` **before** the store is touched, and the failure leaves a consistent, retryable state. Runbook step 7 exercises it |
| `resetAppDatabase()` leaves a stale handle and the next screen reads a deleted file | Med | High | The memo is cleared **before** the await, `resetDatabaseBootstrap()` clears the single-flight, and scenario 14 pins the bootstrap half |
| Three runtime APIs are **unverified** because their packages are absent from the current `node_modules` tree: `expo-sqlite`'s database-deletion / handle-close call, `expo-router`'s `router.dismissAll()`, `expo-constants`' `Constants.expoConfig?.version` | Med | Low | Flagged as *unverified — the implementer must confirm before proceeding* in the Verification Log. The plan names the **responsibility and the owning file**, not the call signature: Implementation Order step 2 reads the installed `expo-sqlite` typings first, step 8 reads `expo-router` and `expo-constants`. The `expo-sqlite` import stays inside `client.ts` whatever the call turns out to be, and if `dismissAll()` is unavailable the fallback is `router.replace` alone plus a `(onboarding)` layout that disables the back gesture |
| `mu-topbar*` gets promoted by a sibling item first, causing a merge conflict in `MU_CLASS_MAP` | Med | Low | Decision 12's contingency: consume the existing primitive, record the difference in the PR body, let `mu-class-coverage.test.ts` arbitrate |
| The three inert about rows read as broken UI in review | Med | Low | Decision 8 records the two rejected alternatives and the follow-up item, so the reviewer rules with the same evidence rather than re-deriving it |
| Item #47 lands mid-flight and the fidelity contract validation fails on unflipped targets | Low | Med | Resolution R3 makes the flip conditional and checked at implementation start (re-verification step 7) |

---

## Follow-ups (explicitly out of scope)

1. **Local privacy-policy and terms content** for the two inert about rows (Decision 8) — a content
   item, not an engineering one; the rows become pressable when there is a bundled document to open.
2. **A local feedback path** that does not export data off-device (Decision 8).
3. **Sync cancellation before a wipe** (Assumption A11), if #10 or #11 later introduce background
   sync.
4. **Converging `ConnectedBanksSummary` (#8) and `ConnectedBankSummary` (#9)** — already recorded as
   a follow-up by item #9; this item consumes whichever exists and does not converge them.
5. **`Modal`'s title variant versus the mockup's `mu-h3`** (Assumption A12) — a design-system
   question with `#screen=ds-components` consequences.
6. **Adding `ScreenTopBar`, `ListGroup` and `ListRow` to the mockup's `#screen=ds-components`
   page** (Decision 12) — a design-contract edit for the design owner; this item adds them to the
   app-side `__DEV__` gallery only.

---

## Implementation Order

Each step ends in a state where `pnpm lint && pnpm typecheck && pnpm test` passes.

0. **Implementation-start re-verification.** Run the eight checks in the *Cross-Cutting Operational
   Assumption Check*, record `Still valid` / `Stale or conflicting` in the PR body, and stop if
   item #9 has not merged (Resolution R1).
   *Verification*: the recorded table appears in the PR description.

1. **Shared formatter.** Add `formatLongMonthYear` to `packages/shared-utils/src/dates.ts` with its
   tests (Decision 10).
   *Verification*: `pnpm --filter @finanzas/shared-utils test` — the new cases pass and every
   pre-existing date test is untouched.

2. **Database and runtime teardown.** Add `deleteAppDatabaseFile` to `src/db/client.ts` (reading
   the installed `expo-sqlite` typings first), `resetDatabaseBootstrap` to `src/db/bootstrap.ts`,
   and `resetAppDatabase` to `src/db/runtime.ts` (Decision 3).
   *Verification*: `pnpm --filter @finanzas/mobile test` — the `db` project passes, including the
   new bootstrap-reset case; `apps/mobile/src/db/__tests__/db-access-boundary.test.ts` still finds
   no `expo-sqlite` import outside `src/db/`.

3. **Repository reads.** Add `countTransactions`, `countCategoriesByDirection` and
   `readFirstLaunchAt`, plus the `LocalProfile` / `SettingsHubRow` types (Decisions 15, 16).
   *Verification*: the `db` project's new cases pass; confirm the
   `inclusion-rule-single-definition` test is still green — a count that neither imports the
   fragments nor names the columns must not trip it.

4. **Secure-store extension.** Append `deleteAllCredentials` to
   `src/lib/secure-store/credential-store.ts`, and add
   `src/lib/secure-store/testing/memory-secure-store.ts` if item #9 did not ship an equivalent.
   *Verification*: item #9's `secure-store-boundary.test.ts` still passes — the new function must
   not introduce a second `expo-secure-store` importer.

5. **The wipe, and its proof.** Write `src/features/settings/wipe-local-data.ts` and
   `wipe-local-data.node.test.ts` (scenarios 1-5), adding the third `feature` Jest project only if
   absent (Decisions 1, 2, 17).
   *Verification*: `pnpm --filter @finanzas/mobile test` — read the output and confirm all three
   Jest projects ran and that scenario 1 asserts an **empty** secure store, not merely a called
   `deleteItem` spy.

6. **The two guards.** Write `src/__tests__/no-sign-out.test.ts` and
   `src/__tests__/secure-store-key-namespace.test.ts` with every N- and K-case from the parser-risk
   addendum (Decisions 2, 13).
   *Verification*: temporarily add `const signOut = () => {};` to a scratch file under `src/` and
   confirm the guard fails; temporarily add `port.setItem('bank_creds:x', 'v')` and confirm the
   second guard fails. Revert both, and confirm both suites report a non-zero scanned-file count.

7. **Design-system primitives.** Add `ScreenTopBar`, `ListGroup` and `ListRow`, export them from the
   barrel, add their `componentMetrics` groups, add their gallery sections and `ds.*` catalogue
   keys, and flip the `MU_CLASS_MAP` entries honouring Decision 12's contingency.
   *Verification*: `pnpm --filter @finanzas/mobile test` — `mu-class-coverage.test.ts` and
   `gallery-catalogue-keys.test.ts` pass; paste the per-status breakdown into the PR body. Also
   confirm `touch-targets.test.ts` and `no-style-literals.test.ts` still pass for the three new
   components.

8. **The three screens.** Add the catalogue keys to `es.json` and `en.json`, add
   `screenMetrics.settings`, write the feature hooks and their pure siblings, and replace the three
   `RoutePlaceholder` routes (Decisions 5-9, 14, 15). Confirm `router.dismissAll()` and
   `Constants.expoConfig?.version` against the installed `expo-router` and `expo-constants`
   packages before using them — both are flagged **unverified** in the Verification Log.
   *Verification*: `pnpm lint` (the `no-literal-string` rule must report nothing),
   `pnpm --filter @finanzas/mobile test` — `catalogue-parity`, `route-manifest-parity`,
   `no-naked-text` and the three new route tests pass. Then run the app and walk
   hub → account → about → back.

9. **Fidelity targets (R3-contingent).** If `scripts/mobile-ui/fidelity-targets.json` exists, flip
   the four targets to `wired` with the `app_file` / `deep_link` / `ready_test_id` values in
   *Infrastructure / Configuration*; otherwise skip and say so in the PR body.
   *Verification*: `pnpm fidelity:contract` — read the output and confirm the wired count rose by
   four and the validator accepts every deep link. If skipped, the runbook's manual comparison is
   the evidence instead.

10. **Documentation.** Make the edits listed in *Documentation Updates*.
    *Verification*: `npx markdownlint-cli2` over the changed files.

11. **CHANGELOG.** Add exactly this entry under `[Unreleased] → ### Added`:

    ```markdown
    - **Settings: hub, local profile and about** (#19): the settings hub, the local-profile screen
      and the about screen, plus the product's only destructive operation — a full local wipe of
      the SQLite store and every `expo-secure-store` credential key, behind an explicit
      confirmation, returning the app to onboarding.
    ```

12. **Smoke test.** Execute
    [`docs/testing/mobile/19-settings-hub-profile-about.smoke-test.md`](../../../testing/mobile/19-settings-hub-profile-about.smoke-test.md)
    on a dev build and record the result in the PR.

---

## Document Quality Gate

- **Spec/brief coverage**: Checked — the brief's five acceptance criteria map as follows. AC1
  (deletion removes the database file and every credential key, verified by test) → Decisions 1-3,
  scenarios 1-4, Implementation Order step 5. AC2 (returns to `onboarding-intro`) → Decision 4,
  scenario 1(c), runbook step 6. AC3 (confirmation modal stating there is no backup) → Decision 7,
  the `settings.account.delete_modal_no_backup` key, scenario 16, runbook step 5. AC4 (no sign-out
  affordance anywhere) → Decision 13, scenario 10, runbook step 8. AC5 (side-by-side mockup
  comparison) → Resolution R3, Implementation Order step 9, runbook step 9.
- **Implementation-order consistency**: Checked — every file named in Layer-by-Layer appears in
  exactly one Implementation Order step, and every helper name
  (`wipeLocalData`, `collectCredentialKeys`, `deleteAllCredentials`, `resetAppDatabase`,
  `deleteAppDatabaseFile`, `resetDatabaseBootstrap`, `countTransactions`,
  `countCategoriesByDirection`, `readFirstLaunchAt`, `formatLongMonthYear`, `ScreenTopBar`,
  `ListGroup`, `ListRow`), route path (`/settings`, `/settings/account`, `/settings/about`),
  `testID`, Decision index (1-17), Assumption label (A1-A12) and scenario number (1-18) is spelled
  identically in every section.
- **Verification support**: Checked — every claim about existing behaviour cites a Verification Log
  row with a command and a result; every cross-item interface claim cites the owning item's plan
  document by path or by `git show` revision.
- **Technical accuracy**: Checked — every primitive prop, variant string, best-practice quote and
  guard behaviour this plan names was read from the actual source file and recorded in the
  Verification Log. The three runtime APIs whose packages are absent from the current
  `node_modules` tree (`expo-sqlite` deletion, `router.dismissAll()`,
  `Constants.expoConfig?.version`) are explicitly flagged **unverified — the implementer must
  confirm before proceeding**, with the owning Implementation Order step and a fallback named.
- **Behavioural guarantees**: Checked — "no credential entry survives" names its mechanism (the
  step-3 read-back plus the namespace scanner), "returns to onboarding" names its mechanism (the
  file is gone, so the flag is gone), fail-closed names its mechanism (step 3 stops before
  `resetStore`), and "runs at most once" names its mechanism (the `phase` guard).
- **Complex workflow decision-gate matrix**: Not applicable — this plan changes product code and
  project documentation only; it adds and modifies no workflow decision gate, protocol, status
  label or mirrored workflow surface.
- **Parser/API/concurrency checklist completeness**: Checked — parser-risk applies (two source
  scanners) and carries a 12-case and an 8-case edge enumeration plus suppression semantics, each
  mapped to a named test file; concurrent-event-source applies (teardown racing focus re-reads) and
  carries all seven checklist items. Single-snapshot / consistency-semantics signals do not apply:
  this item reads no aggregate and makes no cross-query consistency claim.
- **CHANGELOG literal format**: Checked — Implementation Order step 11 gives the entry in the
  project's `**Bold Title** (#N):` format, under `### Added`, for the developer to copy verbatim.
- **Not-applicable rationale**: Checked — the two skipped categories above each carry a one-line
  rationale.
