# Smoke Test Runbook: Bank syncing progress screen

**Feature**: Bank syncing progress screen (`#screen=bank-syncing`) — issue
[#11](https://github.com/lhpaul/personal-finances/issues/11)
**Work item brief**: [issue #11](https://github.com/lhpaul/personal-finances/issues/11) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `bank-syncing`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**: [`2_11-bank-syncing-progress_implementation-plan.md`](../../specs/developments/20260802144102_11-bank-syncing-progress/2_11-bank-syncing-progress_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A dev build, not Expo Go, and a freshly rebuilt one.** This screen adds
      `react-native-webview`, a native module, on top of `expo-sqlite`, `expo-crypto` and
      `expo-secure-store`. A dev client built before this change cannot resolve it at runtime.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison:
      `open design/mockups/mobile/index.html`.
- [ ] Items #6, #8, #9, #10 and #47 are merged. Steps 6-9 exercise a real bank read and cannot be
      run without them.
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks.

> **Real-bank steps are optional and are marked as such.** Steps 1-5, 7 and 10-12 run entirely
> off the `__DEV__` scripted-runner fixture surface and need no bank credentials. Steps 6, 8 and 9
> need a real Banco de Chile login and are the only place a real credential is ever typed. Never
> paste a real credential into a PR, an issue, a log or a screenshot.

---

## Test Data

| Item | Value |
| --- | --- |
| Syncing route | `/(onboarding)/bank-syncing` — deep link `finanzas:///bank-syncing` (Expo Router route groups are not part of the URL) |
| Dev sync-fixtures route | `/(dev)/sync-fixtures` — deep link `finanzas://sync-fixtures` (`__DEV__` only) |
| Dev connect-fixtures route | `/(dev)/connect-fixtures` — deep link `finanzas://connect-fixtures` (`__DEV__` only, item #9) |
| Mockup reference | `design/mockups/mobile/index.html#screen=bank-syncing&state=<state>` |
| Manifest states | `login` (initial), `products`, `transactions`, `error` |
| Fidelity ready `testID` | `fidelity-bank-syncing` |
| Sentinel RUT (fixtures only) | `11.111.111-1` |
| Sentinel password (fixtures only) | `SENTINEL-NOT-A-REAL-PASSWORD` |

---

## Smoke Test Steps

### Step 1: The `login` state

**Maps to**: brief AC1; plan Decisions 2 and 3.

1. Deep-link to `finanzas://sync-fixtures`.
2. Choose **Mantener en «Iniciando sesión»**.
3. Tap **Ir a la pantalla de sincronización**.
4. Open `design/mockups/mobile/index.html#screen=bank-syncing&state=login` beside it.

**Expected result**: the 🔄 block with *Conectando con Banco de Chile…* and *Esto ocurre dentro
de tu teléfono. Puede tomar hasta un minuto.* Below it, the card with a bar filled to roughly a
quarter and three rows:

| Row | Icon | Badge |
| --- | --- | --- |
| Sesión iniciada | ✅ | **En curso** (info) |
| Leyendo productos | ⏳ | **Pendiente** (neutral) |
| Descargando movimientos | ⏳ | **Pendiente** (neutral) |

Row 1's ✅ next to an *En curso* badge is **correct** — it is what the mockup draws (plan
Assumption A3). No error block, no danger note, no buttons.

### Step 2: The `products` state

**Maps to**: brief AC1; plan Decision 2.

1. Return to `finanzas://sync-fixtures` and choose **Mantener en «Leyendo productos»**.
2. Go to the syncing screen and compare against `…&state=products`.

**Expected result**: the bar is at roughly 60%. Row 1 shows **Listo** (green), row 2 shows ⏳
with **En curso**, row 3 still ⏳ / **Pendiente**. The headline block is unchanged.

### Step 3: The `transactions` state

**Maps to**: brief AC1; plan Decisions 2 and 3; Assumption A2.

1. Return to `finanzas://sync-fixtures` and choose **Mantener en «Descargando movimientos»**.
2. Go to the syncing screen and compare against `…&state=transactions`.

**Expected result**: the bar is at roughly 90%. Rows 1 and 2 show **Listo**, row 3 shows ✅ with
**En curso**. The **Ver resultado** button is visible but **disabled** (muted, does not respond
to a tap) — the read has not finished, and `bank-connected` refuses to render before a successful
sync. Record whether the disabled state reads as broken; that evidence decides plan Assumption
A2.

### Step 4: Progress only ever moves forward

**Maps to**: brief AC1; plan Decision 3.

1. Return to `finanzas://sync-fixtures` and choose **Reproducir avance completo (lento)**.
2. Watch the whole sequence without leaving the screen.

**Expected result**: the bar grows and never shrinks, and no step row ever goes back from
**Listo** to **En curso** or **Pendiente**, even though the script deliberately replays an
earlier step and reports a lower progress number partway through.

### Step 5: The success frame

**Maps to**: brief AC1; plan Assumption A2.

1. Return to `finanzas://sync-fixtures` and choose **Completar la lectura**.
2. Go to the syncing screen.

**Expected result**: the screen settles on the `transactions` frame with all three rows done and
**Ver resultado** now **enabled**. Tapping it lands on `#screen=bank-connected`.

### Step 6 (real bank — optional): a real read moves the screen

**Maps to**: brief AC1.

1. Delete and reinstall the app (or clear its data) so no connection exists.
2. Walk the onboarding flow to `#screen=bank-credentials` and enter **your own real** Banco de
   Chile RUT and internet password.
3. Tap **Conectar** and stay on the syncing screen for the whole read.

**Expected result**: the screen advances through *Iniciando sesión* → *Leyendo productos* →
*Descargando movimientos* as the read actually progresses — not on a fixed timer. It never sits
on the first step for the whole read, and it never jumps straight to the last one. When the read
finishes, **Ver resultado** becomes enabled and `bank-connected` reports a real product and
movement count.

**Record**: roughly how long each phase took. If the whole read is under two seconds, note it —
steps 1-3 are then the only reliable way to inspect the intermediate frames.

### Step 7: The `error` state, all four failure reasons

**Maps to**: brief AC2; plan Decisions 6 and 7.

For each of the four reasons in turn — **Credenciales rechazadas**, **Sesión cerrada por el
banco**, **Sin conexión**, **El banco cambió su sitio**:

1. Return to `finanzas://sync-fixtures` and choose that failure script.
2. Go to the syncing screen.
3. For the *Sesión cerrada* case only, compare against
   `design/mockups/mobile/index.html#screen=bank-syncing&state=error`.

**Expected result**: the ⚠️ block with *No pudimos completar la conexión*, then a body that
**names what happened in plain Spanish**, then the danger note *Si tu banco pide una clave
dinámica o bloqueó la sesión, vuelve a intentarlo en unos minutos.*, then **Reintentar** and
**Elegir otro banco**. For *Sesión cerrada* the body is the mockup's exact sentence, *El banco
cerró la sesión antes de terminar. Tus credenciales siguen guardadas en el dispositivo.*

**In every one of the four**, confirm the body contains **no** stack trace, **no** English, no
`Error:` prefix, no URL, no HTML fragment, no bank error code and nothing that looks like it came
from the bank's own page. That is the whole of AC2.

### Step 8 (real bank — optional): retry does not ask again

**Maps to**: brief AC3; plan Decision 8.

1. With a real connection already made in step 6, put the phone into airplane mode.
2. Trigger a sync (re-enter the flow from `#screen=settings-banks`, or use
   `finanzas://connect-fixtures` to re-enter the connect flow) and let it fail.
3. Turn airplane mode off.
4. Tap **Reintentar**.

**Expected result**: the screen returns to *Iniciando sesión* **in place**. You are **not** taken
back to the credentials form and you are **not** asked for your RUT or password again. The read
runs to completion. Afterwards, `#screen=bank-connected` (or the banks list) shows the same
product count as before, **not double** — re-syncing is idempotent (BR5).

### Step 9 (real bank — optional): a credential rejection is the exception

**Maps to**: brief AC3; plan Decision 8; `BEHAVIOR.md` (*"volver a `bank-credentials` si el fallo
fue de autenticación"*).

1. Enter a **wrong password** with your own correct RUT, once. (Once. Repeated wrong attempts
   lock a real bank account — that is why the app never retries this failure automatically.)
2. Let the read fail.
3. Tap **Reintentar**.

**Expected result**: the error body is about the bank rejecting the data, and **Reintentar**
takes you to `#screen=bank-credentials` in its `error` state with the RUT still filled — the one
failure where the person genuinely has to supply something new. Enter the correct password and
confirm the sync then succeeds.

### Step 10: Leaving mid-sync (decision D3)

**Maps to**: plan Assumption A1 and Decision 9; `BEHAVIOR.md` open decision **D3**.

1. Start any long-running script from `finanzas://sync-fixtures` (or a real read from step 6).
2. While the screen is on *Leyendo productos*, navigate away — back gesture, or deep-link to
   `finanzas://(tabs)/home`.
3. Come back to the flow.

**Expected result**: the read **stops**. No error is shown and no error badge appears anywhere
for that bank — a stop the person caused is not a failure. Whatever the read had already gathered
is kept, nothing is duplicated, and starting a sync again works normally. `bank-connected` is
**not** reachable, because no successful sync has completed yet; you land back in the connect
flow instead.

**Record**: this is the observable half of decision **D3**. If a person would expect the sync to
carry on in the background, say so in the PR — it is a future item, not a bug in this one.

### Step 11: Nothing typed reaches anything that persists

**Maps to**: `AGENTS.md` non-negotiable 1.

1. Deep-link to `finanzas://connect-fixtures` and plant the sentinel credential
   (`11.111.111-1` / `SENTINEL-NOT-A-REAL-PASSWORD`).
2. Run any script from `finanzas://sync-fixtures`, including one of the failure scripts.
3. With the Metro/dev-client console open the whole time, search its output for `SENTINEL` and
   for `11.111.111`.
4. Pull the on-device database and grep it:
   `sqlite3 <db-path> ".dump" | grep -i -e SENTINEL -e '11\.111\.111'`.

**Expected result**: **zero** matches in the console and **zero** in the dump — including in
`user_financial_institutions.last_error_message`, which must hold one of the four
`sync.errors.*` keys and nothing else. The automated equivalent is
`apps/mobile/src/features/bank-syncing/credential-leak.db.test.ts`; this step is the on-device
confirmation that the automated one is testing the real path.

### Step 12: Design fidelity — expected vs actual

**Maps to**: the brief's *"Open `design/mockups/mobile/index.html` and compare side by side before
marking done"*; plan Decision 12.

1. Open the reference asset for each state:
   `design/mockups/mobile/index.html#screen=bank-syncing&state=login`, `…&state=products`,
   `…&state=transactions`, `…&state=error`.
2. Compare the implemented screen against each reference side by side (lightweight visual check,
   not a pixel diff): the 🔄 / ⚠️ block, the headline and paragraph, the card, the bar width, the
   three rows with their icons and badges, the danger note, and the buttons.
3. Run the automated gate: `pnpm fidelity --issue 11`.
4. Record PASS/FAIL per state, with expected-vs-actual detail on any failure.

**Expected result**: all four states match the reference; `pnpm fidelity --issue 11` exits 0 for
all four targets. The gate drives the screen through
`finanzas:///bank-syncing?fidelity=1&fidelityScreen=bank-syncing&fidelityState=<state>` (no
`(onboarding)` segment — Expo Router route groups are not part of the URL, matching every sibling
onboarding screen's own wired mapping), which renders the state without starting a read, so the
capture is stable rather than mid-flight. Do **not** raise `max_mismatch_pct` to make a state
pass — fix the screen, or record a `threshold_note` with a real measured reason.

**Recorded result (this implementation)**: all four targets **FAIL** at ~98.9% mismatch — the
captured app screenshot shows the dev client's "No script URL provided" red-box error screen, not
the syncing screen. This is the known stale-dev-client environment limitation the runbook's
Known Limitations section already names (no dev build with `react-native-webview` linked, no
`pnpm dev:mobile` bound to the booted simulator, in this execution environment) — not a defect in
the screen. `pnpm fidelity:contract` itself passes (27 wired targets, up from 23, including all
four of this item's), and `pnpm fidelity:test`'s 47 cases — including the one that proves a wired
mapping's `app_file` genuinely contains its `fidelityTestId()` call — all pass.

### Step 13: The dev surface does not ship

**Maps to**: plan Decision 10.

1. Confirm no product screen links to `/(dev)/sync-fixtures` — it is reachable by deep link only.
2. Confirm `apps/mobile/app/(dev)/sync-fixtures.tsx` returns `null` when `__DEV__` is false and
   `require()`s its panel **inside** that branch, matching `(dev)/gallery.tsx` and
   `(dev)/sample-data.tsx`.
3. Confirm `/(dev)/sync-fixtures` is listed in `DEV_ONLY_ROUTES` in
   `apps/mobile/src/test-utils/route-inventory.ts`.

**Expected result**: the route is reachable only by deep link in a dev build. The `__DEV__` guard
sits before any hook and the implementation is `require()`d inside it, so Metro's dead-code
elimination can drop `src/dev/` from a release bundle — a static top-level import could not be
eliminated the same way. This mirrors item #12's runbook step 12 rather than prescribing a
release-export command this repository has not yet exercised.

### Last Step: Validate & shut down

- Verify every assertion below.
- Turn airplane mode off if step 8 left it on.
- Stop Metro (`Ctrl-C`).
- If a real credential was used in steps 6, 8 or 9, remove the connection from
  `#screen=settings-banks` (or reinstall the app) before handing the device to anyone else.

---

## Assertions Checklist

Each checkbox maps to a criterion from the work item brief or to a non-negotiable.

- [ ] **AC1** — Each scraper step updates the UI as it happens: `login` → `products` →
      `transactions` are each observably distinct (steps 1-3), a real read walks them in real time
      (step 6), and the bar and the rows never move backwards (step 4).
- [ ] **AC1** — All four manifest states render: `login`, `products`, `transactions` (steps 1-3,
      5) and `error` (step 7).
- [ ] **AC2** — Every one of the four failure reasons produces a distinct, plain-Spanish,
      actionable message (step 7).
- [ ] **AC2** — No error surface shows a stack trace, an `Error:` prefix, English text, a URL, an
      HTML fragment or any bank-authored string (step 7).
- [ ] **AC3** — Retry after a non-credential failure re-runs the sync in place and never asks for
      the RUT or the password again (step 8).
- [ ] **AC3** — Retry after a credential rejection is the single exception and returns to the
      credentials form (step 9).
- [ ] **BR5** — A retry after a partial read does not duplicate products or movements (step 8).
- [ ] **Non-negotiable 1** — No credential value appears in the console or in the database dump,
      including in the recorded failure message (step 11).
- [ ] **Non-negotiable 6** — All four states match the mockup side by side, and
      `pnpm fidelity --issue 11` passes for all four targets (step 12).
- [ ] **Non-negotiable 8** — Every user-facing string on the screen is Spanish from the mockup
      catalogue; nothing renders a raw key such as `bank_syncing.error.body.network` (steps 1-7).
- [ ] **D3** — Leaving the screen mid-sync stops the read, keeps what was gathered, and shows no
      error (step 10).
- [ ] The `__DEV__` fixture surface is absent from a release bundle (step 13).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| **None** | Products, movements and connections are produced by a sync, never seeded. | — |
| Bank connection | Needed by steps 6, 8, 9 | Item #9's connect flow, or `finanzas://connect-fixtures` |
| Sentinel credential | Needed by step 11 | `finanzas://connect-fixtures` → plant a credential entry |
| Scripted read outcomes | Needed by steps 1-5, 7, 10 | `finanzas://sync-fixtures` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Unable to resolve "react-native-webview"` at runtime | The dev client predates this change | Rebuild the dev build; Expo Go cannot run this screen |
| The screen sits on *Iniciando sesión* forever with a real bank | The bank changed a selector | Run `pnpm --filter @finanzas/bank-scraper test` — the fixture tests fail before the app does. Re-capture and scrub a fixture, then fix the script |
| The screen shows the `read_in_progress` body immediately | An app-open automatic sync is already running (item #10's device lock refused this one) | Wait for it to finish, then retry. This is correct behaviour, not a bug |
| A raw key such as `bank_syncing.error.body.network` renders instead of Spanish | The key is missing from `es.json`, or a nested key was used where the runtime has `keySeparator: false` | Add the flat key to both catalogues; `catalogue-parity.test.ts` catches the asymmetric case |
| `pnpm fidelity --issue 11` says the target is *still planned* | Step 13 of the Implementation Order was skipped | Flip the four `bank-syncing` mappings to `wired` in `scripts/mobile-ui/fidelity-targets.json` |
| Duplicate movements after a retry | A write bypassed item #10's upsert | This is a sync-engine defect, not a screen defect — file it against #10 |

---

## Known Limitations

- **Steps 6, 8 and 9 need a real Banco de Chile login.** There is no test account for a real
  bank, so those three steps are optional and marked as such. Everything else runs off the
  `__DEV__` scripted-runner surface.
- **Step 9 must be run exactly once.** Repeated wrong-password attempts can lock a real bank
  account. The app itself never retries that failure automatically, for the same reason.
- **The intermediate frames may be too fast to see on a real read.** A healthy Banco de Chile read
  can pass `products` in well under a second. Steps 1-3 exist because of this; step 6 verifies
  ordering and liveness, not legibility.
- **Fidelity capture requires the `Finanzas Fidelity` simulator** created by item #47. On a
  different device size the comparison fails on geometry rather than on this screen.
- **This runbook cannot prove background behaviour**, because there is none: the read is driven
  by the mounted WebView and stops with the screen (decision D3's chosen default). If background
  sync is ever built, step 10's expected result changes.
</content>
</invoke>
