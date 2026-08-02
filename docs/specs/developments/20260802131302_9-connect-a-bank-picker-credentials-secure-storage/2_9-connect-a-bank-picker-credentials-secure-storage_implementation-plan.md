# Connect a Bank: Picker, Credentials and Secure Storage — Implementation Plan

**Spec**: [`1_9-connect-a-bank-picker-credentials-secure-storage_specs.md`](1_9-connect-a-bank-picker-credentials-secure-storage_specs.md)
**Smoke test runbook**: [`docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md`](../../../testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md)

---

## Summary

**Approach**: Build the four connect-flow screens over three new seams the repository does not
have yet: a **secure-store port** whose single adapter is the only file in the app allowed to
import `expo-secure-store`; a **connection write repository** in `src/db/` that creates and
updates `user_financial_institutions` while never receiving a credential value; and a
**sync-handoff seam** that marks the connection `syncing` and navigates to `bank-syncing`,
where item #11 mounts the scraper. The plaintext RUT and password exist in component state only
between typing and the secure-store write, and are dropped before navigation. The picker,
credential form and connected screen are pure renderings of catalogue copy over data read
through `src/db` repositories, with one new design-system primitive (`BankRow`) taking the
`mu-bank*` classes that item #2 explicitly deferred to this item.

**Estimated complexity**: L

<!-- S: < 1 day | M: 1-3 days | L: 3+ days -->

**Rationale**: Four screens with eleven declared states between them, a new native dependency,
a new lint/test boundary for credentials, a new design-system primitive with gallery and
`mu-class` bookkeeping, a new repository layer for the connection lifecycle, a third Jest
project for the Node-tier service tests, and a dev-only fixture surface without which four
acceptance criteria are unverifiable in an MVP that ships exactly one connectable bank.

**Dependencies**:

- **#2 (theme and design-system primitives)** — merged. `Button`, `TextField`, `Note`, `Badge`,
  `Card`, `EmptyState`, `Text` and `componentMetrics` are used as they exist today.
- **#3 (local database)** — merged. `financial_institutions` is seeded; the
  `user_financial_institutions` table, its `(financial_institution_id)` unique index and the
  `credentials_key` column exist. No migration is needed.
- **#34 (i18n)** — merged. Every new string is a flat catalogue key.
- **#4 (shared-utils)** — merged. `isValidRut` / `formatRut` / `normalizeRut` are the RUT
  authority; this item adds no RUT logic of its own.
- **#6 (bank scraper)** — **open in review (PR #46)**. This item does **not** import the
  scraper at runtime; it only records the seam that item #11 will call
  (`startBankRead`). The plan's only hard requirement is that `financial_institutions.id`
  keeps matching the scraper's `bankId` (`banco-de-chile`), which is already true in the
  seed catalogue. **Implementation must not start the connect-flow → scraper wiring before
  #6 merges**; nothing else in this plan is blocked by it.
- **#10 (sync engine) and #11 (syncing screen)** — not built. This plan defines the seam and
  builds neither side of it.

---

## Verification Log

> Every scope statement below is derived from one of these commands, run in the plan branch
> worktree at the recorded revision.

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `4fc495a` (branch `implementation-plan/9-connect-a-bank`, fast-forwarded to `origin/develop`) |
| `mu-bank*` ownership | `grep -n "mu-bank" apps/mobile/src/test-utils/mu-class-map.ts` | Three entries (`mu-bank`, `mu-bank__logo`, `mu-bank__name`), all `status: 'deferred'`, all noted `Deferred to #9 (Connect a bank).` |
| `mu-topbar*` / `mu-item*` ownership | `grep -n "mu-topbar\|mu-item" apps/mobile/src/test-utils/mu-class-map.ts` | `mu-topbar*` deferred to #12; `mu-item*` deferred to #19 — **not** this item's to claim |
| `expo-secure-store` is not installed | `grep -c "expo-secure-store" apps/mobile/package.json` | `0` |
| Version pinned by Expo SDK 54 | `node -e "console.log(require('expo/bundledNativeModules.json')['expo-secure-store'])"` (resolved through the workspace store) | `~15.0.8` |
| Seeded institutions | `sed -n '77,126p' apps/mobile/src/db/seeds/catalogue.ts` | Six banks: `banco-de-chile` (`available`); `santander`, `bci`, `banco-estado`, `falabella`, `itau` (`coming_soon`) |
| Existing repository surface | `grep -rn "^export function\|^export async function" apps/mobile/src/db/repositories/` | `listConnectableInstitutions` (filters `scraper_status = 'available'`), `disconnectInstitution`, plus category/merchant/settings/transaction functions. **No** write-side connection function and **no** picker-wide institution reader exist |
| Connection table shape | `sed -n '67,86p' apps/mobile/src/db/schema.ts` | `status`, `credentials_key` (`TEXT NOT NULL`), `sync_status`, `last_sync_at`, `last_success_at`, `last_error_code`, `last_error_message`; unique index on `financial_institution_id` |
| Credential key convention | `grep -n "credentials_key" docs/project/4-database-model.md` | ``expo-secure-store` key, e.g. `bank_creds:banco-de-chile`. **The value never touches SQLite**` |
| Scraper entry point (contracted) | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/index.ts` | `startBankRead({ countryCode, bankId, credentials, port, priorMonths?, readDeadlineMs?, onResult, onProgress? })` → `ScrapeSession \| ScraperRequestRejection`; barrel is React-free, the component is the deep import `@finanzas/bank-scraper/src/component` |
| Scraper credential field ids | `git show origin/feature/6-port-bank-scraper-banco-de-chile:packages/bank-scraper/src/configs/cl/banco-de-chile/banco-de-chile.config.ts` | `fields: [{ id: 'rut', formatter: formatRut, validation: { fn: isValidRut } }, { id: 'password', maxLength: 8 }]` |
| Route files today | `cat "apps/mobile/app/(onboarding)/"{connect-bank,bank-picker,bank-credentials,bank-connected}.tsx` | All four render `RoutePlaceholder`; `bank-syncing.tsx` also does and stays that way |
| Catalogue key pattern | `sed -n '5p' apps/mobile/src/i18n/__tests__/catalogue-parity.test.ts` | `/^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/` — dotted segments, lowercase, underscores inside a segment only |
| Dev-route precedent | `cat "apps/mobile/app/(dev)/gallery.tsx"`; `grep -n "DEV_ONLY_ROUTES" apps/mobile/src/test-utils/route-inventory.ts` | `__DEV__` guard + `require()` inside the guard; `DEV_ONLY_ROUTES = ['/(dev)/gallery']`, consumed by `route-manifest-parity.test.ts` |
| `mu-bank` measurements | `sed -n '568,578p' design/mockups/mobile/index.html` | Row: `gap var(--sp3)`, `padding var(--sp3) var(--sp4)`, `radius var(--r-lg)`, `background var(--s1)`, `1px var(--border)`; logo `40x40`, `radius var(--r-md)`, `font-size var(--sm)`, weight 800, letter-spacing `-.3px`; name `15px`, weight 600; sibling rows `margin-top var(--sp2)` |
| `mu-item__sub` vs `mu-small` | `sed -n '327p;465p' design/mockups/mobile/index.html` | Identical `font-size: var(--sm); color: var(--t2)`; `mu-item__sub` adds `margin-top: 1px` |
| Fidelity tooling (#47) | `ls scripts/mobile-ui` | `No such file or directory` — item #47's plan is merged, its implementation is not |
| Feature folder | `ls apps/mobile/src/features` | `No such file or directory` — this item creates it (item #8's merged plan schedules it too; see the assumption check) |
| Same-surface PRs, first pass | `gh pr list --repo lhpaul/personal-finances --state open --json number,title,headRefName` | At `4fc495a`: #55 `implementation-plan/8-onboarding-intro-value-ready`, #46 `feature/6-port-bank-scraper-banco-de-chile`, #44 `feature/5-shared-domain-rules-matching-aggregates` |
| Same-surface PRs, re-check after the review gate | `git fetch origin && git log --oneline HEAD..origin/develop` | **#55 merged** into `develop` as `05c0926` + `3f4b49c` while this plan was in its review gate. #46 and #44 remain open and touch `packages/*` only. The plan branch was merged with `develop` at `e9ec926` so the item #8 plan is present in this worktree |
| Overlap with item #8's plan | `git show origin/develop:docs/specs/developments/20260802132343_8-onboarding-intro-value-ready/2_8-onboarding-intro-value-ready_implementation-plan.md` (re-read after the merge) | Plans `src/db/runtime.ts` (`getAppDatabase()`), `src/db/repositories/connections.ts` (read-only `getConnectedBanksSummary`), `src/db/types.ts` additions, `app/(onboarding)/_layout.tsx` `headerShown: false`, and a new `screenMetrics` export in `theme.ts` |

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Artifact base branch and owner | Plan and plan PR are owned by this repository and target `develop` | `.ai-dev-workflow.yaml` (no `repository_mode` key → `single_repo`); `AGENTS.md` → Git & Branching | 2026-08-02, `4fc495a` | Current invocation only | `Verified` |
| Runtime database handle for app code | `getAppDatabase(): Promise<AppDatabase>` in `apps/mobile/src/db/runtime.ts` | Item #8's plan (**merged** into `develop`), Database layer; no such module exists in the codebase at `e9ec926` | 2026-08-02, re-verified at `e9ec926` | Same-surface artifacts only: item #8's merged plan; #46/#44 touch `packages/*` only | `Resolved` — see Resolution R1 |
| Connection repository module path | `apps/mobile/src/db/repositories/connections.ts` | Item #8's merged plan schedules it read-only ("Write-side connection functions belong to #9"); this plan adds the write side | 2026-08-02, re-verified at `e9ec926` | Same-surface artifacts only: item #8's merged plan | `Resolved` — see Resolution R1 |
| Connection `status` value written on connect | `'active'` | `docs/project/4-database-model.md` → `user_financial_institutions.status`; spec → Statuses / Enum Values → Connection state | 2026-08-02, re-verified at `e9ec926` | Same-surface artifacts only: item #8's merged plan, whose read-side filter is still written as status `connected` at line 134 of the merged file | `Conflict` — see Resolution R2 |
| `expo-secure-store` version | `~15.0.8` | `expo/bundledNativeModules.json` for the installed Expo SDK 54 | 2026-08-02, `4fc495a` | Current invocation only; no open or recently merged PR changes `apps/mobile/package.json` | `Verified` |
| Design-fidelity tooling availability | Not available; AC30 is a manual side-by-side comparison | `ls scripts/mobile-ui` → absent; item #47's plan (merged at `7919372`) plans `pnpm fidelity --issue N` for future screen items | 2026-08-02, `4fc495a` | Same-surface merged artifact only: #47 plan | `Verified` — see Resolution R3 |
| Scraper public entry point | `startBankRead(...)` from `@finanzas/bank-scraper` | The merged item #6 implementation plan (Decisions 3, 5, 7) and the open PR #46 branch source | 2026-08-02, `4fc495a` | Same-surface open PRs only: #46 | `Verified` — this item records the seam and calls nothing |

**Resolution R1 — shared `src/db` modules with item #8.** Competing evidence: item #8's plan —
open as PR #55 when this plan was written, **merged into `develop` during this plan's review
gate** — schedules `src/db/runtime.ts` and `src/db/repositories/connections.ts`; this item needs
both. Neither module exists in the codebase yet: item #8's *plan* is merged, its *implementation*
is not. Affected plan statements: every Database-layer bullet and Implementation Order steps 3-5.
Resolution: **ownership is split by direction, and creation is merge-order-contingent.** Item #8
owns `runtime.ts` and the read-only `getConnectedBanksSummary`; item #9 owns the write-side
connection functions and `listConnectedBankSummaries`. Whichever item is implemented second
**adds to the existing file and does not recreate it**, and if `src/db/runtime.ts` does not exist
when item #9 is implemented, item #9 creates it with exactly the contract quoted in the
Verification Log (`getAppDatabase(): Promise<AppDatabase>`), so the two implementations converge
rather than fork. Decision owner: tech-lead agent for item #9, under the parent orchestrator's
no-human-available delegation. Recorded here so the implementer verifies the file's presence
before writing it (Implementation Order step 3).

**Resolution R2 — the connection `status` value.** Competing evidence: the data model and this
item's spec both enumerate `active | inactive | disconnected` and this item is the **only**
writer of that column; item #8's merged plan describes its read-side filter as status
`connected`, and that wording survived its own review gate.
Affected plan statements: `upsertConnection` (Database layer), `listConnectedBankSummaries`, the
Seed Data table and smoke steps 8-10. Resolution: **`'active'` is authoritative** — it is the
value the normative data model fixes and the value this item writes; a reader filtering on
`'connected'` would return nothing. The implementer of whichever item lands second must align the
read-side filter to `'active'`; item #9's own tests assert the written value is `'active'`, which
will fail loudly if the other reading is adopted. Decision owner: tech-lead agent for item #9,
under the parent orchestrator's no-human-available delegation. This is reported to the parent
orchestrator as a cross-item finding against item #8's merged plan (PR #55), which is a
documentation correction there rather than a blocker here.

**Resolution R3 — design fidelity.** Item #47's merged plan says future screen items register
targets in `scripts/mobile-ui/fidelity-targets.json` and run `pnpm fidelity --issue N`. That
tooling does not exist at `4fc495a`. This item's runbook therefore performs AC30 as a manual
side-by-side comparison against `design/mockups/mobile/index.html`. **Contingency**: if item #47
is implemented before item #9, the implementer registers the four screens' targets and adds
`pnpm fidelity --issue 9` to the runbook's fidelity step instead of removing the manual step.

---

## Assumptions

Technical assumptions taken while writing this plan. The spec's own Assumptions, Decision Log and
Open Questions (including the two reversible defaults — no "Sugerir un banco" control, no
postpone path out of the introduction) are settled inputs and are **not** relitigated here.

- **A1 — how AC14's two clauses fit together.** `12.345.678-9` is the mockup's placeholder and its
  check digit is arithmetically wrong (the correct digit for body `12345678` is `5`). Item #4's
  `formatRut` deliberately does not check the digit, because the mockup renders an invalid RUT in
  the `error` state. So AC14 reads as two independent facts: `123456789` is *accepted as input and
  displayed* as `12.345.678-9`, **and** it never enables *Conectar*. Enabling needs an
  arithmetically valid RUT; the runbook uses `12.345.678-5`.
- **A2 — this item adds no WebView dependency.** `react-native-webview` is a peer dependency of
  the scraper's React component and is added by whichever item first mounts it (#11), not here.
- **A3 — the read window is left at the scraper's default.** The sync spec assigns the history
  window to the connect flow; the mockups draw no control for it, so `priorMonths` is not
  overridden and the scraper's own default (current month plus one prior month) applies. Recorded
  in the seam documentation so #11 does not invent a different value.
- **A4 — Spanish plural keys use `_one` and `_other` only.** The counts drawn here (results,
  productos, movimientos) never reach the magnitudes at which CLDR Spanish selects `many`, and
  the catalogue-parity test requires `es` and `en` to carry identical key sets.
- **A5 — no length limit on the password field.** The bank config declares `maxLength: 8` for its
  own injected form; the mockup draws no limit, and a too-long password is indistinguishable on
  this screen from a wrong one — it returns through the `error` state.
- **A6 — the `multiple` fixture uses a coming-soon institution for its second connection.** That
  is legitimate at the data layer (nothing constrains `financial_institution_id` to `available`)
  and unreachable from the picker, which is exactly what makes it a safe fixture.
- **A7 — bank marks are monograms, not images.** The seed writes
  `assets.logo = 'asset://banks/<slug>.png'` and no such file ships. The mockup draws the
  `short_name` monogram over `brand_color`, and `BankRow` does the same; no image is loaded and
  no asset is added by this item.
- **A8 — `app/index.tsx` and the launch gate are not touched.** Item #8 owns them, and its plan
  merged into `develop` during this plan's review gate. This item's
  screens are reached by navigation, and the runbook navigates to the route directly.

---

## Layer-by-Layer Changes

### Database / Data Layer

No migration. Every column this item writes already exists (Verification Log → *Connection table
shape*), so non-negotiable 5 (additive migrations) is not engaged at all.

- [ ] `apps/mobile/src/db/runtime.ts` — **verify first, create only if absent** (Resolution R1).
      Opens the device database via `openAppDatabase()`, wires the Expo migrator and the
      `expo-crypto` / clock ports, calls `ensureDatabaseReady(...)`, memoizes and exports
      `getAppDatabase(): Promise<AppDatabase>`.
- [ ] `apps/mobile/src/db/repositories/institutions.ts` — add
      `listInstitutions(db): PickerInstitution[]`: **every** row of `financial_institutions`,
      ordered `available` first and then by `name` (Business Rule 10), carrying `id`, `name`,
      `scraperStatus`, and the `short_name` / `brand_color` read out of `metadata` through the
      existing `parseInstitutionMetadata` guard (`src/db/json.ts`), whose interface already
      declares both fields. `listConnectableInstitutions` is left byte-identical —
      it filters to `available` and is the wrong reader for a picker that must draw coming-soon
      banks (spec Decision 1).
- [ ] `apps/mobile/src/db/repositories/connections.ts` — **verify first, add to it if item #8
      created it** (Resolution R1). This item contributes:
  - `getConnectionByInstitution(db, institutionId): BankConnection | undefined`
  - `upsertConnection(db, { institutionId, credentialsKey, newId, now }): { id, created }` —
    inserts with `status: 'active'`, `sync_status: 'idle'`, `created_at: now` when absent;
    when present, sets `status: 'active'` and leaves `credentials_key`, `last_sync_at`,
    `last_success_at` and the error columns untouched (Business Rules 14-15, AC20-AC21). The
    `(financial_institution_id)` unique index is the mechanism that makes "exactly one
    connection per bank" true even under a double submit.
  - `markConnectionSyncing(db, id, now)` — sets `sync_status: 'syncing'` and `last_sync_at: now`
    (Business Rules 17-18). It does **not** touch `last_success_at`, which is what makes AC22's
    "two separate facts" hold.
  - `deleteConnectionIfNeverSynced(db, id)` — the compensating action of Decision 7; refuses to
    delete a connection whose `last_success_at` is set.
  - `listConnectionsForCredentialLookup(db): { id, institutionId, credentialsKey, createdAt }[]`
    ordered by `created_at` — the deterministic key list Decision 6 needs, because a keychain has
    no "list every key" API.
  - `listConnectedBankSummaries(db): ConnectedBankSummary[]` — one row per connection whose
    `status = 'active'` **and** `last_success_at is not null` (Business Rule 23), joined to
    `financial_institutions` for name/brand and counting `user_financial_products` and the
    `transactions` reachable through them.
- [ ] `apps/mobile/src/db/types.ts` — add `PickerInstitution`, `BankConnection` and
      `ConnectedBankSummary` so no caller sees a Drizzle row shape. If item #8 already added
      `ConnectedBanksSummary`, both types coexist; converging them is a follow-up, not this item's
      edit.

### Shared Packages / Libraries

- [ ] **None.** `@finanzas/shared-utils` already exports `normalizeRut`, `isValidRut` and
      `formatRut` and needs no change (Business Rule 11 — "the shared RUT validation the app
      already owns"). `@finanzas/shared-domain` is not touched: nothing here is a domain rule.
      `@finanzas/bank-scraper` is not imported by this item (Decision 8).

### Frontend / UI — new files

Secure store (the only place a credential value may be handled):

- [ ] `apps/mobile/src/lib/secure-store/types.ts` — `SecureStorePort` with
      `getItem(key): Promise<string | null>`, `setItem(key, value): Promise<void>`,
      `deleteItem(key): Promise<void>`. No other method; in particular no "list keys".
- [ ] `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts` — the **only** module in
      the repository that imports `expo-secure-store`. Writes with
      `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` (Decision 4).
- [ ] `apps/mobile/src/lib/secure-store/credential-store.ts` — pure over the port:
      `credentialsKeyFor(institutionId)`, `writeCredentials(port, institutionId, credentials)`,
      `readCredentials(port, institutionId)` and `deleteCredentials(port, institutionId)`.
      Contains no `console.` call and no error message that interpolates a value.

Connect-bank feature:

- [ ] `apps/mobile/src/features/connect-bank/connect-flow-store.ts` — module-scoped store holding
      `{ institutionId: string | null; entryOrigin: 'onboarding' | 'settings' }` with
      `subscribe` / `getSnapshot` / `chooseInstitution` / `enterFlow` / `reset`. **The type has no
      credential field and no free-form payload** (Decision 1).
- [ ] `apps/mobile/src/features/connect-bank/use-connect-flow.ts` — `useSyncExternalStore`
      wrapper plus `resolveBackHref(origin)` / `resolveExitHref(origin)` re-exports.
- [ ] `apps/mobile/src/features/connect-bank/flow-navigation.ts` — the pure part:
      `resolveBackHref(origin)` → `/(onboarding)/connect-bank` or `/settings/banks`;
      `resolveExitHref(origin)` → `/(onboarding)/notifications` or `/settings/banks`
      (Business Rule 24, AC26-AC27).
- [ ] `apps/mobile/src/features/connect-bank/institution-search.ts` — pure
      `foldForSearch(text)`, `matchInstitutions(list, query)`, `sortForPicker(list)`
      (Decision 11, Business Rules 8 and 10).
- [ ] `apps/mobile/src/features/connect-bank/credential-form.ts` — pure
      `formatRutForDisplay(input)` (canonical form when structurally parseable, the raw input
      otherwise — `formatRut` throws on malformed input and must never be called unguarded) and
      `canConnect({ rut, password })` (Business Rules 11-12, AC13-AC14).
- [ ] `apps/mobile/src/features/connect-bank/connect-bank.service.ts` — the orchestration, with
      **no React and no module-level singletons**:
      `connectBank(deps, input): Promise<ConnectBankResult>` where
      `deps = { db, secureStore, newId, now }` and
      `input = { institutionId, rut, password }`. Executes Decision 7's ordered sequence and
      returns `{ userFinancialInstitutionId, credentialsKey }`.
- [ ] `apps/mobile/src/features/connect-bank/sync-handoff.ts` — the seam (Decision 8):
      the `SyncRequest` type (`{ userFinancialInstitutionId, institutionId, countryCode,
      credentialsKey }`), `buildSyncRequest(...)`, and `SYNCING_ROUTE`. Documented as the single
      contract item #11 consumes; this file calls nothing in `@finanzas/bank-scraper`.
- [ ] `apps/mobile/src/features/connect-bank/use-institutions.ts` — reads the catalogue through
      `getAppDatabase()` + `listInstitutions`.
- [ ] `apps/mobile/src/features/connect-bank/rut-lock.ts` — `resolveLockedRut(db, port)`, the
      React-free resolver behind the lock (Decision 6).
- [ ] `apps/mobile/src/features/connect-bank/use-rut-lock.ts` — the hook over
      `resolveLockedRut`, returning
      `{ status: 'pending' } | { status: 'unlocked' } | { status: 'locked'; rut }`.
- [ ] `apps/mobile/src/features/connect-bank/use-connect-bank.ts` — the React wrapper: builds
      `deps` from `getAppDatabase()` and the Expo adapter, guards re-entrancy, drops the plaintext
      and navigates. Errors are surfaced as a value-free `ConnectBankError`.
- [ ] `apps/mobile/src/features/connect-bank/use-connected-banks.ts` — reads
      `listConnectedBankSummaries`.
- [ ] `apps/mobile/src/features/connect-bank/state-coverage.ts` — `CONNECT_FLOW_STATE_COVERAGE`:
      for each of the four screen ids, every manifest `state_id` mapped to the source file that
      renders it and the test that asserts it. This is the residual-verification mechanism for
      AC28 (see Testing Strategy).
- [ ] `apps/mobile/src/features/connect-bank/components/FlowHeader.tsx` — screen-local back bar.
      **Not** a design-system primitive: `mu-topbar*` stays deferred to #12 (Decision 10).
- [ ] `apps/mobile/src/features/connect-bank/components/SecurityAccordion.tsx` — screen-local
      disclosure. **Not** a primitive: `mu-item*` stays deferred to #19 (Decision 10).

Design system:

- [ ] `apps/mobile/src/components/ui/BankRow.tsx` — the `mu-bank` primitive. Props:
      `{ name, shortName, brandColor, subtitle, trailing?, onPress?, unavailableLabel? }`.
      With `onPress` it renders a `Pressable` with `accessibilityRole="button"`; without it, a
      plain `View` marked `accessible` whose accessible name ends with `unavailableLabel`
      (Decision 12, AC9).
- [ ] `apps/mobile/src/components/ui/index.ts` — export `BankRow` and its props type.
- [ ] `apps/mobile/src/components/ui/TextField.tsx` — **modified**: two optional props,
      `icon?: ReactNode` (leading slot, mirrors the mockup's search input) and
      `accessibilityLabel?: string` (so a labelless search field is not announced as its emoji
      placeholder). Existing call sites are unaffected (Decision 16).
- [ ] `apps/mobile/src/theme.ts` — **modified**: add a `bank` group to the existing
      `componentMetrics` export with the `mu-bank` measurements from the Verification Log. The
      `theme` object itself is untouched — `theme-tokens-parity.test.ts` asserts its key set
      exactly.
- [ ] `apps/mobile/src/test-utils/mu-class-map.ts` — **modified**: `mu-bank`, `mu-bank__logo` and
      `mu-bank__name` move from `deferred` to
      `{ status: 'primitive', owners: ['BankRow'] }`. No other entry changes.
- [ ] `apps/mobile/src/dev/DesignSystemGallery.tsx` — **modified**: a `BankRow` section
      (available, coming-soon and connected-summary rows) and the icon variant of `TextField`,
      rendered from new `ds.*` catalogue keys.

Routes:

- [ ] `apps/mobile/app/(onboarding)/connect-bank.tsx` — `#screen=connect-bank-intro`
      (`default`, `how-it-works`). Replaces `RoutePlaceholder`.
- [ ] `apps/mobile/app/(onboarding)/bank-picker.tsx` — `#screen=bank-picker`
      (`list`, `search`, `no-results`).
- [ ] `apps/mobile/app/(onboarding)/bank-credentials.tsx` — `#screen=bank-credentials`
      (`empty`, `filled`, `error`, `rut-locked`, and `rut-locked` composed with `error`).
- [ ] `apps/mobile/app/(onboarding)/bank-connected.tsx` — `#screen=bank-connected`
      (`single`, `multiple`).
- [ ] `apps/mobile/app/(onboarding)/bank-syncing.tsx` — **unchanged**, still `RoutePlaceholder`.
      It belongs to item #11; this item only navigates to it.
- [ ] `apps/mobile/app/(onboarding)/_layout.tsx` — `screenOptions={{ headerShown: false }}` if
      item #8 has not already set it (the mockups draw their own headers).
- [ ] `apps/mobile/app/(dev)/connect-fixtures.tsx` + `apps/mobile/src/dev/ConnectFlowFixtures.tsx`
      — `__DEV__`-only fixture surface (Decision 13), following `(dev)/gallery.tsx` exactly:
      guard first, `require()` inside the guard so Metro can drop it from a release bundle.
- [ ] `apps/mobile/src/test-utils/route-inventory.ts` — **modified**: add
      `'/(dev)/connect-fixtures'` to `DEV_ONLY_ROUTES`, which is what keeps
      `route-manifest-parity.test.ts` green.

### Infrastructure / Configuration

- [ ] `apps/mobile/package.json` — add `expo-secure-store: ~15.0.8`. No config-plugin entry is
      added to `app.config.js`: the plugin only configures `NSFaceIDUsageDescription`, and this
      item uses no biometric gate (spec Out of Scope).
- [ ] `pnpm-lock.yaml` — regenerated by `pnpm install`.
- [ ] `eslint.config.mjs` (root) — add an exported `secureStoreBoundary` config
      (`no-restricted-imports` on `expo-secure-store`), mirroring the existing `dbAccessBoundary`
      export and its doc comment.
- [ ] `apps/mobile/eslint.config.mjs` — apply `secureStoreBoundary` to `app/**` and `src/**`,
      ignoring `src/lib/secure-store/**`; and set `no-console: 'error'` for
      `src/lib/secure-store/**` and `src/features/connect-bank/**` (Business Rule 1).
- [ ] `apps/mobile/jest.config.js` — add a third project, `feature`
      (`testEnvironment: 'node'`, `testMatch: ['<rootDir>/src/features/**/*.node.test.ts']`,
      the same `babel-jest` transform the `db` project uses), and add `*.node.test.ts` to the
      `app` project's `testPathIgnorePatterns` (Decision 14).

### Executable workflow shell snippets

Not applicable — this plan adds no executable shell guidance to a framework-owned surface. The
commands in the Implementation Order and the runbook are `pnpm`, `git`, `gh`, `sqlite3` and
`xcrun` invocations run by a person or an agent, not committed shell scripts.

---

## Architecture and Decisions

### Decision 1 — Flow state travels in a module-scoped store, never in the URL

The spec forbids URL-serialized state, and the flow is entered from two different route groups
(onboarding and settings), so a layout-scoped React context cannot cover both. A module-scoped
store read through `useSyncExternalStore` needs no new dependency, survives the group boundary,
and is trivially testable in the Node tier.

```ts
// Illustrative — adapt during implementation.
export type ConnectFlowState = {
  institutionId: string | null;
  entryOrigin: 'onboarding' | 'settings';
};
```

The store's type is closed: there is no `credentials`, no `password`, no index signature. A test
asserts the snapshot's own keys are exactly `institutionId` and `entryOrigin`, so a later "just
stash the password here" edit fails a test rather than a review.

### Decision 2 — The credential form is mockup-driven, not `BankConfig`-driven

`BankConfig.fields` carries Spanish labels and placeholders of its own
(`'Por favor ingresa un RUT válido…'`). Rendering from them would put user-facing copy outside
`src/i18n/` and break non-negotiable 8. The MVP has exactly one connectable bank and the mockup
fixes the form, so this item renders the two fields from catalogue keys and consults no config.
A config-driven form becomes worth building when a second bank ships with a different field set;
it is recorded here as follow-up F1, not as scope.

Consequence: the scraper config's `maxLength: 8` on the password is **not** mirrored. The mockup
draws no length limit, and a too-long password is indistinguishable to this screen from a wrong
one — it comes back through the `error` state like any other rejection.

### Decision 3 — The RUT is stored, and handed on, in canonical display form

Business Rule 12 fixes only what the person sees. The bank's own field is populated verbatim by
the scraper's login script, and the bank config declares `formatter: formatRut` for that field —
so the value the bank expects is the formatted one, `12.345.678-5`. This item therefore writes
`formatRut(input)` into the secure store, which also means the `rut-locked` pre-fill needs no
re-formatting on read.

**Reversal path**, recorded because it is a scraper-facing risk this item cannot prove on its
own: if Banco de Chile's input rejects dots, the change is one call — store `normalizeRut(input)`
instead and keep `formatRut` for display only. The runbook's step 7 asks the tester to record
what the bank's field shows after injection, which is the evidence that decides it.

### Decision 4 — One adapter, one boundary, enforced twice

`expo-secure-store` is importable from exactly one module. This mirrors the repository's existing
and proven `dbAccessBoundary` pattern: an ESLint rule for the fast feedback loop, and a test that
scans source text for the specifier so the guarantee survives a lint-config regression.

Writes use `keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY`. This is not a
detail. iOS keychain items that are **not** in a `…ThisDeviceOnly` protection class are carried
into encrypted device backups and can be restored onto a different device; the `ThisDeviceOnly`
classes are excluded from backup and restore. A bank password reachable from a restored backup is
a copy of the secret outside the phone it was typed on, which is what non-negotiable 1 forbids.
On Android the option is inert and the Keystore-backed store is already device-local.
**Unverified — the implementer must confirm before proceeding**: `expo-secure-store`'s *default*
protection class when `keychainAccessible` is omitted. The decision above does not depend on the
default (the option is always passed explicitly), but the doc update in *Documentation Updates*
should state the default accurately, so read it from the installed
`expo-secure-store` source rather than from this plan.

The stored value is a JSON object, `{"rut":"…","password":"…"}`, under one key per bank.

### Decision 5 — The credential key is deterministic

`credentialsKeyFor(institutionId) === 'bank_creds:' + institutionId`, exactly as the data model
records. Determinism is what makes AC17 and AC20 true by construction: reconnecting a bank writes
the same key, so there is never a second entry, and it is what lets
`disconnectInstitution` leave `credentials_key` byte-identical for a later reconnect (the
existing repository doc comment already relies on this).

### Decision 6 — The RUT lock keys on a stored entry reachable from a connection

The **spec's own** Decision 3 says the lock is triggered by the existence of *any* credential
entry, not by counting connections. A keychain offers no key enumeration, so "any entry" has to be resolved
against a known key list. That list is the connections table:

```ts
// Illustrative — adapt during implementation.
export async function resolveLockedRut(db: AppDatabase, port: SecureStorePort) {
  for (const connection of listConnectionsForCredentialLookup(db)) {
    const stored = await readCredentials(port, connection.institutionId);
    if (stored) return stored.rut;
  }
  return null;
}
```

Ordered by `created_at`, so the answer is deterministic. This gives the disconnect-everything edge
the spec asks for: once every entry is deleted, nothing is found and the field is editable again.
It is also the only read of a credential this item performs outside the write path, which is
exactly the exception Business Rule 6 allows.

### Decision 7 — Write order, and the compensating delete

```text
connectBank(deps, { institutionId, rut, password }):
  1. credentialsKey = credentialsKeyFor(institutionId)
  2. await secureStore.setItem(credentialsKey, JSON.stringify({ rut, password }))
  3. db.transaction(tx =>
       { id, created } = upsertConnection(tx, { institutionId, credentialsKey, newId, now })
       markConnectionSyncing(tx, id, now())          // idle -> syncing, sets last_sync_at
     )
  4. return { userFinancialInstitutionId: id, credentialsKey }
  on failure of (3):
     if (created) deleteConnectionIfNeverSynced(db, id)
     await secureStore.deleteItem(credentialsKey)     // only when no connection existed before
     throw ConnectBankError('connection_write_failed')  // value-free
```

Credentials are written **before** the connection (spec Decision 2): the syncing screen's failure
copy promises they survive a failed sync, and a retry must not re-ask. The connection genuinely
passes through `idle` before `syncing`, which is what Business Rule 17 describes, and both DB
writes are in one transaction so a crash between them cannot leave a connection that claims to be
syncing when nothing was started. The compensating delete only runs when this call created the
connection; a reconnect that fails leaves the previous credentials in place (Business Rule 15).

`markConnectionSyncing` never touches `last_success_at`. That single omission is the mechanism
behind AC22.

### Decision 8 — This item does not mount the WebView; the handoff is a typed seam

The scraper's React component is a deep import that needs `react-native-webview`, which
`apps/mobile` does not have and which this item deliberately does not add. Business Rule 22 says
confirming credentials always leads to the syncing screen, and that screen is item #11's. So the
flow's last act is: mark the connection `syncing`, build a `SyncRequest`, `router.replace` to
`/(onboarding)/bank-syncing`.

```ts
// Illustrative — adapt during implementation. src/features/connect-bank/sync-handoff.ts
export type SyncRequest = {
  userFinancialInstitutionId: string;
  institutionId: string;   // === financial_institutions.id === scraper bankId
  countryCode: string;     // 'cl'
  credentialsKey: string;  // read by #11 through the secure-store port
};
```

Item #11 reads the credential through the same port and calls
`startBankRead({ countryCode, bankId: institutionId, credentials, port, onResult })`; item #10
persists what comes back and writes the connection's `ok` / `error` outcome. **This item hands
over a key, not a secret**, which is why the plaintext can be dropped at step 4 of Decision 7 and
why Business Rule 5's "cleared when the attempt ends" holds even though the read outlives the
screen.

The history window (`priorMonths`) is named by the sync spec as the connect flow's to own. This
item records the intended value — the scraper's own default of one prior month — as part of the
seam documentation and passes no override, because the mockups draw no control for it.

### Decision 9 — The connected screen's counts come from the store, not from a summary object

Spec Decision 8 requires the counts be what the sync *stored*. The sync's change summary is
explicitly transient (#10's spec: "it is not persisted"), and the connected screen can be
re-entered from "Agregar otro banco". Counting `user_financial_products` and their `transactions`
in one query is both the literal reading of "what the sync stored" and the only source that
survives a re-entry. Until #10 lands, the counts are honestly zero and the rows only appear once
`last_success_at` is set, which is the behaviour AC24 describes.

### Decision 10 — `BankRow` is a primitive; the top bar and the accordion are not

Item #2 classified `mu-bank`, `mu-bank__logo` and `mu-bank__name` as `deferred` with the note
`Deferred to #9`. This item takes them: `BankRow` joins the barrel and the three entries become
`primitive` with `owners: ['BankRow']`, which is what `mu-class-coverage.test.ts` checks.

`mu-topbar*` (deferred to #12) and `mu-item*` (deferred to #19) are **not** claimed, even though
these screens draw a back bar and an accordion row. Both are built as screen-local components
under `src/features/connect-bank/components/`, following the precedent item #8's plan sets for
its own `ReadySummaryRow`. The subtitle inside `BankRow` renders through `Text variant="small"`,
whose `mu-small` rule is identical to `mu-item__sub` apart from a 1px top margin (Verification
Log) — so no ownership is implied and no fidelity is lost.

### Decision 11 — Search folding: NFD, strip combining marks, lowercase, substring

```ts
// Illustrative — adapt during implementation.
const COMBINING_MARKS = /\p{M}/gu;
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}
```

Unicode-aware `\p{M}` rather than a hand-written `̀-ͯ` range, so a pre-composed
character that decomposes into a mark outside the basic block still folds. Matching is
`foldForSearch(name).includes(foldForSearch(query.trim()))` over the **whole** catalogue,
available and coming-soon alike (spec Use Case 3). `sortForPicker` is stable and independent of
the query, so `search` renders rows in the same order as `list`.

### Decision 12 — A coming-soon row is not a button

RN's accessibility model would happily announce a `Pressable` with no `onPress` as a button. AC9
asks for the opposite. `BankRow` without `onPress` renders a `View` with `accessible`, no
`accessibilityRole`, and an accessible name composed as `"<name>, <unavailableLabel>"` from
catalogue keys. There is no `onPress`, so there is nothing to fire (AC8).

### Decision 13 — A `__DEV__`-only fixture surface, because the MVP ships one bank

Four criteria are otherwise unverifiable on a device: AC18 (`rut-locked` needs a pre-existing
credential entry), AC24/AC25 (`single` / `multiple` need connections that completed a sync, which
needs #10), and AC27 (entering from settings needs #20's button). The spec anticipates exactly
this and sanctions it for AC18 ("by seeding a credential entry in a dev build").

`app/(dev)/connect-fixtures.tsx` follows `(dev)/gallery.tsx` byte-for-byte in structure: an
`if (!__DEV__) return null` guard before any hook, and `require()` of the implementation **inside**
the guard so Metro's dead-code elimination can drop `src/dev/` from a release bundle. It offers:
plant a credential entry; plant one synced connection; plant two synced connections; enter the
flow as if from settings; clear everything this surface planted. No product screen links to it,
and `DEV_ONLY_ROUTES` keeps it out of the manifest parity comparison.

### Decision 14 — A third Jest project for the Node-tier service tests

The `app` project runs `jest-expo`; the `db` project runs a Node environment and matches only
`src/db/**/*.test.ts`. The credential-leak test needs a real SQLite store (`better-sqlite3`,
a native Node addon that item #3 deliberately kept out of the RN tier) *and* the feature service,
which does not live under `src/db`. A third project, `feature`, matching
`src/features/**/*.node.test.ts`, is the smallest change that keeps both tiers as item #3 left
them. React component tests for these screens stay in the `app` project and follow item #2's
renderer-free convention (call the component function, walk the returned element tree).

### Decision 15 — The connected screen refuses to render without a completed sync

AC23 says the connected screen is unreachable except through a completed sync. Enforcement, not
trust: when `listConnectedBankSummaries` returns nothing, the route renders
`<Redirect href={resolveBackHref(entryOrigin)} />`. This is a guard, not a drawn state — the
mockup declares `single` and `multiple` only, and neither is a legitimate rendering of "nothing
connected".

### Decision 16 — `TextField` gains an icon slot rather than the picker growing its own input

The mockup's search box is `mu-input`, which `TextField` already owns. Building a screen-local
copy would fork the focus, error and locked styling that primitive already encodes. Two optional
props — `icon` and `accessibilityLabel` — keep every existing call site byte-identical while
letting the picker draw the magnifier and be announced as "Buscar banco" instead of as an emoji.

---

## Testing Strategy

**Test types**: Unit (Node tier and RN tier), integration against an in-memory SQLite store,
smoke on a dev build.

**Key scenarios to test**:

1. **Nothing typed reaches the store or a log** — sentinel RUT and password through
   `connectBank`, then a full dump of the resulting database and a scan of every `console.*`
   call. Maps to AC1, AC2, AC3.
   *(`apps/mobile/src/features/connect-bank/credential-leak.node.test.ts`)*
2. **The failed-attempt variant of scenario 1** — the DB write throws; the compensating delete
   runs; the dump and the log scan still find nothing; the thrown error's serialized form
   contains neither sentinel. Maps to AC3, AC5.
   *(same file)*
3. **One entry per bank, one connection per bank** — connecting `banco-de-chile` twice leaves one
   secure-store key and one row; connecting a second institution creates a second key. Maps to
   AC4, AC17, AC19, AC20.
   *(`connect-bank.service.node.test.ts`)*
4. **`idle` really happens, and `last_success_at` is not clobbered** — assert the ordered writes
   and that a connection with an earlier success keeps it after a later failed attempt. Maps to
   AC21, AC22. *(`connect-bank.service.node.test.ts`)*
5. **The RUT lock resolution** — no connections → unlocked; one connection with an entry →
   locked with that RUT; connections whose entries were deleted → unlocked again; two
   connections → the older one's entry wins. Maps to AC18.
   *(`rut-lock.node.test.ts`, over `resolveLockedRut`)*
6. **Connect enablement** — a wrong check digit never enables; a dotless RUT is accepted and
   displayed canonically; an empty password never enables. Maps to AC13, AC14.
   *(`credential-form.test.ts`)*
7. **Search** — case- and accent-insensitive matching, the result-count agreement, the empty
   state, and clearing back to the full list. Maps to AC10, AC11, AC12.
   *(`institution-search.test.ts`)*
8. **Picker composition and accessibility** — available rows are pressable and badged
   `Disponible`; coming-soon rows are not pressable, carry `Próximamente`, and announce as
   unavailable. Maps to AC7, AC8, AC9.
   *(`bank-picker.test.tsx`, renderer-free element-tree inspection)*
9. **The password is masked in every state, and never restored** — every `bank-credentials` state
   renders the password field with `secureTextEntry`; no source file under the flow renders a
   reveal control; and the password lives in component state only, so a fresh mount of the screen
   starts empty (asserted by inspecting the initial state, and by the store-shape test of
   scenario 13). Maps to AC6, AC15. *(`bank-credentials.test.tsx`)*
10. **The rejection message is value-free** — the `error` state renders the catalogue message and
    nothing derived from input or from a failure payload. Maps to AC16.
    *(`bank-credentials.test.tsx`)*
11. **Connected-screen shape** — one summary row per completed connection, singular/plural
    headings and singular/plural count wording, and the redirect when there are none.
    Maps to AC23, AC24, AC25. *(`bank-connected.test.tsx`, `connections.test.ts`)*
12. **Return-to-origin** — `resolveBackHref` / `resolveExitHref` for both origins.
    Maps to AC26, AC27. *(`flow-navigation.test.ts`)*
13. **Boundary scans** — no file outside `src/lib/secure-store/` imports `expo-secure-store`;
    the connect-flow store type carries no credential field. Maps to Business Rules 1 and 5.
    *(`apps/mobile/src/__tests__/secure-store-boundary.test.ts`)*
14. **State coverage residual** — `CONNECT_FLOW_STATE_COVERAGE` enumerates exactly the manifest's
    declared states for the four screens, and every entry names a source file that exists and a
    test that exists. Maps to AC28. *(`apps/mobile/src/__tests__/connect-flow-state-coverage.test.ts`)*
15. **Catalogue coverage residual** — every `connect.*` key in `es.json` is referenced by a
    source file under `app/(onboarding)/` or `src/features/connect-bank/`, and every `t('…')`
    key those files use exists in both catalogues. Maps to AC29.
    *(`apps/mobile/src/__tests__/connect-catalogue-keys.test.ts`, reusing `catalogue-key-scan.ts`)*

**Planted-defect proof (required in the PR body).** Scenario 1 is a negative test, so it must be
shown to fire. On a clean tree, add a realistic debugging mistake — a
`console.warn('connect', input.rut)` inside `connectBank` — re-run the `feature` project, and
record the failing test name and the sentinel it matched; then `git checkout --` the file,
re-run green, and confirm `git diff --stat` prints nothing. The same test also asserts it does
**not** over-fire: the dump it scans is non-empty and contains the seeded institutions and the
created connection row, so a test that scanned an empty string could not pass.

**Smoke test runbook**:
[`docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md`](../../../testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md)

**Regression suite**: the repository's regression suite is `pnpm test` plus `pnpm lint` and
`pnpm typecheck`; every scenario above lands in it. `.maestro/` holds no flow for this journey
and this item adds none — a Maestro flow that types a credential would be a fixture holding a
credential, which is exactly what the item exists to prevent.

### Parser-risk addendum

Classified **applicable**, on two narrow surfaces: `foldForSearch` is explicit text
normalization whose behaviour AC11 asserts, and `secure-store-boundary.test.ts` is a
regex scanner over source text (the same shape as the merged `db-access-boundary.test.ts`).

**Edge-case enumeration — `foldForSearch` / `matchInstitutions`** (unit tests in
`institution-search.test.ts`, one per row):

| # | Input | Expected |
| --- | --- | --- |
| P1 | `itau` against `Banco Itaú` | matches (AC11) |
| P2 | `ITAÚ` against `Banco Itaú` | matches — case and accent both folded |
| P3 | `Itaú` typed with a combining acute (`u` + U+0301) | matches — NFD normalization makes both spellings equal |
| P4 | `estado` against `BancoEstado` | matches — substring, not word-boundary |
| P5 | `chi` | matches `Banco de Chile` only; the count heading reads the singular form |
| P6 | `banco` | matches every seeded name, `BancoEstado` included; the heading reads the plural form |
| P7 | `  chi  ` | matches — the query is trimmed before folding |
| P8 | `` (empty after trim) | the `list` state, not a search with every row |
| P9 | `banco imaginario` | no matches → `no-results` |
| P10 | `ñ` against a name containing `ñ` | matches — `ñ` decomposes to `n` + combining tilde, so folding is symmetric on both sides |
| P11 | A query containing a regex metacharacter, e.g. `.` or `(` | treated literally — matching is `String.prototype.includes`, never a constructed `RegExp` |
| P12 | Ordering under a query | `search` lists the same relative order as `list`; folding never reorders |

**Edge-case enumeration — the secure-store import scanner** (unit tests in
`secure-store-boundary.test.ts`):

| # | Input | Expected |
| --- | --- | --- |
| S1 | `import * as SecureStore from 'expo-secure-store'` | flagged |
| S2 | `import { getItemAsync } from "expo-secure-store"` | flagged (double quotes) |
| S3 | `require('expo-secure-store')` | flagged |
| S4 | `from 'expo-secure-store/build/SecureStore'` | flagged — subpaths count |
| S5 | `from 'expo-secure-store-mock'` | **not** flagged — the specifier must end at the package name or a `/` |
| S6 | `// expo-secure-store is the only place a credential lives` | **not** flagged — a bare mention outside an import is prose |
| S7 | The adapter file itself | exempt by path, and the exemption is asserted to cover exactly one file |
| S8 | Two import statements on one line | both flagged; the scan is global, not first-match |

**Suppression semantics**: none. Neither scanner recognises an inline suppression directive, by
design — a suppression would be an escape hatch through non-negotiable 1. The only exemption is
the path exemption in S7, which is a fixed list of one, asserted by the test itself.

### Concurrent-event-source addendum

Classified **applicable**: the flow has an async database bootstrap racing screen mount, an async
secure-store write racing unmount, and a module-scoped store shared by two route groups.

- **Shared mutable state guards**: the only shared mutable state is `connect-flow-store`. It is
  written exclusively from user-initiated navigation handlers on the JS thread (never from a
  timer, a subscription or a promise continuation), and every read goes through
  `useSyncExternalStore`, so React sees a consistent snapshot per render. The store holds no
  credential, so a stale read can leak nothing.
- **Re-entrancy / in-flight tracking**: a double tap on *Conectar* is the realistic case.
  `useConnectBank` holds an `inFlight` ref checked-and-set synchronously before the first
  `await`; a second call while one is in flight returns immediately. Even if that guard were
  defeated, the `(financial_institution_id)` unique index and the deterministic credential key
  make the second write a no-op update rather than a duplicate.
- **Event deduplication**: a repeated connect for the same bank is idempotent by construction
  (same key, same row). No event stream is subscribed to, so there is no duplicate-callback case.
- **Listener and resource cleanup**: `connect-flow-store` subscriptions are removed by
  `useSyncExternalStore` on unmount. Each async hook (`use-institutions`, `use-rut-lock`,
  `use-connected-banks`) sets a `cancelled` flag in its effect cleanup and drops the result
  rather than calling `setState` after unmount. The database handle is process-lifetime and
  memoized — it is deliberately not closed on unmount.
- **Race conditions at initialization**: `getAppDatabase()` may still be resolving when a screen
  mounts. Each hook renders its `pending` state until it resolves; no screen reads a handle
  synchronously. `ensureDatabaseReady`'s existing single-flight promise means concurrent mounts
  share one bootstrap.
- **Race conditions at teardown**: `connectBank` can be in flight when the person backgrounds the
  app or navigates back. The write sequence is not cancellable and must not be: a half-written
  connection is worse than an orphan credential entry. The `cancelled` flag suppresses only the
  navigation and the state update, never the writes; the next entry into the flow finds a
  consistent row. Abandoning the form *before* tapping Conectar writes nothing at all (AC5),
  because nothing is written until that handler runs.
- **Error propagation across async boundaries**: `connectBank` rejects with a value-free
  `ConnectBankError`; `useConnectBank` catches it, records a value-free reason in component
  state, and never re-throws into an unhandled rejection. Nothing is logged. The screen surfaces
  the catalogue message only.
- **New patterns**: `useSyncExternalStore` over a module store is new to this codebase. It is
  chosen over React context because the flow spans two route groups; it is noted here so a
  reviewer sees the deviation deliberately.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | **No new shipped seed data.** The six institutions item #3 seeds are exactly what the picker draws; `pnpm --filter @finanzas/mobile db:seed` must produce no diff to `apps/mobile/src/db/__fixtures__/store-v1.sql` | `apps/mobile/src/db/seeds/catalogue.ts` (unchanged) |
| Secure-store entry | `bank_creds:banco-de-chile` → `{"rut":"12.345.678-5","password":"ZZFIXTUREPASSZZ"}` — planted only by the dev fixtures surface, for the `rut-locked` state (AC18) | `apps/mobile/src/dev/ConnectFlowFixtures.tsx` |
| `user_financial_institutions` | One `active` connection to `banco-de-chile` with `last_success_at` set, for the `single` state; a second one for the `multiple` state (planted against a coming-soon institution, which is legitimate at the data layer and unreachable from the picker) | `apps/mobile/src/dev/ConnectFlowFixtures.tsx` |
| `user_financial_products` + `transactions` | Three products and a handful of movements under the first connection, so the row reads a real "N productos · M movimientos" (AC24) | `apps/mobile/src/dev/ConnectFlowFixtures.tsx` |
| Sentinel credentials | `rut: 'ZZSENTINELRUTZZ'`, `password: 'ZZSENTINELPASSZZ'`, plus a punctuation variant containing quotes, a backslash and U+2028 | `apps/mobile/src/features/connect-bank/credential-leak.node.test.ts` |
| Test institutions | The bootstrapped in-memory store from `src/db/testing/memory-db.ts` already seeds all six banks; no extra fixture is needed for the Node-tier tests | `apps/mobile/src/db/testing/memory-db.ts` (unchanged) |

---

## Documentation Updates

> Listed for the developer to execute after implementation; not performed at Plan Ready.

- [ ] `docs/project/3-software-architecture.md` — the "Bank credentials" row in the data-handling
      table gains the keychain accessibility class actually used
      (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) and the fact that exactly one adapter module may import
      `expo-secure-store`.
- [ ] `docs/project/4-database-model.md` — note under `user_financial_institutions` that this
      item is the only writer of `status`, `credentials_key` and the `idle → syncing` transition,
      and that `credentials_key` is deterministic (`bank_creds:<institution id>`).
- [ ] `docs/best-practices/stack/expo-react-native.md` — a short section on the secure-store
      boundary and on why `keychainAccessible` is not left at its default.
- [ ] `docs/best-practices/stack/i18n.md` — the plural-key convention this item introduces
      (`*_one` / `*_other` for counts), if the doc does not already state it.
- [ ] `AGENTS.md` — add the dev-only fixtures route alongside the design-system gallery in the
      "Common Commands" block, and add a Troubleshooting row for "the RUT field is locked and I
      want it editable" (clear the app's data, or use the fixtures surface).
- [ ] `design/mockups/mobile/BEHAVIOR.md` — record that decision `D4` was implemented with its
      reversible default (coming-soon banks visible and inert), so the next reader is not told the
      question is still open in code.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The bank's RUT input rejects the dotted form (Decision 3) | Med | Med | One-line reversal to `normalizeRut`; the runbook records what the injected field shows; nothing else depends on the stored form |
| Item #8 lands first and its `src/db/runtime.ts` / `connections.ts` differ from this plan's contract | Med | Med | Resolution R1 fixes the contract and makes the implementer verify the file before creating it; the `status = 'active'` assertion in this item's tests fails loudly on the `connected` reading |
| `expo-secure-store` needs a new native dev build; testing on the old client fails confusingly | High | Low | The runbook's step 1 rebuilds the dev client before anything else and names the exact failure signature |
| A future edit logs a credential in a `catch` block | Med | High | `no-console: 'error'` on both directories, the boundary scan, the leak test, and the planted-defect proof that shows the leak test fires |
| iCloud Keychain sync carries the password off-device | Low | High | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` on every write; asserted by a unit test on the adapter's options object |
| The dev fixtures surface reaches a release bundle | Low | High | Same guard shape as the merged `(dev)/gallery` route (`__DEV__` check before any hook, `require()` inside the guard), plus the existing route-parity test and a bundle-time check in the runbook |
| `mu-class-coverage.test.ts` fails after the map edit | Low | Low | The reclassification is three entries and the test names the mismatch; run it before the UI work (Implementation Order step 6) |
| The `feature` Jest project destabilises the RN tier | Low | Med | It is a separate project with its own environment, and `*.node.test.ts` is excluded from the `app` project — the same separation item #3 proved for `db` |
| The counts on `bank-connected` read zero until #10 lands and are mistaken for a defect | Med | Low | The runbook states it explicitly and uses the fixtures surface to show real counts |

---

## Code Samples

> Every snippet in this document is marked `// Illustrative — adapt during implementation` and is
> shape-only. Production code belongs in the implementation PR.

**Consistency note.** The names used across this plan are single-sourced:
`connectBank`, `upsertConnection`, `markConnectionSyncing`, `deleteConnectionIfNeverSynced`,
`listConnectionsForCredentialLookup`, `listConnectedBankSummaries`, `listInstitutions`,
`credentialsKeyFor`, `resolveLockedRut`, `foldForSearch`, `matchInstitutions`, `sortForPicker`,
`formatRutForDisplay`, `canConnect`, `resolveBackHref`, `resolveExitHref`, `buildSyncRequest`,
`getAppDatabase`, `BankRow`, `CONNECT_FLOW_STATE_COVERAGE`, and the secure-store key prefix
`bank_creds:`.

---

## Implementation Order

1. **Add the dependency and the boundary.** `pnpm add expo-secure-store@~15.0.8` in
   `apps/mobile`; add `secureStoreBoundary` to the root `eslint.config.mjs` and apply it plus
   `no-console: 'error'` in `apps/mobile/eslint.config.mjs`; add the `feature` Jest project.
   *Verify*: `pnpm install && pnpm check:layout && pnpm lint` — confirm the lint run reports no
   new violations and that a deliberate `import 'expo-secure-store'` added temporarily to a
   feature file is reported.
2. **Secure-store port, adapter and credential store**, with their unit tests and
   `secure-store-boundary.test.ts`. *Verify*: `pnpm --filter @finanzas/mobile test` — the
   boundary test passes and its exemption list resolves to the adapter file only.
3. **Runtime database handle.** Check whether `apps/mobile/src/db/runtime.ts` exists
   (Resolution R1). If it does, use it unchanged. If it does not, create it with
   `getAppDatabase(): Promise<AppDatabase>`. *Verify*: the whole `db` Jest project still passes
   unchanged.
4. **Connection repository.** Add the write-side functions, `listInstitutions`, and
   `listConnectedBankSummaries`, with tests in `src/db/__tests__/connections.test.ts` and
   `institutions.test.ts`. *Verify*: `pnpm --filter @finanzas/mobile test` and confirm the new
   tests assert `status = 'active'` and that `last_success_at` survives a later failed attempt.
5. **The service and its leak test.** Write `connect-bank.service.ts`, then
   `credential-leak.node.test.ts` and `connect-bank.service.node.test.ts`. Run the planted-defect
   proof and record its output for the PR body. *Verify*: the leak test fails with the planted
   `console.warn` and passes after `git checkout --`, with `git diff --stat` empty.
6. **`BankRow`, the `TextField` props, `componentMetrics.bank` and the `mu-class-map` edit**,
   plus the gallery section and its `ds.*` keys. *Verify*: `pnpm --filter @finanzas/mobile test`
   — `mu-class-coverage`, `gallery-catalogue-keys`, `theme-tokens-parity`, `no-style-literals`
   and `touch-targets` all pass; read the `mu-class-coverage` console line and confirm the
   `mu-bank*` classes are now counted as `primitive` rather than `deferred`.
7. **Catalogue copy.** Add every `connect.*` key to `es.json` (verbatim from the mockup) and
   `en.json`, in the flat lowercase dotted form the parity test requires. *Verify*:
   `pnpm --filter @finanzas/mobile test` — catalogue parity passes.
8. **Pure feature modules**: `institution-search.ts`, `credential-form.ts`,
   `flow-navigation.ts`, `connect-flow-store.ts`, `rut-lock.ts`, `sync-handoff.ts`, with their
   unit tests (parser-risk rows P1-P12). *Verify*: every enumerated edge case has a named test.
9. **The four screens and their hooks**, replacing `RoutePlaceholder` in each route file, plus
   `_layout.tsx`'s `headerShown: false` if item #8 has not already set it. *Verify*:
   `pnpm --filter @finanzas/mobile test && pnpm typecheck && pnpm lint`.
10. **State- and catalogue-coverage residuals**: `state-coverage.ts` plus
    `connect-flow-state-coverage.test.ts` and `connect-catalogue-keys.test.ts`. *Verify*: run
    them and confirm they name the four screens and their declared states, and that removing a
    state entry makes them fail.
11. **The dev fixtures surface** and the `DEV_ONLY_ROUTES` entry. *Verify*:
    `pnpm --filter @finanzas/mobile test` — `route-manifest-parity` passes; confirm the route
    renders nothing when `__DEV__` is forced false.
12. **Run the smoke runbook**
    `docs/testing/mobile/9-connect-a-bank-picker-credentials-secure-storage.smoke-test.md`
    end to end on a dev build, including the AC30 side-by-side comparison, and record the
    results in the PR body.
13. **Update project docs** per **Documentation Updates** above.
14. **Update `CHANGELOG.md`** under `[Unreleased]` → `### Added`, exactly:

    ```markdown
    - **Connect a bank: picker, credentials and secure storage** (#9): the connect-bank
      introduction with its security accordion, the bank picker over the seeded institution
      catalogue, the credential form with shared RUT validation, the rejection and RUT-locked
      states, and the connected screen. Credentials are written only to `expo-secure-store`,
      under a deterministic per-bank key, and the connection row holds the key and never a
      value. Adds the `BankRow` primitive and a dev-only connect-flow fixtures route.
    ```

---

## Follow-ups (not this item)

- **F1** — a `BankConfig`-driven credential form, when a second bank ships with a different field
  set (Decision 2).
- **F2** — converge `getConnectedBanksSummary` (item #8) and `listConnectedBankSummaries` (this
  item) into one reader once both have merged (Resolution R1).
- **F3** — register the four screens in `scripts/mobile-ui/fidelity-targets.json` once item #47
  is implemented, and replace the runbook's manual comparison with `pnpm fidelity --issue 9`
  (Resolution R3).
- **F4** — the "Sugerir un banco" control, when the product owner names a destination
  (spec Deferral Note 1 / Open Question 1).
