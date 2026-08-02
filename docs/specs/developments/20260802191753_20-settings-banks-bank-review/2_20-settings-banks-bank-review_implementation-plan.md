# Settings: connected banks and bank review — Implementation Plan

**Work item**: [#20 Settings: connected banks and bank review](https://github.com/lhpaul/personal-finances/issues/20)
— a **Refactor**-type item in the tracker, so there is no spec. The work item brief is the
requirement source, together with the four contracts it points at:

- **Visual contract**: `design/mockups/mobile/index.html` — `#screen=settings-banks`
  (states `list`, `empty`, `disconnect-confirm`) and `#screen=bank-review` (states `ok`, `error`);
  manifest entries in [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js)
- **Behaviour contract**:
  [`BEHAVIOR.md` → `settings-banks`, `bank-review`](../../../../design/mockups/mobile/BEHAVIOR.md)
- **Domain contract**: [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md)
  — BR1 (credentials never leave the device), BR3 (bank data is never deleted, only excluded),
  BR5 (re-syncing is idempotent)
- **Data contract**: [`docs/project/4-database-model.md`](../../../project/4-database-model.md)
  — `user_financial_institutions` (`status`, `sync_status`, `last_sync_at`, `last_success_at`,
  `last_error_code`, `last_error_message`), `user_financial_products.metadata`, gap #8
  (*"No sync history"*) and the *"No `auto_sync` column"* note

**Smoke test runbook**:
[`docs/testing/mobile/20-settings-banks-bank-review.smoke-test.md`](../../../testing/mobile/20-settings-banks-bank-review.smoke-test.md)

---

## Summary

**Approach**: Two composition-only routes over one new `apps/mobile/src/features/banks/` folder,
reading through `getAppDatabase()` plus repository functions behind one feature hook per screen —
the pattern items #8 and #12 established. **No TanStack Query.** The item ships no engine: the
sync it offers is item #11's screen reached through item #9's connect-flow store, and the
credential re-entry it offers is item #9's form, which locks the RUT on its own because a
credential entry already exists.

The centre of gravity is the one write this item owns — **disconnect** — and the single sentence
that defines it: *"desconectar → borra la credencial del keychain y 🟡 conserva los movimientos ya
descargados (la historia es del usuario; desconectar corta el futuro, no borra el pasado —
coherente con BR3)"*. That sentence is not a preference here; it is enforced by the schema.
`user_financial_products` cascades from `user_financial_institutions` and `transactions` cascades
from `user_financial_products`, so deleting the connection row would delete every movement the
person owns. Disconnect is therefore a **status transition to `'disconnected'` plus a keychain
delete**, in that order, and the credential goes first so a partial failure can never leave a
credential the person asked to remove.

**Estimated complexity**: **M**

**Rationale**: five manifest states across two screens, two repository reads, one ordered
two-storage write, one additive prop on an existing primitive and one catalogue block. Nothing
here is deep. The cost is in the seams — this item consumes work from six sibling items (#8, #9,
#10, #11, #12, #19) and must not recreate any of it — and in proving the disconnect guarantee
(movements intact, keychain empty, automatic syncing stopped) in a Node-tier test rather than
asserting it in prose.

**Dependencies**:

| Item | State at plan time | Why this plan needs it | Blocking? |
| --- | --- | --- | --- |
| [#8 onboarding](https://github.com/lhpaul/personal-finances/issues/8) | Plan merged; implementation not started | `src/db/runtime.ts` → `getAppDatabase()`, the single app-tier entry point both feature hooks await | **Yes** |
| [#9 connect a bank](https://github.com/lhpaul/personal-finances/issues/9) | Plan merged; implementation not started | The secure-store seam (`SecureStorePort`, `credentialsKeyFor`, `deleteCredentials`), the connect-flow store (`chooseInstitution`, `enterFlow('settings')`), `flow-navigation.ts` (`resolveExitHref('settings')` → `/settings/banks`), `getConnectionByInstitution`, `SYNCING_ROUTE`, and the credential form that arrives RUT-locked (its Use Case 7) | **Yes** — Resolution R1 |
| [#10 sync engine](https://github.com/lhpaul/personal-finances/issues/10) | Plan merged; implementation not started | Writes every column these screens read (`sync_status`, `last_sync_at`, `last_success_at`, `last_error_code`, `last_error_message`); owns `AUTOMATIC_SYNC_INTERVAL_MS` and `isDueForAutomaticSync`; assigns the four `sync.errors.*` catalogue keys to **this** item (its A7) | **Yes** for the `error` state; the `ok` state renders without it |
| [#11 bank syncing](https://github.com/lhpaul/personal-finances/issues/11) | Plan merged; implementation not started | `/(onboarding)/bank-syncing` is the destination of *Sincronizar ahora*, exactly as the mockup wires it | **Yes** for that CTA only; both screens render without it |
| [#12 home screen](https://github.com/lhpaul/personal-finances/issues/12) | Plan merged; implementation not started | `BankRow` (`mu-bank*`, `mu-item__txt/__sub/__chev`) and `describeSyncTime` in `src/features/home/relative-time.ts`, whose own Assumption A11 names issue #20 AC1 as its reason to exist | **Yes** — Resolution R2 |
| [#19 settings hub](https://github.com/lhpaul/personal-finances/issues/19) | Plan merged; implementation not started | `ScreenTopBar` (`mu-topbar*`), `ListGroup` / `ListRow` (`mu-item*`), `componentMetrics.listRow`, and the hub row that links to `/settings/banks` | **Yes** — Resolution R3 |
| [#2 theme and primitives](https://github.com/lhpaul/personal-finances/issues/2) | Merged | `Card`, `Modal`, `Note`, `Badge`, `Button`, `Amount`, `EmptyState`, `Text` | Satisfied |
| [#3 local database](https://github.com/lhpaul/personal-finances/issues/3) | Merged | The schema, `parseProductMetadata` / `parseInstitutionMetadata`, and `disconnectInstitution` — already shipped and already correct | Satisfied |
| [#4 shared-utils](https://github.com/lhpaul/personal-finances/issues/4) | Merged | `formatClp`, `formatTimeOfDay`, `formatShortDate`, `deriveDateLocal`, `differenceInDays` | Satisfied |
| [#34 i18n](https://github.com/lhpaul/personal-finances/issues/34) | Merged | Flat-key catalogues and the `no-literal-string` rule | Satisfied |
| [#47 design-fidelity gate](https://github.com/lhpaul/personal-finances/issues/47) | Plan merged; implementation open as PR [#61](https://github.com/lhpaul/personal-finances/pull/61) | This item's **five** fidelity targets flip `planned` → `wired` | **No** — contingent, Resolution R4 |
| [#5 shared-domain](https://github.com/lhpaul/personal-finances/issues/5) | Merged | Nothing. These screens evaluate no inclusion rule and aggregate no money | Satisfied |

**Not built here**: the sync engine (#10), the syncing screen (#11), the credential form (#9),
the full local wipe (#19 — that is profile destruction; this item's disconnect is per-connection
and deliberately keeps the store intact), and every `mvp: false` screen.

---

## Verification Log

All commands were run in the plan worktree `.claude/worktrees/item-20` at repo revision
`13cecd5` (`git rev-parse HEAD` equals `git rev-parse origin/develop`), on 2026-08-02.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse HEAD`; `git rev-parse origin/develop` | Both `13cecd5`. The branch was created from an earlier `origin/develop` (`961cc69`) and was fast-forwarded to the current tip before any file was written, so the plan is not stacked on unmerged work |
| Template-fit check applies? | `sed -n '171,177p' .ai-dev-workflow.yaml` | `is_template: false` → Protocol 02 **Step 0 does not apply** |
| Repository mode | `grep -n '^mode:' .ai-dev-workflow.yaml` | No match → default `single_repo`; this repository owns the plan and the plan PR |
| Manifest entries for this item's screens | `sed -n '463,485p' design/mockups/mobile/mockup-manifest.js` | `settings-banks` → `/settings/banks`, states `list` *(initial)*, `empty`, `disconnect-confirm`; `bank-review` → `/settings/banks/[bankId]`, states `ok` *(initial)*, `error`. **5 screen/state targets** |
| The mockup as drawn | `sed -n '2261,2347p' design/mockups/mobile/index.html` | Recorded verbatim in the **Copy inventory** table under *Seed Data*. Two facts drive decisions: the list row's trailing element is a `mu-badge--ok` reading `✓` (**not** a chevron), and `bank-review` draws an informational `mu-note` about automatic syncing — **no toggle** |
| *Sincronizar ahora* / *Actualizar credenciales* destinations | Same range, lines 2341-2343 | `onclick="go('bank-credentials','filled')"` and `onclick="go('bank-syncing')"`; *Desconectar banco* → `go('settings-banks','disconnect-confirm')`. All three are the mockup's own wiring (Decisions 6, 7) |
| The 🟡 that defines disconnect | `sed -n '241,256p' design/mockups/mobile/BEHAVIOR.md` | *"desconectar → borra la credencial del keychain y 🟡 conserva los movimientos ya descargados … coherente con BR3"*; `bank-review` *"🟡 sincronizar ahora (BR5 la hace siempre segura)"* and, on a credential failure, *"re-ingresarlas vía `bank-credentials`"* |
| **Deleting the connection row would delete the movements** | `sed -n '93,114p;187,196p' apps/mobile/src/db/schema.ts` | `user_financial_products.user_financial_institution_id` is `ON DELETE cascade`; `transactions.user_financial_product_id` is `ON DELETE cascade`. A `DELETE` on `user_financial_institutions` therefore removes every movement — Decision 1 |
| `disconnectInstitution` already exists and is already correct | `sed -n '37,49p' apps/mobile/src/db/repositories/institutions.ts` | Sets `status: 'disconnected'` and *"touches **nothing else** — in particular, `credentials_key` … is left byte-identical, so a later reconnect can reuse the same deterministic key"*. This item **consumes** it |
| Connection status vocabulary | `sed -n '150,152p' docs/project/4-database-model.md`; `sed -n '74,76p' apps/mobile/src/db/schema.ts` | `status`: `active` \| `inactive` \| `disconnected`; `sync_status`: `idle` \| `syncing` \| `ok` \| `error`. **`'connected'` is not a value anywhere** |
| There is no `auto_sync` column, and the toggle was removed from the mockup | `sed -n '161,165p' docs/project/4-database-model.md`; `sed -n '65,66p' apps/mobile/src/db/schema.ts` | *"**No `auto_sync` column.** Syncing is implicit… The per-connection toggle has been removed from `#screen=bank-review` so the mockups and the schema agree."* — Decision 8 |
| There is no sync-history table | `sed -n '47p' docs/project/4-database-model.md` | Gap #8: *"**No sync history.** Only `last_sync_at` + `sync_status`"*, with `last_success_at` / `last_error_code` / `last_error_message` added *"`bank-review` shows this separately"* — Decision 9 |
| Product money lives in `metadata`, validated as minor units | `sed -n '99,128p' apps/mobile/src/db/json.ts`; `sed -n '180,187p' docs/project/4-database-model.md` | `ProductMetadata = { balance?, mask?, credit_limit?, available_credit? }`, each money field through `assertMinorUnits`; *"`bank-review` reads them one product at a time and no screen aggregates balances"* |
| Disconnecting really does stop automatic syncing | `sed -n '329,345p' docs/specs/developments/20260802131441_10-sync-engine/2_10-sync-engine_implementation-plan.md` | `isDueForAutomaticSync` requires `connection.status === 'active'` — *"`inactive` and `disconnected` are never automatic"*. This item needs **no** change to #10 for the promise to hold; the re-verification step confirms it |
| `AUTOMATIC_SYNC_INTERVAL_MS` | Same range | `6 * 60 * 60 * 1000` in `apps/mobile/src/features/sync/auto-sync.ts` — matches the mockup's *"más de 6 horas"* note (Decision 8) |
| The four `sync.errors.*` keys are **this** item's to define | #10 plan Decision 9 and its A7; #11 plan Assumption A7 | `composeFailureMessageKey` is total over `invalid_credentials \| session_closed \| network \| parse_failed` → `sync.errors.<code>`; *"the catalogue entry that renders these keys belongs to the bank detail screen item"*; #11 keeps its own longer bodies under `bank_syncing.error.body.*` — Decision 10 |
| Item #9's Use Case 7 is exactly this item's AC3 | `sed -n '341,380p' docs/specs/developments/20260802131302_9-connect-a-bank-picker-credentials-secure-storage/1_9-…_specs.md` | *"The mockup wires the bank detail screen's 'Actualizar credenciales' action straight to this credential form. That path arrives with a credential entry already present, so it arrives with the RUT locked and only the password to retype — which is exactly what item #20's own acceptance criterion asks for… This item owes that behavior; the button that reaches it is item #20's."* |
| Item #9's navigation seam for a settings entry | Same plan, *Frontend/UI — new files* | `connect-flow-store.ts` holds `{ institutionId, entryOrigin: 'onboarding' \| 'settings' }`; `flow-navigation.ts` → `resolveBackHref('settings')` and `resolveExitHref('settings')` both resolve to `/settings/banks` |
| Item #12 already owns the relative sync-time descriptor | `sed -n '470p;603,606p' docs/specs/developments/20260802172715_12-home-screen/2_12-home-screen_implementation-plan.md` | `src/features/home/relative-time.ts` → `describeSyncTime(nowInstant, isoInstant)` → `{ kind: 'minutes' \| 'hours' \| 'yesterday' \| 'date', … }`, and its A11 cites *"issue #20 AC1 requires last-success and last-attempt to be shown separately"* — Resolution R2 |
| `BankRow`'s planned shape | Same plan, *Design system* | *"logo or monogram, name, sub-label, chevron. Pressable."* — no trailing-badge slot, hence the additive prop in Decision 4 |
| `mu-*` ownership for these two screens | `grep -nE "'mu-(bank\|item\|topbar\|list)" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-bank*` deferred to #9 (reassigned to `BankRow` by #12's plan), `mu-item*` and `mu-list` deferred to #19, `mu-topbar*` deferred (#19's plan builds `ScreenTopBar`). Every other class these screens draw is already `primitive` or `utility` → Decision 12 |
| An owner must be a barrel export | `cat apps/mobile/src/__tests__/mu-class-coverage.test.ts` | *"every owner resolves to a barrel export of `src/components/ui/index.ts`"* — a screen-local component can never be a `MU_CLASS_MAP` owner, which is why `BankProductRow` is a composition, not an owner (Decision 12) |
| Primitive prop contracts this plan composes | `apps/mobile/src/components/ui/{Modal,Note,Badge,EmptyState,Amount,Text}.tsx` | `Modal { visible, onRequestClose (required), icon?, title, children? }`; `NoteTone = 'info' \| 'ok' \| 'warn' \| 'danger'`; `BadgeTone` includes `ok`, `danger`; `EmptyState { icon, title, description?, action? }`; `AmountTone = 'neutral' \| 'in' \| 'out'` and `Amount` **requires** either `formatted` or `minorUnits` + `format`; `TextVariant` includes `h3`, `body`, `small`, `mono` |
| Catalogue key shape enforced by CI | `cat apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts`; `sed -n '28,32p' apps/mobile/src/i18n/index.ts` | Flat, lowercase, snake_case, dotted; identical key sets in `es`/`en`; `keySeparator: false`. No test asserts i18next plural resolution → Decision 11 |
| The two route files already exist as placeholders | `cat apps/mobile/app/settings/banks/index.tsx apps/mobile/app/settings/banks/[bankId].tsx` | Both are `RoutePlaceholder`. `route-manifest-parity.test.ts` derives routes from files, so replacing their bodies adds and removes no route |
| The campaign data-access pattern | `sed -n '290,360p' docs/specs/developments/20260802172715_12-home-screen/2_12-home-screen_implementation-plan.md` | `getAppDatabase()` + repository functions behind a feature hook; `useFocusEffect` bumps a `reloadToken`; the read is cancellation-guarded and a stored rejection is re-thrown **during render**. **No TanStack Query** |
| The `.db.test.ts` Jest routing | `cat apps/mobile/jest.config.js`; #12 plan Decision 14 | Two projects today (`app`, `db`). #12/#9/#13/#16 each add the same two additive lines: `db.testMatch` gains `'<rootDir>/src/features/**/*.db.test.ts'`, `app.testPathIgnorePatterns` gains `'\\.db\\.test\\.ts$'` — Resolution R5 |
| This item's fidelity targets, read from the live contract | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-targets.json` | Exactly **5** mappings — `settings-banks` × `list \| empty \| disconnect-confirm` and `bank-review` × `ok \| error` — all `status: "planned"`, all `fixture: "seed-default"`, none carrying a `max_mismatch_pct` override. `coverage_sets` has `{ "issue": 20, "targets": [{ "screen_id": "settings-banks", "states": "all" }, { "screen_id": "bank-review", "states": "all" }] }` |
| How the contract validates `ready_test_id` | `git show origin/feature/47-design-fidelity-gate:scripts/mobile-ui/fidelity-contract.mjs` lines 196-204 | It passes when the `app_file` source contains **either** the literal `ready_test_id` **or** a `fidelityTestId('<screen_id>')` call. Decision 13 uses the helper-call form and pins the literal in a unit test |
| The preview helpers exist and are `__DEV__`-only | `git show origin/feature/47-design-fidelity-gate:apps/mobile/src/lib/fidelity-preview.ts` | `fidelityTestId(screenId) => \`fidelity-${screenId}\`` and `useFidelityPreview()`, which returns `{ active: false, state: null }` whenever `__DEV__` is false |
| Bounded same-surface open PRs | `gh pr list --state open --json number,title,headRefName` then a file-level read of each | Three: **#61** (item #47 implementation — same surface: `scripts/mobile-ui/fidelity-targets.json`), **#68** (docs-only edit to item #12's plan), **#46** (`packages/bank-scraper`, item #6). Only #61 touches a file this plan names |
| **Runtime packages this plan names but cannot verify** | `ls node_modules/expo-sqlite apps/mobile/node_modules/expo-secure-store` | Not installed in the current tree (the same situation items #8, #11 and #19 recorded). Nothing in this plan calls an Expo API directly — the only Expo surfaces reached are `expo-router` (`useLocalSearchParams`, `useFocusEffect`, `router`, `Redirect`) and item #9's secure-store adapter, both behind seams — but the implementer must still confirm `router.setParams` exists on the installed `expo-router` before relying on Decision 7 |

### Residual verification strategy

This plan makes three completeness claims. None is left as prose; each names the mechanical
evidence the implementation PR must paste.

| Claim | Evidence source | What the implementation PR pastes |
| --- | --- | --- |
| **Every manifest state of both screens is implemented** (non-negotiable 6) | `apps/mobile/src/features/banks/state-coverage.ts` → `BANKS_STATE_COVERAGE`, asserted set-equal to the manifest's states by `state-coverage.test.ts`; plus the five fidelity targets flipped to `wired` and validated by `pnpm fidelity:contract` (R4-contingent) | The `state-coverage.test.ts` pass line and the `pnpm fidelity:contract` summary (or, under R4, the runbook's manual side-by-side record) |
| **Disconnecting keeps every downloaded movement** (brief AC2) | `apps/mobile/src/features/banks/__tests__/disconnect-bank.db.test.ts` — counts `transactions` and `user_financial_products` before and after over a real in-memory store, and asserts the counts are unchanged and `status = 'disconnected'` | The before/after counts the test prints |
| **No credential value can reach a log or an error payload** (BR1) | `no-console: 'error'` for `src/features/banks/**` (the rule item #9 sets for `src/features/connect-bank/**`), plus `apps/mobile/src/features/banks/__tests__/no-credential-values.test.ts`, which scans every file in the folder for a `readCredentials` / `getItem` call and for `console.` | The test's pass line and the list of files it scanned |
| **Every `mu-*` class these two screens draw already has an owner** | The existing `apps/mobile/src/__tests__/mu-class-coverage.test.ts` set-equality assertion and its per-status breakdown | The per-status breakdown, before and after (Decision 12 predicts **no change**) |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml` (no `mode`, no `workflow_hub`, no `product_repo` section) | 2026-08-02T19:17Z, `13cecd5` | Current invocation item `{#20}`; no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* (*"spec/plan/feature/fix PRs target `develop`"*) | 2026-08-02T19:17Z, `13cecd5` | Current invocation item `{#20}`; no open PR changes branching policy | `Verified` |
| Plan branch is not stacked on unmerged work | `implementation-plan/20-settings-banks-bank-review` at `13cecd5`, identical to `origin/develop` | `git rev-parse HEAD origin/develop` after `git merge --ff-only origin/develop` | 2026-08-02T19:17Z | Isolated worktree at `.claude/worktrees/item-20` | `Verified` |
| **Connection `status` vocabulary** | `'active' \| 'inactive' \| 'disconnected'`. `'connected'` is **not** a value | `docs/project/4-database-model.md` line 150; `apps/mobile/src/db/schema.ts` line 74; item #9 plan Resolution R2 (records the historical `'connected'` slip and rules `'active'` authoritative) | 2026-08-02T19:17Z, `13cecd5` | Current invocation item `{#20}`; items #9 and #10 are the only other writers of this column, and both use `'active'` | `Verified` |
| **The secure-store seam** | `src/lib/secure-store/{types,expo-secure-store.adapter,credential-store}.ts`; `SecureStorePort { getItem, setItem, deleteItem }`; `credentialsKeyFor(id) === 'bank_creds:' + id`; `deleteCredentials(port, institutionId)` | Item #9's merged plan, *Frontend/UI — new files* and Decisions 4-5; corroborated by `docs/project/4-database-model.md` line 151 | 2026-08-02T19:17Z, `13cecd5` | Same-surface siblings #9 (creates it) and #19 (appends `deleteAllCredentials` to the same file). This item **consumes** and adds nothing to `src/lib/secure-store/` | `Verified` — Resolution R1 |
| **Screen data-access pattern** | `getAppDatabase()` + repository functions behind one feature hook per screen; `useFocusEffect` → `reloadToken`; **no TanStack Query** | Item #8's merged plan (establishes it and queues the `expo-react-native.md` correction); item #12 Decision 7; the parent orchestrator's binding campaign-wide decision for this run | 2026-08-02T19:17Z, `13cecd5` | Current invocation item `{#20}`; every sibling screen plan (#12, #13, #15, #16, #17, #19) records the same pattern | `Verified` |
| **Jest routing convention for feature-tier database tests** | `*.db.test.ts` — `db.testMatch` gains `'<rootDir>/src/features/**/*.db.test.ts'`, `app.testPathIgnorePatterns` gains `'\\.db\\.test\\.ts$'` | Item #12 Decision 14 (originating), items #9, #13 and #16 repeat it verbatim; the parent orchestrator's binding campaign-wide decision for this run | 2026-08-02T19:17Z, `13cecd5` | Current invocation item `{#20}`; item #19's plan proposes a different `*.node.test.ts` third project for the same purpose | `Conflict` → `Resolved`, see Resolution R5 |
| **Where connection repository functions live** | `apps/mobile/src/db/repositories/institutions.ts` | Item #9 plan Resolution R5 (*"the connection functions go here, next to the merged `disconnectInstitution`"*); item #10 adds `SyncConnection` reads to the same file | 2026-08-02T19:17Z, `13cecd5` | Same-surface siblings #8 (creates `repositories/connections.ts` for `getConnectedBanksSummary`), #9 and #10 | `Conflict` → `Resolved`, see Resolution R6 |
| **Fidelity contract file and this item's target list** | `scripts/mobile-ui/fidelity-targets.json`; 5 mappings, `coverage_sets[issue=20]`, all `planned`, `fixture: "seed-default"`, no threshold override | Read directly from `origin/feature/47-design-fidelity-gate` (open PR #61), not from the plan prose | 2026-08-02T19:17Z, `13cecd5` | Same-surface open PR **#61** only | `Verified` — with the R4 contingency |

**Resolution R1 — the secure-store seam is item #9's; this item deletes through it and never
recreates it.** Competing evidence: none. `src/lib/secure-store/**` does not exist at `13cecd5`;
item #9's merged plan creates it, and item #19's merged plan already appends the only extension
anyone has asked for (`deleteAllCredentials`). Affected plan statements: Decision 2, the
`disconnect-bank.service.ts` bullet, Implementation Order step 4.
**Resolution: this item imports `deleteCredentials` and the `SecureStorePort` type and adds
nothing to that folder.** If item #9 has not merged when this item is implemented, the implementer
**stops and returns to the parent orchestrator** rather than inventing the `expo-secure-store`
dependency version, its keychain protection class and its boundary lint. Decision owner: tech-lead
agent for item #20, under the parent orchestrator's no-human-available delegation.

**Resolution R2 — the relative sync-time descriptor is item #12's, and this item is its second
consumer.** Competing evidence: item #12's plan puts `describeSyncTime` in
`apps/mobile/src/features/home/relative-time.ts` — inside another feature's folder — while this
item needs it in `src/features/banks/`. Affected plan statements: Decision 3 and the copy
inventory. **Resolution: import it across features in place; do not copy it and do not move it.**
Item #12's own Assumption A11 names issue #20 as the reason the module exists, so a cross-feature
import is the intended relationship rather than an accident. There is no lint rule against a
cross-feature import inside `apps/mobile/src`
(`grep -n 'no-restricted-imports' -A 25 eslint.config.mjs` shows the restrictions are
package-boundary and SQL-boundary rules only). Promoting the module to `src/lib/relative-time.ts`
is recorded as follow-up **F1**, to be done when a third consumer appears — not by this item,
which would otherwise edit a merged item's internals for cosmetic reasons. Decision owner:
tech-lead agent for item #20.

**Resolution R3 — the settings shell primitives are item #19's.** Competing evidence: none;
`ScreenTopBar`, `ListGroup` and `ListRow` do not exist at `13cecd5`. Affected plan statements:
Decision 12 and every route bullet. **Resolution: consume `ScreenTopBar` as-is; consume `ListRow`
only where the mockup draws `mu-item`, which on these two screens is nowhere** — `settings-banks`
draws `mu-bank` rows and `bank-review` draws `mu-card--tight` rows. If item #19 has not merged,
the implementer stops rather than building a second top bar. Decision owner: tech-lead agent for
item #20.

**Resolution R4 — the fidelity tooling may or may not exist at implementation time.** Competing
evidence: item #47's merged plan requires each screen item to flip its targets, and PR #61
implements it, but `scripts/mobile-ui/` is absent from `develop` at `13cecd5`. Affected plan
statements: Decision 13, Implementation Order step 10, the runbook's fidelity step.
**Resolution: the flip is conditional and the runbook carries both paths.** If
`scripts/mobile-ui/fidelity-targets.json` exists at implementation time, step 10 flips the five
mappings and the runbook runs `pnpm fidelity --issue 20`; if not, step 10 is skipped with a note
in the PR body and the manual side-by-side comparison against `design/mockups/mobile/index.html`
is the evidence. The manual step is **never** removed. The `useFidelityPreview()` / `fidelityTestId`
calls in the two route files are **also** conditional on the same file existing, because
`src/lib/fidelity-preview.ts` ships in the same PR. Decision owner: tech-lead agent for item #20.

**Resolution R5 — `.db.test.ts`, not `.node.test.ts`.** Competing evidence: item #12's merged plan
(Decision 14) routes feature-tier database tests through the existing `db` project with the
`*.db.test.ts` suffix, and items #9, #13 and #16 repeat it verbatim; item #19's merged plan instead
proposes a third `feature` project matching `src/features/**/*.node.test.ts`. Affected plan
statements: the Testing Strategy test-file table and Implementation Order step 2.
**Resolution: this item uses `*.db.test.ts`**, per the parent orchestrator's binding campaign-wide
decision for this run and the four-to-one weight of the merged plans. If, at implementation time,
`jest.config.js` already carries #12's two lines, this item changes nothing; if it does not, this
item adds them exactly as #12 specifies. This item never adds a third Jest project. Decision owner:
parent orchestrator (campaign-wide), recorded here.

**Resolution R6 — connection reads live in `institutions.ts`.** Competing evidence: item #8's
merged plan creates `apps/mobile/src/db/repositories/connections.ts` for
`getConnectedBanksSummary`; item #9's Resolution R5 puts the connection functions in
`institutions.ts` *"next to the merged `disconnectInstitution`"*, and item #10 adds its
`SyncConnection` reads there too. Affected plan statements: the Database layer bullets and
Implementation Order step 3. **Resolution: this item's `listBankConnections` goes in
`institutions.ts`**, where `disconnectInstitution`, `getConnectionByInstitution` and
`getConnection` already are — three of the four functions this item calls. `connections.ts` is left
untouched. Converging the readers is item #9's already-recorded follow-up F2, not this item's edit.
Decision owner: tech-lead agent for item #20.

### Implementation-start re-verification (mandatory before the first file edit)

Before touching a file, the implementer re-runs the checks whose value could have moved, and
records `Still valid` or `Stale or conflicting` in the implementation PR:

1. `git log --oneline -1 origin/develop` — confirm items **#8, #9, #10, #11, #12 and #19** have
   merged. If #8, #9, #12 or #19 has not, stop (Resolutions R1-R3).
2. `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/institutions.ts` —
   confirm `disconnectInstitution`, `getConnectionByInstitution` and `getConnection` exist with
   the recorded shapes, and that `disconnectInstitution` still writes only `status`.
3. `grep -nE '^export (async )?function' apps/mobile/src/db/repositories/products.ts` — confirm
   item #10 created the file. If it did not, create it with only this item's read in it.
4. `grep -n 'isDueForAutomaticSync' -A 12 apps/mobile/src/features/sync/auto-sync.ts` — confirm
   the predicate still requires `status === 'active'`. **If it does not, stop**: the disconnect
   promise depends on it, and changing #10's predicate is a decision for the parent orchestrator,
   not a silent patch here.
5. `grep -n 'AUTOMATIC_SYNC_INTERVAL_MS' apps/mobile/src/features/sync/auto-sync.ts` — confirm the
   constant is exported and still six hours (Decision 8's drift test imports it).
6. `grep -nE '^export' apps/mobile/src/features/connect-bank/{connect-flow-store,flow-navigation,sync-handoff}.ts` —
   confirm `chooseInstitution`, `enterFlow`, `resolveExitHref` and `SYNCING_ROUTE`.
7. `grep -nE 'export (type )?(function )?BankRow|BankRowProps' -A 12 apps/mobile/src/components/ui/BankRow.tsx` —
   read the shipped prop surface before adding Decision 4's optional `badge` prop; if #12 already
   shipped a trailing slot under another name, use it and add nothing.
8. `grep -n "status: 'deferred'" apps/mobile/src/test-utils/mu-class-map.ts` — confirm no class
   these screens draw is still `deferred` (Decision 12 predicts none is).
9. `grep -n 'db.test.ts' apps/mobile/jest.config.js` — decide the R5 branch.
10. `ls scripts/mobile-ui/fidelity-targets.json apps/mobile/src/lib/fidelity-preview.ts` — decide
    the R4 branch.
11. `grep -n 'setParams' node_modules/expo-router/build/*.d.ts` (or the installed equivalent) —
    confirm `router.setParams` exists before relying on Decision 7's param-clearing step.

If any check comes back `Stale or conflicting`, stop before editing and return the evidence to the
parent orchestrator.

---

## Key Decisions

### Decision 1 — disconnect is a status transition, and the schema is what makes that non-negotiable

`user_financial_products` references `user_financial_institutions` with `ON DELETE cascade`, and
`transactions` references `user_financial_products` with `ON DELETE cascade`
(`apps/mobile/src/db/schema.ts` lines 99 and 193). A `DELETE` on the connection row therefore
deletes every product and every movement the person owns. The 🟡 in `BEHAVIOR.md` — *"conserva los
movimientos ya descargados … desconectar corta el futuro, no borra el pasado"* — and BR3 both say
that must not happen, and the cascade means the mistake would be silent and irreversible on a
device.

So disconnect writes exactly one column: `status = 'disconnected'`. The already-merged
`disconnectInstitution(db, userFinancialInstitutionId)` does precisely that and nothing else, and
this item **consumes it unchanged**. Nothing in this item issues a `DELETE` against any table; a
test asserts the source of `src/features/banks/**` contains no `delete(` call against a Drizzle
table, mirroring how item #19 keeps its own wipe honest.

Consequences that follow from the same choice, and that the plan states so they are not
rediscovered in review:

- `credentials_key` is left byte-identical, so reconnecting the same bank reuses the same
  deterministic keychain key and item #9's `upsertConnection` finds the row rather than
  duplicating it (the `(financial_institution_id)` unique index guarantees the rest).
- `last_success_at`, `last_sync_at` and the error columns are left as they were. The connection's
  history is a fact about the past; disconnecting does not rewrite it.
- The disconnected row is **excluded from the list** (Decision 5), so the person sees the mockup's
  `empty` state after disconnecting their only bank — which is exactly what the mockup's
  *Desconectar* button does (`go('settings-banks','empty')`).

### Decision 2 — the credential is deleted first, and the order is the failure contract

The disconnect sequence is ordered and fail-closed, in `disconnect-bank.service.ts`:

```ts
// Illustrative — adapt during implementation.
// apps/mobile/src/features/banks/disconnect-bank.service.ts
export type DisconnectOutcome =
  | { status: 'disconnected' }
  | { status: 'failed'; stage: 'credential' | 'connection' };

export async function disconnectBank(
  deps: { db: AppDatabase; secureStore: SecureStorePort },
  input: { connectionId: string; institutionId: string },
): Promise<DisconnectOutcome> {
  try {
    await deleteCredentials(deps.secureStore, input.institutionId); // 1. keychain first
  } catch {
    return { status: 'failed', stage: 'credential' }; // status stays 'active'
  }
  try {
    disconnectInstitution(deps.db, input.connectionId); // 2. then the row
  } catch {
    return { status: 'failed', stage: 'connection' };
  }
  return { status: 'disconnected' };
}
```

Why this order and not the reverse. If the status flip came first and the keychain delete then
failed, the person would be shown *"desconectado"* while their bank credential was still on the
device — a broken privacy promise, and the one failure mode BR1 exists to prevent. With the
credential first, the worst residue is a connection still marked `active` whose credential is
gone: the promise is kept, the state is visible (the row is still listed, with a failure `Note`),
and the action is **re-runnable** because both halves are idempotent —
`SecureStorePort.deleteItem` on an absent key is a no-op and `disconnectInstitution` is an
`UPDATE … SET status = 'disconnected'`. This is the same ordering item #19's wipe uses, for the
same reason (*"credentials go first"*).

The function takes its dependencies as arguments and touches no React, so the whole guarantee is
provable in a Node-tier `*.db.test.ts` over a real in-memory database and a fake port.

### Decision 3 — the two screens read, they do not compute

Both hooks follow the campaign pattern exactly: `await getAppDatabase()`, call repository
functions, expose a discriminated state, re-read when `useFocusEffect` bumps a `reloadToken`,
discard a superseded run through an `isCancelled()` guard, and re-throw a stored rejection
**during render** so it reaches the route's `ErrorBoundary` instead of becoming an unhandled
rejection. The async race is extracted from each hook as a plain exported function
(`loadBankConnections`, `loadBankReview`) so the guard is testable without a renderer.

`useFocusEffect` is what makes AC3 true end to end: after a credential update the person returns
from item #11's syncing screen to `/settings/banks`, and the list re-reads on focus, so the row's
sync state is the one the sync just wrote.

Everything the screens display beyond raw fields is a **pure function** in the feature folder,
taking already-read rows and returning a catalogue key plus interpolation values — never a Spanish
string built in TypeScript (non-negotiable 8):

| Pure function | Input | Output |
| --- | --- | --- |
| `resolveConnectionListItem` | a `BankConnectionSummary` + `now` | `{ badge, subtitleKey, subtitleValues, accessibilityStatusKey }` |
| `resolveBankReviewState` | a `BankConnectionSummary` | `'ok' \| 'error'` (Decision 9) |
| `resolveSyncTimeKey` | item #12's `describeSyncTime` descriptor + a key prefix | a catalogue key + values |
| `resolveSyncErrorKey` | a `BankConnectionSummary` (reads `lastErrorCode` and `lastErrorMessage`) | one of the five `sync.errors.*` keys (Decision 10) |
| `toProductView` | a `BankProductSummary` | a `BankProductView`: `{ icon, title, metaKey, metaValues, amount }` (Decision 5) |
| `summarizeConnections` | `BankConnectionSummary[]` | `{ bankCount, productCount }` |

### Decision 4 — the list row's trailing element is a badge, which `BankRow` gains additively

The mockup's `settings-banks` row ends with `<span class="mu-badge mu-badge--ok">✓</span>`, not
with the `mu-item__chev` that `#screen=home`'s bank row ends with. Item #12's `BankRow` is
specified as *"logo or monogram, name, sub-label, chevron"*, so it has no slot for this.

This item adds **one optional prop** to `apps/mobile/src/components/ui/BankRow.tsx`:
`badge?: { tone: BadgeTone; label: string }`. When present, the row renders a `Badge` in the
trailing position **instead of** the chevron; when absent, `BankRow` behaves exactly as item #12
ships it, so no existing call site changes. No new barrel export, no `MU_CLASS_MAP` edit
(`mu-badge` and `mu-badge--ok` are already `primitive`, owned by `Badge`), and no new
`componentMetrics` group. This mirrors how item #9 plans its own conditional `BankRow` extension
and how item #11 consumes `Progress`'s `indeterminate` prop.

Accessibility: `✓` is not a status a screen reader can announce. The row's `accessibilityLabel`
is composed as *bank name + status word* using `settings_banks.status_ok` / `status_error`, so the
visible badge stays the mockup's glyph while the accessible name carries the meaning. A test
asserts the accessible name of an `error` row ends with the error status label.

### Decision 5 — `bank-review`'s product rows are a composition, not a new primitive

The mockup draws each product as `mu-card mu-card--tight` wrapping a `mu-row` with
`mu-item__icon`, `mu-item__title`, `mu-item__sub mu-mono` and `mu-amount`. It does **not** draw
`mu-list` / `mu-item`, so item #19's `ListRow` is the wrong component and `Card variant="tight"`
is the right one. `BankProductRow.tsx` is therefore **screen-local**: `Card` + `Text` + `Amount`,
taking its icon and title geometry from `componentMetrics.listRow` (item #19's group) so the two
stay visually identical without a style literal. It is deliberately not a `components/ui/`
primitive — `mu-class-coverage.test.ts` requires every `MU_CLASS_MAP` owner to be a barrel export,
so a screen-local component could not own those classes anyway, and item #19's `ListRow` already
does.

What each row shows, from `parseProductMetadata` (never from a first-class column — the data model
keeps balance and cupo in `metadata`):

| Field | Source | Rule |
| --- | --- | --- |
| Icon | `type` | Total map: `checking`, `sight`, `savings` → 🏦; `credit_card` → 💳; `credit_line` → 📈 (Assumption A5) |
| Title | `name` | The bank's own words, stored by the sync. Not a localized type label — this is data, not copy |
| Meta line | `metadata.mask`, `metadata.credit_limit` | Total function over the four cases: mask only → `bank_review.product_meta_mask`; mask + cupo → `…_mask_cupo`; cupo only → `…_cupo`; neither → no meta line |
| Amount | `metadata.balance` | `formatClp`; **absent → no amount is rendered** (not `$0`, which would be a claim the store never made). Tone is `out` for `credit_card`, `neutral` otherwise (Assumption A6) |

Products are ordered by `type` (in the data model's declared order) then by `name`, so the list is
deterministic across reads and across fidelity captures.

### Decision 6 — *Sincronizar ahora* and *Actualizar credenciales* are navigations, not engines

This item mounts no WebView, imports nothing from `@finanzas/bank-scraper`, and never calls
`runSync`. Both CTAs write item #9's connect-flow store and navigate, exactly where the mockup's
own `onclick` sends them:

| CTA | Visible when | Action |
| --- | --- | --- |
| *Sincronizar ahora* | `bank-review` state `ok` | `chooseInstitution(institutionId)`, `enterFlow('settings')`, `router.push(SYNCING_ROUTE)` → `/(onboarding)/bank-syncing` |
| *Actualizar credenciales* | `bank-review` state `error` | `chooseInstitution(institutionId)`, `enterFlow('settings')`, `router.push('/(onboarding)/bank-credentials')` |

`enterFlow('settings')` is the whole of AC3's "without re-entering the RUT" story on this side of
the seam: item #9's form resolves the locked RUT from the secure store through `resolveLockedRut`
whenever a credential entry exists, and this path always arrives with one. Item #9's own Use Case
7 states the obligation explicitly and assigns the button to this item. The return trip is item
#9's `resolveExitHref('settings')` → `/settings/banks`, so the person lands back on the list and
`useFocusEffect` re-reads it.

*Sincronizar ahora* is safe to press at any time because BR5 makes a re-sync idempotent and item
#10's device lock refuses a second concurrent read as a value (`{ status: 'refused' }`), not an
error. The button is nonetheless rendered `muted` + `disabled` while `sync_status === 'syncing'`,
so the person is not invited into a refusal.

### Decision 7 — `disconnect-confirm` is a state of `/settings/banks`, reachable from both screens

The manifest declares three states on one route, so introducing `/settings/banks/disconnect`
would create a route file the manifest does not declare and break `route-manifest-parity.test.ts`
(the same reasoning as item #17's Decision 13 and item #19's Decision 7).

The complication is that the mockup's *Desconectar banco* button on `bank-review` also goes to
`settings-banks&state=disconnect-confirm` — the confirmation is on the **list** screen even when
it is asked for from the **detail** screen. The mechanism is a single route parameter:

- `/settings/banks` reads `useLocalSearchParams<{ disconnect?: string }>()`. When `disconnect`
  names a listed connection, the modal is open for that connection; otherwise it is closed.
- `settings-banks`'s own *Desconectar {bank}* button calls
  `router.setParams({ disconnect: connectionId })`.
- `bank-review`'s *Desconectar banco* calls
  `router.push({ pathname: '/settings/banks', params: { disconnect: connectionId } })`.
- *Cancelar*, a successful disconnect, and a `disconnect` value that matches no listed connection
  all clear it with `router.setParams({ disconnect: undefined })`, so returning to the screen
  later never reopens a stale modal.

No route file is added or removed, so `route-manifest-parity.test.ts` is unaffected. `Modal`'s
required `onRequestClose` is wired to the same clearing function as *Cancelar*, so a hardware back
press and the cancel button take the identical path.

### Decision 8 — the auto-sync toggle in the brief is not built, because nothing draws it and no column backs it

The brief lists *"the auto-sync toggle"* in scope. Three authorities say there is none:

1. The mockup draws an informational `mu-note` — *"Sincronizamos automáticamente al abrir la app si
   pasaron más de 6 horas desde la última vez."* — and no `mu-switch` anywhere on `bank-review`.
2. `docs/project/4-database-model.md`: *"**No `auto_sync` column.** … The per-connection toggle has
   been removed from `#screen=bank-review` so the mockups and the schema agree. If per-bank control
   is wanted later it belongs here as a real column."*
3. `BEHAVIOR.md` → `bank-review` lists two actions, neither of which is a toggle.

Non-negotiable 6 makes the mockup the contract, so the note is implemented as a note. Building a
toggle would additionally require a migration, and migrations are additive and irreversible on a
device — the wrong thing to add speculatively.

The note's *"6 horas"* is not a hard-coded literal: the catalogue string interpolates `{{hours}}`,
and the screen passes `AUTOMATIC_SYNC_INTERVAL_MS / 3_600_000` from item #10's
`src/features/sync/auto-sync.ts`. A unit test asserts the rendered value is `6`, so the copy and
the engine constant cannot drift apart silently. Re-introducing the toggle is recorded as
follow-up **F2**.

### Decision 9 — "sync history" is two timestamps shown separately, not a table

Brief AC1: *"The error state shows the last successful sync separately from the last attempt."*
The data model already answers this and explicitly rules out a history table (gap #8: *"**No sync
history.** Only `last_sync_at` + `sync_status`"*, with `last_success_at` added because *"`bank-review`
shows this separately"*). So this item adds **no migration and no table**. It renders:

| `bank-review` state | Header sub-line | Note |
| --- | --- | --- |
| `ok` | `last_success_at` as a relative time — *"Sincronizado hace 2 h"* | — |
| `error` | `last_success_at` as an absolute day + time — *"Última sincronización exitosa: ayer 21:14"* | the danger `Note` describing the **last attempt**'s failure (`last_error_*`), which `last_sync_at` timestamps |

The two facts are structurally separate: `last_success_at` drives the header, `last_error_code` /
`last_error_message` drive the note, and item #10 guarantees `markConnectionSyncing` never touches
`last_success_at`. A `.db.test.ts` writes a connection whose `last_sync_at` is newer than its
`last_success_at` and asserts the rendered model carries both, distinctly.

The state selector is total over `sync_status`: `'error'` → the `error` state; `'idle'`,
`'syncing'` and `'ok'` → the `ok` state, with *Sincronizar ahora* disabled while `'syncing'`. A
connection that has never synced successfully (`last_success_at is null`) renders the `ok` state
with `bank_review.never_synced` in place of the relative time — the manifest declares no third
state, and inventing one would break the fidelity contract's completeness rule.

### Decision 10 — the four `sync.errors.*` keys are defined here, and resolved through a total map

Item #10 stores an i18n **key** in `last_error_message` (its A7) and assigns the catalogue entries
to this item; item #11 keeps its own longer, screen-specific bodies under `bank_syncing.error.body.*`
and records the split in its A7. This item therefore ships exactly the four keys #10's
`composeFailureMessageKey` can emit, plus one defensive fallback:

```text
sync.errors.invalid_credentials
sync.errors.session_closed
sync.errors.network
sync.errors.parse_failed
sync.errors.unknown          ← rendered only when the stored value is none of the four
```

`resolveSyncErrorKey(connection)`, reading `lastErrorCode` and `lastErrorMessage`, is a total
function: it returns the key
for `lastErrorCode` when the code is one of item #10's four, otherwise `sync.errors.unknown`. It
**never** passes `lastErrorMessage` to `t()` unchecked — a stored string is treated as a claim to
be validated against the known set, not as a key to be resolved, so a corrupt or legacy row can
never render as a raw key or as bank-flavoured text. Tests cover all four codes, an unknown code,
a null code, and a `lastErrorMessage` containing planted bank text.

The Spanish for `invalid_credentials` is the mockup's own sentence, verbatim. The other three are
not drawn anywhere; they are written here in the mockup's register and listed as Assumption A4.

### Decision 11 — plural selection is a pure TypeScript function, not i18next's plural backend

The list needs *"1 banco · 3 productos"*, which is two independently pluralized counts. The i18n
runtime sets `keySeparator: false` and no existing test asserts anything about i18next's plural
resolution, so this plan does not rely on it. Instead:

- the catalogue carries explicit `…_one` / `…_other` keys, which satisfy the flat snake_case
  pattern the parity test enforces;
- a pure `pluralKey(base, count)` in the feature folder picks the suffix (`count === 1` → `_one`);
- the interpolation variable is `{{value}}`, **not** `{{count}}` — passing `count` to `t()` would
  hand control back to i18next's plural machinery and produce a doubly-suffixed lookup.

Spanish and English agree on the one/other boundary for these two nouns, so one selector serves
both catalogues. A unit test covers 0, 1 and 2 for both bases.

### Decision 12 — no new design-system primitive, and no `mu-class-map.ts` edit

Every `mu-*` class these two screens draw is owned by the time this item is implemented:

| Class group | Owner | Status at implementation time |
| --- | --- | --- |
| `mu-topbar`, `__btn`, `__title` | `ScreenTopBar` (#19) | `primitive` |
| `mu-bank`, `__logo`, `__name`, `mu-item__txt`, `mu-item__sub`, `mu-item__chev` | `BankRow` (#12) | `primitive` |
| `mu-item__icon`, `mu-item__title` | `ListRow` (#19) | `primitive` |
| `mu-card`, `--tight`, `mu-note`, `--danger`, `__icon`, `mu-badge`, `--ok`, `--danger`, `mu-btn`, `--outline`, `--ghost`, `--danger`, `mu-empty`, `__icon`, `mu-modal`, `__icon`, `mu-overlay`, `--center`, `mu-amount`, `--out`, `mu-h3`, `mu-p`, `mu-small`, `mu-mono` | Already `primitive` at `13cecd5` | `primitive` |
| `mu-scroll`, `mu-pad`, `mu-pad-b`, `mu-row`, `mu-btn-row`, `mu-btn-stack`, `mu-mt1`…`mu-mt5` | — | `utility` |

So this item adds no primitive, adds no `componentMetrics` group, does not touch `theme.ts`, does
not touch `mu-class-map.ts`, and adds no `DesignSystemGallery` section — the gallery's
bidirectional `ds.*` coverage test therefore stays green with no catalogue additions. The single
design-system edit is Decision 4's additive `badge` prop on `BankRow`. Step 8 of the
implementation-start re-verification confirms the table above against the live map before any
edit; if a class is still `deferred`, the implementer follows the live map and records the
difference in the PR body rather than flipping another item's class.

### Decision 13 — the five fidelity targets flip `planned` → `wired`, and preview mode needs no data

Item #47's Decision 2 makes the flip the concrete task each screen item inherits, and its
`coverage_sets` already carries this item's two screens. The five mappings become:

| `screen_id` | `state_id` | `app_file` | `deep_link` | `ready_test_id` |
| --- | --- | --- | --- | --- |
| `settings-banks` | `list` | `apps/mobile/app/settings/banks/index.tsx` | `finanzas:///settings/banks?fidelity=1&fidelityScreen=settings-banks&fidelityState=list` | `fidelity-settings-banks` |
| `settings-banks` | `empty` | same | `…&fidelityState=empty` | `fidelity-settings-banks` |
| `settings-banks` | `disconnect-confirm` | same | `…&fidelityState=disconnect-confirm` | `fidelity-settings-banks` |
| `bank-review` | `ok` | `apps/mobile/app/settings/banks/[bankId].tsx` | `finanzas:///settings/banks/banco-de-chile?fidelity=1&fidelityScreen=bank-review&fidelityState=ok` | `fidelity-bank-review` |
| `bank-review` | `error` | same | `…&fidelityState=error` | `fidelity-bank-review` |

`fixture` stays `seed-default` and no `max_mismatch_pct` is added — item #47's Decision 4 makes a
raised threshold a visible diff that needs a note, and this item raises nothing.

Two consequences worth stating:

- **Preview mode renders a fixed presentation and performs no read.** Connections and products are
  never seeded (item #10: *"Products, movements and connections are discovered by a sync and are
  never seeded"*), so `seed-default` contains no connection. Each route reads
  `useFidelityPreview()` and, when `active`, renders the named state from
  `src/features/banks/fidelity-presentation.ts` — a frozen, `__DEV__`-only fixture carrying the
  mockup's own sample values (Banco de Chile, three products, `••4821`, cupo `$2.500.000`). This
  is item #11's Decision 12 pattern.
- **The `ready_test_id` appears in the route file as a `fidelityTestId(...)` call.** The validator
  (`scripts/mobile-ui/fidelity-contract.mjs`, verified at lines 196-204) passes when the source
  contains either the literal string or a `fidelityTestId('<screen_id>')` call with a literal
  screen id. The routes use `testID={fidelityTestId('settings-banks')}` and
  `testID={fidelityTestId('bank-review')}`, and a unit test pins the literals
  (`expect(fidelityTestId('settings-banks')).toBe('fidelity-settings-banks')`) so a change to the
  helper cannot silently break the contract.

`[bankId]` is the **institution id** (`financial_institutions.id`, e.g. `banco-de-chile`, which is
also the scraper's `bankId`), not the connection id: it is stable, human-readable, deep-linkable
and unique by construction, because `(financial_institution_id)` is a unique index on
`user_financial_institutions`. The route resolves the connection through item #9's
`getConnectionByInstitution`, and renders `<Redirect href="/settings/banks" />` when there is no
connection or its status is `'disconnected'` — item #9's Decision 15 guard pattern.

---

## Assumptions

Every 🟡 this plan builds on, and every inference the mockup does not settle. `A1`-`A3` come
straight from `BEHAVIOR.md`'s 🟡 marks and are carried forward, as that document requires.

| # | Assumption | Basis | If wrong |
| --- | --- | --- | --- |
| A1 | 🟡 Disconnecting deletes the keychain entry and **keeps** downloaded movements | `BEHAVIOR.md` → `settings-banks`; brief AC2; BR3 | The whole item changes; this is the brief's central promise |
| A2 | 🟡 *Sincronizar ahora* is always safe | `BEHAVIOR.md` → `bank-review`; BR5; item #10's device lock returns `refused` as a value | Only the disabled-state rule in Decision 6 changes |
| A3 | 🟡 A credential failure routes to `bank-credentials` for re-entry | `BEHAVIOR.md` → `bank-review`; the mockup's own `onclick`; item #9 Use Case 7 | The `error` state's primary CTA changes destination |
| A4 | The Spanish for `session_closed`, `network` and `parse_failed` is written here, in the mockup's register; only `invalid_credentials` is drawn | The mockup draws one error body; item #10 defines four codes | Three catalogue strings change; no code changes |
| A5 | Product icons: `checking`/`sight`/`savings` → 🏦, `credit_card` → 💳, `credit_line` → 📈 | The mockup draws three of the five types; the other two are the same family as `checking` | One entry in a total map changes |
| A6 | A credit card's `metadata.balance` is the amount owed, so its `Amount` tone is `out`; every other type is `neutral` | The mockup draws `mu-amount--out` on the card row only | One entry in a total map changes |
| A7 | The list shows connections whose `status` is `'active'` or `'inactive'`, and hides `'disconnected'` | The mockup's *Desconectar* goes to `state=empty` with one bank connected; `'inactive'` has no writer in the campaign but is a declared value | The list predicate changes; nothing else |
| A8 | The row subtitle for a connection in error reads *"Error de sincronización"* | `#screen=home`'s bank row draws exactly that string for its `sync-error` state; `settings-banks` draws only the healthy variant | One catalogue string changes |
| A9 | The `disconnect-confirm` paragraph renders the bank name without the mockup's inline bold | React Native needs a nested `Text` for inline weight, which would fragment one sentence into three catalogue keys | A visible but sub-threshold fidelity delta; the alternative is three keys |
| A10 | The mockup's *"1 banco · 3 productos"*, *"hace 2 h"*, `••4821` and the three balances are sample data, not required values | Same convention item #19 recorded for its RUT and movement count | Nothing; no test asserts a sample value |
| A11 | `[bankId]` is the institution id | The manifest's own parameter name, the unique index, and the scraper's `bankId` | The deep links in Decision 13 change |

---

## Layer-by-Layer Changes

### Database / Data Layer

**No migration.** Every column these screens read already exists, and `disconnect` writes one
column that already exists. Non-negotiable 5 is not engaged.

- [ ] `apps/mobile/src/db/repositories/institutions.ts` — **modified** (Resolution R6). Add
      `listBankConnections(db): BankConnectionSummary[]`: one row per `user_financial_institutions`
      row whose `status` is `'active'` or `'inactive'` (Assumption A7), joined to
      `financial_institutions` for `name` and the `short_name` / `brand_color` read through the
      existing `parseInstitutionMetadata` guard, plus a `COUNT` of its `user_financial_products`.
      Carries `id`, `institutionId`, `name`, `shortName`, `brandColor`, `logoUrl`, `status`,
      `syncStatus`, `lastSyncAt`, `lastSuccessAt`, `lastErrorCode`, `lastErrorMessage`,
      `productCount`. Ordered by `created_at`. `disconnectInstitution`,
      `getConnectionByInstitution`, `getConnection` and `listConnectedBankSummaries` are
      **consumed unchanged**.
- [ ] `apps/mobile/src/db/repositories/products.ts` — **modified** (the file item #10 creates; see
      re-verification step 3). Add
      `listProductsForConnection(db, userFinancialInstitutionId): BankProductSummary[]`, carrying
      `id`, `externalId`, `type`, `name`, `currencyCode` and the parsed `ProductMetadata`
      (`balance`, `mask`, `credit_limit`, `available_credit`) through the existing
      `parseProductMetadata` guard. Ordered by `type` in the data model's declared order, then by
      `name`.
- [ ] `apps/mobile/src/db/types.ts` — **modified**: add `BankConnectionSummary` and
      `BankProductSummary` so no caller sees a Drizzle row shape. Item #8's
      `ConnectedBanksSummary`, item #9's `ConnectedBankSummary` and item #10's `SyncConnection`
      coexist with them; converging the readers is item #9's already-recorded follow-up F2.
- [ ] **Seed data: none.** Connections and products are discovered by a sync and are never seeded
      (item #10). See [Seed Data](#seed-data).

### Backend / API

- [ ] **None — there is no backend.** Both screens read the device's own store and the one write
      they perform is a local `UPDATE` plus a keychain delete.

### Shared Packages / Libraries

- [ ] **None.** `@finanzas/shared-utils` already exports `formatClp`, `formatTimeOfDay`,
      `formatShortDate`, `deriveDateLocal` and `differenceInDays`, which is everything the two
      screens format. `@finanzas/shared-domain` is not touched: nothing here is a domain rule —
      no inclusion is evaluated and no money is aggregated. `@finanzas/bank-scraper` is not
      imported, not even type-only (Decision 6).

### Frontend / UI — new files

`apps/mobile/src/features/banks/` (new folder):

- [ ] `types.ts` — `BankConnectionListItem`, `BankReviewModel`, `BankProductView`,
      `BankReviewState` (`'ok' | 'error'`), `DisconnectOutcome`.
- [ ] `connection-view.ts` — pure: `resolveConnectionListItem(connection, nowInstant)`,
      `resolveBankReviewState(connection)`, `resolveSyncTimeKey(descriptor, prefix)`,
      `summarizeConnections(connections)`, `pluralKey(base, count)` (Decisions 3, 9, 11). Composes
      item #12's `describeSyncTime` (Resolution R2) and `@finanzas/shared-utils`'s
      `formatTimeOfDay` / `formatShortDate`. No React, no SQL.
- [ ] `sync-error-copy.ts` — pure: `SYNC_ERROR_KEYS`, `resolveSyncErrorKey(connection)`
      (Decision 10).
- [ ] `product-view.ts` — pure: `PRODUCT_TYPE_ICON`, `PRODUCT_TYPE_ORDER`, `toProductView(product)`
      (Decision 5). Takes `formatClp` as an injected formatter so the pure module never imports a
      locale-dependent default.
- [ ] `disconnect-bank.service.ts` — `disconnectBank(deps, input)`, the ordered sequence of
      Decision 2. No React, no module-level singleton, no `console.` call, and no error message
      that interpolates a credential or a key.
- [ ] `use-bank-connections.ts` — the list hook plus the exported, hook-free
      `loadBankConnections({ getAppDatabase, isCancelled })` (Decision 3).
- [ ] `use-bank-review.ts` — the detail hook plus `loadBankReview({ getAppDatabase, institutionId,
      isCancelled })`, composing `getConnectionByInstitution` + `listProductsForConnection`.
- [ ] `use-disconnect-bank.ts` — the React wrapper: builds `deps` from `getAppDatabase()` and item
      #9's Expo secure-store adapter, guards re-entrancy (a second press while a disconnect is in
      flight is a no-op), and returns `{ run, status }`.
- [ ] `fidelity-presentation.ts` — the frozen `__DEV__`-only presentations for the five preview
      states (Decision 13). Contains no credential, no key and no real data.
- [ ] `state-coverage.ts` — `BANKS_STATE_COVERAGE`: for each of the two screen ids, every manifest
      `state_id` mapped to the source file that renders it and the test that asserts it.
- [ ] `components/ConnectedBankRow.tsx` — composes item #12's `BankRow` with the settings subtitle
      and the trailing `Badge` (Decision 4).
- [ ] `components/DisconnectConfirmModal.tsx` — the `Modal` for `disconnect-confirm` (Decision 7).
- [ ] `components/BankStatusCard.tsx` — `bank-review`'s header card: logo, name, sub-line, badge.
- [ ] `components/BankProductRow.tsx` — the `Card variant="tight"` product row (Decision 5).

### Frontend / UI — modified files

- [ ] `apps/mobile/app/settings/banks/index.tsx` — replaces `RoutePlaceholder`. Reads
      `useFidelityPreview()` and `useLocalSearchParams`, calls `useBankConnections()`, and composes
      `ScreenTopBar` + the summary line + `ConnectedBankRow`s + the two buttons, or `EmptyState`
      when there are no connections, plus `DisconnectConfirmModal`. Carries
      `testID={fidelityTestId('settings-banks')}` on its root view. No SQL, no business logic, no
      literal copy.
- [ ] `apps/mobile/app/settings/banks/[bankId].tsx` — replaces `RoutePlaceholder`. Reads
      `useFidelityPreview()` and the `bankId` param, calls `useBankReview(bankId)`, redirects to
      `/settings/banks` when there is no live connection, and composes `ScreenTopBar` +
      `BankStatusCard` + the error `Note` + the products section + the auto-sync `Note` + the
      button stack. Carries `testID={fidelityTestId('bank-review')}` on its root view.
- [ ] `apps/mobile/src/components/ui/BankRow.tsx` — **modified**: one optional
      `badge?: { tone: BadgeTone; label: string }` prop (Decision 4). Existing call sites are
      unaffected. No new barrel export beyond the prop type already exported with `BankRowProps`.
- [ ] `apps/mobile/src/i18n/es.json` and `en.json` — **modified**: the `settings_banks.*`,
      `bank_review.*` and `sync.errors.*` keys of the **Copy inventory** table under *Seed Data*.
      Spanish comes verbatim from the mockup where the mockup draws it.
- [ ] `apps/mobile/eslint.config.mjs` — **modified**: `no-console: 'error'` for
      `src/features/banks/**`, matching what item #9 sets for `src/features/connect-bank/**` and
      item #11 for `src/features/bank-syncing/**` (BR1).
- [ ] `apps/mobile/jest.config.js` — **only if items #12/#9/#13/#16 have not already added them**:
      the two additive lines of Resolution R5. No third project.
- [ ] `scripts/mobile-ui/fidelity-targets.json` — **R4-contingent**: flip this item's five
      mappings from `planned` to `wired` per Decision 13's table.
- [ ] `apps/mobile/src/test-utils/mu-class-map.ts` — **not modified** (Decision 12).
- [ ] `apps/mobile/src/theme.ts` — **not modified** (Decision 12).
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — **not modified**: this item adds no
      primitive.
- [ ] `apps/mobile/src/test-utils/route-inventory.ts` — **not modified**: this item adds no
      `__DEV__` route. The five preview states are reached through the existing routes'
      `useFidelityPreview()` deep links, so no fixture route is needed.

### Infrastructure / Configuration

- [ ] **No new dependency, no lockfile change, no CI workflow change.** Every module this item
      imports is already a dependency of `apps/mobile` or ships in a sibling item.

### Executable workflow shell snippets

- [ ] **None.** This plan adds no executable shell guidance to a framework-owned surface; the
      commands it names are existing `pnpm`, `git` and `gh` invocations run verbatim.

---

## Concurrency Safety Checklist

The classifier applies: two async reads (`loadBankConnections`, `loadBankReview`) race screen
teardown and a focus-driven re-read, the disconnect mutation writes the same connection row that
item #10's app-open sweep may be writing, and both storage systems are reached from the same
handler.

- **Shared mutable state guards** — the only shared mutable state this item introduces is each
  hook's `useState`, written from exactly one async continuation and guarded by that run's
  `isCancelled()` closure. The database handle itself is item #8's module-level memo, not this
  item's to guard. The connection row is guarded by SQLite's own statement atomicity: this item
  writes one column of one row with one `UPDATE`, and item #10 writes the sync columns inside its
  own transaction, so the two never interleave a partial state.
- **Re-entrancy / in-flight tracking** — yes, twice. (a) A focus event can bump `reloadToken` while
  a read is in flight: the superseded run's `isCancelled()` flips in the effect's cleanup and its
  result is discarded rather than `setState`d. (b) A second press of *Desconectar* can arrive
  before the first settles: `useDisconnectBank` holds a `status` of
  `'idle' | 'running' | 'failed'` and returns early while `'running'`, so the ordered sequence
  never runs twice concurrently. The `Modal`'s confirm button is also `disabled` while `'running'`.
- **Event deduplication** — the only event that can fire more than once for the same intent is
  focus (fast tab/back cycling). A duplicate focus produces a duplicate read, which is idempotent
  and cheap: the last run to finish wins and every earlier one is discarded by its cancellation
  guard. The disconnect sequence is itself idempotent (Decision 2), so even a duplicate that
  escaped the in-flight guard would converge on the same state.
- **Listener and resource cleanup** — `useFocusEffect` and `useEffect` return their own cleanups;
  the effect cleanup sets `cancelled = true`. There are **no timers, no subscriptions and no
  event emitters** in this item — a test asserts `src/features/banks/**` contains no `setTimeout`,
  `setInterval` or `addEventListener`. An in-flight disconnect at unmount is deliberately **not**
  aborted: its two writes must complete for the state to be coherent, and neither of them
  `setState`s after the guard flips.
- **Race conditions at initialization** — a focus event can arrive before `getAppDatabase()`
  resolves. The `await` is inside the guarded run, so a pre-resolution focus simply queues a second
  run; the first one to complete after the handle resolves sets state, and the other is discarded.
  If the handle rejects, the stored rejection is re-thrown during render, reaching the route's
  `ErrorBoundary` rather than becoming an unhandled rejection.
- **Race conditions at teardown** — yes: navigating away mid-read. Every `setState` is behind
  `isCancelled()`, so a late result is dropped silently. A disconnect that settles after teardown
  writes its two stores and drops its result; the next mount re-reads the truth.
- **Error propagation across async boundaries** — read failures become
  `{ status: 'error', error }` and are re-thrown **during render** (item #12's precedent), so they
  reach the `ErrorBoundary`. Disconnect failures are **values**, not throws:
  `DisconnectOutcome.status === 'failed'` carries the stage, and the screen renders a danger `Note`
  with a retry affordance. No error message in this item interpolates a credential, a key or a
  bank response — the failure surface is a two-value enum.
- **New concurrent patterns** — none. Both the cancellation-guarded read and the in-flight
  mutation guard already exist in the codebase's plans (items #8, #9, #12); this item introduces
  no pattern the campaign has not already reviewed.

### Parser-risk classification

**Not applicable.** This item adds no file under `scripts/lint/`, `scripts/parse/` or a comparable
scanner directory, introduces no module whose responsibility is lint/parser/scanner/tokenizer
work, and describes no regex-heavy scanning or structured-text parsing. The two source-scanning
tests it adds (`no-credential-values.test.ts`, the no-`DELETE` assertion) are substring checks over
a fixed file list with no grammar, no state machine and no user-supplied pattern; they are
assertions, not parsers.

### Cross-cutting checklist classification

**Not applicable.** This item adds no checklist category to `REVIEW.md`, to any protocol, or to
any agent or skill file, and changes no acceptance criterion that other plans must satisfy. It is
a product screen pair.

---

## Testing Strategy

**Test types**: Unit (pure functions and components, `app` project) · Integration over a real
in-memory SQLite store (`db` project, via the `*.db.test.ts` convention) · Smoke (runbook) ·
Design fidelity (R4-contingent).

### Test files

| File | Jest project | What it proves |
| --- | --- | --- |
| `apps/mobile/src/features/banks/__tests__/connection-view.test.ts` | `app` | The list item, review state, sync-time key and plural selectors are total over every input |
| `apps/mobile/src/features/banks/__tests__/sync-error-copy.test.ts` | `app` | `resolveSyncErrorKey` is total: four codes, an unknown code, a null code, and a `lastErrorMessage` carrying planted bank text |
| `apps/mobile/src/features/banks/__tests__/product-view.test.ts` | `app` | Icon map, meta-line cases (mask only / mask + cupo / cupo only / neither), amount tone, and the absent-balance case |
| `apps/mobile/src/features/banks/__tests__/auto-sync-note.test.ts` | `app` | The rendered note's `{{hours}}` equals `AUTOMATIC_SYNC_INTERVAL_MS / 3_600_000` (Decision 8's drift guard) |
| `apps/mobile/src/features/banks/__tests__/state-coverage.test.ts` | `app` | `BANKS_STATE_COVERAGE` is set-equal to the manifest's states for both screens |
| `apps/mobile/src/features/banks/__tests__/no-credential-values.test.ts` | `app` | No file under `src/features/banks/**` calls `readCredentials`, `getItem` or `console.`, and none contains `setTimeout` / `setInterval` / `addEventListener` |
| `apps/mobile/src/features/banks/__tests__/settings-banks-screen.test.tsx` | `app` | All three `settings-banks` states render; the confirm modal opens from the param and closes on cancel; the error row's accessible name ends with the error status label |
| `apps/mobile/src/features/banks/__tests__/bank-review-screen.test.tsx` | `app` | Both `bank-review` states render; the CTA set differs by state; *Sincronizar ahora* is disabled while `syncing`; a missing connection redirects |
| `apps/mobile/src/features/banks/__tests__/disconnect-bank.db.test.ts` | `db` | Decision 2's ordered sequence over a real in-memory store and a fake port — see the scenario map |
| `apps/mobile/src/features/banks/__tests__/read-bank-data.db.test.ts` | `db` | `listBankConnections` and `listProductsForConnection` against seeded rows, including the separate-timestamps case |
| `apps/mobile/src/lib/__tests__/fidelity-preview.test.ts` (existing, item #47) | `app` | Extended with the two literal pins of Decision 13 |

### Scenario map

| # | Scenario | Maps to | File |
| --- | --- | --- | --- |
| 1 | The list renders one row per `active`/`inactive` connection, with its product count, and hides `disconnected` rows | Brief scope; A7 | `read-bank-data.db.test.ts` |
| 2 | The summary line reads *"N banco(s) · M producto(s)"* with correct plural selection at 0, 1 and 2 | Decision 11 | `connection-view.test.ts` |
| 3 | With no connection, the `empty` state renders with its CTA to the picker | Manifest state `empty` | `settings-banks-screen.test.tsx` |
| 4 | *Desconectar {bank}* opens the confirm modal; *Cancelar* closes it and clears the param | Manifest state `disconnect-confirm`; Decision 7 | `settings-banks-screen.test.tsx` |
| 5 | Confirming a disconnect deletes the keychain entry, sets `status = 'disconnected'`, and leaves the product and transaction counts **unchanged** | **Brief AC2**; Decisions 1, 2 | `disconnect-bank.db.test.ts` |
| 6 | A keychain delete failure leaves `status` untouched and returns `stage: 'credential'` | Decision 2 | `disconnect-bank.db.test.ts` |
| 7 | A second confirm press while the first is in flight is a no-op | Concurrency checklist | `settings-banks-screen.test.tsx` |
| 8 | Disconnecting twice converges on the same state | Decision 2's idempotence | `disconnect-bank.db.test.ts` |
| 9 | After disconnect, `isDueForAutomaticSync` returns false for that connection | *"dejaremos de sincronizar"* | `disconnect-bank.db.test.ts` |
| 10 | No file in the feature issues a `DELETE` against a table | Decision 1; BR3 | `no-credential-values.test.ts` |
| 11 | `bank-review` `ok` renders the relative last-success time, the products, the auto-sync note, *Sincronizar ahora* and *Desconectar banco* | Manifest state `ok` | `bank-review-screen.test.tsx` |
| 12 | `bank-review` `error` renders the absolute last-**successful** sync, the danger note for the stored code, *Actualizar credenciales* and *Desconectar banco*, and **not** *Sincronizar ahora* | **Brief AC1**; Manifest state `error` | `bank-review-screen.test.tsx` |
| 13 | A connection whose `last_sync_at` is newer than its `last_success_at` surfaces both, distinctly | **Brief AC1**; Decision 9 | `read-bank-data.db.test.ts` |
| 14 | Each of the four `last_error_code` values selects its own catalogue key; an unknown value selects `sync.errors.unknown`; a `lastErrorMessage` with planted bank text is never rendered | Decision 10; BR1 | `sync-error-copy.test.ts` |
| 15 | *Actualizar credenciales* sets `entryOrigin: 'settings'` and the chosen institution before navigating to the credential form | **Brief AC3**; Decision 6 | `bank-review-screen.test.tsx` |
| 16 | *Sincronizar ahora* navigates to `SYNCING_ROUTE` and is disabled while `sync_status === 'syncing'` | Decision 6; A2 | `bank-review-screen.test.tsx` |
| 17 | Products render mask, cupo and balance from `metadata`; a product without a balance renders no amount | Decision 5 | `product-view.test.ts` |
| 18 | Requesting `[bankId]` with no live connection redirects to `/settings/banks` | Decision 13 | `bank-review-screen.test.tsx` |
| 19 | A superseded read never sets state after teardown | Concurrency checklist | `settings-banks-screen.test.tsx` |
| 20 | Every manifest state of both screens is present in `BANKS_STATE_COVERAGE` | Non-negotiable 6 | `state-coverage.test.ts` |
| 21 | `fidelityTestId('settings-banks')` and `fidelityTestId('bank-review')` equal the two `ready_test_id` literals | Decision 13 | `fidelity-preview.test.ts` |

**Smoke test runbook**:
[`docs/testing/mobile/20-settings-banks-bank-review.smoke-test.md`](../../../testing/mobile/20-settings-banks-bank-review.smoke-test.md)

**Regression suite**: the repository's automated suites are `pnpm test` (Jest) and `pnpm fidelity`
(R4-contingent). Both are covered above; there is no separate end-to-end regression project to
extend. `.maestro/` exists but carries no flow for these screens and none is added here.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Connections, products, movements | **None seeded.** They are discovered by a sync and never seeded (item #10's *Seed Data* section) | — |
| `financial_institutions` | Already seeded by item #3 — `banco-de-chile` with `short_name: "BCH"` and `brand_color: "#003da5"`, the two values `settings-banks` and `bank-review` draw the monogram from | `apps/mobile/src/db/seeds/catalogue.ts` (unchanged) |
| Test fixtures for the `db` tier | Built in-test: one `active` connection with three `user_financial_products` (`checking` with `balance`/`mask`; `credit_card` with `balance`/`mask`/`credit_limit`; `credit_line` with `credit_limit` and a zero `balance`) and a handful of `transactions` under them, so Scenario 5 has something to prove survives | `apps/mobile/src/features/banks/__tests__/disconnect-bank.db.test.ts`, `…/read-bank-data.db.test.ts` |
| Fidelity preview presentations | Frozen `__DEV__`-only fixtures carrying the mockup's own sample values | `apps/mobile/src/features/banks/fidelity-presentation.ts` |
| Smoke-test data | Produced by running item #9's connect flow against item #11's `__DEV__` scripted runner, so no real bank credential is needed for any step except the optional real-bank ones | see the runbook's *Test Data* |

### Copy inventory (`apps/mobile/src/i18n/es.json` + `en.json`)

Spanish is the mockup's, verbatim where the mockup draws it; English is a faithful translation.
Flat, lowercase, snake_case, identical key sets — `catalogue-parity.test.ts` enforces the shape.

| Key | Spanish | Drawn by the mockup? |
| --- | --- | --- |
| `settings_banks.title` | Bancos conectados | Yes |
| `settings_banks.summary` | `{{banks}} · {{products}}` | Yes (composition) |
| `settings_banks.bank_count_one` / `_other` | `{{value}} banco` / `{{value}} bancos` | Yes (singular) |
| `settings_banks.product_count_one` / `_other` | `{{value}} producto` / `{{value}} productos` | Yes (plural) |
| `settings_banks.synced_minutes` | Sincronizado hace `{{value}}` min | Inferred from the `hours` variant |
| `settings_banks.synced_hours` | Sincronizado hace `{{value}}` h | Yes |
| `settings_banks.synced_yesterday` | Sincronizado ayer `{{time}}` | Inferred |
| `settings_banks.synced_date` | Sincronizado el `{{date}}` | Inferred |
| `settings_banks.never_synced` | Sin sincronizar | Inferred |
| `settings_banks.sync_error` | Error de sincronización | From `#screen=home` (A8) |
| `settings_banks.status_ok` / `status_error` | Al día / Error | From `bank-review`'s badges (accessible names) |
| `settings_banks.badge_ok` | ✓ | Yes |
| `settings_banks.add_bank` | + Conectar nuevo banco | Yes |
| `settings_banks.disconnect_named` | Desconectar `{{bank}}` | Yes |
| `settings_banks.empty_title` | No hay bancos conectados | Yes |
| `settings_banks.empty_body` | Conecta tu primer banco para comenzar a gestionar tus finanzas. | Yes |
| `settings_banks.empty_cta` | Conectar primer banco | Yes |
| `settings_banks.disconnect_title` | Desconectar banco | Yes |
| `settings_banks.disconnect_body` | ¿Desconectar `{{bank}}`? Eliminaremos las credenciales del dispositivo y dejaremos de sincronizar. Tus movimientos ya descargados se mantienen. | Yes (A9) |
| `settings_banks.disconnect_cancel` / `disconnect_confirm` | Cancelar / Desconectar | Yes |
| `settings_banks.disconnect_failed` | No pudimos completar la desconexión. Inténtalo de nuevo. | Inferred (Decision 2) |
| `bank_review.badge_ok` / `badge_error` | Al día / Error | Yes |
| `bank_review.synced_minutes` / `_hours` / `_yesterday` / `_date` | as the `settings_banks` variants | Yes (`hours`) |
| `bank_review.last_success_yesterday` | Última sincronización exitosa: ayer `{{time}}` | Yes |
| `bank_review.last_success_date` | Última sincronización exitosa: `{{date}}` `{{time}}` | Inferred |
| `bank_review.never_synced` | Sin sincronizaciones exitosas | Inferred |
| `bank_review.products_title` | Productos | Yes |
| `bank_review.product_meta_mask` | ••`{{mask}}` | Yes |
| `bank_review.product_meta_mask_cupo` | ••`{{mask}}` · cupo `{{cupo}}` | Yes |
| `bank_review.product_meta_cupo` | cupo `{{cupo}}` | Inferred |
| `bank_review.auto_sync_note` | Sincronizamos automáticamente al abrir la app si pasaron más de `{{hours}}` horas desde la última vez. | Yes (Decision 8) |
| `bank_review.update_credentials` | Actualizar credenciales | Yes |
| `bank_review.sync_now` | Sincronizar ahora | Yes |
| `bank_review.disconnect` | Desconectar banco | Yes |
| `sync.errors.invalid_credentials` | El banco rechazó las credenciales. Puede que hayas cambiado tu clave de internet. Vuelve a ingresarla para reanudar la sincronización. | Yes |
| `sync.errors.session_closed` | El banco cerró la sesión antes de terminar. Vuelve a intentarlo. | Inferred (A4) |
| `sync.errors.network` | No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo. | Inferred (A4) |
| `sync.errors.parse_failed` | No pudimos leer los datos del banco. Inténtalo más tarde. | Inferred (A4) |
| `sync.errors.unknown` | No pudimos completar la última sincronización. | Inferred (Decision 10) |

---

## Documentation Updates

To be executed by the developer **after** implementation, not now:

- [ ] `design/mockups/mobile/BEHAVIOR.md` — under `settings-banks` and `bank-review`, record the
      three implementation facts the document does not yet carry: `[bankId]` is the institution id
      (A11); the `disconnect-confirm` state is reachable from **both** screens and lives on
      `/settings/banks` (Decision 7); and *"sincronizar ahora"* hands off to `bank-syncing` rather
      than syncing in place (Decision 6). Do **not** clear the 🟡 marks — that is LH's call.
- [ ] `docs/project/1-business-domain.md` — extend the **Bank connection** entity paragraph with
      the disconnect semantics: disconnecting removes the keychain entry and marks the connection
      `disconnected`; products and movements are retained, coherent with BR3.
- [ ] `docs/project/4-database-model.md` — no schema change, but add to the
      `user_financial_institutions` section that `status = 'disconnected'` is written **only** by
      the settings disconnect action and that the row is never deleted, naming the cascade as the
      reason.
- [ ] `AGENTS.md` — add one Troubleshooting row: *"Movements disappeared after disconnecting a
      bank → something deleted the `user_financial_institutions` row. Disconnect is a status
      transition; the two `ON DELETE cascade` chains make deletion destroy every movement."*
- [ ] `docs/project/3-software-architecture.md` — **verify only.** Line 104 still describes hooks
      as *"`src/features/*/queries.ts` wrap TanStack Query"*, which item #8 queued for correction.
      If item #8's correction has landed, no edit; if it has not, report it to the parent
      orchestrator rather than fixing another item's queued edit here.
- [ ] `docs/best-practices/stack/expo-react-native.md` — same verify-only treatment, for the same
      queued correction.
- [ ] `docs/project/2-repo-architecture.md` — **none.** It describes `features/` generically
      (*"One folder per domain area"*) and does not enumerate the folders.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| An implementer deletes the connection row instead of flipping `status`, silently destroying every movement | Low | **Critical, irreversible on a device** | Decision 1 states the cascade explicitly; Scenario 5 counts movements before and after; Scenario 10 asserts the feature contains no `DELETE` |
| Six sibling items must merge first; the implementation is dispatched too early | Medium | High — wasted cycle | The dependency table marks each one Blocking/not, and re-verification step 1 stops before the first file edit |
| The keychain delete succeeds and the status flip fails, leaving an `active` connection with no credential | Low | Medium | Decision 2 makes this the *chosen* residue, keeps the row visible with a failure `Note`, and makes the action re-runnable; Scenario 6 covers it |
| Item #12's `BankRow` ships with a different trailing-slot API than Decision 4 assumes | Medium | Low | Re-verification step 7 reads the shipped surface first and uses whatever slot exists |
| Item #10 changes `isDueForAutomaticSync` so a `disconnected` connection is still eligible | Low | High — the disconnect promise breaks | Re-verification step 4 checks the predicate and **stops** rather than patching #10 silently |
| `router.setParams` behaves differently on the installed `expo-router` version | Low | Medium | Re-verification step 11; the fallback is a module-scoped pending-disconnect store, which needs no route param |
| Item #47 has not merged, so the five targets cannot be flipped | Medium | Low | Resolution R4: the flip is conditional and the manual side-by-side stays in the runbook either way |
| The `disconnect-confirm` fidelity capture exceeds its 3% default threshold because of A9's missing inline bold | Low | Low | The delta is the glyph strokes of one short phrase inside a modal; if it does trip, the fix is the three-key split, **not** a raised threshold (item #47 Decision 4) |

---

## Follow-ups (explicitly out of scope)

- **F1** — promote item #12's `describeSyncTime` from `src/features/home/relative-time.ts` to
  `src/lib/relative-time.ts` when a third consumer appears (Resolution R2).
- **F2** — a per-connection auto-sync toggle, if it is ever wanted: it needs an `auto_sync` column,
  a migration, a mockup state and a `BEHAVIOR.md` entry, in that order (Decision 8).
- **F3** — converging `ConnectedBanksSummary` (#8), `ConnectedBankSummary` (#9), `SyncConnection`
  (#10) and `BankConnectionSummary` (this item) into one reader. Already recorded as item #9's
  follow-up F2; this item adds the fourth shape and inherits the debt rather than resolving it
  mid-campaign.
- **F4** — a `disconnected` connections section on `settings-banks` ("bancos desconectados"), so a
  person can see that their history came from a bank they no longer sync. The mockup draws no such
  section, so it is not built (A7).

---

## Code Samples

All code in this document is marked *Illustrative — adapt during implementation*. The only sample
is Decision 2's `disconnectBank`, included because the **order** of its two writes is the item's
central guarantee and prose alone leaves it ambiguous. Everything else is described by signature
and contract, to be written in the implementation PR.

---

## Implementation Order

1. **Re-verify.** Run the eleven implementation-start checks above and record each result in the
   PR body. Stop on any `Stale or conflicting`.
2. **Jest routing (R5-contingent).** If `apps/mobile/jest.config.js` lacks item #12's two lines,
   add them exactly as #12 specifies. Verify: `grep -n 'db.test.ts' apps/mobile/jest.config.js`
   shows both the `testMatch` entry and the `testPathIgnorePatterns` entry.
3. **Repository reads.** Add `listBankConnections` to
   `apps/mobile/src/db/repositories/institutions.ts`, `listProductsForConnection` to
   `apps/mobile/src/db/repositories/products.ts`, and the two types to
   `apps/mobile/src/db/types.ts`. Write `read-bank-data.db.test.ts` alongside (Scenarios 1, 13).
   Verify: `pnpm --filter @finanzas/mobile test -- read-bank-data` passes.
4. **The disconnect service.** Write `disconnect-bank.service.ts` and
   `disconnect-bank.db.test.ts` (Scenarios 5, 6, 8, 9). Verify: the test prints the before/after
   product and transaction counts and they are equal.
5. **Pure view logic.** `types.ts`, `connection-view.ts`, `sync-error-copy.ts`, `product-view.ts`,
   `state-coverage.ts`, and their three unit test files (Scenarios 2, 14, 17, 20).
6. **Copy.** Add every key of the copy inventory to `es.json` and `en.json`. Verify:
   `pnpm --filter @finanzas/mobile test -- catalogue-parity` passes.
7. **`BankRow`'s badge prop.** Add the optional `badge` prop (Decision 4) and confirm every
   existing `BankRow` call site still type-checks unchanged.
8. **Feature hooks and components.** `use-bank-connections.ts`, `use-bank-review.ts`,
   `use-disconnect-bank.ts`, `fidelity-presentation.ts`, and the four components.
9. **Routes.** Rewrite `apps/mobile/app/settings/banks/index.tsx` and
   `apps/mobile/app/settings/banks/[bankId].tsx`, including `useFidelityPreview()` and the
   `fidelityTestId(...)` `testID`s (R4-contingent for the import). Write the two screen tests and
   `no-credential-values.test.ts` (Scenarios 3, 4, 7, 10, 11, 12, 15, 16, 18, 19).
10. **Fidelity targets (R4-contingent).** Flip the five mappings per Decision 13's table and add
    the two literal pins to `fidelity-preview.test.ts` (Scenario 21). Verify:
    `pnpm fidelity:contract` passes. If `scripts/mobile-ui/` is absent, skip this step and say so
    in the PR body.
11. **Lint boundary.** Add `no-console: 'error'` for `src/features/banks/**` to
    `apps/mobile/eslint.config.mjs`. Verify: `pnpm lint` passes.
12. **Full verification.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:layout`, and
    `pnpm fidelity --issue 20` when step 10 ran. Paste the residual-verification evidence table's
    four artefacts into the PR body.
13. **Walk the runbook** at
    `docs/testing/mobile/20-settings-banks-bank-review.smoke-test.md`, including the side-by-side
    comparison against `design/mockups/mobile/index.html`.
14. **Project docs.** Execute the *Documentation Updates* section above.
15. **CHANGELOG.** Add under `[Unreleased]`, in the project's `**Bold Title** (#N):` format:

    ```markdown
    - **Settings: connected banks and bank review** (#20): the connected-banks list with its empty
      state, per-bank detail with products, balances and cupo, manual re-sync and credential
      update hand-offs, and disconnection — which deletes the keychain entry and keeps every
      downloaded movement.
    ```

---

## Document Quality Gate

- Spec/brief coverage: **Checked** — the brief has three checkbox acceptance criteria plus a
  side-by-side requirement. AC1 → Decision 9, Scenarios 12-13, runbook Step 5. AC2 → Decisions 1-2,
  Scenarios 5-6, 8-10, runbook Step 6. AC3 → Decision 6, Scenario 15, runbook Step 7. The
  side-by-side requirement → runbook Step 9 and Decision 13. Every brief scope noun is mapped:
  list, empty state, per-bank detail, products/balances/cupo, sync history (Decision 9), manual
  re-sync (Decision 6), credential update (Decision 6), disconnection (Decisions 1-2, 7), and the
  auto-sync toggle (Decision 8 — explicitly not built, with three authorities cited).
- Implementation-order consistency: **Checked** — the file list, the Layer-by-Layer bullets, the
  test-file table and the fifteen ordered steps name the same paths and the same symbols. Repeated
  identifiers were cross-read: `listBankConnections`, `listProductsForConnection`,
  `BankConnectionSummary`, `BankProductSummary`, `disconnectBank`, `DisconnectOutcome`,
  `resolveSyncErrorKey`, `toProductView`, `BANKS_STATE_COVERAGE`, `ConnectedBankRow`,
  `BankProductRow`, `apps/mobile/src/features/banks/`, `/settings/banks`,
  `/settings/banks/[bankId]`, `fidelity-settings-banks`, `fidelity-bank-review`, and Decision
  indices 1-13. The component `ConnectedBankRow` and the type `BankConnectionSummary` were named
  apart deliberately so no section can read as the other.
- Verification support: **Checked** — every claim about existing behaviour (the cascade, the
  status vocabulary, the absent `auto_sync` column, the absent history table, `isDueForAutomaticSync`'s
  `'active'` requirement, the fidelity target list, the validator's `ready_test_id` rule, the
  owner-must-be-a-barrel-export rule) cites a Verification Log row with the exact command and
  result.
- Behavioural guarantees: **Checked** — *movements survive a disconnect* is enforced by the
  status-only write plus Scenario 5's counts; *idempotence* by two no-op-safe writes plus Scenario
  8; *automatic syncing stops* by item #10's `status === 'active'` predicate plus Scenario 9;
  *at most one disconnect in flight* by `useDisconnectBank`'s status guard plus Scenario 7; *no
  credential in a log* by the `no-console` rule plus the scan test.
- Complex workflow decision-gate matrix: **Not applicable** — this plan adds and modifies no
  workflow decision gate, no protocol, no status label and no mirrored workflow surface. It is a
  product screen pair in an application repository.
- Parser/API/concurrency checklist: **Concurrency checked, parser not applicable, cross-cutting
  checklist not applicable** — the seven-item concurrency checklist is answered above with a design
  decision per item; the parser-risk and cross-cutting classifications each carry a written
  rationale in their own subsections.
- CHANGELOG literal format: **Checked** — Implementation Order step 15 carries the entry in the
  project's `**Bold Title** (#N):` format, ready to copy verbatim.
- Not-applicable rationale: **Checked** — every skipped category (parser-risk, cross-cutting
  checklist, decision-gate matrix, backend layer, shared packages, seed data, new dependencies,
  `mu-class-map.ts`, `theme.ts`, gallery, route inventory) states why in place.
