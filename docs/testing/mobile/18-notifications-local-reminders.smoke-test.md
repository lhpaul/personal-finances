# Smoke Test Runbook: Notifications and local reminders

**Feature**: Notifications and local reminders (`#screen=notifications-intro`,
`#screen=notifications-schedule`, `#screen=settings-notifications`) — issue
[#18](https://github.com/lhpaul/personal-finances/issues/18)
**Work item brief**: [issue #18](https://github.com/lhpaul/personal-finances/issues/18) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `notifications-intro`, `notifications-schedule`, `settings-notifications`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**:
[`2_18-notifications-local-reminders_implementation-plan.md`](../../specs/developments/20260802191711_18-notifications-local-reminders/2_18-notifications-local-reminders_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **This runbook takes real time to run.** Step 5 waits for a real notification to fire at a
> wall-clock time you choose. Budget a few minutes of waiting, or use the simulator's date-and-time
> controls as described there. Do not shorten the wait by scheduling a one-off notification through
> a debug hook — the point of the step is that the *weekly* trigger the app registers actually
> fires.

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A freshly built dev client, not Expo Go, and not a dev client built before this item.**
      `expo-notifications` is a native module: a Metro reload is not enough, the client must be
      rebuilt after the dependency was added.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison: `open design/mockups/mobile/index.html`.
- [ ] **The OS notification permission for the app is in its undetermined state** for Step 1. On the
      iOS simulator, the reliable way is to delete the app from the simulator and reinstall it; on a
      device, delete and reinstall. Toggling it in the system settings after a denial leaves
      `canAskAgain` false, which is a different scenario (Step 4).
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks.

---

## Test Data

| Item | Value |
| --- | --- |
| Onboarding permission screen | `/(onboarding)/notifications` — deep link `finanzas:///notifications` |
| Onboarding schedule screen | `/(onboarding)/notifications/schedule` — deep link `finanzas:///notifications/schedule` |
| Settings reminders screen | `/settings/notifications` — deep link `finanzas:///settings/notifications` |
| Mockup references | `design/mockups/mobile/index.html#screen=notifications-intro&state=default`, `…&state=denied`, `…#screen=notifications-schedule&state=time`, `…&state=custom-time`, `…&state=days`, `…#screen=settings-notifications&state=enabled`, `…&state=disabled` |
| Fidelity preview deep links (`__DEV__` only) | `finanzas:///notifications?fidelity=1&fidelityScreen=notifications-intro&fidelityState=denied` and the six siblings listed in the plan's Decision 18 |
| Expected default schedule | 9:00 AM, Monday to Friday (plan Assumption A2) |
| Notification identifiers the app owns | every id beginning `finanzas-reminder` |

> **Why no fixture is needed**: reminders read no transaction data. The schedule is three
> `app_settings` keys and a live OS permission.

---

## Smoke Test Steps

### Step 1: The permission is asked at `notifications-intro`, never at launch

**Maps to**: brief AC1 ("Permission is requested at `notifications-intro`, never on launch"), plan
Decision 7.

1. Install the app fresh (permission undetermined) and launch it.
2. **Before touching anything**, watch the first screen: no OS permission dialog may appear at
   launch, on the intro screen, on the value carousel, or on any connect-a-bank screen.
3. Walk the onboarding flow to `notifications-intro` (or deep-link `finanzas:///notifications` on a
   build where the earlier screens are not yet implemented).
4. Open `#screen=notifications-intro&state=default` beside it.

**Expected result**: the screen shows the eyebrow **Paso 2**, the title **Activar notificaciones**,
the lead paragraph, and the framed sample notification card reading **Finanzas · ahora** with
**💰 Desafío diario:** and the sample body. Two buttons: **Habilitar notificaciones** (primary) and
**Tal vez después** (ghost). **No OS dialog has appeared yet.**

5. Tap **Habilitar notificaciones**.

**Expected result**: the OS permission dialog appears now, and only now.

### Step 2: Granting leads to the schedule, and the schedule saves

**Maps to**: brief AC3 ("Reminders fire at the configured time on the configured days"), plan
Decisions 9 and 10.

1. Grant the permission.

**Expected result**: the app navigates to `notifications-schedule`, `state=time`: a top bar reading
**Recordatorios** with a back affordance, the heading **⏰ ¿Cuándo te funciona mejor?**, and a
two-column grid of six chips — `7:00 AM`, `9:00 AM` (pre-selected), `12:00 PM`, `6:00 PM`, `8:00 PM`,
**Personalizada**.

2. Tap **Personalizada**.

**Expected result**: `state=custom-time` — the **Personalizada** chip becomes the selected one, the
`9:00 AM` chip loses its selection, and a card headed **Hora personalizada** appears with two numeric
boxes, a colon, and an **AM / PM** segmented control. Edit it to `07 : 45 PM` and confirm both boxes
accept and reject input sensibly (a minute of `75` must not be accepted).

3. Tap the `9:00 AM` chip again to return to a preset, then tap **Continuar**.

**Expected result**: `state=days` — the heading **📅 ¿Qué días?**, the seven day rows with Monday to
Friday checked and Saturday and Sunday unchecked, and the outline button **Solo días laborales**.

4. Check **Sábado**, then tap **Solo días laborales**.

**Expected result**: the selection returns to exactly Monday to Friday.

5. Tap **Continuar**.

**Expected result**: the app navigates to `onboarding-ready`. If item #8's ready screen is present,
its reminders row reads **Notificaciones activadas** with the subtitle **9:00 AM · días laborales**
— proof that this item wrote what #8 reads.

### Step 3: The settings screen shows the same schedule and can change it

**Maps to**: brief scope ("Settings persist to `app_settings`"), plan Decisions 5 and 9.

1. Deep-link `finanzas:///settings/notifications`.
2. Open `#screen=settings-notifications&state=enabled` beside it.

**Expected result**: a top bar reading **Recordatorios**, a card with **Recordatorios activados** and
the switch **on**, the section **Hora del desafío** with four rows (**Mañana 9:00 AM** selected,
**Tarde 2:00 PM**, **Noche 8:00 PM**, **Hora personalizada**), the section **Días** with Monday to
Friday checked, and a **Guardar** button. **No warning note is shown.**

3. Select **Noche**, uncheck **Viernes**, check **Sábado**, and tap **Guardar**.
4. Leave the screen and come back.

**Expected result**: the screen shows **Noche 8:00 PM** selected and Monday-Thursday plus Saturday
checked. The values survived, which means they were written to `app_settings`, not held in component
state.

5. Select **Hora personalizada** and set `07 : 30 PM`, then **Guardar** and return.

**Expected result**: **Hora personalizada** is selected with the subtitle **7:30 PM**, and none of the
three named presets is selected.

### Step 4: Denial is a supported state, not an error

**Maps to**: brief AC2 ("Denial is a supported state, not an error"), plan Decisions 6 and 11.

1. Delete and reinstall the app so the permission is undetermined again, and walk to
   `notifications-intro`.
2. Tap **Habilitar notificaciones** and **deny** in the OS dialog.
3. Open `#screen=notifications-intro&state=denied` beside it.

**Expected result**: the screen switches to the `denied` frame — the amber note **📵 Las
notificaciones están bloqueadas para esta app. Puedes habilitarlas en los ajustes del teléfono
cuando quieras.**, and a single button **Continuar sin notificaciones**. **No error dialog, no red
state, no crash, and the person is not stuck.**

4. Tap **Continuar sin notificaciones**.

**Expected result**: the app moves on to `onboarding-ready`. Onboarding completes normally without
notifications.

5. Deep-link `finanzas:///settings/notifications` and compare against
   `#screen=settings-notifications&state=disabled`.

**Expected result**: the switch is off and not togglable, the amber note reads **Las notificaciones
están bloqueadas en los ajustes del sistema.** with **Abrir ajustes del teléfono** highlighted, and
neither the time section nor the days section is shown.

6. Tap **Abrir ajustes del teléfono**.

**Expected result**: the OS settings page for this app opens.

7. Enable notifications there, return to the app, and observe the settings screen **without
   navigating away and back**.

**Expected result**: the screen re-reads the permission when the app returns to the foreground and
switches to the `enabled` frame. The previously stored time and days are still there — a permission
revocation never erased the person's choices.

8. Now do the reverse: with reminders enabled, go to the OS settings, **revoke** the permission, and
   return to the app.

**Expected result**: the settings screen shows the `disabled` frame with the system note. The OS
wins, exactly as `BEHAVIOR.md` requires.

### Step 5: A reminder actually fires, at the configured time, on a configured day

**Maps to**: brief AC3, plan Decisions 3 and 4.

1. With the permission granted, set the time to a few minutes from now (use **Hora personalizada**)
   and check **only today's weekday**. Tap **Guardar**.
2. Background the app (do not force-quit it — that is Step 6).
3. Wait for the time to arrive. On the iOS simulator you may instead advance the simulator's clock
   past the target minute; record which method you used.

**Expected result**: exactly **one** notification appears, with the title **Desafío diario** and the
body **Categoriza tus gastos de hoy. Toca para comenzar.**

4. Repeat with **only tomorrow's weekday** checked and the same time.

**Expected result**: nothing fires today. This is the check that catches an off-by-one in the
weekday mapping (plan Decision 4) — a wrong mapping shows up here as a reminder on the wrong day,
not as a test failure.

5. Foreground the app and let a reminder fire while it is open.

**Expected result**: a banner appears without a sound (plan Decision 14).

### Step 6: Changing the schedule reschedules rather than duplicating

**Maps to**: brief AC4 ("Changing the schedule reschedules rather than duplicating notifications"),
plan Decision 2.

1. On `/settings/notifications`, set a time a few minutes out with **all seven days** checked, and
   tap **Guardar**.
2. Tap **Guardar** again without changing anything. Then change the time by one minute and tap
   **Guardar**. Then change it back and **Guardar** once more.
3. Wait for the configured minute to arrive.

**Expected result**: **exactly one** notification arrives for that minute. Not two, not four. If more
than one arrives, the cancel-then-schedule sequence is broken and the item is not done.

4. Force-quit the app, relaunch it, and let the next day's reminder fire.

**Expected result**: it still fires. Scheduled local notifications survive a process restart; the
app does not need to be running.

### Step 7: Tapping a reminder opens the categorisation session

**Maps to**: plan Decision 15, `BEHAVIOR.md` → `stage-intro` ("desde un recordatorio local").

1. With onboarding complete, let a reminder fire while the app is backgrounded, and tap the
   notification.

**Expected result**: the app opens on `/categorize/intro` (the stage intro, or its placeholder if
item #13 has not landed).

2. Force-quit the app, let a reminder fire, and tap it from a cold start.

**Expected result**: the same destination, once. It must not open twice or bounce between screens.

3. Delete and reinstall so the app is mid-onboarding, schedule a reminder if the flow allows it, and
   tap one while onboarding is in progress.

**Expected result**: the person stays in onboarding. A reminder tap never yanks someone out of the
setup flow.

### Step 8: Design fidelity — expected vs actual

**Maps to**: brief AC5 ("Open `design/mockups/mobile/index.html` and compare side by side before
marking done"), `AGENTS.md` non-negotiable 6.

Reference assets: `design/mockups/mobile/index.html` at the seven hashes listed in **Test Data**.
These are the only design references for this item; the issue carries no attachments and there is no
`assets/` folder in the development directory.

1. If item #47's fidelity kit is present, run the automated gate and paste its summary table:

   ```bash
   pnpm fidelity --issue 18
   ```

2. Whether or not the gate ran, compare each of the seven screen states side by side against its
   mockup hash. Use the `fidelity=1` preview deep links from **Test Data** to reach `denied` and
   `disabled` without revoking a real permission.
3. Capture at least one small-screen viewport as well as the standard 393×852 one — the Spanish copy
   on `notifications-intro` and the day list are the places where wrapping breaks first.
4. Record PASS/FAIL per state, with expected-vs-actual detail on any failure.

**Expected result**: all seven states match their mockup reference for layout, spacing, typography
and colour. Any difference is either fixed or recorded as a known acceptable difference with a
reason — never absorbed by raising a fidelity threshold.

### Last Step: Validate and shut down

- Verify every assertion in the checklist below.
- Set the reminder schedule back to something sane (or turn it off) so the test device stops
  notifying you.
- Stop the Metro dev server.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from the work item brief or to a contract this plan
treats as binding.

- [ ] **AC1** — No permission dialog appears at launch or anywhere before the explicit
      **Habilitar notificaciones** press on `notifications-intro` (Step 1).
- [ ] **AC2** — Denial renders the `denied` frame with re-enable guidance, and the person can
      continue; nothing errors, nothing blocks (Step 4).
- [ ] **AC3** — A reminder fires at the configured time on a configured day, and does not fire on an
      unconfigured day (Step 5).
- [ ] **AC4** — Saving the schedule repeatedly produces exactly one notification per configured slot
      (Step 6).
- [ ] **AC5** — All seven declared manifest states were compared side by side against
      `design/mockups/mobile/index.html` (Step 8).
- [ ] The schedule persists across screen exits and app restarts (Steps 3 and 6).
- [ ] A revoked OS permission is reflected as `disabled` without erasing the stored schedule, and
      re-granting restores it (Step 4).
- [ ] Tapping a reminder opens `/categorize/intro` once, from both a warm and a cold start, and
      never during onboarding (Step 7).
- [ ] Every string on all three screens is Spanish copy from the mockup — no English placeholder, no
      untranslated key rendered as `notifications_intro.title` (Steps 1-4).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| — | No fixture is required; reminders read no transaction data | — |
| `app_settings` reminder keys | Written by the app itself when the schedule is saved | Complete Step 2 or Step 3 |
| Undetermined OS permission | Steps 1 and 4 | Delete and reinstall the app |
| Denied OS permission with `canAskAgain: false` | Step 4 | Deny once in the OS dialog, then do not reinstall |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find native module 'ExpoNotifications'` at launch | The dev client was built before `expo-notifications` was added | Rebuild the dev client. A Metro reload cannot add a native module |
| No OS dialog appears when tapping **Habilitar notificaciones** | The permission is already granted or already denied — `canAskAgain` is false after a denial | Delete and reinstall the app to return to the undetermined state |
| A notification never arrives on the iOS simulator | Simulator notification delivery is unreliable when the simulator is not focused, and Do Not Disturb suppresses banners silently | Keep the simulator window focused, check Focus/Do Not Disturb, and confirm the app's notification permission in the simulator's Settings app |
| Two notifications arrive for one configured slot | A schedule change bypassed `applyReminderSchedule` | This is an AC4 failure, not a test problem. Every schedule change must go through `applyReminderSchedule`, which cancels every `finanzas-reminder*` identifier before scheduling |
| The reminder fires on the wrong day | The ISO-to-platform weekday conversion is wrong (plan Decision 4) | Check `adapter-weekday-mapping.test.ts` — ISO 1 = Monday must map to platform 2, and ISO 7 = Sunday to platform 1 |
| A fidelity deep link opens the wrong screen or a blank one | Expo Router group segments are not part of the URL | Use `finanzas:///notifications`, not `finanzas:///(onboarding)/notifications` |
| The settings screen shows `disabled` although the OS permission is granted | The stored intent is off, which is a legitimate state | Toggle **Recordatorios activados** on. The system note must **not** be visible in this case (plan Decision 11) |

---

## Known Limitations

- **Waiting is part of the test.** Steps 5 and 6 depend on wall-clock time. Advancing the simulator
  clock is permitted; record which method was used, because a clock jump exercises the trigger
  slightly differently from real elapsed time.
- **Daylight-saving transitions are not covered.** Chile changes its offset twice a year and the
  platform's weekly trigger is a wall-clock trigger, so a reminder is expected to keep its local
  time across a transition. Verifying that would take a device clock set months ahead, which is out
  of scope for a smoke test.
- **Android is not covered end to end here.** The plan creates the notification channel in the
  adapter, but the project's device testing runs on iOS today. When an Android dev build exists,
  Steps 5 to 7 should be repeated there, and the channel should be visible in the OS app settings
  under **Recordatorios**.
- **This runbook cannot prove the absence of a launch-time permission request** — only that none
  occurred in the paths it walks. The mechanical proof is the boundary test named in the plan's
  Testing Strategy.
