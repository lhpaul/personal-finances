# Smoke Test Runbook: Connect a Bank — Picker, Credentials and Secure Storage

**Feature**: Connect a bank: picker, credentials and secure storage (#9)
**Spec**: [`1_9-connect-a-bank-picker-credentials-secure-storage_specs.md`](../../specs/developments/20260802131302_9-connect-a-bank-picker-credentials-secure-storage/1_9-connect-a-bank-picker-credentials-secure-storage_specs.md)
**Implementation plan**: [`2_9-connect-a-bank-picker-credentials-secure-storage_implementation-plan.md`](../../specs/developments/20260802131302_9-connect-a-bank-picker-credentials-secure-storage/2_9-connect-a-bank-picker-credentials-secure-storage_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] A **dev build** is installed on a simulator or device. Expo Go is not enough:
      `expo-sqlite`, `expo-crypto` and the newly added `expo-secure-store` are native modules.
      Because this item adds a native module, the dev client must be **rebuilt** — an older
      client fails at runtime with `Cannot find native module 'ExpoSecureStore'`.
- [ ] `pnpm install` has been run and `pnpm check:layout` passes.
- [ ] `pnpm dev:mobile` is running and the dev build is connected to it.
- [ ] The mockup is open for side-by-side comparison: `open design/mockups/mobile/index.html`.
- [ ] **The app's data is cleared.** There is no sign-out in this product (`BR0` — the profile is
      the device), so "a fresh session" means a fresh install or cleared app data. See
      *Troubleshooting*.
- [ ] Optional but recommended: the `sqlite3` command-line tool, for steps 12 and 13.

---

## Test Data

| Item | Value |
| --- | --- |
| Actor | The person, on their own device. There is no account and no test user (`BR0`) |
| Bundle identifier (dev build, since #23) | `cl.finanzas.mobile.dev` |
| Valid RUT for the happy path | `12.345.678-5` (check digit 5 is the arithmetically correct one) |
| Invalid RUT for the inert-button check | `12.345.678-9` — the mockup's placeholder; its check digit is wrong, so it must never enable *Conectar* |
| Dotless RUT for the formatting check | `123456785` |
| Password | Any non-empty string. Use `ZZSMOKEPASSZZ` so the later dump and log greps have something unmistakable to search for |
| Entry routes | `/(onboarding)/connect-bank`, `/(onboarding)/bank-picker`, `/(onboarding)/bank-credentials`, `/(onboarding)/bank-connected` |
| Dev fixtures route | `finanzas://connect-fixtures` (dev builds only) |
| Design references | `#screen=connect-bank-intro` (`default`, `how-it-works`) · `#screen=bank-picker` (`list`, `search`, `no-results`) · `#screen=bank-credentials` (`empty`, `filled`, `error`, `rut-locked`) · `#screen=bank-connected` (`single`, `multiple`) |

> **Note on the sync**: items #10 (sync engine) and #11 (syncing screen) are not built. Confirming
> credentials lands on the `bank-syncing` route, which is still a placeholder with a link
> onward. That placeholder link is how this runbook reaches the connected screen; the real
> transition is item #11's.

---

## Smoke Test Steps

### Step 0: Start from a clean install

1. Delete the app from the simulator/device (or clear its data — see *Troubleshooting*).
2. Reinstall the freshly built dev client and launch it.
3. Navigate to `/(onboarding)/connect-bank`.

**Expected result**: The connect-bank introduction renders. No sign-in surface appears anywhere.

### Step 1: `connect-bank-intro` — `default`

**Maps to**: AC28, AC29

1. Confirm, in order: the eyebrow `Primer paso`, the heading `Conecta tu banco`, the lead
   paragraph, a success-toned card headed `Máxima seguridad garantizada` containing
   `Almacenamiento local seguro` and its paragraph, a collapsed row reading
   `¿Cómo funciona la conexión segura?` with a downward chevron, and one primary button
   `Conectar con mi banco`.
2. Confirm there is **no** skip, "más tarde" or "omitir" control anywhere on the screen.

**Expected result**: Exactly one forward action. All copy is Spanish and matches the mockup.

### Step 2: `connect-bank-intro` — `how-it-works`

**Maps to**: AC28, spec Decision 11

1. Tap `¿Cómo funciona la conexión segura?`.
2. Confirm the chevron flips and three numbered steps appear, worded exactly as the mockup:
   opening the bank's site inside the app on the phone; credentials typed into that form and kept
   encrypted in the device keychain; products and movements read and stored locally with none of
   it passing through a server.
3. Tap the row again and confirm it collapses. Press the system back gesture and confirm it
   leaves the screen rather than merely closing the accordion.

**Expected result**: The accordion is local state; back is navigation.

### Step 3: `bank-picker` — `list`

**Maps to**: AC7, AC8, AC28

1. Tap `Conectar con mi banco`.
2. Confirm a search field with the placeholder `Buscar banco…`, then the heading
   `Bancos disponibles en Chile`.
3. Confirm `Banco de Chile` is the first row, with its `BCH` mark, the line
   `Cuentas, tarjetas y líneas` and the badge `Disponible`.
4. Confirm the remaining seeded banks follow, each with `Próximamente` where the badge would be.
5. Tap two different `Próximamente` rows.
6. Confirm the standing note about the MVP supporting Banco de Chile is shown below the list.

**Expected result**: Available first, then coming soon. Tapping a coming-soon row does nothing at
all — no navigation, no visual press feedback that suggests it is actionable.

### Step 4: `bank-picker` accessibility

**Maps to**: AC9

1. Turn on VoiceOver (iOS) or TalkBack (Android).
2. Swipe through the list.

**Expected result**: `Banco de Chile` is announced as a button. Every coming-soon row is announced
with its name and `Próximamente` and is **not** announced as a button.

### Step 5: `bank-picker` — `search` and `no-results`

**Maps to**: AC10, AC11, AC12, AC28

1. Type `chi`. Confirm the heading is replaced by a singular result count and that exactly the
   matching row is listed.
2. Clear the field and type `banco`. Confirm the count is plural and agrees with the number of
   rows actually drawn.
3. Clear the field and type `itau` (no accent, lower case). Confirm `Banco Itaú` appears.
4. Clear the field and type `banco imaginario`. Confirm the empty state: `No encontramos ese banco`
   and `Revisa el nombre o cuéntanos cuál necesitas para priorizarlo.`, with the standing note
   hidden.
5. Confirm no `Sugerir un banco` button is drawn (deferred — spec Deferral Note 1).
6. Clear the field. Confirm the full list returns.

**Expected result**: The count always agrees with what is listed; search folds case and accents.

### Step 6: `bank-credentials` — `empty` and `filled`

**Maps to**: AC13, AC14, AC15, AC28

1. Select `Banco de Chile`.
2. Confirm the header shows the bank's name and mark above `Ingresa tus credenciales de banca en
   línea`, and that the privacy note `Estos datos se cifran y se guardan solo en este teléfono.
   No se envían a ningún servidor.` is visible.
3. Confirm both fields are empty with their placeholders, and `Conectar` is visibly inert.
4. Type `12.345.678-9` and a password. Confirm `Conectar` stays inert — that check digit is wrong.
5. Replace the RUT with `123456785`. Confirm the field displays `12.345.678-5` and `Conectar`
   becomes active.
6. Clear the password. Confirm `Conectar` goes inert again; retype it.
7. Confirm the password renders as dots in every one of these states and that no eye/reveal
   control exists anywhere on the screen.

**Expected result**: The button is the only validation signal; no inline RUT error message is
drawn (spec Decision 4).

### Step 7: Confirming writes the credential and starts the handoff

**Maps to**: AC19, AC23, and the plan's Decision 3 evidence

1. Tap `Conectar`.
2. Confirm you land on the `bank-syncing` route (a placeholder at this stage).
3. **Record for the PR**: whether anything in the flow displayed the RUT back in a form other than
   the canonical `12.345.678-5`. This is the evidence for the plan's Decision 3 reversal path.

**Expected result**: Navigation happens once, forward only. No error is shown.

### Step 8: Abandoning the form writes nothing

**Maps to**: AC5, AC6

1. From `bank-syncing`, go back to the picker and select `Banco de Chile` again.
2. Type a password and then tap `Cancelar`.
3. Re-open the credential form.

**Expected result**: The password field is empty — the previous input is not restored. (The RUT is
now pre-filled and locked; that is step 9, not a restored value.)

### Step 9: `bank-credentials` — `rut-locked`

**Maps to**: AC18, AC28

1. Confirm the RUT field shows `12.345.678-5`, is rendered as locked, and carries the note
   `Todos tus bancos deben estar a nombre del mismo RUT.`
2. Try to edit, select, clear and paste over it.
3. Confirm only the password field is editable.

**Expected result**: The RUT cannot be changed by any interaction. If the flow has been reset
since step 7, plant the entry from `finanzas://connect-fixtures` → *plant a credential entry*
and repeat.

### Step 10: `bank-credentials` — `error`, and `error` composed with `rut-locked`

**Maps to**: AC16, AC17, AC28

1. Open `finanzas://connect-fixtures` and choose *return to the credential form in its rejected
   state* (this stands in for item #11's failure path, which does not exist yet).
2. Confirm the message `El banco rechazó estas credenciales. Revisa tu clave e inténtalo de nuevo.`
   appears under the password field, the password stays masked, and the field is marked in error.
3. Confirm the message contains no part of the RUT or password, no bank error text and no
   technical detail (no code, no stack, no HTTP status).
4. Confirm the RUT is still locked in this state.
5. Correct the password and tap `Conectar` again.

**Expected result**: The rejection message is generic; the locked RUT and the error state compose.

### Step 11: `bank-connected` — `single` and `multiple`

**Maps to**: AC24, AC25, AC26, AC28

1. Open `finanzas://connect-fixtures` and choose *plant one synced connection*.
2. Navigate to `/(onboarding)/bank-connected`.
3. Confirm the heading `¡Banco conectado!`, the congratulation line, one row with the bank's name,
   a success mark, and a subtitle in the form `N productos · M movimientos` whose numbers match
   what the fixture planted (check singular wording with a fixture of one).
4. Return to the fixtures surface and choose *plant two synced connections*. Re-open the screen.
5. Confirm the heading is now `¡Bancos conectados!` and one row is drawn per connection, each with
   its own counts.
6. Tap `Agregar otro banco` and confirm you land on the picker. Go back, tap `Estoy listo` and
   confirm you continue into the notifications step.

**Expected result**: Only the number of rows and the heading differ between the two states.
Neither shows balances, amounts or anything about categorization.

### Step 12: The database contains no credential

**Maps to**: AC1, AC3

1. Locate the on-device store:

   ```bash
   # cl.finanzas.mobile.dev is the development-variant bundle identifier since #23
   # (apps/mobile/app.config.js -> expo.ios.bundleIdentifier).
   xcrun simctl get_app_container booted cl.finanzas.mobile.dev data
   ```

2. The database is at `Documents/SQLite/finanzas.db` under that path. Copy it somewhere writable
   and inspect it:

   ```bash
   sqlite3 /tmp/finanzas-device.db ".dump" > /tmp/finanzas-device.sql
   grep -in "ZZSMOKEPASSZZ" /tmp/finanzas-device.sql
   grep -inE "[0-9]{7,8}-[0-9kK]" /tmp/finanzas-device.sql
   grep -in "12345678" /tmp/finanzas-device.sql
   ```

3. Also confirm the connection row exists and holds only the key:

   ```bash
   sqlite3 /tmp/finanzas-device.db "select financial_institution_id, status, credentials_key, sync_status, last_sync_at, last_success_at from user_financial_institutions;"
   ```

**Expected result**: The three `grep` commands print nothing. The `select` prints one row per
connected bank, with `credentials_key` reading `bank_creds.banco-de-chile` (dot separator — colon is rejected by expo-secure-store's key validator; item #100) and no column
containing a RUT or a password. Repeat this check after the *failed* attempt of step 10 and
confirm it still holds.

### Step 13: No log line contains a credential

**Maps to**: AC2, AC3

1. Scroll back through the full `pnpm dev:mobile` Metro console output for this session.
2. On iOS, also check the device console:

   ```bash
   xcrun simctl spawn booted log show --last 30m --predicate 'processImagePath contains "Finanzas"' > /tmp/finanzas-device.log
   grep -in "ZZSMOKEPASSZZ" /tmp/finanzas-device.log
   grep -inE "[0-9]{7,8}-[0-9kK]" /tmp/finanzas-device.log
   ```

3. Repeat after triggering the rejected-credentials path of step 10.

**Expected result**: No occurrence of the password, the RUT, or any substring of either, in the
Metro output or the device log — on the successful path and on the failed one.

### Step 14: Entering from settings returns to settings

**Maps to**: AC27

1. Open `finanzas://connect-fixtures` and choose *enter the flow as if from settings*.
2. Confirm you land on the picker.
3. Press back.

**Expected result**: You return to `/settings/banks`, not into onboarding. Repeat entering from
the onboarding intro and confirm back returns to the intro instead.

### Step 15: The dev fixtures surface is not in a release build

**Maps to**: plan Decision 13

1. Confirm no product screen anywhere links to `connect-fixtures`.
2. Build the release bundle and confirm the fixtures module is absent:

   ```bash
   pnpm --filter @finanzas/mobile exec npx expo export --platform ios --output-dir /tmp/finanzas-export
   grep -rl "ConnectFlowFixtures" /tmp/finanzas-export || echo "absent from the release bundle"
   ```

**Expected result**: The command prints `absent from the release bundle`.

### Step 16: Design fidelity — expected vs actual

**Maps to**: AC30, AC28

1. Open `design/mockups/mobile/index.html`.
2. Compare each of the following side by side with the built screen and record PASS/FAIL with
   expected-vs-actual detail on any failure:
   `#screen=connect-bank-intro&state=default`, `&state=how-it-works`;
   `#screen=bank-picker&state=list`, `&state=search`, `&state=no-results`;
   `#screen=bank-credentials&state=empty`, `&state=filled`, `&state=error`, `&state=rut-locked`;
   `#screen=bank-connected&state=single`, `&state=multiple`.
3. Pay particular attention to the bank row: 40×40 brand mark, the name at 15px semibold, the
   subtitle immediately under it, and the badge or absence of one on the right.

**Expected result**: Each built state matches its named reference for layout, copy and the
presence or absence of every control. This is a lightweight visual comparison, not a pixel diff.

> If item #47 (design-fidelity gate) has been implemented by the time this runbook is executed,
> register the four screens in `scripts/mobile-ui/fidelity-targets.json` and run
> `pnpm fidelity --issue 9` in addition to the manual comparison.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Stop `pnpm dev:mobile` and delete the copied database and log files from `/tmp`.

---

## Assertions Checklist

- [ ] AC1 — A dump of the whole device database contains no occurrence of the password or the RUT
- [ ] AC2 — No Metro or device log line contains the password, the RUT, or a substring of either
- [ ] AC3 — After a rejected attempt, AC1 and AC2 still hold and the on-screen error names neither
- [ ] AC4 — The credential entry is scoped to the chosen bank; a second bank creates a second entry
- [ ] AC5 — Cancelling after typing a password writes no entry and creates no connection
- [ ] AC6 — Re-opening the form shows an empty password field
- [ ] AC7 — The picker lists every seeded bank, available first, with `Disponible` on Banco de Chile
- [ ] AC8 — Every unavailable bank shows `Próximamente` and does nothing when tapped
- [ ] AC9 — A screen reader announces a coming-soon row as unavailable, not as a button
- [ ] AC10 — A matching search narrows the list and the heading count agrees with the rows shown
- [ ] AC11 — `itau` finds `Banco Itaú`
- [ ] AC12 — A non-matching search shows the not-found state; clearing restores the full list
- [ ] AC13 — `Conectar` is inert until the RUT is valid and the password is non-empty
- [ ] AC14 — A wrong check digit never enables `Conectar`; `123456785` displays as `12.345.678-5`
- [ ] AC15 — The password is masked in every state and no reveal control exists
- [ ] AC16 — The rejection message is the catalogue message, with no value and no technical detail
- [ ] AC17 — Reconnecting replaces the stored credentials; exactly one entry remains for that bank
- [ ] AC18 — With an entry present, the RUT is pre-filled, locked, noted, and uneditable
- [ ] AC19 — Confirming creates exactly one connection holding the key and no credential value
- [ ] AC20 — Connecting an already-connected bank leaves exactly one connection
- [ ] AC21 — A connection whose sync failed still exists, and its credentials are still stored
- [ ] AC22 — Last attempt and last success are recorded as two separate facts
- [ ] AC23 — Confirming always lands on the syncing route; the connected screen is not otherwise reachable
- [ ] AC24 — One connection shows the single-bank heading and one row with real counts
- [ ] AC25 — More than one shows the pluralized heading and one row per connection
- [ ] AC26 — `Agregar otro banco` returns to the picker; `Estoy listo` continues onboarding
- [ ] AC27 — Entering from settings and backing out returns to settings
- [ ] AC28 — Every declared state of the four screens renders
- [ ] AC29 — No user-facing string is inline; every one resolves through the Spanish catalogue
- [ ] AC30 — Side-by-side comparison against `design/mockups/mobile/index.html` was performed

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Institution catalogue | Six banks, one `available` | Shipped by item #3's seeder; present after first launch, no command needed |
| Credential entry | `rut-locked` (step 9) | `finanzas://connect-fixtures` → *plant a credential entry* |
| One synced connection | `bank-connected` `single` (step 11) | `finanzas://connect-fixtures` → *plant one synced connection* |
| Two synced connections | `bank-connected` `multiple` (step 11) | `finanzas://connect-fixtures` → *plant two synced connections* |
| Settings entry origin | AC27 (step 14) | `finanzas://connect-fixtures` → *enter the flow as if from settings* |
| Everything planted | Reset between runs | `finanzas://connect-fixtures` → *clear planted fixtures*, or clear the app's data |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find native module 'ExpoSecureStore'` | The dev client predates this item's new dependency | Rebuild the dev client (`pnpm --filter @finanzas/mobile exec npx expo run:ios`) |
| The RUT field is locked and you want it editable | A credential entry exists from an earlier run | Clear the app's data, or use *clear planted fixtures* |
| `bank-connected` shows no rows | No connection has `last_success_at` set — expected until item #10 lands | Use the fixtures surface to plant a synced connection |
| Counts read `0 productos · 0 movimientos` | Same cause: nothing has been stored yet | Same fix; this is not a defect in this item |
| `xcrun simctl get_app_container` errors | No booted simulator, or the app is not installed | Boot the simulator and launch the app once first |
| The app crashes on launch after clearing data | A migration threw — unrecoverable in the field | Run `pnpm --filter @finanzas/mobile db:check` and treat it as a blocking defect |
| Search finds nothing at all | The catalogue did not seed | Clear the app's data and relaunch so bootstrap re-seeds |

---

## Known Limitations

- The real transition into `bank-syncing`, its progress states and the failure path back to the
  credential form belong to item #11; this runbook uses the placeholder route and the dev fixtures
  surface to reach the states on either side of it.
- The counts on `bank-connected` are only non-zero once item #10 stores products and movements.
  Until then they are exercised through planted fixtures, which is a faithful test of the
  rendering but not of the sync.
- Entering the flow from the connected-banks list uses the fixtures surface, because the button
  that does it in production belongs to item #20.
- The `xcrun` commands are macOS/iOS only. On Android, use
  `adb exec-out run-as cl.finanzas.mobile.dev cat databases/finanzas.db` (dev-build package id,
  since #23) and `adb logcat` for the
  equivalent checks in steps 12 and 13.
