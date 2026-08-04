# Smoke Test Runbook: Transaction detail and exclusion

**Feature**: Transaction detail and exclusion (#16)
**Work item brief**: [issue #16](https://github.com/lhpaul/personal-finances/issues/16) — a
Refactor-type item, so there is no spec file; the issue body is the acceptance contract.
**Implementation plan**: [`../../specs/developments/20260802143959_16-transaction-detail-exclusion/2_16-transaction-detail-exclusion_implementation-plan.md`](../../specs/developments/20260802143959_16-transaction-detail-exclusion/2_16-transaction-detail-exclusion_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] A **dev build** on the iOS simulator (`pnpm dev:mobile`). Expo Go cannot run this app —
      `expo-sqlite` is a native module.
- [ ] `pnpm install` has run and `pnpm check:layout` passes.
- [ ] The simulator has launched the app at least once, so migrations and starter seeds have been
      applied.
- [ ] `sqlite3` is available on the machine (ships with macOS).
- [ ] The mockups are open in a browser: `open design/mockups/mobile/index.html`.
- [ ] There is **no sign-in**. The app has no account and no session; "fresh session" here means a
      fresh database, loaded in Step 0.

---

## Test Data

| Item | Value |
| --- | --- |
| Fixture | `apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql` |
| Categorized movement | `detail-tx-categorized` — `Líder S.A.`, `$35.000`, `viernes, 24 de enero de 2025`, `11:20`, category `🛒 Supermercado`, `category_source = 'auto'`, note `Compras semanales` |
| Uncategorized movement | `detail-tx-uncategorized` — the same bank facts, no category, no note |
| Excluded movement | `detail-tx-excluded` — the same bank facts, category `🛒 Supermercado` with `category_source = 'user'`, excluded with reason `shared_expense` |
| Bank description (all three) | `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` |
| Product | `Cta. corriente ••4821` |
| Detail route | `/transactions/[transactionId]` |
| Deep link template | `finanzas:///transactions/<id>` |
| Design reference | `design/mockups/mobile/index.html#screen=transaction-detail&state=<state>` |

---

## Smoke Test Steps

### Step 0: Load the fixture

The app has no bank connection until #10 ships, so the three movements are loaded directly into
the device store.

1. Stop the app on the simulator.
2. Resolve the container and apply the fixture:

   ```bash
   # cl.finanzas.mobile.dev is the development-variant bundle identifier since #23
   # (apps/mobile/app.config.js -> expo.ios.bundleIdentifier).
   CONTAINER=$(xcrun simctl get_app_container booted cl.finanzas.mobile.dev data)
   DB_PATH=$(find "$CONTAINER" -name 'finanzas.db' | head -1)
   sqlite3 "$DB_PATH" < apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql
   ```

   The `find` is deliberate: the exact directory `expo-sqlite` uses under the app container is
   **unverified** in this runbook — the implementer confirms it on the first run and may pin the
   path here afterwards. Every later SQL step reuses `$DB_PATH`.
3. Relaunch the app.

**Expected result**: the command exits without error and
`sqlite3 "$DB_PATH" "select count(*) from transactions where id like 'detail-tx-%';"` prints `3`.

### Step 1: Open the categorized movement

**Maps to**: brief *"Full detail"*, AC2

1. Open `finanzas:///transactions/detail-tx-categorized` (paste it into the dev client's URL bar,
   or `xcrun simctl openurl booted 'finanzas:///transactions/detail-tx-categorized'`).
2. Read the whole screen against
   `design/mockups/mobile/index.html#screen=transaction-detail&state=categorized`.

**Expected result**:

- Top bar reads **Detalle de transacción** with a back control.
- Hero card: badge **Gasto**, glyph **🛒**, amount **$35.000** in the expense tone, name
  **Líder S.A.**
- **Información** card rows, in order: Comercio `Líder S.A.` · Fecha `viernes, 24 de enero de
  2025` · Hora `11:20` · Producto `Cta. corriente ••4821` · Categoría `🛒 Supermercado`.
- Directly under the category row: **Categoría sugerida automáticamente según el comercio**.
- **Descripción del banco** shows `COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL` in a
  flat monospaced block.
- **Nota** shows `Compras semanales`.
- Buttons, in order: **Cambiar categoría**, **Configurar comercio**, **Excluir del análisis**.
- There is **no** "Eliminar" control anywhere on the screen.

### Step 2 (optional — requires #15): Reach the screen from the list

**Maps to**: the navigation seam

1. Open the **Transacciones** tab.
2. Tap the `Líder S.A.` row for `$35.000`.

**Expected result**: the same screen as Step 1 opens. If #15 has not merged, skip this step and
use the deep links throughout — see *Known Limitations*.

### Step 3: The bank's facts are read-only

**Maps to**: **AC1** — `raw_description` is never editable

1. Tap directly on the **Descripción del banco** block.
2. Tap on the amount, the date, the hour and the product row.
3. Try a long-press on the description block.

**Expected result**: none of them opens a keyboard, a cursor, a menu or an edit affordance.
Nothing about the bank's text, amount, type, date or hour can be changed from this screen.
Confirm the store agrees after the whole run:

```bash
sqlite3 "$DB_PATH" \
  "select raw_description, amount, type, occurred_at, date_local
   from transactions where id = 'detail-tx-categorized';"
```

The values must be identical to the ones this runbook started with.

### Step 4: Edit the note

**Maps to**: brief *"the editable note"*, Assumption A8

1. Tap the **Nota** field, clear it and type `Compras del sábado`.
2. Tap outside the field to blur it.
3. Read the store:

   ```bash
   sqlite3 "$DB_PATH" "select note from transactions where id = 'detail-tx-categorized';"
   ```

4. Now clear the field completely and, **without** tapping outside, navigate back with the top-bar
   control (this exercises the teardown flush).
5. Re-open the movement and read the store again.

**Expected result**: after step 3 the query prints `Compras del sábado`. After step 5 the field is
empty, the query prints an empty line, and

```bash
sqlite3 "$DB_PATH" "select note is null from transactions where id = 'detail-tx-categorized';"
```

prints `1` — a blank note is stored as `NULL`, not as an empty string. Restore the note to
`Compras semanales` before continuing.

### Step 5: Change the category

**Maps to**: brief *"category change"*

1. Tap **Cambiar categoría**.
2. Verify the picker opens as a sheet over the screen, showing category chips for **expenses
   only** (no income category is offered for a `debit` movement).
3. Choose **🍔 Comida** and confirm.
4. Read the store:

   ```bash
   sqlite3 "$DB_PATH" \
     "select transaction_category_id, category_source
      from transactions where id = 'detail-tx-categorized';"
   ```

**Expected result**: the info row now reads `🍔 Comida`, the hero glyph is `🍔`, and the query
prints `comida|user`. Because `category_source` is now `user`, the **Categoría sugerida
automáticamente** caption disappears — this is AC2 observed from the other direction. Restore the
category to `supermercado` with `category_source = 'auto'` before Step 9, or re-apply the fixture.

### Step 6: The merchant shortcut

**Maps to**: brief *"merchant shortcut"*

1. Tap **Configurar comercio**.
2. Note where it lands, then navigate back.

**Expected result**: the app navigates to `/categorize/merchant/detail-merchant-lider`. Until #14
ships, that route is still a placeholder — the correct result is that the placeholder for
`merchant-edit` is shown, not a crash and not a dead button. Navigating back returns to the same
movement with the same note and category.

### Step 7: Exclude from analysis

**Maps to**: brief *"the exclusion sheet"*, BR3

1. Open `finanzas:///transactions/detail-tx-uncategorized`.
2. Confirm the `uncategorized` differences against
   `#screen=transaction-detail&state=uncategorized`: glyph **❓**, a **Sin categorizar** badge in
   the Categoría row, **no** auto-suggestion caption, the note field showing the placeholder
   **Agregar una nota…**, and the buttons **Categorizar ahora** / **Configurar comercio** /
   **Excluir del análisis**.
3. Tap **Excluir del análisis**.
4. Compare the sheet against `#screen=transaction-detail&state=exclude-sheet`: title **🚫 Excluir
   del análisis**, question **¿Por qué quieres excluir esta transacción?**, exactly **four**
   options — Transferencia personal (pre-selected), Involucra a más personas, Gasto no relevante,
   Otro — **no** free-text field, and the buttons **Cancelar** / **Confirmar**.
5. Tap **Cancelar**.
6. Read the store — nothing may have been written:

   ```bash
   sqlite3 "$DB_PATH" \
     "select excluded_at is null from transactions where id = 'detail-tx-uncategorized';"
   ```

7. Re-open the sheet, choose **Involucra a más personas**, and tap **Confirmar**.
8. Read the store again:

   ```bash
   sqlite3 "$DB_PATH" \
     "select excluded_at, exclusion_reason, exclusion_note, included_amount
      from transactions where id = 'detail-tx-uncategorized';"
   ```

**Expected result**: after step 6 the query prints `1`. After step 8 `excluded_at` holds a
timestamp, `exclusion_reason` is `shared_expense`, and both `exclusion_note` and `included_amount`
are empty (`NULL`). The row still exists — count the table before and after and confirm it is
unchanged. The screen now shows the `excluded` presentation: badge **Excluida del análisis**,
glyph **🚫**, the warning note **Excluida del análisis. Motivo: involucra más personas. No cuenta
en totales ni gráficos.**, and a single button **Volver a incluir en el análisis**.

### Step 8: Re-include

**Maps to**: **AC3** — re-including clears the exclusion fields and restores it to aggregates

1. Open `finanzas:///transactions/detail-tx-excluded` and compare against
   `#screen=transaction-detail&state=excluded`. Confirm the auto-suggestion caption is **absent**
   (this movement's `category_source` is `user`) and that the only action offered is **Volver a
   incluir en el análisis**.
2. Record the category total before re-inclusion:

   ```bash
   sqlite3 "$DB_PATH" \
     "select coalesce(sum(coalesce(included_amount, amount)), 0)
      from transactions
      where transaction_category_id = 'supermercado' and excluded_at is null
        and date_local between '2025-01-01' and '2025-01-31';"
   ```

3. Tap **Volver a incluir en el análisis**.
4. Read the row and the total again:

   ```bash
   sqlite3 "$DB_PATH" \
     "select excluded_at is null, exclusion_reason is null, exclusion_note is null,
             transaction_category_id, included_amount is null
      from transactions where id = 'detail-tx-excluded';"
   ```

5. Tap **Volver a incluir en el análisis** again if it is still offered.

**Expected result**: after step 4 the query prints `1|1|1|supermercado|1` — all three exclusion
columns cleared, the category kept, `included_amount` still null — and the category total from
step 2 has grown by `35000`. The screen has switched to the `categorized` presentation. After step
5 the action is no longer offered (the movement is already included); if it is somehow tapped
again, nothing changes and nothing throws.

### Step 9: Design fidelity — expected vs actual

**Maps to**: brief AC4 — *"Open `design/mockups/mobile/index.html` and compare side by side before
marking done"*

The design assets for this item are the mockup states named in the issue body's `## Mockups`
section. There is no other reference asset; do not invent one.

1. Re-apply the fixture (Step 0) so the three movements are back in their pristine state.
2. Run the automated comparison:

   ```bash
   pnpm fidelity --issue 16
   ```

3. Then compare by eye, side by side, for each of the four states:

   | App | Reference |
   | --- | --- |
   | `finanzas:///transactions/detail-tx-categorized` | `#screen=transaction-detail&state=categorized` |
   | `finanzas:///transactions/detail-tx-uncategorized` | `#screen=transaction-detail&state=uncategorized` |
   | `finanzas:///transactions/detail-tx-excluded` | `#screen=transaction-detail&state=excluded` |
   | `finanzas:///transactions/detail-tx-categorized` + tap **Excluir del análisis** | `#screen=transaction-detail&state=exclude-sheet` |

4. Record PASS/FAIL per state, with expected-vs-actual detail on failure.

**Expected result**: all four targets report `wired` and PASS. One known, accepted difference: the
category label reads **Supermercado** where the mockup draws **Comida**, because the mockup pairs
`supermercado`'s 🛒 glyph with `comida`'s name and no seeded category is both (plan Assumption
A5). Any other difference is fixed in the screen or the fixture — **never** by raising the
mismatch threshold.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Re-apply the fixture so the device is left in a known state.
- Shut down the app.

---

## Assertions Checklist

- [ ] All four MVP states render: `categorized`, `uncategorized`, `excluded`, `exclude-sheet`
      (Steps 1, 7, 8, 9).
- [ ] **AC1** — `raw_description` is never editable, and no bank fact changed across the whole run
      (Step 3).
- [ ] **AC2** — *Categoría sugerida automáticamente* appears on the `auto` movement and disappears
      the moment the person picks a category themselves (Steps 1, 5); it is absent on the
      `uncategorized` movement and on the `user`-sourced excluded one (Steps 7, 8).
- [ ] **AC3** — re-inclusion clears `excluded_at`, `exclusion_reason` and `exclusion_note`, keeps
      the category, and the movement re-enters the category total (Step 8).
- [ ] **AC4** — every state was compared against `design/mockups/mobile/index.html` and
      `pnpm fidelity --issue 16` reports four `wired` targets (Step 9).
- [ ] BR3 — no movement was deleted; the `transactions` row count is unchanged from Step 0
      (Steps 7, 8).
- [ ] The note is editable, trims, stores `NULL` when blank, and survives a back-navigation flush
      (Step 4).
- [ ] The category can be changed in place, offers only the movement's own direction, and writes
      `category_source = 'user'` (Step 5).
- [ ] The merchant shortcut navigates and returns without losing screen state (Step 6).
- [ ] The exclusion sheet offers exactly four reasons and no free-text field; Cancelar writes
      nothing (Step 7).
- [ ] `included_amount` is `NULL` on every movement this run touched (Steps 7, 8).
- [ ] No user-facing string appeared in a language other than Spanish, and none looked like a
      translation key.

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| 1 connection, 1 product (`Cta. corriente`, mask `4821`), 1 merchant (`Líder S.A.`) and 3 movements | The three detail states, with the mockup's own sample values | `sqlite3 "$DB_PATH" < apps/mobile/src/db/__fixtures__/transaction-detail-v1.sql` (Step 0) |

The fixture is a **delta**: it assumes a bootstrapped store (schema + starter seeds already
applied by the first app launch) and is idempotent, so re-running it between steps is the
supported way to reset.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `sqlite3` reports `no such table: transactions` | The app has never launched, so migrations have not run | Launch the app once, then re-run Step 0 |
| The deep link opens the app but lands on the home screen | The route param did not resolve | Confirm the id in the URL matches a row: `sqlite3 "$DB_PATH" "select id from transactions where id like 'detail-tx-%';"` |
| The screen shows *No encontramos esta transacción.* | The fixture is not loaded, or the id is mistyped | Re-run Step 0 |
| The auto-suggestion caption is missing on `detail-tx-categorized` | A previous run's Step 5 left `category_source = 'user'` | Re-apply the fixture |
| `pnpm fidelity --issue 16` says a target is still `planned` | Implementation Order Step 10 was not completed | Flip the four mappings to `wired`; do not run the gate against a `planned` target |
| A fidelity capture fails on a text row only | The device is not on the profile's simulator, or the fixture drifted | Re-apply the fixture and confirm the simulator matches `profiles.simulator_name`. Never raise the threshold |
| The category picker shows income categories | The movement's direction was misread | This is a real bug in the chip inputs, not a test-data problem — report it |

---

## Known Limitations

- **Step 2 depends on #15.** Until the transactions list ships, the screen is reachable only by
  deep link. Every other step is written to be deep-link-driven, so the runbook is fully
  executable without #15.
- **Step 6 depends on #14.** Until the merchant editor ships, *Configurar comercio* lands on a
  placeholder. The assertion is that navigation happens and the round trip preserves screen state,
  not that the editor works.
- **Step 9 depends on #47.** Without the fidelity gate, `pnpm fidelity` does not exist and only
  the manual side-by-side comparison in Step 9.3 can be performed.
- **The `exclude-sheet` capture is reached by tapping**, not by a distinct movement, because it is
  an overlay over the `categorized` presentation — the same way the mockup draws it.
- **One accepted visual difference** is documented in Step 9: `Supermercado` vs the mockup's
  `Comida` (plan Assumption A5). It is flagged for LH in the plan PR and is not a test failure.
