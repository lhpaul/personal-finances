# Smoke Test Runbook: Categorization flow

**Feature**: Categorization flow (#13)
**Spec**: [`../../specs/developments/20260802131809_13-categorization-flow/1_13-categorization-flow_specs.md`](../../specs/developments/20260802131809_13-categorization-flow/1_13-categorization-flow_specs.md)
**Implementation plan**: [`../../specs/developments/20260802131809_13-categorization-flow/2_13-categorization-flow_implementation-plan.md`](../../specs/developments/20260802131809_13-categorization-flow/2_13-categorization-flow_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] A **dev build** on the iOS simulator (`pnpm dev:mobile`). Expo Go cannot run this app —
      `expo-sqlite` is a native module.
- [ ] `pnpm install` has run and `pnpm check:layout` passes.
- [ ] The simulator has launched the app at least once, so migrations and starter seeds have
      been applied.
- [ ] `sqlite3` is available on the machine (ships with macOS).
- [ ] The mockups are open in a browser: `open design/mockups/mobile/index.html`.
- [ ] There is **no sign-in**. The app has no account and no session; "fresh session" here means
      a fresh database, loaded in Step 0.

---

## Test Data

| Item | Value |
| --- | --- |
| Fixture | `apps/mobile/src/db/__fixtures__/stage-queue-v1.sql` |
| Pending movements after loading it | 4 |
| Expense card under test | `MercadoLibre Chile`, `$42.000`, `26 ene · 14:32`, bank text `MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO` |
| Income card under test | `Consultoría Digital SpA`, `$1.200.000`, `27 ene · 21:00`, bank text `TRANSFERENCIA ELECTRONICA PAGO CONSULTORIA DESARROLLO WEB` |
| Movement with no merchant | bank text `COMERCIO SIN IDENTIFICAR 4523`, `$8.990` |
| Stage intro route | `/categorize/intro` (`finanzas:///categorize/intro`) |
| Categorization route | `/categorize` |
| Completion route | `/categorize/complete` |

---

## Smoke Test Steps

### Step 0: Load the fixture

The app has no bank connection until #10 ships, so the queue is loaded directly into the device
store.

1. Stop the app on the simulator.
2. Resolve the container and apply the fixture:

   ```bash
   APP_ID=$(node -e "console.log(require('./apps/mobile/app.config.js')().ios.bundleIdentifier)")
   CONTAINER=$(xcrun simctl get_app_container booted "$APP_ID" data)
   sqlite3 "$CONTAINER/Documents/SQLite/finanzas.db" \
     < apps/mobile/src/db/__fixtures__/stage-queue-v1.sql
   ```

   If the database path differs on this Expo SDK, find it with
   `find "$CONTAINER" -name 'finanzas.db'` and use that path.
3. Relaunch the app.

**Expected result**: no error; the file applies cleanly and re-applying it a second time also
succeeds (the statements are `INSERT OR REPLACE`).

> **Faster alternative, when #12 has landed**: open `/(dev)/sample-data` and use its load action
> instead. This runbook does not depend on that route existing.

### Step 1: Stage intro

**Maps to**: AC1, AC2 (entry), UX Rules → *Stage intro*

1. Navigate to `/categorize/intro` (deep link `finanzas:///categorize/intro`, or the home CTA
   once #12 ships).
2. Read the screen top to bottom.

**Expected result**: the top bar reads `Etapa 1`; the heading reads `Tu primera etapa` with the
eyebrow `Categorización inteligente`; the three-step card (`Identificamos` / `Categorizamos` /
`Celebramos`) is present; the left tile reads **4** over `Transacciones por categorizar`; the
right tile shows a `~N` value over `Minutos estimados`; the three reasons are listed; the 💡
note about stopping whenever you want is present; the primary action reads
`🚀 ¡Empezar mi primera etapa!`.

### Step 2: Start a stage and read the first card

**Maps to**: AC2, AC3, AC5, AC34

1. Tap `🚀 ¡Empezar mi primera etapa!`.
2. Read the progress line and the card.

**Expected result**: the categorization screen opens; the step indicator draws **four** steps
with the first active and the line reads `Transacción 1 de 4`; the card shows a badge, a date and
time, an amount with no decimals and a `.` thousands separator, and the bank's description
verbatim under `Descripción del banco` in a monospaced block.

### Step 3: Expense state, suggestion and taxonomy

**Maps to**: AC5, AC7, AC8, AC9

1. Advance with `Omitir` until the `MercadoLibre Chile` / `$42.000` card is on screen.
2. Inspect the chip grid.
3. Tap `Elegir otra`.

**Expected result**: a `Gasto` badge and the question `¿En qué categoría lo pones?`; exactly one
chip carries the ✨ star and the `Sugerido` hint, and it is the **first** chip
(`📦 Compras`); the grid holds seven category chips plus `Elegir otra`; every chip is an expense
category and none is an income category; `Elegir otra` opens the full expense taxonomy including
`✨ Otros`.

### Step 4: Income state

**Maps to**: AC6, AC7

1. Return to the stage and reach the `Consultoría Digital SpA` / `$1.200.000` card.

**Expected result**: an `Ingreso` badge, the amount styled as money in, the question
`¿De qué tipo de ingreso se trata?`, and a grid of **income** categories only —
`💻 Freelance` first with the `Sugerido` hint, then `Sueldo` and `Ingresos extra`, then
`Elegir otra`.

### Step 5: A movement with no merchant

**Maps to**: Spec A8

1. Reach the `COMERCIO SIN IDENTIFICAR 4523` / `$8.990` card.

**Expected result**: the bank's description stands in place of a merchant name; there is **no**
`Toca para editar` affordance and **no** chip carries the `Sugerido` hint.

### Step 6: "Siguiente →" is inert until a category is selected; "Omitir" never is

**Maps to**: AC12, AC13

1. On any card, without selecting a chip, tap `Siguiente →`.
2. Open `¿No estás seguro?` and tap `Siguiente →` again.
3. Tap `Omitir`.

**Expected result**: `Siguiente →` does nothing in both attempts and reads as unavailable;
`Omitir` is enabled in every state and advances to the next movement; the skipped movement's
category, deferral mark and exclusion are unchanged — after the stage ends it is still counted
as pending.

### Step 7: Confirm a category

**Maps to**: AC10, AC11, AC3

1. On the `MercadoLibre Chile` card, tap a chip that is **not** the suggestion (for example
   `🍔 Comida`), then tap it again to change to `📦 Compras`.
2. Tap `Siguiente →`.
3. Return to `/categorize/intro`.

**Expected result**: selecting a chip only highlights it — nothing is recorded until
`Siguiente →`; after confirming, the stage advances and the progress line increments; the intro
now shows **3** pending. Verify the write directly:

```bash
sqlite3 "$CONTAINER/Documents/SQLite/finanzas.db" \
  "select transaction_category_id, category_source, review_flag, excluded_at, included_amount
   from transactions where id = 'stage-tx-expense';"
```

The row shows the chosen category, `user`, and three `NULL`s.

### Step 8: Deferral marks

**Maps to**: AC14, AC15

1. On the next card, open `¿No estás seguro?` and tap `Revisar más tarde`.
2. On the following card, open it again and tap `No recuerdo`.

**Expected result**: each choice acts immediately and advances the stage; neither assigns a
category; both movements are still pending afterwards. In SQL, `review_flag` is `review_later`
and `uncertain` respectively, with `transaction_category_id` still `NULL`.

### Step 9: Exclusion, and the re-sync guarantee

**Maps to**: AC17, AC18, AC19, AC20, AC21, AC22, AC24

1. On a card, open `¿No estás seguro?` → `Excluir del análisis`.
2. Read the sheet, then tap `Cancelar`.
3. Open it again, choose `Involucra a más personas`, leave the note empty, tap `Confirmar`.
4. Re-apply the fixture from Step 0 (this stands in for a re-sync of the same movements).

**Expected result**: the sheet shows `🚫 Excluir del análisis`, the question, the five reasons
with one pre-selected, and the optional note field; `Cancelar` records nothing and returns to
the previous state; `Confirmar` records the exclusion and advances. In SQL the row still exists,
with `excluded_at` set, `exclusion_reason = 'shared_expense'`, `exclusion_note` `NULL` and
`included_amount` `NULL`. After re-applying the fixture, the exclusion **and** the category from
Step 7 are still there — a re-sync never overwrites a person's decision.

### Step 10: Completion — `partial`

**Maps to**: AC28, AC29, AC31

1. Finish the batch.

**Expected result**: `¡Buen trabajo!` / `Categorizaste las transacciones recientes.`, a counter
in the shape `X / Y` over `transacciones organizadas` with a bar filled to that ratio, the two
summary tiles (`Gasto diario promedio` / `este mes`, and `vs mes pasado`), the closing line, and
two actions: `Seguir categorizando` and `Terminado por hoy`. Tapping `Seguir categorizando` goes
straight to a new batch on the categorization screen **without** replaying the intro.

### Step 11: Completion — `done`

**Maps to**: AC30, Use Case 9

1. Categorize or exclude every remaining pending movement.

**Expected result**: `¡Increíble trabajo!` / `Has organizado completamente tus transacciones.`, a
single total with a full bar, the same two tiles and closing line, and a single action
`Continuar a inicio`. Movements marked `Revisar más tarde` or `No recuerdo` still count as
pending, so this state is only reachable once they have been categorized or excluded too.

### Step 12: Leaving mid-stage

**Maps to**: AC16, Use Case 10

1. Start a fresh stage, confirm one category, select a chip on the next movement **without**
   confirming, then close the stage from the top bar.
2. Re-enter from `/categorize/intro`.

**Expected result**: the confirmed decision is kept; the unconfirmed selection is discarded and
that movement is still pending; no completion screen appeared and no warning was shown;
re-entering starts a fresh stage from the intro.

### Step 13: Merchant editor round trip

**Maps to**: AC25, AC26, AC27

1. On the `MercadoLibre Chile` card, select a category, then tap the merchant name.
2. Return with the back affordance.

**Expected result**: the merchant editor route opens for that merchant (until #14 ships it is
the route placeholder — confirm it is the `merchant-edit` placeholder for the right
`merchantId`); returning puts you back on the **same** movement with the **same** selection and
the same progress line. Nothing about an already-categorized movement changed.

### Step 14: `advanced` is absent

**Maps to**: AC23, AC24

1. Inspect every state of the categorization screen, including with `¿No estás seguro?` open and
   with the exclusion sheet open.

**Expected result**: there is no `Opciones avanzadas` row anywhere, no `Incluir parcialmente`
option, no amount field and no `50%` / `Monto` segment — not disabled, not hidden: absent. No
row in `transactions` has a non-null `included_amount`:

```bash
sqlite3 "$CONTAINER/Documents/SQLite/finanzas.db" \
  "select count(*) from transactions where included_amount is not null;"
```

Expect `0`.

### Step 15: No network, no analytics

**Maps to**: AC35

1. Put the simulator in airplane mode (or disconnect the host network) and walk Steps 2 through
   11 again.

**Expected result**: every screen and every write behaves identically. The flow makes no request
and emits no event.

### Step 16: Design fidelity — expected vs actual

**Maps to**: AC32, AC36

Reference assets: `design/mockups/mobile/index.html` — `#screen=stage-intro`;
`#screen=categorize` in `expense`, `income`, `not-sure`, `exclude-sheet`;
`#screen=categorize-complete` in `partial` and `done`. `#screen=categorize&state=advanced` is
`mvp: false` and must **not** be implemented.

1. Run the automated gate: `pnpm fidelity --issue 13`.
2. Record the seven-row result table (target, mismatch %, PASS/FAIL) and paste it into the PR.
3. Open the mockup beside the running build and compare each of the seven states by eye:
   heading, badge, amount styling, chip grid, sheet, buttons, counters.

**Expected result**: all seven targets are `wired` and PASS at their configured threshold, and
the side-by-side comparison shows no difference that matters to an acceptance criterion. A
failure is fixed in the screen or in the fixture — **never** by raising a threshold.

### Last Step: Validate & Shut Down

- Verify every assertion below.
- Stop the dev server and the simulator.

---

## Assertions Checklist

- [ ] AC1 — the intro's pending count equals the movements with no category that are not excluded
- [ ] AC2 — a stage opens on the first movement of a batch of at most ten, most recent first
- [ ] AC3 — the progress line starts at 1, increments once per movement and ends the stage
- [ ] AC4 — no movement is offered twice in one stage, including skipped and deferred ones
- [ ] AC5 — the expense state shows the badge, the amount out, the merchant, the bank text and the expense question
- [ ] AC6 — the income state shows the badge, the amount in and the income question and taxonomy
- [ ] AC7 — an expense is never offered an income category, and the reverse
- [ ] AC8 — exactly one chip carries `Sugerido` when the rule suggests, none when it does not
- [ ] AC9 — `Elegir otra` opens the full taxonomy for the direction, `✨ Otros` included
- [ ] AC10 — confirming records the category and `category_source = 'user'`, and the pending count drops
- [ ] AC11 — the category is visible without a re-sync
- [ ] AC12 — `Omitir` is always enabled; `Siguiente →` does nothing without a selection
- [ ] AC13 — skipping records nothing
- [ ] AC14 — `Revisar más tarde` marks, assigns no category, advances, stays pending
- [ ] AC15 — `No recuerdo` behaves the same with its own mark
- [ ] AC16 — leaving keeps confirmed decisions and discards the unconfirmed selection
- [ ] AC17 — the sheet shows five reasons, one pre-selected, and an optional note
- [ ] AC18 — cancelling records nothing
- [ ] AC19 — confirming records the reason, and confirming without a note succeeds
- [ ] AC20 — an excluded movement leaves every total and chart
- [ ] AC21 — an excluded movement still exists; no screen offers to delete anything
- [ ] AC22 — after any exclusion, `included_amount` is still unset
- [ ] AC23 — the advanced disclosure, the partial option, the amount field and the segment are absent
- [ ] AC24 — no path writes an included amount
- [ ] AC25 — the merchant name opens the editor for that merchant, carrying the selection
- [ ] AC26 — returning restores the same movement and progress
- [ ] AC27 — a merchant default does not change an already hand-categorized movement
- [ ] AC28 — `partial` shows its copy, the session counter and both actions
- [ ] AC29 — `Seguir categorizando` starts a new batch without the intro
- [ ] AC30 — `done` shows its copy, a full bar and one action
- [ ] AC31 — the two tiles reflect exclusions made during the stage
- [ ] AC32 — all seven MVP states render; `advanced` is not implemented
- [ ] AC33 — no user-facing string is a literal; every Spanish string matches the mockup
- [ ] AC34 — every amount is a whole peso through the shared formatter; dates are the local day
- [ ] AC35 — no network request, no analytics event
- [ ] AC36 — the mockup was opened and all seven states compared side by side

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Connection, product, two merchants, 4 pending and 9 categorized movements | The whole runbook | `sqlite3 <container>/Documents/SQLite/finanzas.db < apps/mobile/src/db/__fixtures__/stage-queue-v1.sql` (Step 0) |
| Starter categories, institutions and merchants | Applied automatically on first launch by `ensureDatabaseReady` | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| The intro shows 0 pending | The fixture was applied to the wrong container, or the app was not relaunched | Re-resolve `$CONTAINER`, re-apply, relaunch |
| `Unable to resolve "@expo/metro-runtime"` | The `node_modules` tree is not hoisted | `pnpm check:layout`, then plain `pnpm install` |
| Native module missing at runtime | Running Expo Go instead of a dev build | Build and install the dev client |
| A chip grid shows the wrong number of tiles | The fixture's usage history did not apply | Re-apply the fixture and confirm the 9 categorized rows exist |
| `pnpm fidelity` cannot find the simulator | The `Finanzas Fidelity` device does not exist | Follow the `simctl create` command printed by the capture script (#47) |
| A fidelity target fails just over its threshold | A real visual difference, or a fixture digit that differs from the mockup | Fix the screen or the fixture. Do not raise the threshold |

---

## Known Limitations

- **AC31 cannot be cross-checked against `home` yet.** `home` (#12) is not implemented, so the
  runbook verifies the tiles read the shared inclusion rule and change when an exclusion is
  made, but the literal "same figure on both screens" comparison moves to #12's runbook.
- **AC27 is verified against a placeholder.** The merchant editor (#14) does not exist yet, so
  Step 13 confirms the round trip and the unchanged category, not the editor's own behavior.
- **No bank sync.** Step 9's "re-sync" is a re-application of the same fixture, which exercises
  the same person-owned-column guarantee the real upsert carries, without a live bank.
- **The mockup's sample digits differ from the fixture's.** `~5` minutes, `7 / 20` and `57` are
  illustrative in the mockup; the fixture produces its own numbers. Compare the tile, the label
  and the shape of the number, not the digit.
