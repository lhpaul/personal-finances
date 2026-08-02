# Smoke Test Runbook: Transactions list

**Feature**: Transactions list — month-grouped virtualized list, search, filter sheet, empty
state and manual entry
**Work item**: [#15 Transactions list](https://github.com/lhpaul/personal-finances/issues/15) —
a **Refactor**-type item, so there is no spec; the issue body is the requirement source
**Implementation plan**: [`2_15-transactions-list_implementation-plan.md`](../../specs/developments/20260802142116_15-transactions-list/2_15-transactions-list_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] A **dev build** on a device or simulator. Expo Go cannot run this screen —
      `expo-sqlite`, `expo-crypto` and `@shopify/flash-list` are native modules.
- [ ] `pnpm install` and `pnpm check:layout` both green.
- [ ] `pnpm dev:mobile` running, with the dev build connected.
- [ ] The mockup open side by side: `open design/mockups/mobile/index.html`, then
      `#screen=transactions`.
- [ ] There is **no sign-in** in this product (Business Rule 0) — there is nothing to log into
      and nothing to log out of. Ignore any "fresh session / logged out" convention.

---

## Test Data

| Item | Value |
| --- | --- |
| Screen | `#screen=transactions`, states `list`, `search`, `filters`, `empty` |
| Route | `/(tabs)/transactions` |
| Deep link | `finanzas:///(tabs)/transactions` |
| Base dataset | `apps/mobile/src/db/__fixtures__/store-v1.sql` — 1 connection, 2 products, 13 debit movements in `2026-01`, 5 of them excluded, 1 manual, 1 partially included |
| Volume dataset | 240 deterministic movements across four months, both directions, both products — loaded by the dev panel action *Generar movimientos de demo* |
| Search terms drawn in the mockup | `uber` (2 results), `zzz` (no results) |
| Dev data panel | `finanzas:///(dev)/sample-data` (`__DEV__` only) |

Load both datasets before Step 1: open the dev panel, run *Cargar datos de ejemplo*, then
*Generar movimientos de demo*. Running either action twice must not duplicate rows — that is
part of Step 10.

---

## Smoke Test Steps

### Step 1: Reach the screen

**Maps to**: brief scope, `BEHAVIOR.md` → `transactions` (route `/(tabs)/transactions`).

1. From `home`, tap the **Transacciones** tab.
2. Then relaunch the app and reach the same screen with the deep link
   `finanzas:///(tabs)/transactions`.

**Expected result**: both paths land on the transactions screen. The header shows the 💳 avatar,
the title *Transacciones*, the subtitle *Historial completo de movimientos* and a ⚙ action on the
right. Below it, the search field reads *🔍 Buscar por comercio, categoría, nota…*.

### Step 2: The `list` state and month grouping

**Maps to**: brief AC1, Decision 3, Decision 8 · `#screen=transactions&state=list`.

1. Read the first group header.
2. Scroll to the second group header.
3. Count the rows visible in the first group and compare against the number in the header.

**Expected result**: group headers read `📅 <Mes> de <año> (<n>)` — the month name capitalized,
the count in parentheses. Rows appear newest first. The count in a header is the number of
matching movements in that whole month, **not** the number currently rendered — with the volume
dataset loaded, the first header's count is larger than the rows on screen until you scroll.

### Step 3: Virtualization and pagination

**Maps to**: brief AC1 ("no full-table `.map()` into a ScrollView"), Decision 4.

1. Scroll to the bottom of the list, continuously, through all four months.
2. Watch for a stall, a blank band, or a jump.
3. Scroll back to the top.

**Expected result**: scrolling is smooth; more rows load as you approach the end without a
visible spinner-then-reset; **no row appears twice and no row is skipped** as pages join. The
month headers stay correct as later pages arrive. Returning to the top shows the same first rows
as before.

### Step 4: Search

**Maps to**: brief AC3, Decision 5 · `#screen=transactions&state=search`.

1. Type `uber` into the search field.
2. Read the summary line and the rows.
3. Clear the field and type a word that appears only in a **note** (with the base fixture:
   `semanal`).
4. Clear it and type a **category** name (`Comida`).
5. Clear it and type a fragment of a **raw bank description** that is not a merchant name
   (`GIRO`).
6. Clear it and type `UBER` in capitals.

**Expected result**: the month headers are replaced by one summary line reading
`<n> resultados para «<término>»`. Each search returns only matching movements: by merchant name,
by note, by category name, by raw description. `UBER` and `uber` return the same rows.
Typing feels immediate — the list settles about a quarter-second after you stop typing, not on
every keystroke.

### Step 5: Excluded movements stay visible and attenuated

**Maps to**: brief AC2, `BEHAVIOR.md` → *"los excluidos se muestran atenuados… no desaparecen de
la lista"*, Business Rules 3 and 4, plan Decision 6.

1. With no search term and no filters, find an excluded movement (base fixture: *GIRO CAJERO
   AUTOMATICO*, *COMISION MANTENCION*, *NETFLIX.COM*, *TRANSFERENCIA A CUENTA PROPIA*,
   *RESTAURANT LA MESA*).
2. Read its meta line.
3. Open the filter sheet (⚙), switch **Mostrar excluidas** off, and tap *Aplicar*.
4. Re-open the sheet, switch it back on, tap *Aplicar*.

**Expected result**: excluded movements are **visible by default**, rendered dimmed, with a meta
line reading `<día> · Excluida: <motivo>`. Switching *Mostrar excluidas* off removes exactly
those rows and nothing else — every other row keeps its position — and the month header counts
drop by exactly the number of excluded movements removed. Switching it back on restores them.

> This step is where the brief and the contracts disagreed: brief AC2 says excluded movements are
> *hidden* by default. The mockup draws one in the default `list` state, the switch is drawn
> `is-on`, and `BEHAVIOR.md` says they never disappear. The implementation follows the mockup and
> `BEHAVIOR.md`. If LH decides otherwise, this step's expectation inverts and one constant
> changes.

### Step 6: The filter sheet, combination and the header badge

**Maps to**: brief AC4, Decision 7 · `#screen=transactions&state=filters`.

1. Tap the ⚙ header action.
2. Compare the sheet against the mockup: **Tipo** (Todos / Gastos / Ingresos), **Estado** (Todas /
   Sin categorizar / Categorizadas), **Producto** (Todos + one pill per product), the **Mostrar
   excluidas** row with its sub-label *Movimientos fuera del análisis*, and *Limpiar* / *Aplicar*.
3. Select **Tipo → Ingresos**, tap *Aplicar*.
4. Re-open, add **Estado → Sin categorizar**, tap *Aplicar*.
5. Re-open, add **Producto → Tarjeta de Crédito**, tap *Aplicar*.
6. Type a search term on top of the three filters.
7. Re-open the sheet, tap *Limpiar*, then *Aplicar*.
8. Re-open the sheet, change something, then dismiss with ✕ instead of *Aplicar*.

**Expected result**: each filter narrows the list further and the header counts follow. The three
filters plus the search term combine (all must match, not any). While any filter differs from the
default, the ⚙ action shows its dot; after *Limpiar* + *Aplicar* the dot disappears. Dismissing
with ✕ discards the change — the list is exactly as it was before the sheet opened.

### Step 7: The `empty` state

**Maps to**: brief AC4, Decision 10 · `#screen=transactions&state=empty`.

1. Type `zzz` into the search field.
2. Clear the search, then set a filter combination that matches nothing (for example
   **Tipo → Ingresos** with a product that has no income).

**Expected result**: both produce the drawn empty block — 🔎, *Sin resultados*, and *No
encontramos movimientos con ese término. Prueba con otro comercio o ajusta los filtros.* No
month headers, no rows, no error.

### Step 8: Manual transaction entry

**Maps to**: brief scope ("Manual transaction entry"), plan Decision 12.

1. With no search term and no filters, scroll to the bottom and tap
   *+ Agregar transacción manual*.
2. Submit with an empty description; then with a non-numeric amount; then with `0`.
3. Fill in an amount, a description, **Tipo → Gasto** and a product, and save.
4. Find the new movement in the list.
5. Add a second movement with **exactly the same** amount, description, type and product.

**Expected result**: invalid submissions are rejected inline with a message and nothing is
written. A valid save closes the sheet and the new movement appears at the top of today's month
group, uncategorized (so it will show `⚠️ Necesita categorización`). The second, identical entry
**also** persists as its own row — a manual entry is never deduplicated away (Business Rule 5's
hash folds in the row id).

> The sheet's Spanish copy is **proposed**, not contract: the mockup draws the button but not the
> form. Record any copy objection as feedback for the `design/mockups/` + `BEHAVIOR.md`
> follow-up, not as a defect of this item.

### Step 9: Navigation seam to the detail screen

**Maps to**: plan Decision 13 · `BEHAVIOR.md` → *"Acciones: fila → `transaction-detail`"*.

1. Tap any movement row.
2. Go back.
3. Tap an excluded row.

**Expected result**: each tap opens `/transactions/[transactionId]` for that movement — today the
placeholder for item #16. The back gesture returns to the list with the scroll position, the
search term and the filters intact.

### Step 10: Idempotence of the demo data

**Maps to**: Business Rule 5, plan Decision 14.

1. Note the first month header's count.
2. Open the dev panel and run *Generar movimientos de demo* a second time.
3. Return to the transactions screen.

**Expected result**: the count is identical. Re-running the generator refreshes rows through the
same idempotent upsert the sync engine uses; it never duplicates a movement.

### Step 11: Accessibility and density

**Maps to**: `expo-react-native.md` → *Accessibility*.

1. Enable the OS's largest non-accessibility text size.
2. Re-open the screen, the filter sheet and the manual-entry sheet.
3. Turn on the screen reader and swipe through a movement row, the search field and the ⚙ action.

**Expected result**: no clipped merchant name, no truncated amount, no overlapping meta line.
Every tappable element — the header action, the search field, each pill, the switch row, each
movement row, both sheet buttons — remains at least 44 pt on its vertical axis. The search field
is announced by its label, not by its emoji. Amount tone is never the only signal: income keeps
its `+`, and an excluded row's state is carried by its meta text as well as by its opacity.

### Step 12: The tab bar

**Maps to**: `AGENTS.md` non-negotiable ("the tab bar is drawn with four tabs; the MVP renders
only Inicio and Transacciones").

**Expected result**: exactly **two** tabs — *Inicio* and *Transacciones* — with *Transacciones*
active. No *Presupuestos*, no *Beneficios*, not even disabled, even though the mockup draws four.
This is an accepted, permanent difference from the drawing, not a defect.

### Step 13: Design fidelity — expected vs actual

**Maps to**: brief AC5 (*"Open `design/mockups/mobile/index.html` and compare side by side before
marking done"*), `AGENTS.md` non-negotiable 6,
`docs/best-practices/stack/mobile-ui-fidelity.md`.

Reference asset: `design/mockups/mobile/index.html` — the repository's UI contract. No other
design asset exists for this item: issue #15 has no `## Design assets` section, there is no
tracker attachment, and the development folder has no `assets/` directory.

For **each** of the four states, open the mockup at the matching hash and compare side by side:

| State | Mockup hash | What to compare |
| --- | --- | --- |
| `list` | `#screen=transactions&state=list` | Header block, search field, month header format, row layout (icon / name / meta / amount), the dimmed excluded row, the outline *+ Agregar transacción manual* button |
| `search` | `#screen=transactions&state=search` | Focused search field showing the term, the `N resultados para «uber»` summary replacing the month headers, the result rows |
| `filters` | `#screen=transactions&state=filters` | The sheet over a populated list: grab handle, *Filtros* title, ✕, the three pill rows with their active pill, the switch row with its sub-label, *Limpiar* / *Aplicar* |
| `empty` | `#screen=transactions&state=empty` | Focused search field, the 🔎 icon, *Sin resultados*, the description paragraph |

Record PASS/FAIL per state with expected-vs-actual detail on failure, plus a screenshot of each.

**Expected result**: each state matches its drawing in structure, spacing, colour and copy.
Two differences are **expected and accepted**, and must be named rather than filed as defects:
the two-tab tab bar (Step 12), and the manual-entry sheet, which the mockup does not draw at all
and which therefore has no reference to compare against.

If item #47 has merged, also run `pnpm fidelity:contract` and paste its summary line; the four
`transactions` targets must report `wired`.

### Last Step: Validate and shut down

- Verify every assertion below.
- Stop the dev server.

---

## Assertions Checklist

Each checkbox maps to a brief acceptance criterion or an in-scope brief objective.

- [ ] **AC1** — The list is virtualized: it pages in as you scroll, with no duplicated or skipped
      row (Steps 2, 3).
- [ ] **AC2** — Excluded movements are rendered dimmed and are governed by the *Mostrar excluidas*
      toggle; with the toggle on (the default) they are visible (Step 5).
- [ ] **AC3** — Search matches merchant, category, note and raw description, case-insensitively
      (Step 4).
- [ ] **AC4** — Filters combine correctly, month counts follow, and the header ⚙ shows its dot
      while any filter differs from the default (Step 6).
- [ ] **AC5** — All four states compared side by side against
      `design/mockups/mobile/index.html` (Step 13).
- [ ] **Scope: manual entry** — A manual movement can be added, is validated, and two identical
      entries both persist (Step 8).
- [ ] **Empty state** — Both "no search results" and "no filter results" render the drawn empty
      block (Step 7).
- [ ] **Seam** — A row opens `/transactions/[transactionId]` and back restores the list state
      (Step 9).
- [ ] **Idempotence** — Re-running the demo generator does not duplicate movements (Step 10).
- [ ] **Accessibility** — 44 pt targets, no clipping at the largest text size, no colour-only
      signal (Step 11).

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Connection, 2 products, 13 movements incl. 5 excluded and 1 manual | Excluded/attenuated rows, manual flag, partial inclusion | Dev panel → *Cargar datos de ejemplo* (executes the committed `apps/mobile/src/db/__fixtures__/store-v1.sql`) |
| 240 movements across 4 months, both directions | Month grouping, the *Ingresos* filter, pagination | Dev panel → *Generar movimientos de demo* |
| Empty store | The `empty` state without a search term | Dev panel → *Vaciar datos de ejemplo*, or a fresh install |

The dev panel is `__DEV__`-only and never reachable in a release build.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The screen is blank on launch | The database handle has not resolved, or bootstrap threw | Check the Metro logs for `DatabaseBootstrapError`. A migration failure is unrecoverable by design — reinstall the dev build |
| `Unable to resolve "@shopify/flash-list"` | The dependency was installed but the dev build was not rebuilt | It is a native module: rebuild the dev client, do not reload |
| Rows repeat or vanish while scrolling | The keyset cursor lost its tiebreaker | Confirm the order is `date_local desc, id desc` and that the cursor carries both fields |
| A header count disagrees with the rows under it | A predicate was applied to one query and not the other | Both reads must go through `buildTransactionListPredicates`; a hand-written `WHERE` in either one is the bug |
| Excluded movements disappear with the toggle on | An exclusion predicate leaked into the default path | Only the `showExcluded === false` branch may add `isIncluded` |
| Search misses an accented merchant name | Known limitation: SQLite `LIKE` folds ASCII case, not diacritics | Expected. Category-name search is accent-insensitive; the text columns are a named follow-up (FTS5 or a normalized shadow column) |
| Amounts show decimals or look 100× off | A float entered the money pipeline upstream | `formatClp` throws on a non-integer by design — that throw is the signal, not a formatter bug |
| A movement lands in the wrong month group | The month was derived from the UTC timestamp | The group key must be `substr(date_local, 1, 7)`, never derived from `occurred_at` |

---

## Known Limitations

- The runbook needs the dev sample-data panel (item #12) because item #10's real sync requires
  live bank credentials, which no automated or repeatable smoke test can use.
- The manual-entry sheet has no mockup reference, so Step 13 cannot compare it. Its date is fixed
  to today and it asks for no category — both deliberate, both recorded in the plan.
- Foreign-currency rows render with `formatClp` like any other, because item #10 explicitly
  defers what the person sees for a non-CLP movement. The bundled datasets are CLP only, so this
  is not exercised here.
- Step 3's "no row is skipped or repeated" is a visual check on a device; the mechanical
  guarantee is the paging test in `apps/mobile/src/db/__tests__/transactions.test.ts`.
