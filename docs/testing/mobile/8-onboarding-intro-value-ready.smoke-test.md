# Smoke Test Runbook: Onboarding — intro, value carousel and ready

**Feature**: Onboarding: intro, value carousel and ready (#8)
**Work item brief**: [lhpaul/personal-finances#8](https://github.com/lhpaul/personal-finances/issues/8)
(Refactor-type item — no spec document)
**Implementation plan**: [`2_8-onboarding-intro-value-ready_implementation-plan.md`](../../specs/developments/20260802132343_8-onboarding-intro-value-ready/2_8-onboarding-intro-value-ready_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

Before running this smoke test:

- [ ] A **dev build** is installed on a simulator or device. Expo Go is not enough — `expo-sqlite`
      and `expo-crypto` are native modules.
- [ ] `pnpm install` has been run and `pnpm check:layout` passes.
- [ ] `pnpm dev:mobile` is running and the dev build is connected to it.
- [ ] The mockup is open for side-by-side comparison:
      `open design/mockups/mobile/index.html`
- [ ] **The app's data is cleared.** There is no sign-out in this product (BR0 — the profile is the
      device), so "a fresh session" means a fresh install. See *Troubleshooting* for how to reset.

---

## Test Data

| Item | Value |
| --- | --- |
| Actor | The person, on their own device. There is no account, no login and no test user (BR0) |
| First-launch state | No `finanzas.db` on the device — app data cleared or freshly installed |
| Returning-launch state | `app_settings.onboarding_completed = true`, produced by finishing Step 6 once |
| Entry route | `/` → resolves to `/(onboarding)/intro` or `/(tabs)/home` |
| Mockup references | `#screen=onboarding-intro` · `#screen=onboarding-value&state=step-1` · `&state=step-2` · `&state=step-3` · `#screen=onboarding-ready` |
| Seeded institution | `Banco de Chile` (slug `banco-de-chile`), seeded by item #3 |

---

## Smoke Test Steps

### Step 0: Start from a clean install

1. Delete the app from the simulator/device (or clear its data — see *Troubleshooting*).
2. Reinstall the dev build and launch it.

**Expected result**: The app opens. No sign-in screen, no account prompt, no "continue with
email" — anywhere. If any authentication surface appears, stop: that is a non-negotiable 7 / BR0
violation, not a smoke-test failure.

### Step 1: First launch lands on the intro screen

**Maps to**: AC1 ("First launch lands on `onboarding-intro`"), AC2 (the `users` row)

1. Observe the launch, timing roughly how long the screen is blank before content appears.
2. When content appears, confirm it is the welcome screen and not the home placeholder.

**Expected result**: The app lands on `/(onboarding)/intro`. The blank interval before it (the
database migration + seed window) is brief and does not read as a hang. Record the observed
duration in the PR body.

### Step 2: `onboarding-intro` renders

**Maps to**: AC6 (mockup comparison), non-negotiable 6 (this screen declares no states, so there is
exactly one to check)

1. Confirm the screen shows, in order: the 👋 glyph, `Bienvenido a Finanzas`,
   `Te ayudaremos a tomar control de tu dinero — paso a paso, a tu propio ritmo.`, and a single
   full-width primary button reading `Comenzar`.
2. Confirm there is no back button, no top bar and no skip control.
3. Confirm the content clears the status bar / notch and the button clears the home indicator.

**Expected result**: The screen matches `#screen=onboarding-intro`. All copy is Spanish and matches
the mockup exactly.

### Step 3: The carousel advances by CTA

**Maps to**: AC3 ("The carousel advances"), non-negotiable 6 (states `step-1`, `step-2`, `step-3`)

1. Tap `Comenzar`. Confirm you arrive at `/(onboarding)/value` on **step 1**: 🎯,
   `Mejoras financieras simples`, its lead paragraph, and a flat card listing
   `Sin complicaciones técnicas`, `Proceso paso a paso`, `Interfaz intuitiva`.
2. Confirm the dots show three dots with the **first** one active, and the CTA reads `Continuar`.
3. Tap `Continuar`. Confirm **step 2**: 🔒, `Tus claves nunca salen del teléfono`, its paragraph,
   **no** checklist card, and the **second** dot active.
4. Tap `Continuar`. Confirm **step 3**: 🌱, `A tu ritmo, unos minutos por semana`, its paragraph,
   and the **third** dot active.

**Expected result**: Three pages in that order, dots tracking the page, CTA labelled `Continuar` on
all three.

### Step 4: The carousel advances by swipe, and goes backwards

**Maps to**: AC3, plan Assumption A7

1. From step 3, swipe right-to-left is not possible (last page). Swipe left-to-right to return to
   step 2, then again to step 1.
2. Confirm the dots follow each swipe.
3. Swipe forward to step 3 again.

**Expected result**: Swiping moves between pages in both directions and the dots stay in sync with
the visible page. The page does not settle half-way between two pages.

### Step 5: "Saltar" and the step-3 CTA both reach the connect-bank screen

**Maps to**: AC3 ("«Saltar» jumps to `connect-bank-intro`"), plan Decision 3 / Assumption A1

1. On step 3, tap `Continuar`. Confirm you arrive at `/(onboarding)/connect-bank` (until item #9
   lands this is the route placeholder — it names screen `connect-bank-intro`).
2. Go back to the value screen (see *Troubleshooting* if there is no back affordance: relaunch after
   clearing data and re-walk Steps 1–3).
3. On **step 1**, tap `Saltar` in the top-right.

**Expected result**: `Saltar` is visible on every step, styled as a ghost button in the top-right,
and lands on the same `/(onboarding)/connect-bank` route as the step-3 `Continuar`. Onboarding is
**not** marked complete by this path — Step 7 verifies that.

### Step 6: `onboarding-ready` reflects real state, not hardcoded copy

**Maps to**: AC4 ("`onboarding-ready` reflects the real connection and reminder state"), plan
Decision 7 / Assumption A2

Until items #9 and #18 land there is no way to create a connection or a reminder from the UI, so
this step has two parts.

**6a — the honest empty case (always run this)**

1. Navigate to `/(onboarding)/ready`. With `pnpm dev:mobile` running, deep-link it as
   `finanzas:///ready` — Expo Router group segments in parentheses are not part of the URL, which
   is why the dev-only gallery is reached as `finanzas://gallery` and not `finanzas://(dev)/gallery`.
   Alternatively, walk the placeholder chain from `/(onboarding)/connect-bank`.
2. Confirm the screen shows 🎉, `¡Todo listo!`, its lead paragraph, and the `Comenzar` button.
3. Confirm **no** summary card is shown, and in particular that no row claims a connected bank or
   active notifications.

**Expected result**: No fabricated `1 banco conectado` / `Notificaciones activadas` text appears.
Seeing either one with no real connection is an AC4 failure.

**6b — the populated case (optional until #9/#18 land)**

1. Using a SQLite client against the device database (see *Troubleshooting*), insert one
   `user_financial_institutions` row with `status = 'active'` (not `'connected'` — that value
   does not exist; `docs/project/4-database-model.md` enumerates `active | inactive |
   disconnected`) pointing at `banco-de-chile`, three `user_financial_products` rows for it, and
   the `app_settings` rows `reminder_enabled = true`, `reminder_time = "09:00"`,
   `reminder_days = [1,2,3,4,5]`.
2. Relaunch the app and return to `/(onboarding)/ready`.

**Expected result**: The card shows two rows — 🏦 `1 banco conectado` / `Banco de Chile · 3 productos`,
and 🔔 `Notificaciones activadas` / `9:00 AM · días laborales` — each with a green ✓ badge. This is
the exact content drawn in `#screen=onboarding-ready`.

### Step 7: Completing onboarding sets the flag and leaves the flow

**Maps to**: AC5 (`app_settings.onboarding_completed` is set on completion)

1. On `/(onboarding)/ready`, tap `Comenzar`.
2. Observe the destination: `/categorize/intro` when the store holds uncategorized movements, or
   `/(tabs)/home` when it does not. On a fresh install with no sync, expect `/(tabs)/home`.
3. Attempt to go back (hardware back on Android, back-swipe on iOS).

**Expected result**: You land on the expected destination and **cannot** navigate back into any
`(onboarding)` screen. The route was replaced, not pushed.

### Step 8: Subsequent launches skip onboarding

**Maps to**: AC1 ("subsequent launches land on `(tabs)/home`"), BR0

1. Fully quit the app (swipe it out of the app switcher — do not just background it).
2. Relaunch it.
3. Repeat once more.

**Expected result**: Both relaunches land directly on the home placeholder. The onboarding screens
are never shown again.

### Step 9: Re-running the first-launch path is still clean

**Maps to**: AC2 (single `users` row), non-negotiable 4 (idempotence)

1. Clear the app's data again and relaunch.
2. Confirm you land on `/(onboarding)/intro` again.
3. Complete the flow through Step 7 a second time.

**Expected result**: The full path works from a clean install every time, with no crash on the
second run and no duplicated state.

### Step 10: Design fidelity — expected vs actual

**Maps to**: AC6 ("Open `design/mockups/mobile/index.html` and compare side by side before marking
done"), non-negotiable 6

Design assets exist for this item: the HTML mockup at `design/mockups/mobile/index.html`, referenced
by `#screen=` hash in the work item brief. Compare each of the five references below.

1. `open 'design/mockups/mobile/index.html#screen=onboarding-intro'` — compare against Step 2.
2. `open 'design/mockups/mobile/index.html#screen=onboarding-value&state=step-1'`
3. `open 'design/mockups/mobile/index.html#screen=onboarding-value&state=step-2'`
4. `open 'design/mockups/mobile/index.html#screen=onboarding-value&state=step-3'`
5. `open 'design/mockups/mobile/index.html#screen=onboarding-ready'` — compare against Step 6b when
   it was run, otherwise against 6a and note the summary card as intentionally absent.

For each: check glyph, headline, body copy, the presence/absence of the checklist card, dot state,
button label, button variant, and vertical rhythm. Record PASS/FAIL per reference, with
expected-vs-actual detail on any FAIL.

Capture **two viewports**: one small screen (e.g. iPhone SE) and one normal screen. Spanish copy is
long and step 2's headline is the longest.

**Expected result**: Each screen matches its reference. Differences that do not affect the
acceptance criteria (font rendering, platform button ripple) are listed as known acceptable
differences.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Record in the PR body: the simulator/device and OS version, both viewports used, the `#screen=`
  references compared, screenshot paths (keep them under `.tmp/`), the first-launch blank interval
  from Step 1, and whether Step 6b was run.
- Stop the dev server.

---

## Assertions Checklist

- [ ] First launch lands on `onboarding-intro` (AC1)
- [ ] Subsequent launches land on `(tabs)/home` (AC1)
- [ ] No sign-in, account or auth surface appears anywhere (BR0, non-negotiable 7)
- [ ] The single `users` row exists after first launch, with a generated UUID (AC2)
- [ ] The carousel advances by CTA and by swipe, across all three declared states (AC3)
- [ ] `Saltar` is present and jumps to `connect-bank-intro` (AC3)
- [ ] `onboarding-ready` shows no fabricated connection or reminder text when there is none (AC4)
- [ ] `onboarding-ready` shows the real connection and reminder summary when state exists (AC4)
- [ ] `app_settings.onboarding_completed` is set on completion, and the flow cannot be re-entered
      by going back (AC5)
- [ ] All five `#screen=` references were compared side by side and recorded (AC6)
- [ ] All copy is Spanish and matches the mockup string for string (non-negotiable 8)
- [ ] Nothing writes a credential anywhere — this item touches none (non-negotiable 1)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Categories, institutions, merchants | Starter content, including `banco-de-chile` | Automatic — `ensureDatabaseReady()` seeds on first launch (item #3) |
| `users` (single row) | First-launch profile | Automatic on first launch |
| `app_settings.onboarding_completed` | Returning-launch scenario | Produced by completing Step 7 |
| `user_financial_institutions` / `user_financial_products` / reminder settings | Step 6b only | Inserted manually via a SQLite client; **never** added to the shipped seeds |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The app opens straight on the home placeholder on what should be a first launch | The previous run's `finanzas.db` survived | iOS simulator: *Device → Erase All Content and Settings*, or delete the app. Android: *App info → Storage → Clear storage*. Then relaunch |
| The launch screen stays blank | The bootstrap threw, or the migration is slow on first install | Check the Metro logs for `DatabaseBootstrapError` / `DatabaseMigrationError`. A migration failure here is the unrecoverable case in `AGENTS.md`'s troubleshooting table — do not ship it |
| `Native module missing` / `expo-sqlite` is undefined | Running in Expo Go | Rebuild and install the dev build |
| `Unable to resolve "@expo/metro-runtime"` | `node_modules` is isolated, not hoisted | `pnpm check:layout`, then a plain `pnpm install` |
| The dots do not match the visible page after a fast swipe | Momentum-scroll index calculation | Note the exact gesture and report it — this is scenario 4's unit test failing to cover a real case |
| Cannot reach `/(onboarding)/ready` for Step 6 | The connect-bank screens are still placeholders | Deep-link it: `finanzas:///ready` from the dev client's URL bar (group segments are not in the URL) |
| No SQLite client for Step 6b | — | Step 6b is optional. Record it as not run; scenarios 6, 7, 8 and 9 in the plan's Testing Strategy cover the same logic automatically |

---

## Known Limitations

- **Step 6b cannot be produced through the UI** until items #9 (connect a bank) and #18
  (notifications) land. Until then the populated summary card is exercised by unit tests plus a
  manual database insert, not by using the app.
- **The destination after Step 7 is almost always `(tabs)/home`** on a fresh install, because no
  movements exist until the sync engine (#10) lands. The `/categorize/intro` branch is covered by a
  unit test, not by this runbook.
- **Fidelity comparison is manual.** The automated `mockups:capture` / `compare` tooling is item #47;
  until it lands, the PR must state that the comparison was done by eye.
- **This runbook has no automated E2E counterpart yet.** Maestro flows are item #22; its author
  should lift Steps 1–9 directly.
