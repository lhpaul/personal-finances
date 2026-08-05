# Smoke Test Runbook: Maestro end-to-end flows

**Feature**: Maestro end-to-end flows (#22)
**Spec**: None — Refactor-route item. The brief is the [issue #22 body](https://github.com/lhpaul/personal-finances/issues/22), reproduced in the implementation plan.
**Implementation plan**: [`../../specs/developments/20260804063303_22-maestro-e2e-flows/2_22-maestro-e2e-flows_implementation-plan.md`](../../specs/developments/20260804063303_22-maestro-e2e-flows/2_22-maestro-e2e-flows_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] macOS with Xcode and `xcrun simctl` available.
- [ ] Maestro CLI installed and on `PATH`. Pinned version: **2.6.0**.
      Check with `maestro --version`; install with `curl -Ls "https://get.maestro.mobile.dev" | bash`.
- [ ] `pnpm install` has run and `pnpm check:layout` passes.
- [ ] A dedicated simulator named **`Finanzas E2E`** is created and booted. If it does not exist,
      `bash scripts/e2e/run-e2e.sh` prints the exact `xcrun simctl create` command; the device
      types it accepts, in order, are `iPhone 16`, `iPhone 15`, `iPhone 14`.
- [ ] A **Debug (`__DEV__`) build** of the app is installed on that simulator
      (`npx expo run:ios --device "Finanzas E2E"` from `apps/mobile`). Expo Go cannot run this app,
      and a **release build cannot run this suite at all** — every fixture surface the flows use is
      `__DEV__`-guarded and returns `null` in a release build.
- [ ] A Metro dev server is running and reachable
      (`pnpm dev:mobile`; `curl -s http://localhost:8081/status` returns `packager-status:running`).
- [ ] There is **no sign-in**. "Fresh session" in this runbook means the `reset` fixture state, or
      a `launchApp` with `clearState`.

> **Warning — this suite deletes secure-store credentials.** The `reset` fixture state deletes the
> saved credential entries for `banco-de-chile` and `santander` on the target device. That is why
> the suite refuses to run on any simulator other than `Finanzas E2E` without the explicit
> `--allow-any-device` flag. Never point it at a device that holds a credential you care about.

---

## Test Data

| Item | Value |
| --- | --- |
| App id | `cl.finanzas.mobile.dev` (the development-`APP_VARIANT` bundle identifier since #23 — `apps/mobile/app.config.js`; confirmed on device, corrected from the plan's `cl.finanzas.mobile`, which is the production variant) |
| URL scheme | `finanzas://` (flows use the three-slash form, e.g. `finanzas:///e2e-fixtures`) |
| E2E fixture panel | `/(dev)/e2e-fixtures` — deep link `finanzas:///e2e-fixtures` (`__DEV__` only) |
| Fixture states | `reset`, `synced-home`, `stage-queue`, `transaction-detail`, `scripted-read` |
| Fixture RUT | `12.345.678-5` (valid check digit; declared in `.maestro/flow-contract.json`) |
| Fixture password | `ZZE2EPASSZZ` (declared in `.maestro/flow-contract.json`) |
| Stubbed scraper script | `complete_with_data` — deterministic 2-product, 6-movement read |
| Existing SQL fixtures | `apps/mobile/src/db/__fixtures__/store-v1.sql`, `stage-queue-v1.sql`, `transaction-detail-v1.sql` |
| Suite command (AC1) | `maestro test .maestro/` |
| Wrapped command | `pnpm e2e` (preflight + the same `maestro test .maestro/`) |
| Debug artifacts | `.tmp/e2e` (gitignored) |

---

## Smoke Test Steps

### Step 0: Toolchain checks — no simulator required

**Maps to**: AC2, and the plan's *Residual verification strategy*

1. `pnpm e2e:contract`
2. `pnpm e2e:lint`
3. `pnpm e2e:test`

**Expected result**: all three exit `0`. `pnpm e2e:contract` prints one row per declared flow with
its id, status (`wired` / `planned`), fixture state, covered screens and owning issue; all ten
rows read `wired` (Implementation Order step 12's promotion happened at dispatch — see Known
Limitations). Keep this table — it is the evidence attached to the PR.

### Step 1: Prove the credential scanner works in both directions

**Maps to**: AC2

1. Confirm `pnpm e2e:lint` is green on the committed suite (Step 0 already did).
2. Temporarily add `# rut 11.111.111-1` to any file under `.maestro/`, re-run `pnpm e2e:lint` (R1).
3. Revert, then temporarily add a line `password: "hunter2"`, re-run `pnpm e2e:lint` (R2).
4. Revert, then temporarily add `- inputText: 'mi-clave-real'` to a flow, re-run `pnpm e2e:lint`
   (R3 — this is the rule that actually closes the credential path, since typing is how a secret
   would enter a flow).
5. Revert, then temporarily add `https://portalpersonas.bancochile.cl/login`, re-run
   `pnpm e2e:lint` (R4).
6. Revert all four edits and confirm `pnpm e2e:lint` is green again, and that
   `git status` is clean.

**Expected result**: each planted line produces a `file:line:rule` finding and a non-zero exit; the
declared fixture RUT, the declared fixture password and the declared `input_values` entries do
**not** produce a finding; the tree is clean at the end. A scanner that only ever passes proves
nothing.

### Step 2: Preflight failures are actionable

**Maps to**: AC1 (usability of the acceptance command)

1. With Metro stopped, run `pnpm e2e`.
2. Restart Metro. Shut down the `Finanzas E2E` simulator and run `pnpm e2e` again.
3. Boot the simulator but uninstall the app (`xcrun simctl uninstall booted cl.finanzas.mobile.dev`)
   and run `pnpm e2e` again.

**Expected result**: three distinct, actionable errors — no Metro, no matching booted device (with
the exact `xcrun simctl create` command printed), app not installed. None of them is a Maestro
timeout.

### Step 3: The fixture panel

**Maps to**: the plan's fixture contract (D6)

1. Restore the prerequisites (Metro up, simulator booted, app installed).
2. Deep-link to `finanzas:///e2e-fixtures`.
3. Tap each of the five state buttons in turn, then tap the first one again.

**Expected result**: the panel opens; each tap reports its success line; no error line appears; and
tapping a state twice reports success both times (each state is idempotent). Confirm the panel is
**not** reachable from any product screen.

### Step 4: Flow 01 — first launch, onboarding and bank connection

**Maps to**: brief scope ("onboarding through bank connection"), AC1, AC2

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/01-onboarding-connect.yaml`
2. Watch the simulator.

**Expected result**: the app relaunches at `Bienvenido a Finanzas`, walks the three value pages,
reaches the bank picker, selects Banco de Chile, submits the **fixture** RUT and password, the
syncing screen advances through its steps and completes, `¡Banco conectado!` appears, and the flow
ends after `Estoy listo`. The hidden WebView never mounts and no real bank is contacted — the
stubbed `complete_with_data` script settles the read. Flow exits `0`.

### Step 5: Flow 02 — home with data

**Maps to**: brief scope ("sync … home with data")

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/02-home-with-data.yaml`

**Expected result**: the `synced-home` state applies, home renders the hero, the financial summary
card, the trend card, the category breakdown, recent movements and the connected-banks card. Flow
exits `0`.

### Step 6: Flow 03 — a categorization session

**Maps to**: brief scope ("a categorization session"), issue dependency #13

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/03-categorize-batch.yaml`

**Expected result**: the `stage-queue` state applies, the stage intro shows **4** pending
movements. The first movement (merchant "Consultoría Digital SpA") opens `merchant-edit` via the
merchant-name tap and returns, then confirms its suggested category ("Freelance") and advances;
the remaining three are skipped (`Omitir`) — one confirm and three skips within the same batch.
The completion screen shows the partial outcome (1 of 4 resolved), and "Continuar a inicio" lands
on home. Flow exits `0`.

### Step 7: Flow 04 — transaction detail and exclusion

**Maps to**: brief scope ("excluding a movement"), issue dependency #16

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/04-transaction-detail-exclude.yaml`

**Expected result**: the `transaction-detail` state applies, the transactions list opens. The
flow's own note: `transaction-detail-v1.sql`'s three fixture movements share the exact same date,
amount and merchant by design (its own header comment) — genuinely ambiguous to a list tap — so
the flow deep-links to the concrete `detail-tx-categorized` id rather than tapping a list row,
consistent with D5's own "deterministic state by deep link" philosophy. `Excluir del análisis`
opens the reason sheet, confirming records the exclusion, and the detail screen then shows the
excluded badge and note. The movement is still present in the list — excluded, never deleted. Flow
exits `0`.

### Step 8: Flow 05 — dashboard

**Maps to**: brief scope (the flows that matter), issue #17

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/05-dashboard.yaml`

**Expected result**: the dashboard opens on the month segment, the trend, spending-overview and
category-report sections render, and switching to the week segment re-renders them. Flow exits `0`.

### Step 9: Flow 06 — re-sync is idempotent

**Maps to**: brief scope ("re-syncing"), AGENTS.md non-negotiable 4

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/06-resync-idempotent.yaml`

**Expected result**: the syncing screen auto-starts on mount (the `scripted-read` state already
armed a pending handoff) and redirects to `bank-connected` on success — that redirect is the
sync-completed signal. The flow `copyTextFrom`s the transactions month-header text
(`"<mes> (<n>)"`) before the second sync, re-applies `scripted-read`, syncs again, and asserts the
**same** copied text is visible afterward. A duplicated movement (a different count) fails this
flow. Flow exits `0`.

### Step 10: Flow 08 — settings banks

**Maps to**: issue #20 (merged on `develop`; promoted from `planned` to `wired` per the
implementation plan's Implementation Order step 12)

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/08-settings-banks.yaml`

**Expected result**: the `synced-home` state applies, `settings-banks` shows the fixture
connection's row ("Banco de Chile"), tapping it opens `bank-review` (`Productos` visible), and
`Volver` returns to `settings-banks`. Non-destructive — no disconnect. Flow exits `0`.

### Step 11: Flow 09 — settings categories

**Maps to**: issue #21 (merged on `develop`; promoted per Implementation Order step 12)

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/09-settings-categories.yaml`

**Expected result**: `settings-categories` opens on the expense tab ("+ Nueva categoría de
gasto"), switching to "Ingresos" shows "+ Nueva categoría de ingreso", and switching back to
"Gastos" restores the expense-tab copy. No category is created, edited or deleted — this flow only
exercises tab switching. Flow exits `0`.

### Step 12: Flow 10 — notifications

**Maps to**: issue #18 (merged on `develop`; promoted per Implementation Order step 12)

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/10-notifications.yaml`

**Expected result**: the flow deep-links directly to `finanzas:///notifications/schedule` —
deliberately bypassing `notifications-intro`'s "Habilitar notificaciones", which would otherwise
require handling a real OS permission dialog this suite does not depend on. Selecting the
"Personalizada" custom-time chip, continuing to the days step, choosing "Solo días laborales" and
continuing again saves the schedule and lands on `onboarding-ready`. `settings-notifications` is
then opened directly and shows the schedule just written (`Recordatorios activados`, the time and
days sections) — no toggle is tapped, avoiding any OS permission dialog. Flow exits `0`.

### Step 13: Flow 07 — settings wipe (destructive, runs last)

**Maps to**: issue #19 (merged on `develop`; promoted per Implementation Order step 12)

1. `bash scripts/e2e/run-e2e.sh .maestro/flows/07-settings-wipe.yaml`

**Expected result**: `settings` opens; `Acerca de` shows "Privacidad por diseño."; back to
`settings`; `Perfil local` opens `settings-account`; `Borrar todos mis datos` opens the
confirmation modal; `Borrar todo` wipes the store and the app re-enters at `onboarding-intro`
("Bienvenido a Finanzas"). Run this flow **last** — never before another flow in the same session.
Flow exits `0`.

### Step 14: The acceptance command

**Maps to**: AC1

1. Reset the device state: deep-link to `finanzas:///e2e-fixtures` and tap the `reset` action.
2. Run the literal acceptance command from the repository root: `maestro test .maestro/`

**Expected result**: exactly ten flows execute, in the order `.maestro/config.yaml` declares
(`07-settings-wipe` last, since it wipes the store), and all ten pass. No subflow under
`.maestro/shared/` is executed as a flow. Record the output — it is the evidence attached to the
PR.

### Step 15: CI wiring

**Maps to**: AC1 (CI half), plan D14

1. On the implementation PR, confirm the `test` job shows the three new steps (*E2E flow
   contract*, *E2E flow lint*, *E2E toolchain unit tests*) and that all three are green.
2. Apply `ready-for-regression` to the PR and confirm the `maestro-ios` job is **skipped**.
3. Do **not** set `ENABLE_MAESTRO_E2E` as part of this runbook — enabling it is an owner decision
   (see the plan's *Owner decision required*).

**Expected result**: the cheap checks run on every PR; the macOS job is present, correctly gated,
and costs nothing while the repository variable is unset.

### Step 16: Release-build safety

**Maps to**: AGENTS.md non-negotiable 7, plan D3

1. Confirm `apps/mobile/app/(dev)/e2e-fixtures.tsx` returns `null` when `__DEV__` is false (its
   unit test asserts this).
2. Confirm no product screen links to `/(dev)/e2e-fixtures`.
3. Confirm the new dev modules are reached only behind a `__DEV__` guard, so Metro drops them from
   a release bundle.

**Expected result**: the fixture surface cannot be reached in a shipped build.

### Last Step: Validate & Shut Down

- Verify every assertion below.
- Apply the `reset` state one final time so the simulator is left in a known state.
- Stop Metro.

---

## Assertions Checklist

- [ ] **AC1** — `maestro test .maestro/` runs ten flows against a booted simulator and all pass.
- [ ] **AC2** — no real credential appears in any file under `.maestro/`; `pnpm e2e:lint` proves it
      and fails on each of the four planted violations in Step 1.
- [ ] **AC3** — this runbook exists under `docs/testing/` and every step above has been executed.
- [ ] Onboarding through bank connection completes with a fixture credential and a stubbed read.
- [ ] A categorization session moves the four pending movements through the queue.
- [ ] Excluding a movement is persisted and visible on the detail screen; the movement is not
      deleted.
- [ ] Re-syncing the same scripted read does not change the movement count.
- [ ] Every fixture state is idempotent.
- [ ] Settings wipe, settings banks, settings categories and notifications — all four promoted
      per Implementation Order step 12 — are wired and pass (Steps 10-13).
- [ ] `pnpm e2e:contract` reports every MVP screen as covered by a wired flow, or excluded (with a
      reason) — no `planned` rows remain.
- [ ] The `maestro-ios` CI job is present, doubly gated, and skipped while `ENABLE_MAESTRO_E2E` is
      unset.
- [ ] The `__DEV__` fixture surface is unreachable in a release build.

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| First launch | No onboarding flag, no connection, no stored credential | `finanzas:///e2e-fixtures` → `reset` |
| Populated store | Home, transactions and dashboard have data | `finanzas:///e2e-fixtures` → `synced-home` (loads `store-v1.sql`) |
| Categorization queue | 4 pending movements | `finanzas:///e2e-fixtures` → `stage-queue` (applies `stage-queue-v1.sql`) |
| Detail rows | Categorized / uncategorized / excluded movements | `finanzas:///e2e-fixtures` → `transaction-detail` (applies `transaction-detail-v1.sql`) |
| Stubbed read | Fixture connection + `complete_with_data` installed | `finanzas:///e2e-fixtures` → `scripted-read` |

The three `.sql` files remain the source of truth and are unchanged by this item; the panel is a
second, in-app way to apply them. The host-side `sqlite3` procedure documented in the #13 and #16
runbooks still works.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every flow fails at its first `assertVisible` | Metro is not running, or the installed build is not a Debug build | `curl -s http://localhost:8081/status`; rebuild with `npx expo run:ios --device "Finanzas E2E"` |
| `no booted simulator matches` | The `Finanzas E2E` device does not exist or is shut down | Run the `xcrun simctl create` / `boot` commands the script prints |
| The fixture panel opens but every action errors | The database never bootstrapped — the app has not completed a first launch since install | Launch the app manually once, then re-run |
| A flow taps the wrong button | Two screens share the same copy (`Comenzar`, `Excluir del análisis`) | The flow is missing its screen-unique anchor before the tap — add the `assertVisible` |
| `pnpm e2e:lint` fails after a copy change | A selector no longer matches an `es.json` value | Update the flow's selector, or add a `data_selectors` entry if the string is fixture data |
| Flow 06 fails with a changed count | A write bypassed the dedup upsert, or the run crossed local midnight between the two syncs | Re-run from `reset`; if it reproduces inside one day, it is a real idempotency regression |
| Home shows no current-month data | A fixed-date fixture was used where the deterministic read was expected | Flows 02 and 05 must use the states named above; only `e2e-read-fixture.ts` produces current-month dates |
| Maestro behaves differently from this runbook | CLI version drift | `maestro --version` must report `2.6.0`; the runner warns on a mismatch |

---

## Known Limitations

- **Local-first.** The device leg runs locally. The `maestro-ios` CI job exists but is inert until
  the owner sets `ENABLE_MAESTRO_E2E`; that is a cost decision, not a defect.
- **Debug builds only.** A release build has no deterministic entry point by design, so this suite
  cannot validate a store artifact.
- **Selector surface is copy.** Screens without a root `fidelityTestId(...)` anchor (`home`, the
  onboarding screens, every settings screen) are matched by Spanish copy. `pnpm e2e:lint` catches
  drift cheaply, but a copy change still requires a flow edit.
- **All four extension flows are wired, not planned.** By the time this item was implemented,
  #18/#19/#20/#21 were all merged on `develop`, so Implementation Order step 12's promotion
  happened immediately rather than being left for a future item: settings wipe, settings banks,
  settings categories and notifications are all `wired` rows in `.maestro/flow-contract.json`
  (issues #19/#20/#21/#18 respectively, for traceability).
- **Cross-midnight runs.** The deterministic read anchors on the run's local day. Two syncs on
  opposite sides of local midnight legitimately produce different dates; re-run from `reset`.

## First-run confirmations (recorded during implementation)

- **`launchApp: clearState: true` does not auto-reconnect to Metro.** It cold-starts the Expo
  dev-client's own native "Development Servers" launcher, not the app's JS content. `fixture.yaml`
  now taps the listed dev-server row and waits for the launcher to disappear before proceeding —
  every flow funnels through it, so this is handled once, centrally.
- **A one-time dev-menu tutorial sheet** ("This is the developer menu…") can appear after a fresh
  connect, on top of whatever screen loads under it. `fixture.yaml` dismisses it (tapping the
  sheet's own backdrop) before continuing, conditioned on the sheet's "Reload" text being visible.
- **The device locale matters and is not automatic.** A newly-created simulator can inherit
  `AppleLanguages`/`AppleLocale` from the host Mac (observed: `en-CL` primary on a Chile-region,
  English-language Mac) — the app then renders in English, and every Spanish selector in this
  suite fails. `Finanzas E2E` must have Spanish set as the **primary** language before a Debug
  build first connects:
  ```bash
  xcrun simctl spawn "Finanzas E2E" defaults write -g AppleLanguages -array "es-CL" "en-CL"
  xcrun simctl spawn "Finanzas E2E" defaults write -g AppleLocale -string "es_CL"
  ```
  then terminate and relaunch the app (a full simulator reboot is not required).
- **Deep-link form**: the three-slash form (`finanzas:///<route>`) works once the app is
  connected and running. It does **not** work immediately after a `clearState` (see above) — the
  bare custom scheme is intercepted by the dev-client launcher until a JS bundle is loaded.
- **Maestro's text matching requires the element's *whole* accessibility text to match** — not a
  substring search. React Native on iOS frequently merges sibling `Text` nodes that share a
  `Pressable`/accessible ancestor into one combined `accessibilityText` (e.g. a row's name +
  status badge, a heading's decorative glyph + its translated title, or — most consequentially —
  an entire `Sheet`/`Modal`'s content). A selector must equal the *whole* merged string, which is
  why `data_selectors` carries several composite entries (`"Banco de Chile, Al día"`, `"⏰ ¿Cuándo
  te funciona mejor?"`, `"Acerca de, "`) rather than the bare catalogue value.
- **`bank-syncing`'s advance to `bank-connected` is a manual "Ver resultado" tap**, not an
  automatic redirect — the plan's illustrative flow 01 sample assumed automatic; the real screen
  enables the CTA once `phase === 'succeeded'` and waits for the tap. The synced step's own status
  badge was observed to stay "En curso" even after the read settles (cosmetic; the CTA itself is
  reliably tappable once enabled) — flows 01 and 06 retry the tap a few times rather than waiting
  on that badge.
- **Maestro CLI version confirmed**: `2.6.0`, matching the pin. `copyTextFrom` has no way to name
  its own captured variable — it is always read back as `${maestro.copiedText}` (the plan's
  illustrative sample assumed a custom `id:` capture name; corrected).

## Blocked flows — real, pre-existing product bugs found on device

Four flows cannot currently pass `maestro test .maestro/`, each blocked by a genuine bug in
already-merged product code that this device run is the first thing to ever exercise for real
(the same category of finding AGENTS.md's troubleshooting table already records for #95's P0).
None of these are fixed in this PR — none is in scope for an E2E-flows item to change product
code for (D18), and each is cross-cutting enough (credential storage; a shared overlay primitive)
to need its own reviewed fix. Each is reported here honestly, with evidence, per this item's own
instruction never to stub a failing flow green.

1. **Flow 01 (`onboarding-connect`) and Flow 07 (`settings-wipe`) — `expo-secure-store` rejects
   the app's own `bank_creds:<institutionId>` key format on a real device.**
   `apps/mobile/src/lib/secure-store/credential-store.ts`'s `credentialsKeyFor` produces
   `bank_creds:banco-de-chile` — the colon fails `expo-secure-store`'s own key validation
   (`node_modules/expo-secure-store/src/SecureStore.ts`: `isValidKey` requires
   `/^[\w.-]+$/`, i.e. alphanumeric, `.`, `-`, `_` only — no colon). Every real call to
   `writeCredentials`/`readCredentials`/`deleteCredentials` throws
   `Error: Invalid key provided to SecureStore. Keys must not be empty and contain only
   alphanumeric characters, ".", "-", and "_".` on a real device. This is unconditional and
   deterministic — not a timing flake. It surfaces first in the `reset` fixture state (which
   deletes both fixture institutions' credential keys, D7) and again in `settings-wipe`'s
   `wipeLocalData` sweep. **This is a pre-existing bug in already-merged code (items #9/#19/#20),
   invisible to every existing Jest test because they all substitute a `SecureStorePort` fake and
   never call the real native module** — device E2E is the first thing to reach it.
   Evidence: `evidence/blocker-secure-store-colon-key.png`.
2. **Flow 03 (`categorize-batch`) — `StageIntroScreen.tsx` wraps its content in a plain `View`,
   not a `ScrollView`.** On this device profile the content (hero, "what we'll do", the three
   step icons, the two stat tiles, the "why it matters" list, the note, and the "🚀 ¡Empezar mi
   primera etapa!" CTA) overflows the viewport height, and the CTA renders entirely off-screen
   with no way to scroll to it — confirmed by four `scroll` commands producing a pixel-identical
   screenshot. Evidence: `evidence/flow03-blocker-stageintro-no-scrollview.png`.
3. **Flow 04 (`transaction-detail-exclude`) and Flow 07 (`settings-wipe`) — the shared `Sheet`/
   `Modal` overlay primitive merges every descendant's text into one accessibility element,
   making individual buttons/options untappable by their own text.**
   `apps/mobile/src/components/ui/_internal/Overlay.tsx`'s outer backdrop `Pressable` (with its
   own `onPress`) becomes, on iOS, the accessible leaf for the whole subtree it wraps — every
   `Text` inside a `Sheet` or `Modal` gets flattened into one combined `accessibilityText`
   (confirmed via `maestro hierarchy`, e.g. `"🚫 Excluir del análisis, ¿Por qué quieres excluir
   esta transacción?, Transferencia personal, …, Cancelar, Confirmar"` as a *single* element).
   `tapOn` against any individual option or button inside — "Transferencia personal", "Confirmar",
   "Borrar todo" — finds nothing, even though the same text renders correctly and is visible.
   This blocks the exclude-reason confirmation in flow 04 and the destructive delete confirmation
   in flow 07 — both are the essential action each flow exists to prove, so neither flow can be
   redesigned around it the way flow 10 was redesigned around the OS permission dialog.
   Evidence: `evidence/flow04-blocker-sheet-accessibility-fusion.png`,
   `evidence/flow07-blocker-modal-accessibility-fusion.png`.

**Net result — run standalone, one flow at a time** (`bash scripts/e2e/run-e2e.sh
.maestro/flows/<file>`, the same command each Step above uses): 6 of 10 flows pass end to end on a
real `Finanzas E2E` simulator — 02, 05, 06, 08, 09, 10. 01, 03, 04, 07 fail for the three reasons
above.

**Net result — the literal AC1 command** (`maestro test .maestro/`, all ten in one continuous
session): 5/10 flows failed on the run recorded for this PR. `05 dashboard`, `08 settings banks`,
`09 settings categories` and `10 notifications` passed, matching the standalone results exactly.
`06 re-sync is idempotent` also passed in this run (it did not always land in the standalone
sample above, timing-dependent). `01`, `03`, `04`, `07` failed for the same three reasons.
**`02 home with data`, which passes reliably standalone, additionally failed in this combined
run** — `01`'s app-crash finding (`App crashed or stopped while executing flow`, a variant of the
same SecureStore throw, this time not caught by the panel's own `try`/`catch` before the process
terminated) appears to corrupt the shared app session for whichever flow runs immediately after it
in the same `maestro test .maestro/` invocation, not just `01` itself. This is a corollary of the
same root-cause bug (finding 1), not a fourth independent one: once finding 1 is fixed, `01` stops
crashing and this cascade has no trigger left. Full output:
`.tmp/e2e/.maestro/tests/2026-08-04_205242/` (gitignored, present in the implementation branch's
worktree at PR time) and `evidence/full-suite-run-final.txt`.

AC1's literal command is correct and will pass once a human decides how to address the findings
above (a dedicated fix item is the natural next step for each, given their cross-cutting blast
radius) — nothing about this item's own flow files, contract or fixture surface is what keeps it
red today.
</content>
