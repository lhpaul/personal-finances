# Smoke Test Runbook: Settings — connected banks and bank review

**Feature**: Connected banks and bank review (`#screen=settings-banks`, `#screen=bank-review`) —
issue [#20](https://github.com/lhpaul/personal-finances/issues/20)
**Work item brief**: [issue #20](https://github.com/lhpaul/personal-finances/issues/20) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `settings-banks`, `bank-review`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**:
[`2_20-settings-banks-bank-review_implementation-plan.md`](../../specs/developments/20260802191753_20-settings-banks-bank-review/2_20-settings-banks-bank-review_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A dev build, not Expo Go.** These screens sit on top of `expo-sqlite` and
      `expo-secure-store`, and reaching the sync hand-off needs `react-native-webview` — all
      native modules.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison:
      `open design/mockups/mobile/index.html`.
- [ ] Items **#8, #9, #10, #11, #12 and #19** are merged. Without #9 there is no way to create a
      connection; without #19 there is no settings hub to reach these screens from.
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks.

> **Never paste a real bank credential into a PR, an issue, a log or a screenshot.** Steps 1-8 and
> 10-12 run entirely off item #11's `__DEV__` scripted runner and need no real credential. Steps 9
> and 13 are optional and are the only place a real Banco de Chile login is typed.

---

## Test Data

| Item | Value |
| --- | --- |
| Connected-banks route | `/settings/banks` — deep link `finanzas:///settings/banks` |
| Bank-review route | `/settings/banks/banco-de-chile` — deep link `finanzas:///settings/banks/banco-de-chile` |
| Settings hub route | `/settings` (item #19) — the only drawn entry point |
| Dev sync-fixtures route | `/(dev)/sync-fixtures` — deep link `finanzas://sync-fixtures` (`__DEV__` only, item #11) |
| Dev connect-fixtures route | `/(dev)/connect-fixtures` — deep link `finanzas://connect-fixtures` (`__DEV__` only, item #9) |
| Mockup reference | `design/mockups/mobile/index.html#screen=settings-banks&state=<state>` and `…#screen=bank-review&state=<state>` |
| Manifest states | `settings-banks`: `list` (initial), `empty`, `disconnect-confirm` · `bank-review`: `ok` (initial), `error` |
| Fidelity ready `testID`s | `fidelity-settings-banks`, `fidelity-bank-review` |
| Institution used throughout | `banco-de-chile` — "Banco de Chile", monogram `BCH`, brand `#003da5` |

---

## Smoke Test Steps

### Step 1: The `empty` state, on a device that has never connected a bank

**Maps to**: manifest state `settings-banks&state=empty`; brief scope ("the connected-banks list
with its empty state").

1. Reinstall the app, or wipe local data from `/settings/account` (item #19), so no connection
   exists.
2. Open `/settings` and tap **Bancos conectados**.

**Expected result**: the 🏦 empty state renders — *No hay bancos conectados*, the sentence
*Conecta tu primer banco para comenzar a gestionar tus finanzas.* and a single **Conectar primer
banco** button. No summary line, no bank row, no *Desconectar* button.

3. Tap **Conectar primer banco**.

**Expected result**: item #9's bank picker opens.

### Step 2: Create a connection without a real bank

**Maps to**: setup for every later step.

1. Open the dev connect-fixtures surface (`finanzas://connect-fixtures`) and the dev
   sync-fixtures surface (`finanzas://sync-fixtures`), and follow their panels to complete a
   connect + successful sync for `banco-de-chile` with the scripted runner. Aim for a read that
   discovers **three** products: a cuenta corriente, a tarjeta de crédito with a cupo, and a
   línea de crédito with a cupo.
2. Return to `/settings/banks`.

**Expected result**: the list state renders.

### Step 3: The `list` state

**Maps to**: manifest state `settings-banks&state=list`.

1. Read the screen top to bottom.

**Expected result**:

- the summary line reads *1 banco · 3 productos* (the numbers follow your fixture, the wording and
  the `·` separator do not);
- one bank row with the `BCH` monogram on the brand blue, the name *Banco de Chile*, a sub-label
  of the form *Sincronizado hace N min/h · 3 productos*, and a **✓ badge** at the trailing edge —
  not a chevron;
- a **+ Conectar nuevo banco** outline button;
- a **Desconectar Banco de Chile** ghost button.

2. With a screen reader on, focus the bank row.

**Expected result**: the announced name ends with the status word *Al día* — the visible `✓` is
not the accessible name.

### Step 4: `bank-review` in the `ok` state

**Maps to**: manifest state `bank-review&state=ok`; brief scope ("per-bank detail showing
products, balances and cupo").

1. Tap the bank row.

**Expected result**: `/settings/banks/banco-de-chile` opens with

- a top bar titled *Banco de Chile* whose back affordance returns to `/settings/banks`;
- a header card with the `BCH` monogram, the name, a relative sub-line (*Sincronizado hace N h*)
  and an **Al día** badge;
- a **Productos** heading followed by one card per product: an icon (🏦 / 💳 / 📈), the bank's own
  product name, a mono meta line (`••NNNN`, and `· cupo $N` on the two credit products) and the
  balance on the right — the credit card's amount in the "out" colour, the others neutral;
- a 🔄 note reading *Sincronizamos automáticamente al abrir la app si pasaron más de 6 horas desde
  la última vez.*;
- **Sincronizar ahora** (outline) and **Desconectar banco** (ghost). **No** *Actualizar
  credenciales* button, and **no** auto-sync switch anywhere.

2. Confirm the note says **6** horas, and that
   `grep -n 'AUTOMATIC_SYNC_INTERVAL_MS' apps/mobile/src/features/sync/auto-sync.ts` shows
   `6 * 60 * 60 * 1000`.

**Expected result**: the two agree. (A unit test asserts this; the step is here so a reader sees
why the number is not a literal.)

### Step 5: The `error` state shows the last **successful** sync separately from the last attempt

**Maps to**: **brief AC1**; manifest state `bank-review&state=error`.

1. Note the current sub-line ("Sincronizado hace …") and the current time.
2. From `/(dev)/sync-fixtures`, script a failing read for `banco-de-chile` with reason
   `invalid_credentials`, and run it.
3. Return to `/settings/banks/banco-de-chile`.

**Expected result**:

- the badge is **Error** (danger);
- the header sub-line reads *Última sincronización exitosa: …* and names the timestamp from
  **step 1 of this step** — the successful one — not the failed attempt you just ran;
- a danger ⚠️ note reads *El banco rechazó las credenciales. Puede que hayas cambiado tu clave de
  internet. Vuelve a ingresarla para reanudar la sincronización.*;
- the primary button is **Actualizar credenciales**; **Sincronizar ahora** is **not** drawn;
  **Desconectar banco** still is.

4. Repeat with each of the other three scripted failure reasons (`session_closed`, `network`,
   `parse_failed`).

**Expected result**: the note body changes for each reason, the header's *última sincronización
exitosa* line does **not** move, and no note ever contains raw bank text, a URL, a stack trace or
anything resembling a credential.

### Step 6: Disconnecting deletes the credential and keeps the movements

**Maps to**: **brief AC2**; manifest state `settings-banks&state=disconnect-confirm`.

1. Before disconnecting, open `/transactions` (item #15) and record the number of movements
   listed, and the total product count from `/settings/banks`.
2. Return to `/settings/banks/banco-de-chile` and tap **Desconectar banco**.

**Expected result**: the app navigates to `/settings/banks` **with the confirmation modal already
open** — the 🔌 icon, the title *Desconectar banco*, and the paragraph *¿Desconectar Banco de
Chile? Eliminaremos las credenciales del dispositivo y dejaremos de sincronizar. Tus movimientos
ya descargados se mantienen.* with **Cancelar** and **Desconectar**.

3. Tap **Cancelar**.

**Expected result**: the modal closes and the `list` state is intact. Navigate away and back —
the modal does **not** reopen.

4. Tap **Desconectar Banco de Chile** on the list, then **Desconectar** in the modal.

**Expected result**:

- the list falls back to the `empty` state (this was the only bank);
- `/transactions` still lists **exactly the same number of movements** as in sub-step 1;
- the movements are unchanged — same descriptions, same amounts, same categories.

5. Force-quit and relaunch the app.

**Expected result**: no automatic sync starts for the disconnected bank, and the list is still
`empty`.

### Step 7: Credential update re-runs the sync without re-entering the RUT

**Maps to**: **brief AC3**.

1. Reconnect `banco-de-chile` through the dev fixtures (as in step 2), then script an
   `invalid_credentials` failure (as in step 5) so `bank-review` is in its `error` state.
2. Tap **Actualizar credenciales**.

**Expected result**: item #9's credential form opens with the **RUT pre-filled and read-only**
(the `rut-locked` state) and only the password field editable. You are never asked to retype the
RUT.

3. Enter the fixture password and confirm.

**Expected result**: the syncing screen (`/(onboarding)/bank-syncing`) takes over, and when it
finishes you land back on **`/settings/banks`** — not in onboarding. The row's sub-label shows a
fresh sync time, and `bank-review` is back in its `ok` state.

### Step 8: *Sincronizar ahora* is safe to press

**Maps to**: `BEHAVIOR.md`'s 🟡 *"sincronizar ahora (BR5 la hace siempre segura)"*.

1. From `bank-review` in the `ok` state, note the movement count on `/transactions`.
2. Tap **Sincronizar ahora**, let the scripted read complete, and return.
3. Repeat twice more.

**Expected result**: the movement count is **identical** after each run — a re-sync stores nothing
twice (BR5). The sync time updates each run.

4. While a sync is in flight, return to `bank-review`.

**Expected result**: **Sincronizar ahora** is visibly disabled; pressing it does nothing.

### Step 9 (real bank — optional): the same three flows against Banco de Chile

**Maps to**: brief scope, end to end.

1. Wipe local data, connect a real Banco de Chile account through the normal flow, and let the
   first sync complete.
2. Repeat steps 3, 4, 6 and 8 with the real connection.

**Expected result**: identical behaviour. Confirm in particular that the products, balances and
cupos on `bank-review` match what the bank's own site shows.

### Step 10: Nothing this screen renders can leak a credential

**Maps to**: BR1; `AGENTS.md` non-negotiable 1.

1. With the Metro console open, walk steps 3-8 again.

**Expected result**: no log line from `src/features/banks/**` at all, and nothing anywhere in the
console, the error notes or a screenshot that contains a RUT, a password or a keychain key.

### Step 11: Deep-linking a bank that is not connected

**Maps to**: implementation plan Decision 13.

1. With no connection (or with `banco-de-chile` disconnected), open
   `finanzas:///settings/banks/banco-de-chile`.

**Expected result**: the app redirects to `/settings/banks` and shows the `empty` state. No crash,
no half-drawn detail screen.

### Step 12: Design fidelity — expected vs actual

**Maps to**: brief acceptance criterion *"Open `design/mockups/mobile/index.html` and compare side
by side before marking done"*; `AGENTS.md` non-negotiable 6.

**Reference assets**: `design/mockups/mobile/index.html` — `#screen=settings-banks&state=list`,
`&state=empty`, `&state=disconnect-confirm`, `#screen=bank-review&state=ok`, `&state=error`.

1. **Automated path (when item #47 has merged)**: run `pnpm fidelity --issue 20`.
   **Expected result**: all five targets pass. Paste the summary table into the PR.
2. **Manual path (always, and the only path if `scripts/mobile-ui/` is absent)**: open the mockup
   in a browser at 393×852 and put the device beside it. Compare each of the five states in turn:
   spacing rhythm, the monogram colour, the badge tones, the ghost/outline/danger button
   treatments, the mono meta lines, the modal's icon and button row, and the empty state's icon
   and copy.
3. Record PASS/FAIL per state with expected-vs-actual detail on any failure.

**Expected result**: each implemented state matches its mockup state. Known and accepted deltas:
the bank name inside the disconnect paragraph is **not** bold (implementation plan Assumption A9);
sample values differ (bank counts, times, balances) because they are data, not copy
(Assumption A10).

### Step 13 (optional): the fidelity preview does not ship

**Maps to**: implementation plan Decision 13.

1. Build a release bundle and search it for `fidelityScreen` and for the preview presentation's
   sample strings.

**Expected result**: no match — `useFidelityPreview()` returns inert whenever `__DEV__` is false.

### Last Step: Validate & shut down

- Verify every assertion in the checklist below.
- Stop the Metro dev server.

---

## Assertions Checklist

- [ ] **AC1** — `bank-review`'s `error` state shows the last **successful** sync separately from
      the failed last attempt, and the successful timestamp does not move when an attempt fails
      (Step 5).
- [ ] **AC2** — disconnecting deletes the keychain entry, stops syncing, and leaves every
      downloaded movement in place (Step 6).
- [ ] **AC3** — credential update re-runs the sync with the RUT pre-filled and read-only
      (Step 7).
- [ ] **AC4** — the implemented screens were compared side by side against
      `design/mockups/mobile/index.html` (Step 12).
- [ ] All three `settings-banks` states render: `list`, `empty`, `disconnect-confirm`
      (Steps 1, 3, 6).
- [ ] Both `bank-review` states render: `ok`, `error` (Steps 4, 5).
- [ ] Products show name, mask, cupo and balance, with the credit card's amount in the "out"
      colour (Step 4).
- [ ] The auto-sync note says 6 horas and matches `AUTOMATIC_SYNC_INTERVAL_MS`; there is **no**
      auto-sync toggle anywhere (Step 4).
- [ ] *Sincronizar ahora* is idempotent and is disabled while a sync is in flight (Step 8).
- [ ] Cancelling the confirmation leaves the connection untouched and does not reopen later
      (Step 6).
- [ ] A deep link to a bank with no live connection redirects to `/settings/banks` (Step 11).
- [ ] No credential, RUT or keychain key appears in any log, note or screenshot (Step 10).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| `financial_institutions` | The `banco-de-chile` catalogue row with `short_name: "BCH"` and `brand_color: "#003da5"` | Already seeded on first launch; `pnpm --filter @finanzas/mobile db:seed` regenerates the bundled fixture |
| Connection + 3 products + movements | The `list` and `ok` states, and the movement count Step 6 protects | Created at runtime by the connect flow driven from `/(dev)/connect-fixtures` + `/(dev)/sync-fixtures` (Step 2). Connections are **never** seeded — they only exist after a read |
| A failed sync outcome | The `error` state and its four reasons | Scripted from `/(dev)/sync-fixtures` (Step 5) |
| No data at all | The `empty` state | Fresh install, or the local wipe on `/settings/account` (item #19) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Movements disappeared after Step 6 | The disconnect deleted the `user_financial_institutions` row instead of setting `status = 'disconnected'`. Both `user_financial_products` and `transactions` cascade from it | A defect, not a test problem. Stop and report it: this is the item's central guarantee |
| The list still shows the bank after disconnecting | The list predicate is not filtering `status = 'disconnected'` | Check `listBankConnections` in `apps/mobile/src/db/repositories/institutions.ts` |
| A sync starts on relaunch for a disconnected bank | `isDueForAutomaticSync` lost its `status === 'active'` requirement | Check `apps/mobile/src/features/sync/auto-sync.ts` (item #10) and report upstream |
| The credential form asks for the RUT again | The connect-flow store was not seeded with the institution, or the keychain entry was removed | Confirm *Actualizar credenciales* calls `chooseInstitution` + `enterFlow('settings')` before navigating |
| *Sincronizar ahora* lands in onboarding instead of returning to settings | `enterFlow('settings')` was not set, so `resolveExitHref` resolved the onboarding branch | Same fix as above |
| `pnpm fidelity --issue 20` says a target is `planned` | The five mappings were not flipped to `wired` | Implementation plan Decision 13's table |
| `Unable to resolve` a native module | The dev client predates `expo-secure-store` / `react-native-webview` | Rebuild the dev client; `pnpm check:layout` first |

---

## Known Limitations

- Steps 1-8 and 10-12 exercise the screens through item #11's `__DEV__` scripted runner, so they
  prove the **screens**, not the scraper. A real bank read is only covered by the optional
  Step 9.
- The `disconnect-confirm` state cannot be reached by a deep link outside fidelity preview mode:
  it needs a live connection to confirm against. Fidelity captures use the frozen preview
  presentation instead.
- There is no automated device E2E flow (`.maestro/`) for these screens; the manual walk plus the
  Jest suites are the coverage.
- Step 13 depends on a release-bundle build, which is slower than the rest of the runbook and is
  therefore optional per run — but must be done at least once before the first release.
