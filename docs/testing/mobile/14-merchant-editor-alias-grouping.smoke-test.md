# Smoke Test Runbook: Merchant editor and alias grouping

**Feature**: Merchant editor and alias grouping (`#screen=merchant-edit`)
**Work item brief**: [`lhpaul/personal-finances#14`](https://github.com/lhpaul/personal-finances/issues/14)
(Refactor-type item — the issue body is the brief; there is no spec)
**Implementation plan**: [`2_14-merchant-editor-alias-grouping_implementation-plan.md`](../../specs/developments/20260802181431_14-merchant-editor-alias-grouping/2_14-merchant-editor-alias-grouping_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has run and `pnpm check:layout` passes.
- [ ] A **dev build** on an iOS simulator or device. Expo Go cannot load `expo-sqlite`, so the whole
      screen is unreachable there.
- [ ] `pnpm dev:mobile` is running and the dev client is attached.
- [ ] The store has been rebuilt from the committed fixture, so the merchant-editor scenario rows
      exist (see [Seed Data Reference](#seed-data-reference)).
- [ ] `design/mockups/mobile/index.html` is open in a browser next to the simulator
      (`pnpm mockups:mobile`).
- [ ] There is **no sign-in step** — the profile is the device. Do not look for one.

---

## Test Data

| Item | Value |
| --- | --- |
| Merchant under test | `MercadoLibre Chile` — `merchants.id` = `mercadolibre` |
| Its seeded alias | `MERCADOLIBRE COMPRA` (`match_type` `prefix`) |
| Movements already attributed to it | Four: three `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO` (2025-11-18, 2025-12-09, 2026-01-14) plus one dated 2026-01-16 that the person categorized by hand as **Comida** (`category_source` = `user`) |
| The candidate to group | `MERPAGO*MERCADOLIBRE` — two movements, no merchant |
| The negative control | `ML CHILE SPA` — one movement, no merchant, which must **not** be offered |
| Screen route | `/categorize/merchant/mercadolibre` |
| Deep link | `finanzas:///categorize/merchant/mercadolibre` |
| Mockup reference | `design/mockups/mobile/index.html#screen=merchant-edit&state=default` (also `&state=suggestions`, `&state=category-picker`) |

---

## Smoke Test Steps

### Step 1: Open the editor

1. Open the deep link `finanzas:///categorize/merchant/mercadolibre` from the dev client's URL bar.
2. Observe the screen that loads.

**Expected result**: The `default` state renders — a top bar titled **Configurar comercio** with a
back affordance, a **Nombre del comercio** field holding `MercadoLibre Chile` with the hint "Este
nombre se usará para agrupar todas las transacciones futuras.", a **Categoría por defecto** card
showing **Compras** with "Se aplicará automáticamente a futuras transacciones" and a **Cambiar**
button, an **Estadísticas de gasto** card, a **Posibles nombres legales (N)** disclosure row, and a
**Guardar** button at the bottom. All copy is Spanish.

### Step 2: The merchant name is editable and the rename persists

**Maps to**: brief Scope — "Rename a merchant"

1. Tap the name field and change it to `MercadoLibre CL`.
2. Tap **Guardar**.
3. Re-open the deep link from Step 1.

**Expected result**: The field shows `MercadoLibre CL`. Nothing else on the screen changed.

4. Change the name back to `MercadoLibre Chile` and tap **Guardar** again, so later steps read the
   drawn name.

### Step 3: The default category can be changed, and the picker is its own state

**Maps to**: brief Scope — "set its default category"; AC2

1. From `default`, tap **Cambiar**.
2. Observe the screen.

**Expected result**: The `category-picker` state renders — a card titled **Elige una categoría** with
a two-column grid of category chips (each with its emoji), the current default **Compras** shown as
selected, and a **Guardar categoría** button. The **Categoría por defecto** card, the statistics card
and the disclosure row are **not** on screen.

3. Tap **Comida**, then tap **Guardar categoría**.

**Expected result**: The screen returns to `default` and the **Categoría por defecto** card now shows
**Comida**. Nothing has been written yet.

4. Tap **Guardar** at the bottom, then re-open the deep link.

**Expected result**: The default category is **Comida**.

### Step 4: Setting a default category does not touch movements the person already categorized

**Maps to**: AC2 — "Setting a default category does not overwrite categories the user already
confirmed"

1. Before this step, note the category of the 2026-01-16 `MERCADOLIBRE` movement. It was categorized
   by hand as **Comida**.
2. Re-open the editor and change the default category to **Supermercado** (Step 3's mechanics), then
   tap **Guardar**.
3. Navigate to the transactions list (`finanzas:///(tabs)/transactions`) and find the 2026-01-16
   `MERCADOLIBRE` movement, and also the 2026-01-14 one.

**Expected result**: Both movements keep the category they had before Step 4. The hand-categorized
one still reads **Comida**. No movement was re-categorized to **Supermercado**. The new default is
visible only on the merchant, and applies to movements that arrive later.

4. Set the default back to **Compras** and tap **Guardar**, so the remaining steps start from the
   drawn value.

### Step 5: The suggestions state lists detected names with real counts

**Maps to**: brief Scope — "fold multiple raw bank descriptions into it"; AC3

1. From `default`, tap the **Posibles nombres legales (N)** row.
2. Observe the screen.

**Expected result**: The `suggestions` state renders — a card titled **Nombres detectados en tus
movimientos**, the top bar, the name field, the **Categoría por defecto** card, the statistics card
and the **Guardar** button all still present, and the disclosure row replaced by the card. The
disclosure count N equals the number of rows in the card.

3. Read the rows.

**Expected result**:

- `MERCADOLIBRE COMPRA` carries an **Actual** badge and a movement count of **4** — the four
  movements currently attributed to this merchant.
- `MERPAGO MERCADOLIBRE` carries an **Agrupar** badge and a movement count of **2**.
- `ML CHILE SPA` is **absent** — it shares no distinctive token with the merchant, and community
  suggestions are out of MVP scope. Its absence is the expected behavior, not a bug.
- Every raw string is rendered in the monospaced style the mockup uses.

### Step 6: Grouping an alias re-links existing movements

**Maps to**: AC1 — "Grouping an alias re-links existing movements and applies to future ones"; AC3

1. Tap the **Agrupar** badge on the `MERPAGO MERCADOLIBRE` row.

**Expected result**: The row's badge becomes **Actual**, its count stays **2**, and the
`MERCADOLIBRE COMPRA` row still reads **4**. The disclosure count is unchanged — the row moved from
candidate to alias, and the count is aliases plus candidates. No navigation happened and no
confirmation dialog appeared.

2. Tap **Cerrar**, then navigate to the transactions list and find the two `MERPAGO*MERCADOLIBRE`
   movements (2025-12-20 and 2026-01-06).

**Expected result**: Both now show **MercadoLibre Chile** as their merchant. Their category, note,
exclusion state and amount are unchanged — grouping moved the merchant and nothing else.

3. Force-quit the app, reopen the editor and open `suggestions` again.

**Expected result**: Exactly two **Actual** rows, `MERCADOLIBRE COMPRA` (4) and
`MERPAGO MERCADOLIBRE` (2). No duplicate row was created and no error appeared — one alias row exists
per raw pattern.

### Step 7: `match_count` reflects the real number of movements

**Maps to**: AC3 — "`match_count` reflects the real number of movements"

1. In the `suggestions` card, add up the movement counts on the **Actual** rows.

**Expected result**: The sum is **6** — the four movements originally attributed to the merchant plus
the two just grouped. No count is stale, and no count exceeds the number of movements the transactions
list shows for this merchant.

2. Force-quit the app, reopen it, and return to the editor.

**Expected result**: The counts are identical. They are recomputed from the movements table on every
load, not carried in memory.

### Step 8: Spending statistics over the last three months

**Maps to**: brief Scope — "Spending statistics over the last three months"

1. On the `default` state, read the **Estadísticas de gasto** card.

**Expected result**: The card shows a **Promedio mensual** amount in CLP with `.` thousands
separators and no decimals, a percentage line reading "… vs mes anterior", and three bars each
labelled with a three-letter month abbreviation in Spanish. The three labels are the current month
and the two before it, in chronological order left to right, and the rightmost bar is the highlighted
one.

> **Note on values**: the committed fixture's movements are dated November 2025 to January 2026. If
> the device clock is later than April 2026 the three months in the window contain no movements, so
> every bar is empty and the average reads `$0`. That is correct behavior for a dormant merchant.
> Verify the **shape** here — three bars, three Spanish month abbreviations, an average line and a
> delta line. The arithmetic is proven by the repository tests
> (`pnpm --filter @finanzas/mobile test -- merchants`), which pin the reference day.

### Step 9: A merchant with nothing to fold still renders

**Maps to**: implementation plan assumption A6

1. Open `finanzas:///categorize/merchant/netflix`.
2. Tap the **Posibles nombres legales** row.

**Expected result**: The screen renders normally, the disclosure count is honest (it may be `(1)` for
the seeded `NETFLIX.COM` alias and no candidates), and the card shows the **Actual** row with no
**Agrupar** rows. If the count is `(0)`, the card shows "Aún no detectamos otros nombres para este
comercio." instead of an empty list. Nothing crashes.

### Step 10: An unknown merchant does not crash the app

**Maps to**: implementation plan assumption A7

1. Open `finanzas:///categorize/merchant/no-such-merchant`.

**Expected result**: An empty state reading "No encontramos este comercio" with a **Volver** action.
The app does not crash and no blank form appears.

### Step 11: Arriving from the categorization flow carries the selected category

**Maps to**: merged #13 spec A9 / Conflict 2

> Run this step as written when #13 (categorization flow) has shipped. Until then, exercise the same
> seam through the deep link in sub-step 3, which is the identical code path.

1. Start a categorization stage and reach a movement whose merchant is `MercadoLibre Chile`.
2. Tap the merchant name ("Toca para editar") after selecting a category — for example **Comida**.
3. Or, equivalently: open
   `finanzas:///categorize/merchant/mercadolibre?categoryId=comida`.

**Expected result**: The editor opens with **Comida** already shown as the **Categoría por defecto**,
pre-selected but **not** saved. Backing out without tapping **Guardar** leaves the merchant's stored
default unchanged; tapping **Guardar** persists it.

### Step 12: Design fidelity — expected vs actual

**Maps to**: brief AC4 — "Open `design/mockups/mobile/index.html` and compare side by side before
marking done"; `AGENTS.md` non-negotiable #6

1. Run the automated gate:

   ```bash
   pnpm fidelity:contract
   pnpm fidelity --issue 14
   ```

2. Open each reference state in the browser and compare it against the running app:
   - `design/mockups/mobile/index.html#screen=merchant-edit&state=default`
   - `design/mockups/mobile/index.html#screen=merchant-edit&state=suggestions`
   - `design/mockups/mobile/index.html#screen=merchant-edit&state=category-picker`
3. Record PASS/FAIL per state, with expected-vs-actual detail on any failure.

**Expected result**: `pnpm fidelity:contract` reports the three `merchant-edit` targets as `wired`,
and `pnpm fidelity --issue 14` produces a comparison for each. Side by side, card order, spacing,
typography, badge tones and the amber/green money colours match the mockup. Two documented
differences are expected and are recorded as `threshold_note` entries in the contract: the statistics
card's numbers and bar heights come from real data rather than the mockup's `$60.200 / −55%` sample,
and the category picker draws the full taxonomy rather than the mockup's six illustrative chips.

### Last Step: Validate & Shut Down

- Tick every assertion below.
- Stop the dev server and close the simulator.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from the work item brief.

- [ ] **AC1** — Grouping `MERPAGO MERCADOLIBRE` re-links its two existing movements to
      `MercadoLibre Chile` and leaves their other columns untouched (Step 6); the alias is stored, so
      matching movements arriving later resolve to the same merchant.
- [ ] **AC2** — Changing the default category writes nothing to any movement: the hand-categorized
      2026-01-16 movement still reads **Comida** afterwards (Step 4).
- [ ] **AC3** — The **Actual** rows' movement counts sum to the merchant's real movement total, before
      and after grouping, and survive an app restart (Steps 5, 6, 7).
- [ ] **AC4** — All three MVP manifest states (`default`, `suggestions`, `category-picker`) render and
      match the mockup side by side, with the two documented threshold differences (Steps 1, 3, 5, 12).
- [ ] Renaming the merchant persists and is used as the display name (Step 2).
- [ ] The statistics card shows the current month and the two before it, with a monthly average and a
      period-over-period delta (Step 8).
- [ ] The A9 seam pre-selects a carried category without persisting it (Step 11).
- [ ] Defensive branches do not crash: no candidates (Step 9) and an unknown merchant (Step 10).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| `merchants` / `merchant_aliases` starter content | `mercadolibre` → `MercadoLibre Chile`, default category **Compras**, alias `MERCADOLIBRE COMPRA` | Applied automatically on first launch by the bootstrap seed path |
| Merchant-editor movements | Four attributed to `mercadolibre` (one of them hand-categorized as **Comida**), two `MERPAGO*MERCADOLIBRE` and one `ML CHILE SPA` with no merchant | `pnpm --filter @finanzas/mobile db:seed` rebuilds `apps/mobile/src/db/__fixtures__/store-v1.sql`; load it into the dev build the same way the other mobile runbooks do |

Re-running `db:seed` twice must leave `git status` clean — the fixture is byte-deterministic.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The screen still renders the placeholder text | The route file was not replaced, or the bundler cached the old module | Confirm `apps/mobile/app/categorize/merchant/[merchantId].tsx` no longer imports `RoutePlaceholder`, then restart the dev server |
| All three bars are empty and the average reads `$0` | The device clock is more than three months past the fixture's newest movement (2026-01) | Expected — see the note in Step 8. Verify shape here and rely on the repository tests for the arithmetic |
| `ML CHILE SPA` never appears as a candidate | Working as designed | The MVP derives suggestions from the person's own movements only; `ML` is too short and `CHILE`/`SPA` are generic tokens. Community-sourced suggestions are out of MVP scope |
| Tapping **Agrupar** raises a unique-constraint error | The alias insert path ran instead of the re-point path | `merchant_aliases_raw_pattern_unique` is global; grouping must look the pattern up first and update `merchant_id` when a row already exists |
| A movement moved to this merchant that should not have | The suggestion rule or the re-link filter is too loose | Re-linking claims only movements with `merchant_id IS NULL`; check the filter before suspecting the matcher |
| Counts disagree between the disclosure row and the card | Two separate reads instead of one snapshot | Both must come from the same `readMerchantEditor` result |
| `pnpm fidelity --issue 14` reports "still planned" | The contract rows were not flipped | Flip all three `merchant-edit` rows to `wired` with `app_file`, `deep_link` and `ready_test_id` |
| Native module missing at runtime | Running in Expo Go | Use a dev build |

---

## Known Limitations

- The statistics card's values depend on the device clock, while the committed fixture's dates are
  fixed. On a clock later than April 2026 the on-device check is a shape check; the numeric behavior
  is covered by repository tests that pin the reference day.
- Step 11's in-app path depends on #13 (categorization flow). Until #13 ships, the equivalent deep
  link exercises the same code path but not the navigation that produces it.
- The mockup's third suggestion row (`ML CHILE SPA`) is community knowledge, which has no source in a
  device-only product. Its absence is expected and is recorded as an assumption in the plan.
- This runbook does not exercise a real bank sync. Whether a newly synced `MERPAGO*MERCADOLIBRE`
  movement resolves to the merchant on ingest belongs to #10's runbook.
