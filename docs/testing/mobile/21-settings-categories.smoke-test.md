# Smoke Test Runbook: Settings — categories management

**Feature**: Categories management (`#screen=settings-categories`, states `expense`, `income`,
`edit`, `delete-confirm`) — issue
[#21](https://github.com/lhpaul/personal-finances/issues/21)
**Work item brief**: [issue #21](https://github.com/lhpaul/personal-finances/issues/21) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `settings-categories`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**: [`2_21-settings-categories_implementation-plan.md`](../../specs/developments/20260802191607_21-settings-categories/2_21-settings-categories_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

> **Read this before you start.** Step 6 deletes a category. Deletion is irreversible for the
> category row itself — the movements survive and move to ✨ Otros (BR7), but the category and any
> budget rows attached to it are gone. Run this runbook on a simulator or a test device.

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A dev build, not Expo Go.** This screen reads SQLite through `expo-sqlite`, a native module.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison: `open design/mockups/mobile/index.html`.
- [ ] The device store holds the seeded categories and at least a handful of categorized movements
      in the **current month** (see *Seed Data Reference*). Without movements, Steps 3 and 6 cannot
      check the counts.
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks.

---

## Test Data

| Item | Value |
| --- | --- |
| Categories screen | `/settings/categories` — deep link `finanzas:///settings/categories` |
| Mockup reference | `design/mockups/mobile/index.html#screen=settings-categories&state=expense`, `…&state=income`, `…&state=edit`, `…&state=delete-confirm` |
| Seeded expense categories | 10, in token order: Comida, Supermercado, Transporte, Compras, Entretenimiento, Servicios, Salud, Educación, Hogar, **✨ Otros** (last) |
| Seeded income categories | 6: Sueldo, Freelance, Ingresos extra, Inversiones, Bonos, **✨ Otros** (last) |
| On-device fixture | `apps/mobile/src/db/__fixtures__/store-v1.sql` — loaded through item #12's `__DEV__` sample-data panel (`finanzas://sample-data`) when it has landed |
| Category created during this run | name `Mascotas`, icon any glyph from the grid |

> **Why the drawn list is shorter than the real one**: the mockup draws 8 expense and 5 income rows;
> the seed ships 10 and 6 (plan Decision 15, Assumption A6). The extra rows are expected — the
> screen renders the store, not the drawing.

---

## Smoke Test Steps

### Step 1: Reach the screen — `settings-categories&state=expense`

**Maps to**: brief scope, plan Decisions 8 and 13.

1. Launch the dev build with a populated store.
2. Navigate: **Configuración → Categorías** (or deep-link `finanzas:///settings/categories`).
3. Open `#screen=settings-categories&state=expense` beside it.

**Expected result**: a top bar reading **Categorías** with a back affordance to `/settings`; below
it a two-option segment **Gastos | Ingresos** with **Gastos** active; then one grouped list of the
expense categories in seed order, each with its emoji, its name and a `☰` handle on the right; and
at the bottom an outline button **+ Nueva categoría de gasto**.

### Step 2: The income tab — `settings-categories&state=income`

**Maps to**: brief scope ("expense/income tabs"), plan Decision 7.

1. Tap **Ingresos**.
2. Open `#screen=settings-categories&state=income` beside it.

**Expected result**: the list swaps to the income categories, ✨ Otros still last, and the bottom
button now reads **+ Nueva categoría de ingreso**. Tap **Gastos** to return; the expense list comes
back in the same order it had.

### Step 3: The row captions are real counts

**Maps to**: plan Decision 6, Assumptions A4 and A5.

1. Stay on **Gastos**.
2. Compare each row's subtitle against the movements you know are in the store this month (the
   transactions list at `/transactions` is the cross-check when item #15 has landed; otherwise the
   sample fixture's own data).

**Expected result**: a row shows *«N transacciones este mes»* only when it actually has movements
dated in the current month, and shows **no** subtitle when it has none — exactly as the mockup
draws it, where only some rows carry a subtitle. A movement that was **excluded** from analysis
still counts here (it is still stored in that category).

### Step 4: Create a category

**Maps to**: brief scope ("create"), plan Decisions 4, 7, 9 and Assumption A3.

1. On **Gastos**, tap **+ Nueva categoría de gasto**.
2. In the sheet, type `Mascotas` in **Nombre** and pick any glyph under **Ícono**.
3. Tap **Guardar**.

**Expected result**: the sheet carries the two fields the mockup draws (**Nombre**, **Ícono**) and
**no** *Eliminar categoría* button and **no** direction control. **Guardar** is unavailable until
both a name and an icon are set. After saving, the sheet closes and **Mascotas** appears in the
expense list **immediately above ✨ Otros**, with no subtitle (it has no movements yet). Switch to
**Ingresos** and back: it is still there, still above ✨ Otros.

### Step 5: Edit a category — `settings-categories&state=edit`

**Maps to**: brief scope ("edit (name + emoji)"), plan Decisions 4 and 8.

1. Tap the **Comida** row.
2. Open `#screen=settings-categories&state=edit` beside it.
3. Change the name to `Comida y café`, pick a different glyph, tap **Guardar**.

**Expected result**: the sheet is titled **Editar categoría**, the name field is pre-filled with the
current name, the current glyph is pre-selected in the grid, and a ghost **Eliminar categoría**
button in the danger colour sits below **Cancelar / Guardar**. After saving, the row shows the new
name and glyph, **in the same position** as before, and its subtitle (its movement count) is
unchanged — the rename moved nothing. Re-open the sheet and tap **Cancelar**: nothing changes.

### Step 6: Delete a category — `settings-categories&state=delete-confirm`

**Maps to**: **brief AC1**, plan Decisions 1 and 6.

1. Note the movement count shown on the row you are about to delete, and note ✨ Otros' count.
2. Tap that row, then **Eliminar categoría**.
3. Open `#screen=settings-categories&state=delete-confirm` beside it.
4. Tap **Cancelar** first, and confirm you land back on the **list** (not back on the edit sheet).
5. Re-open and this time tap **Eliminar**.

**Expected result**: the modal shows the 🗑 icon, the title **Eliminar categoría**, and a sentence
naming the category with its emoji and the number of transactions that will move to ✨ Otros. After
confirming, the category disappears from the list, and the movements that were in it are now in
✨ Otros — verify by opening the transactions list (or the ✨ Otros row's count, which must have
grown by the deleted category's **all-time** count). **No movement disappeared.**

### Step 7: ✨ Otros cannot be touched

**Maps to**: **brief AC2**, plan Decision 3, Resolution R2, Assumption A1.

1. On **Gastos**, look at the ✨ Otros row, then tap it.
2. Try to drag it by the place where other rows have their `☰` handle.
3. Repeat both on **Ingresos**.

**Expected result**: the ✨ Otros row shows the subtitle **Categoría por defecto · no se puede
eliminar** on Gastos and **Categoría por defecto** on Ingresos; it has **no `☰` handle**; tapping it
opens **nothing**; and it cannot be dragged. There is no path in this screen that reaches a delete
or rename affordance for it.

### Step 8: Reorder, and prove it stuck

**Maps to**: **brief AC3**, plan Decisions 5 and 10.

1. On **Gastos**, press and drag the `☰` handle of **Transporte** to the top of the list.
2. Release. Leave the screen (back to **Configuración**) and return.
3. Force-quit the app, relaunch, and open the screen again.
4. Open a categorization surface that lists categories — the categorize flow (#13) or a transaction
   detail's category picker (#16) — when those have landed.

**Expected result**: the row moves while you drag, the list closes the gap behind it, and on release
the new order holds. It survives leaving the screen and it survives a relaunch. ✨ Otros is still
last. The categorization picker lists the expense categories in the **same** order — there is only
one ordering in the app.

### Step 9: Design fidelity — expected vs actual

**Maps to**: **brief AC4** (*"Open `design/mockups/mobile/index.html` and compare side by side
before marking done"*), plan Decisions 14 and 15, Resolution R3.

**If the fidelity kit (item #47) has landed**:

1. Load the deterministic fixture, then run `pnpm fidelity --issue 21`.
2. Read the summary table and open the diff PNGs under `.tmp/ui-fidelity/`.

**Expected result**: the four targets (`expense`, `income`, `edit`, `delete-confirm`) capture and
compare. The two **list** targets are expected to exceed the default 3 % threshold purely because
the store holds 10 and 6 categories where the mockup draws 8 and 5 (plan Decision 15) — confirm from
the diff image that the difference is **only** the extra rows. Any difference in spacing, colour,
type scale, the segment, the sheet or the modal is a real failure and must be fixed, not
thresholded.

**If it has not landed** (or in addition to it):

1. Open `design/mockups/mobile/index.html` and set each of the four states in turn.
2. Compare side by side with the running app: top bar, segment, row anatomy (emoji, title, optional
   subtitle, handle), the create button's copy, the sheet's two fields and three buttons, and the
   modal's icon, title, sentence and button pair.

**Expected result**: every drawn element is present with the same copy, order and emphasis. Record
PASS/FAIL per state with expected-vs-actual detail on any failure.

### Last Step: Validate & Shut Down

- Verify every assertion in the checklist below.
- Restore the store if you want to keep testing (reload the fixture; the deleted category is gone
  for good).
- Shut down the dev build.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion in the work item brief.

- [ ] **AC1** — deleting a category re-parents its transactions to the ✨ Otros of the same
      direction; no movement was deleted, and the ✨ Otros count grew by exactly the deleted
      category's all-time count (Step 6).
- [ ] **AC2** — the two ✨ Otros rows offer no delete action, no edit sheet and no drag handle, in
      both directions (Step 7).
- [ ] **AC3** — a drag reorder persists across leaving the screen and across a relaunch, ✨ Otros
      stays last, and the categorization picker shows the same order (Step 8).
- [ ] **AC4** — all four manifest states were compared side by side with
      `design/mockups/mobile/index.html`, and every difference found is either fixed or recorded
      with a reason (Step 9).
- [ ] Brief scope — create (Step 4) and edit of name + emoji (Step 5) both work, and neither offers
      a direction control.
- [ ] Row captions reflect real month counts and are absent when the count is zero (Step 3).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| 16 seeded categories | Every run | Automatic on first launch — item #3's seed, generated from `design/tokens.json` |
| Movements in the current month, spread across at least three expense categories, including one excluded movement | Steps 3, 6, 8 | Item #12's `__DEV__` sample-data panel (`finanzas://sample-data`) loading `apps/mobile/src/db/__fixtures__/store-v1.sql`, or a real Banco de Chile connection plus one sync |
| `Mascotas` | Step 4 | Created by hand during the run |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every row shows a subtitle, including ones with no movements | The zero case is rendering instead of being omitted | Plan Assumption A4 — the subtitle is conditional on `monthCount > 0` |
| The delete modal's number differs from the row's subtitle | Correct by design: the row is **this month**, the modal is **all time** (plan Decision 6, Assumption A5). Only a defect if the modal shows the month count |
| The drag does not start, or the list scrolls instead | The `ScrollView` stole the responder | The parent list must set `scrollEnabled={false}` for the duration of the drag (plan Decision 10) |
| The order snaps back after a moment | The focus re-read overwrote the optimistic order with a stale read | The `reloadToken` stamp in the hook is what prevents it (plan concurrency table, row 1) |
| The order is right in settings but wrong in the categorization picker | Something sorted categories outside `listCategories` | There is exactly one ordering source; find and remove the second one |
| A new category lands **below** ✨ Otros | The fallback was not pushed down on insert | `createUserCategory` takes ✨ Otros' `sort_order` and increments the fallback's (plan Decision 5) |
| Saving a rename throws a unique-constraint error | Something re-derived the slug on rename | Renames never touch `slug` (plan Decision 4) |
| Native module missing at runtime | Running in Expo Go | Use a dev build |

---

## Known Limitations

- The list does not auto-scroll while dragging past its top or bottom edge; with the seeded
  taxonomy every row is reachable without it (plan follow-up 1).
- The icon grid offers the seeded glyph set for the direction, not an arbitrary emoji keyboard
  (plan Assumption A7, follow-up 4).
- The delete-modal sentence renders **✨ Otros** unbolded, unlike the mockup's `<b>`
  (plan Assumption A9, follow-up 5).
- Steps 8's picker cross-check and the sample-data panel depend on items #13/#16 and #12; until they
  land, use a real connection and skip the picker half of Step 8, recording that it was skipped.
