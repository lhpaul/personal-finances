# Categorization flow — Spec

**Depends on**: 2-theme-design-system-primitives, 5-shared-domain-rules-matching-aggregates,
10-sync-engine

---

## Overview

This is the core loop of the product. Once a person's bank movements are on the device, the app
invites them into a short guided session — a *desafío* or *etapa* — that walks a small batch of
uncategorized movements one at a time, asks a single question per movement ("¿en qué categoría lo
pones?"), and celebrates the result. The session is designed to be finished in a couple of
minutes, a few days a week, and to be abandoned at any moment without losing anything or
punishing the person.

The flow is three screens: an intro that shows how much is pending and what the session will be
about, the categorization screen itself, and a completion screen that closes the session either
with movements still pending or with the queue at zero. Along the way the person can assign a
category, defer a movement ("revisar más tarde", "no recuerdo"), skip it outright, or take it out
of their analysis entirely by excluding it with a reason.

Two product commitments shape every decision here. First, **categorization is never mandatory**
(Business Rule 6 of the domain): every screen offers a way forward that records nothing, and no
control ever blocks progress. Second, **bank data is never deleted** (Business Rule 3): excluding
a movement is a reversible state on a record that stays, not a removal.

This item delivers the screens and the decisions they record. It does not deliver the suggestion
engine (`shared-domain`, #5), the storage (#3, #10), the merchant editor (#14), the home CTA that
leads here (#12), or the reminders that nudge the person back (#18).

---

## Normative references

These documents are ground truth and are not restated here. Where this spec and one of them
appear to disagree, the disagreement is recorded under
[Documented Conflicts](#documented-conflicts) rather than silently reconciled.

- [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md) — the entities and
  Business Rules 3, 4, 6, 7 and 8, and the *Desafío / Etapa* glossary entry. Authoritative for the
  rules this flow must not break.
- [`design/mockups/mobile/BEHAVIOR.md`](../../../../design/mockups/mobile/BEHAVIOR.md), sections
  `stage-intro`, `categorize` and `categorize-complete` — when each state applies, what each
  action does, and what data each screen lives on. Claims marked 🟡 in that document are proposals
  awaiting validation; this spec builds on them and lists every one it uses under
  [Assumptions](#assumptions).
- [`design/mockups/mobile/index.html`](../../../../design/mockups/mobile/index.html) and
  [`mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js) — the visual
  contract: `#screen=stage-intro`, `#screen=categorize` (`expense`, `income`, `not-sure`,
  `exclude-sheet`) and `#screen=categorize-complete` (`partial`, `done`). Authoritative for
  layout, states and Spanish copy.
- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) — authoritative for
  the enumerated value sets this flow records (categorization provenance, deferral flag, exclusion
  reason) and for the single analysis rule every total reads through.
- [`docs/project/3-software-architecture.md`](../../../project/3-software-architecture.md),
  decisions 3 and 4 — domain rules are pure and live in `shared-domain`; the mockups are the UI
  contract and every state in a screen's manifest entry is a real render branch.

**Sample data**: the numbers drawn in the mockups (4 pending movements, "~5" minutes, "7 / 20",
"57", "$46.700", "−12%") are sample values illustrating the layout. The contract is the tile, the
label and the shape of the number — not the digit.

---

## Assumptions

Nothing in this item had a human alignment conversation available, so every gap was resolved from
the documents named above in that order of authority. Each resolution below is a **product
decision made by default**, reversible, and listed so a reviewer can overturn it cheaply.

### A1 — Batch size: **10 movements per stage** (the most important assumption in this spec)

`BEHAVIOR.md → stage-intro` says a stage is "un lote acotado … sesión corta de N movimientos, no
la cola completa" and marks the size of N as 🟡 pending: *"tamaño del lote N por sesión — el
mockup no lo fija."* This spec sets **N = 10**.

Reasoning: the domain overview commits to "sesiones de 1–3 minutos"; a movement whose category is
one tap takes on the order of ten seconds, which puts a 1–3 minute session in the range of six to
eighteen movements. The completion screen's `partial` state only exists because a stage is
smaller than the queue, and its sample (a stage inside a 20-deep queue) is consistent with a batch
on the order of ten. Ten is also a round number a person can hold in their head when the progress
reads "Transacción 3 de 10".

**Consequences if a reviewer changes it**: none beyond the number itself — the batch size is a
single value the flow reads; the progress indicator, the estimated-time tile and the completion
counters are all derived from it. **Human confirmation requested: yes.**

### Assumption register

| # | Assumption | Source | Confirmation requested |
| --- | --- | --- | --- |
| A1 | A stage offers **10** movements. | 🟡 `BEHAVIOR.md → stage-intro` ("tamaño del lote N"); domain "1–3 minutos" | Yes |
| A2 | The intro's CTA starts a stage with that bounded batch; the back affordance returns to wherever the person came from and records nothing. | 🟡 `BEHAVIOR.md → stage-intro` | No |
| A3 | The queue is ordered **most recent movement first**, with a deterministic tie-break, so two people with the same data see the same order and a re-entered stage is reproducible. | Mockup copy "categorizar tus transacciones recientes" / "Categorizaste las transacciones recientes" | No |
| A4 | A movement deferred during a stage (skipped, "revisar más tarde", "no recuerdo") is not offered again **within that stage**; it stays pending and is eligible in later stages. | Derived from A1/A3 — a stage that re-offers what was just skipped would block the person in a loop, contradicting Business Rule 6 | No |
| A5 | The intro's "Minutos estimados" tile is derived from the batch size using one fixed per-movement estimate, rounded to a whole minute and shown with the drawn "~" prefix. | Mockup tile; the drawn "~5" is sample data | Yes |
| A6 | Completion counters: `partial` shows *movements resolved during this stage* over *movements pending when the stage started*, and the bar is that ratio; `done` shows the *total number of categorized movements on the device* with a full bar and no denominator. "Resolved" = the movement left the pending queue, by being categorized or excluded. | Mockup (`7 / 20` at 35 % fill; `57` at 100 %) | Yes |
| A7 | The picker shows the suggested category first when there is one, then the categories this person uses most in that direction, up to seven chips, always followed by "Elegir otra" which opens the full taxonomy for that direction. | Mockup grids (8 tiles for gasto, 4 for ingreso) against a seeded taxonomy of 10 expense and 6 income categories | Yes |
| A8 | When no merchant resolves for a movement, the card shows the bank's description in place of the merchant name, offers no merchant-edit affordance, and shows no suggestion chip. | 🟡 `BEHAVIOR.md → categorize` (the suggestion comes from the merchant's default) | No |
| A9 | The "remember as the merchant's default" hook is the affordance the mockup actually draws — the merchant name is tappable and opens the merchant editor (#14) — carrying the category the person just selected as the pre-selected default. | 🟡 `BEHAVIOR.md → categorize` ("ofrece recordar como default del comercio") vs. the mockup, which draws no inline offer. See [Conflict 2](#conflict-2--where-remember-as-the-merchants-default-lives) | Yes |
| A10 | Choosing a category chip **selects** it; "Siguiente →" confirms the selection and moves on. See [Conflict 1](#conflict-1--one-tap-or-two). | Mockup draws both the grid and a primary "Siguiente →" | Yes |
| A11 | The exclusion note is optional for **every** reason, not only "Otro". | Mockup draws the note field in every reason state, labelled "(opcional)". See [Conflict 3](#conflict-3--when-the-exclusion-note-applies) | No |
| A12 | The MVP does not count or number stages: `stage-intro` renders the drawn copy on every entry, including "Etapa 1" and "Tu primera etapa". | The mockup draws exactly one `stage-intro` and no per-stage variants; inventing copy would violate the UI contract | Yes — see [Deferral Note 2](#deferral-note-2--stage-numbering-and-repeat-visit-copy) |
| A13 | Entering the flow with an empty queue (for example from a reminder fired before a sync removed the last pending movement) sends the person to home instead of an empty `stage-intro`; the mockup draws no empty state for the intro. | Mockup state list for `stage-intro` (no empty state) | No |
| A14 | A stage that runs out of movements mid-way — because the batch was smaller than the requested size — ends normally on the completion screen; a short batch is not an error. | Derived: the queue can hold fewer than N movements | No |

---

## Use Cases

### Use Case 1: A person opens a stage

**Actor**: The person using the app (the only actor in this product — there is no second role and
no server-side operator).
**Preconditions**: At least one movement is pending — it has no category and is not excluded.

**Steps**:

1. The person arrives at the stage intro from the pending call to action on home (#12), from the
   end of onboarding (#8), or from a local reminder (#18).
2. They read what the session is about and how much is pending.
3. They tap the start action.

**Postconditions**: A stage is under way with a bounded batch of pending movements (A1), and the
first movement of that batch is on screen. Nothing has been written.

**Information shown**:

- The stage heading and the explanation of what the session does.
- The number of movements pending categorization.
- An estimate of how long the session takes (A5).
- Why categorizing matters, and a reassurance that the person can stop at any time.

**Actions available**:

- Start the stage.
- Go back to wherever they came from.

**Considerations**:

- Leaving from here costs nothing and is not recorded as a failure or a missed session.
- If the queue emptied between the reminder and the tap, the person lands on home instead (A13).

---

### Use Case 2: The person categorizes an expense

**Actor**: The person using the app.
**Preconditions**: A stage is under way and the current movement is money going out.

**Steps**:

1. The person reads the movement: its direction, its amount, who it was with, and exactly what the
   bank wrote.
2. They pick a category from the offered chips — the suggested one is first and marked as a
   suggestion — or open the full list of expense categories.
3. They confirm and move to the next movement (A10).

**Postconditions**: The movement carries that category and the app records that **the person**
chose it, not an automatic suggestion. The movement leaves the pending queue. The next movement of
the batch is on screen, or the stage ends if that was the last one.

**Information shown**:

- A "Gasto" badge, the movement's date and time, and the amount styled as money going out.
- The resolved merchant name with an edit affordance, or the bank's description when no merchant
  resolved (A8).
- The bank's own description, verbatim, in a block that is clearly the bank's words.
- The progress of the stage: how many movements it holds and which one this is.
- Expense categories for this direction, with at most one marked "Sugerido".

**Actions available**:

- Pick a category and confirm.
- Open the full expense taxonomy ("Elegir otra").
- Open the merchant editor (#14) from the merchant name.
- Open "¿No estás seguro?" (Use Case 4).
- Skip.
- Leave the stage.

**Considerations**:

- The category offered is always the taxonomy of the movement's own direction; an expense is never
  offered income categories.
- A suggestion is shown only when the shared suggestion rule produces one; it is never presented
  as already applied.
- If the decision cannot be recorded, the flow does not advance and the person is told; nothing is
  silently dropped.

---

### Use Case 3: The person categorizes an income

**Actor**: The person using the app.
**Preconditions**: A stage is under way and the current movement is money coming in.

**Steps**: As Use Case 2, with the income question ("¿De qué tipo de ingreso se trata?") and the
income taxonomy.

**Postconditions**: As Use Case 2.

**Information shown**: As Use Case 2, with an "Ingreso" badge and the amount styled as money
coming in.

**Actions available**: As Use Case 2, over income categories.

**Considerations**:

- The two directions differ only in badge, amount styling, question and taxonomy. Everything else
  — progress, merchant, bank description, deferral, exclusion, skip — is identical.

---

### Use Case 4: The person is not sure what a movement was

**Actor**: The person using the app.
**Preconditions**: A stage is under way and a movement is on screen.

**Steps**:

1. The person opens "¿No estás seguro?".
2. They choose one of three ways out: look at it later, say they do not remember, or take it out
   of the analysis.
3. For the first two, the movement is marked accordingly and the stage moves on. The third opens
   the exclusion sheet (Use Case 5).

**Postconditions**: The movement carries the chosen mark, still has no category, and remains
pending for a later stage. The stage has advanced.

**Information shown**:

- "Revisar más tarde — Lo veré después".
- "No recuerdo — No estoy seguro de qué fue".
- "Excluir del análisis — No es un gasto propio".

**Actions available**: The three options above, plus everything still available on the movement.

**Considerations**:

- Neither mark assigns a category, so the movement still counts as pending on home.
- Neither mark is a dead end: the movement comes back in a later stage (A4), and can also be
  handled from the transactions list (#15) and detail screen (#16).
- Choosing the same mark twice across stages is harmless — the later choice replaces the earlier.

---

### Use Case 5: The person excludes a movement from the analysis

**Actor**: The person using the app.
**Preconditions**: A stage is under way and a movement is on screen.

**Steps**:

1. The person chooses "Excluir del análisis" from "¿No estás seguro?".
2. A sheet asks why, offering a fixed list of reasons with one pre-selected.
3. They may add a short explanation.
4. They confirm, or cancel and return to the movement unchanged.

**Postconditions**: On confirm, the movement is marked excluded with the chosen reason and the
optional note, it stops counting toward every total and chart, it leaves the pending queue, and
the stage moves on. **The movement itself is not deleted and is not hidden from the transactions
list** — it stays visible there, attenuated, and can be brought back from the transaction detail
screen (#16). On cancel, nothing is recorded.

**Information shown**:

- The sheet heading "🚫 Excluir del análisis" and the question "¿Por qué quieres excluir esta
  transacción?".
- The five reasons (see [Statuses / Enum Values](#statuses--enum-values)).
- An optional free-text field ("Explica brevemente (opcional)").

**Actions available**: Pick a reason, write a note, confirm, cancel.

**Considerations**:

- An exclusion always carries a reason; the note is never required (A11).
- Excluding is not deleting, and the flow contains no delete action of any kind.
- The MVP has exactly two outcomes for a movement's participation in the analysis: it counts in
  full, or it does not count at all. No partial amount is ever offered or recorded.

---

### Use Case 6: The person skips a movement

**Actor**: The person using the app.
**Preconditions**: A stage is under way and a movement is on screen.

**Steps**:

1. The person taps "Omitir".

**Postconditions**: Nothing is recorded about the movement. It stays pending exactly as it was.
The stage moves to the next movement, or ends if that was the last.

**Information shown**: Unchanged.

**Actions available**: Skip is available on every movement, in every state of the screen,
regardless of what is or is not selected.

**Considerations**:

- Skip differs from "revisar más tarde" only in that it records nothing at all.
- Skip is never disabled, never hidden behind a disclosure, and never asks for confirmation.

---

### Use Case 7: The person wants this category remembered for the merchant

**Actor**: The person using the app.
**Preconditions**: A stage is under way, the current movement has a resolved merchant, and the
person has selected a category for it.

**Steps**:

1. The person taps the merchant name on the movement card.
2. The merchant editor opens (#14), with the selected category offered as that merchant's default.
3. They save or leave; either way they come back to the stage on the same movement.

**Postconditions**: Whatever the merchant editor persists is that item's responsibility. Returning
to the stage does not lose the selection made on the current movement, and does not skip it.

**Information shown**: "Toca para editar" beneath the merchant name, so the affordance is
discoverable.

**Actions available**: Open the editor; return to the stage.

**Considerations**:

- A merchant default applies to **future** movements. It never rewrites a category a person
  already chose by hand.
- This spec owns only the hook and the round trip. The editor, its alias grouping and its
  suggestions belong to #14.

---

### Use Case 8: The stage ends with movements still pending

**Actor**: The person using the app.
**Preconditions**: The last movement of the batch has been handled and pending movements remain.

**Steps**:

1. The person sees the celebration and their progress.
2. They choose to run another stage or to stop for today.

**Postconditions**: Another stage starts with a fresh batch, or the person returns to home. Every
decision made during the stage was already recorded as it was made.

**Information shown**:

- "¡Buen trabajo!" and "Categorizaste las transacciones recientes."
- The counter and progress bar for the session (A6).
- Two summary tiles: average daily spending this month, and the change against last month — both
  read through the same shared analysis rule every other total in the app uses, so they cannot
  disagree with home or the dashboard.

**Actions available**: "Seguir categorizando", "Terminado por hoy".

**Considerations**:

- Continuing goes straight to a new batch on the categorization screen; it does not replay the
  intro.
- The summary tiles already reflect everything decided in the stage just finished, including the
  exclusions.

---

### Use Case 9: The stage ends with nothing left pending

**Actor**: The person using the app.
**Preconditions**: The last pending movement on the device has been handled.

**Steps**:

1. The person sees the full-queue celebration.
2. They continue to home.

**Postconditions**: The person is on home, which now shows its all-clear state (#12).

**Information shown**: "¡Increíble trabajo!", "Has organizado completamente tus transacciones.",
the total organized with a full progress bar (A6), the same two summary tiles, and the closing
line "¡Ahora tienes una vista completa de tus gastos!".

**Actions available**: "Continuar a inicio".

**Considerations**:

- Movements marked "revisar más tarde" or "no recuerdo" **still have no category**, so they are
  still pending: reaching this state means the queue is genuinely empty, not that every movement
  was touched.

---

### Use Case 10: The person leaves in the middle of a stage

**Actor**: The person using the app.
**Preconditions**: A stage is under way.

**Steps**:

1. The person closes the stage from the top bar, or leaves the app.

**Postconditions**: Every decision already confirmed is kept. The unconfirmed selection on the
current movement is discarded, and that movement is still pending. No completion screen is shown
and no penalty, streak loss or warning is recorded.

**Information shown**: Whatever screen they went to.

**Actions available**: Coming back later starts a fresh stage from the intro.

**Considerations**:

- There is no "resume this stage" concept in the MVP: a new stage takes a fresh batch from the
  queue.
- Because decisions are recorded one at a time, a crash mid-stage loses at most the selection that
  was never confirmed.

---

## Business Rules

1. **Nothing in this flow is mandatory.** Every movement offers at least one way forward that
   records nothing, and no control is ever disabled in a way that traps the person (domain
   Business Rule 6).
2. **Each decision is recorded when it is confirmed**, movement by movement. There is no
   end-of-session save, so leaving early never loses a confirmed decision.
3. **A category assigned here is the person's own decision** and is recorded as such. An automatic
   suggestion never overwrites it later (domain Business Rule 6; the suggestion rule in #5 already
   refuses to suggest over a person's choice).
4. **Excluding is never deleting** (domain Business Rule 3). The movement stays, keeps everything
   the bank said, remains visible in the transactions list, and can be brought back later.
5. **An exclusion always carries one reason** from the fixed list; the note is optional for every
   reason.
6. **An excluded movement leaves every total and every chart**, through the one shared analysis
   rule that home, the dashboard and this flow's summary tiles all read (domain Business Rule 4).
7. **Partial inclusion is not offered and never recorded.** A movement either counts in full or
   does not count. No screen in this flow renders a percentage, a partial amount, or the advanced
   inclusion controls.
8. **Amounts are whole pesos** and are shown through the shared money formatter; a decimal in an
   amount is a defect (domain Business Rule 8).
9. **Dates are the person's local day**, never derived from a UTC timestamp.
10. **What the bank said is immutable and always visible.** The raw description is shown verbatim
    and is never edited by this flow; only the person's decision layer changes.
11. **The pending queue is exactly the movements with no category that are not excluded.** The
    count shown on the intro is that queue, and it is the same count home shows.
12. **A movement is offered at most once per stage.**
13. **At most one category is marked as suggested**, and only when the shared suggestion rule
    produces one. There is no suggestion when no merchant resolved or the merchant has no default.
14. **The taxonomy follows the movement's direction**: expense categories for money out, income
    categories for money in. The fallback category (✨ Otros) of that direction is always
    reachable through the full list.
15. **Categorizing one movement changes only that movement.** Bulk effects belong to merchant
    defaults (#14) and apply to future movements only.
16. **All user-facing copy comes from the app's message catalogues**, Spanish as the production
    language and English as fallback, with the Spanish string identical to the mockup. No literal
    string is written into a screen.
17. **Nothing in this flow leaves the device.** It reads and writes local data only, makes no
    network request, and emits no analytics.
18. **A screen is not done until every state its manifest entry declares renders** — for the
    states that are in the MVP. `advanced` is flagged `mvp: false` and is not built.

---

## UX Rules

### Stage intro (`#screen=stage-intro`)

- Shows the pending count and the time estimate as two equal tiles.
- Shows the three-step explanation of the session (identify, categorize, celebrate) and the three
  reasons it matters, as drawn.
- Carries the reassurance note that the person can stop whenever they want — this is the visual
  expression of Business Rule 1 and is not optional copy.
- The primary action starts the stage. A back affordance returns to the origin.
- No empty state: the screen is only reached when something is pending (A13).

### Categorization (`#screen=categorize`)

- **Progress**: a step indicator with one step per movement in the batch, and the line
  "Transacción X de N". Both are derived from the batch, so they stay truthful when the batch is
  short (A14).
- **`expense`**: warning-toned icon, "Gasto" badge, date and time, amount styled as money out,
  merchant name with the edit pencil and "Toca para editar", and the bank description block under
  the label "Descripción del banco" in monospace.
- **`income`**: success-toned icon, "Ingreso" badge, amount styled as money in, same merchant and
  description treatment, and the income question and taxonomy.
- **Category grid**: two columns; the suggested chip carries the ✨ star and the "Sugerido" hint
  and comes first; the last tile is always "Elegir otra".
- **`not-sure`**: the "¿No estás seguro?" row is a disclosure available in both direction states;
  opening it reveals exactly three options and does not hide the movement or the category grid.
- **`exclude-sheet`**: a bottom sheet over the screen with a grab handle, the five reasons as a
  single-choice list with one pre-selected, an optional note field, and a cancel/confirm pair where
  confirm is styled as destructive. Cancel returns to the previous state with nothing recorded.
- **Bottom actions**: "Omitir" (secondary) and "Siguiente →" (primary) are present in every state
  of the screen. "Omitir" is always enabled.
- **The advanced disclosure and its panel are not rendered at all** — not disabled, not hidden
  behind a flag: absent.
- **Loading**: the screen never shows a half-populated card. Until the next movement is ready to
  render completely, the current one stays.
- **Failure**: if a decision cannot be recorded, the stage does not advance, the movement stays on
  screen with its selection intact, and a non-blocking message says so. The person can still skip.

### Completion (`#screen=categorize-complete`)

- **`partial`**: "¡Buen trabajo!" / "Categorizaste las transacciones recientes.", the counter as
  *resolved / pending at stage start* with a matching bar, and two actions stacked — continue with
  another stage (primary), or stop for today (ghost).
- **`done`**: "¡Increíble trabajo!" / "Has organizado completamente tus transacciones.", the total
  organized with a full bar, and a single action back to home.
- Both states show the same two summary tiles and the closing line.
- The celebration is the only reward: no streaks, no points, no badges in the MVP.

---

## Copy contract

Spanish is the production language and comes verbatim from the mockup. English is the fallback and
is not a product commitment in this item. Every string below goes through the message catalogues;
none is written into a screen.

| Screen · state | Element | Spanish copy |
| --- | --- | --- |
| `stage-intro` | Top bar | Etapa 1 |
| `stage-intro` | Heading / eyebrow | Tu primera etapa · Categorización inteligente |
| `stage-intro` | Lead | Ya tienes todo configurado. Ahora viene lo divertido: tomar control de tus finanzas paso a paso. |
| `stage-intro` | Card title / body | ¿Qué vamos a hacer? · Vamos a categorizar tus transacciones recientes juntos. Es rápido, y cada categorización es una pequeña victoria. |
| `stage-intro` | Three steps | Identificamos / Gastos por categorizar · Categorizamos / Uno por uno · Celebramos / Cada progreso |
| `stage-intro` | Tiles | Transacciones por categorizar · Minutos estimados |
| `stage-intro` | Reasons | ¿Por qué es importante? · Visibilidad total / Sabrás exactamente en qué gastas tu dinero · Insights inteligentes / Análisis automáticos de tus patrones de gasto · Control gradual / Cada categorización te acerca a tus objetivos |
| `stage-intro` | Note | Flexibilidad total: puedes parar cuando quieras y continuar después. No hay presión, solo progreso. |
| `stage-intro` | Primary action | 🚀 ¡Empezar mi primera etapa! |
| `categorize` | Top bar · progress | Categorizar · Transacción {n} de {total} |
| `categorize` · `expense` | Badge · question | Gasto · ¿En qué categoría lo pones? |
| `categorize` · `income` | Badge · question | Ingreso · ¿De qué tipo de ingreso se trata? |
| `categorize` | Merchant affordance | Toca para editar |
| `categorize` | Description label | Descripción del banco |
| `categorize` | Suggestion hint | Sugerido |
| `categorize` | Full-list chip | Elegir otra |
| `categorize` | Disclosure | ¿No estás seguro? |
| `categorize` · `not-sure` | Options | Revisar más tarde / Lo veré después · No recuerdo / No estoy seguro de qué fue · Excluir del análisis / No es un gasto propio |
| `categorize` | Bottom actions | Omitir · Siguiente → |
| `categorize` · `exclude-sheet` | Heading · question | 🚫 Excluir del análisis · ¿Por qué quieres excluir esta transacción? |
| `categorize` · `exclude-sheet` | Reasons | Transferencia personal · Involucra a más personas · Gasto no relevante · Retiro de efectivo · Otro |
| `categorize` · `exclude-sheet` | Note placeholder · actions | Explica brevemente (opcional) · Cancelar · Confirmar |
| `categorize-complete` · `partial` | Heading · lead | ¡Buen trabajo! · Categorizaste las transacciones recientes. |
| `categorize-complete` · `done` | Heading · lead | ¡Increíble trabajo! · Has organizado completamente tus transacciones. |
| `categorize-complete` | Counter labels | Total categorizado · transacciones organizadas |
| `categorize-complete` | Tiles | Gasto diario promedio / este mes · vs mes pasado / estás gastando menos |
| `categorize-complete` · `partial` | Actions | Seguir categorizando · Terminado por hoy |
| `categorize-complete` · `done` | Action · closing line | Continuar a inicio · ¡Ahora tienes una vista completa de tus gastos! |

---

## Statuses / Enum Values

The stable code values below are fixed by
[`docs/project/4-database-model.md`](../../../project/4-database-model.md); this flow is
responsible for the display labels and for which values it may write.

### How a movement's category was decided

| Stable value | Display label | Description |
| --- | --- | --- |
| `user` | Elegida por ti | The person picked the category in this flow, or on the transaction detail screen. **The only value this flow writes.** |
| `auto` | Sugerida automáticamente | The app applied a resolved merchant's default that the person never configured. Written by sync (#10), not here. |
| `rule` | Regla del comercio | The app applied a merchant default the person configured (#14). Not written here. |

**Valid transitions**: `auto` or `rule` or none → `user` when the person confirms a category in
this flow. `user` never transitions back automatically.

### Deferral mark

| Stable value | Display label | Description |
| --- | --- | --- |
| *(none)* | — | The movement carries no deferral mark. |
| `review_later` | Revisar más tarde | The person will look at it later. No category. |
| `uncertain` | No recuerdo | The person does not remember what the movement was. No category. |

**Valid transitions**: none → `review_later` or `uncertain` when the person chooses that option;
either mark → the other when they choose again in a later stage; either mark → cleared when a
category is finally assigned.

### Exclusion reason

| Stable value | Display label |
| --- | --- |
| `personal_transfer` | Transferencia personal |
| `shared_expense` | Involucra a más personas |
| `not_relevant` | Gasto no relevante |
| `cash_withdrawal` | Retiro de efectivo |
| `other` | Otro |

**Valid transitions**: not excluded → excluded with a reason when the person confirms the sheet.
Excluded → not excluded only from the transaction detail screen (#16); this flow offers no
re-inclusion.

### Stage outcome

| Stable value | Display label | Description |
| --- | --- | --- |
| `partial` | Quedan pendientes | The batch is finished and the queue is not empty. |
| `done` | Todo categorizado | The batch is finished and the queue is empty. |

**Valid transitions**: a stage ends in exactly one of the two, decided by the pending count at the
moment the last movement of the batch is handled.

---

## Operational Visibility

- **Notifications**: this flow schedules none. The reminders that bring a person back are #18; this
  item only accepts being opened by one.
- **Network**: none. This flow makes no request of any kind, and there is no server to report to.
- **Analytics**: none. There is no telemetry in the product, and the open question about
  crash/error monitoring (decision D5 in the behavior contract, tracked as #49) is device-wide and
  is not resolved by this item.
- **Local diagnostics**: any local log written by this flow identifies a movement by its internal
  identifier only — never by amount, bank description, merchant or note.

---

## Acceptance Criteria

Every criterion below is verifiable by a person following a smoke test on a device with seeded
data, or by an automated test over the same data.

**Flow and stage**

- [ ] AC1. From a state with pending movements, opening the stage intro shows the pending count
      and the time estimate; the count equals the number of movements with no category that are
      not excluded.
- [ ] AC2. Starting a stage opens the categorization screen on the first movement of a batch of at
      most ten (A1); with fewer than ten pending, the batch is the whole queue and the progress
      line and step indicator both say so.
- [ ] AC3. The progress line reads "Transacción 1 de N" on the first movement and increases by one
      per movement handled, ending the stage after the Nth.
- [ ] AC4. No movement is offered twice within one stage, including movements that were skipped or
      deferred.

**Categorizing**

- [ ] AC5. On an expense movement, the screen shows the "Gasto" badge, the amount as money out,
      the merchant name, the bank's description verbatim, and the expense question.
- [ ] AC6. On an income movement, the screen shows the "Ingreso" badge, the amount as money in,
      and the income question with income categories.
- [ ] AC7. An expense is never offered an income category, and an income is never offered an
      expense category.
- [ ] AC8. When the shared suggestion rule produces a suggestion, exactly one chip carries the
      "Sugerido" hint and it is the first chip; when it does not, no chip carries it.
- [ ] AC9. "Elegir otra" opens the full taxonomy for the movement's direction, including ✨ Otros
      and any category the person created.
- [ ] AC10. Confirming a category records that category against the movement and records that the
      **person** chose it (`user`); the movement disappears from the pending count immediately.
- [ ] AC11. A movement categorized in a stage appears with that category in the transactions list
      and on the home totals without needing a re-sync.

**Never blocking**

- [ ] AC12. "Omitir" is present and enabled on every movement, in the `expense`, `income` and
      `not-sure` states, whether or not a category is selected.
- [ ] AC13. Skipping records nothing: the movement's category, deferral mark and exclusion are all
      unchanged, and it is still pending after the stage ends.
- [ ] AC14. "Revisar más tarde" marks the movement accordingly, assigns no category, advances the
      stage, and leaves the movement pending.
- [ ] AC15. "No recuerdo" behaves the same with its own mark.
- [ ] AC16. Leaving the stage from the top bar at any point keeps every decision already confirmed
      and leaves the current movement untouched; returning later starts a fresh stage.

**Excluding**

- [ ] AC17. "Excluir del análisis" opens the sheet with the five reasons, one pre-selected, and an
      optional note field.
- [ ] AC18. Cancelling the sheet records nothing and returns to the movement in the state it was
      in.
- [ ] AC19. Confirming records the exclusion with the chosen reason and, when written, the note;
      confirming without a note succeeds.
- [ ] AC20. An excluded movement stops counting in the month total, the daily average, the
      category breakdown and every chart, verified against home and the dashboard reading the same
      figure.
- [ ] AC21. An excluded movement still exists and is still listed in the transactions list with
      its exclusion visible; no screen in this flow offers to delete anything.
- [ ] AC22. Excluding never records a partial amount: after any exclusion, the movement's included
      amount remains unset.

**Partial inclusion is absent**

- [ ] AC23. The "Opciones avanzadas" disclosure, the "Incluir parcialmente" option, the amount
      field and the 50 % / Monto segment do not exist anywhere in the built flow — not disabled,
      not hidden: absent.
- [ ] AC24. No path through this flow writes an included amount for any movement.

**Merchant default hook**

- [ ] AC25. Tapping the merchant name opens the merchant editor for that merchant, carrying the
      category currently selected as the offered default (A9).
- [ ] AC26. Returning from the merchant editor puts the person back on the same movement of the
      same stage, with the stage progress unchanged.
- [ ] AC27. A merchant default set from that editor does not change the category of any movement
      the person had already categorized by hand.

**Completion**

- [ ] AC28. Finishing a batch with movements still pending shows the `partial` state with its
      copy, the session counter and both continuation actions.
- [ ] AC29. "Seguir categorizando" starts a new batch directly on the categorization screen,
      without replaying the intro.
- [ ] AC30. Finishing with nothing pending shows the `done` state with its copy, a full progress
      bar and a single action to home.
- [ ] AC31. The two summary tiles on the completion screen show the same figures as home for the
      same month, including the effect of exclusions made during the stage.

**Contract compliance**

- [ ] AC32. Every state declared for these three screens in the mockup manifest renders —
      `stage-intro`; `categorize` in `expense`, `income`, `not-sure` and `exclude-sheet`;
      `categorize-complete` in `partial` and `done` — and `advanced` is not implemented.
- [ ] AC33. No user-facing string in these screens is a literal in the screen code; every one
      resolves through the message catalogues, and the Spanish string matches the
      [Copy contract](#copy-contract) table character for character.
- [ ] AC34. Every amount displayed is a whole peso amount produced by the shared money formatter,
      and every date shown is the movement's local day.
- [ ] AC35. The flow makes no network request and emits no analytics event.
- [ ] AC36. Before this item is marked done, `design/mockups/mobile/index.html` is opened and each
      of the seven implemented states is compared side by side with the build.

---

## Out of Scope (MVP)

- **Partial inclusion — `#screen=categorize&state=advanced`.** The radio group, the amount input
  and the 50 % / Monto segment are not built. The state stays drawn in the mockups flagged
  `mvp: false`. The MVP offers exactly two outcomes: include fully, or exclude with a reason. The
  stored included-amount stays unwritten so that neither the schema nor any aggregate changes when
  the feature eventually lands.
- **The merchant editor itself (#14)** — renaming a merchant, alias grouping, the community
  suggestions state and the merchant statistics. This item owns only the entry point and the
  return trip.
- **The suggestion rule (#5)** — how a category is suggested is a domain rule that already exists;
  this flow consumes it.
- **Storing and syncing movements (#3, #10).**
- **The home screen and its pending call to action (#12)**, the transactions list (#15), the
  transaction detail screen and re-inclusion (#16), the dashboard (#17), reminders (#18) and
  category management (#21).
- **Re-including an excluded movement** — offered on transaction detail (#16), not here.
- **Editing a movement's note** — offered on transaction detail (#16), not here.
- **Bulk or multi-select categorization**, "apply to all similar movements", and any rules engine.
- **Undo history** beyond changing the selection before confirming it, and beyond re-deciding a
  movement later from the transactions list.
- **Gamification** beyond the celebration copy the mockups draw: no streaks, points, levels or
  badges.
- **Stage numbering and per-stage copy variants** — see
  [Deferral Note 2](#deferral-note-2--stage-numbering-and-repeat-visit-copy).
- **Resuming an interrupted stage.** A new stage always takes a fresh batch.
- **English copy quality.** English exists as a fallback; Spanish is the production language.
- **Any server-side component.** There is none in this product, and this flow needs none.

---

## Documented Conflicts

### Conflict 1 — one tap or two

**The disagreement**: `BEHAVIOR.md → categorize` says "elegir categoría → escribe `category_id` y
avanza al siguiente del lote", which reads as commit-on-tap. The mockup draws a primary
"Siguiente →" button alongside the chip grid, which would have nothing to do if a tap already
committed and advanced.

**Resolution**: choosing a chip **selects** it; "Siguiente →" confirms and advances (A10). This
keeps the drawn button meaningful, which the UI contract requires, and it makes a mis-tap
correctable — a real concern for a screen whose whole purpose is fast repeated tapping, and one
that matters under Business Rule 1. The behavior contract's sentence is still satisfied in
substance: choosing a category writes the category and moves on.

**Human confirmation requested**: yes. If the product owner prefers one tap, "Siguiente →" becomes
the way to advance without deciding and "Omitir" is removed — a change to two controls and their
tests.

### Conflict 2 — where "remember as the merchant's default" lives

**The disagreement**: `BEHAVIOR.md → categorize` says, marked 🟡, that assigning a category "ofrece
recordar como default del comercio". The mockup draws no such offer on the categorization screen;
the only merchant-default control it draws anywhere is inside `merchant-edit`, reachable by
tapping the merchant name.

**Resolution**: the hook is the drawn affordance. Tapping the merchant name opens the merchant
editor (#14) with the selected category offered as the default (A9). No inline offer is invented,
because the mockups are the UI contract and inventing a control would break it.

**Human confirmation requested**: yes. If an inline offer is wanted — a checkbox under the chip
grid, say — it needs to be drawn in the mockups first, in the same pull request that adds it here.

### Conflict 3 — when the exclusion note applies

**The disagreement**: the data model describes the exclusion note as "free text when reason =
`other`". The mockup draws the note field, labelled "(opcional)", in the sheet regardless of which
reason is selected.

**Resolution**: the note is optional and available for every reason (A11). The mockup is the UI
contract, and a person excluding a shared expense has as much to say as one choosing "Otro". The
data model's phrasing describes the expected common case, not a constraint.

### Conflict 4 — how long a session takes

**The disagreement**: the domain overview commits to "sesiones de 1–3 minutos". The stage intro
mockup shows "~5" estimated minutes next to a pending count of 4.

**Resolution**: the mockup's digits are sample data. The estimate is derived from the batch size
with a single per-movement constant (A5), and the batch size is chosen so that a stage lands
inside the 1–3 minute promise (A1). The engagement commitment wins over an illustrative number.

---

## Brief Objective List

Discrete requirements from work item #13.

1. Build `stage-intro`, the `categorize` screen, and `categorize-complete`.
2. Expense and income category pickers with the suggestion chip.
3. "¿No estás seguro?" → review-later / uncertain / exclude.
4. The exclusion sheet with reasons and an optional note.
5. Session progress and the partial/done completion states.
6. Do not build `#screen=categorize&state=advanced`: no partial-inclusion radio, no amount field,
   no 50 % / Monto segment.
7. The MVP offers exactly two outcomes per movement: include fully, or exclude with a reason.
8. Acceptance: categorizing records that the person chose the category.
9. Acceptance: skipping is always available; nothing blocks progress.
10. Acceptance: exclusion records the exclusion and its reason, and the movement leaves every
    aggregate.
11. Acceptance: the included amount is never written.
12. Acceptance: every listed state renders; `advanced` is not implemented.
13. Acceptance: compare against `design/mockups/mobile/index.html` side by side before marking
    done.
14. Depends on #2 (design-system primitives), #5 (shared-domain rules) and #10 (sync engine).

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. Three screens | AC1, AC2, AC5, AC6, AC28, AC30, AC32; Use Cases 1, 2, 8, 9; [UX Rules](#ux-rules) |
| 2. Expense and income pickers with the suggestion chip | AC5, AC6, AC7, AC8, AC9; Use Cases 2, 3; Business Rules 13, 14 |
| 3. "¿No estás seguro?" → later / uncertain / exclude | AC14, AC15, AC17; Use Cases 4, 5; [Deferral mark](#deferral-mark) |
| 4. Exclusion sheet with reasons and optional note | AC17, AC18, AC19; Use Case 5; Business Rule 5; [Exclusion reason](#exclusion-reason) |
| 5. Session progress and partial/done | AC3, AC28, AC29, AC30, AC31; Use Cases 8, 9; A6; [Stage outcome](#stage-outcome) |
| 6. `advanced` not built | AC23, AC32; Business Rule 7; Out of Scope (partial inclusion) |
| 7. Exactly two outcomes per movement | AC10, AC19, AC22, AC24; Business Rules 6, 7 |
| 8. Categorizing records the person's own choice | AC10; Business Rule 3; [How a movement's category was decided](#how-a-movements-category-was-decided) |
| 9. Skipping always available, nothing blocks | AC12, AC13, AC16; Business Rules 1, 2; Use Cases 6, 10 |
| 10. Exclusion recorded; movement leaves every aggregate | AC19, AC20, AC21; Business Rules 4, 6; Use Case 5 |
| 11. Included amount never written | AC22, AC24; Business Rule 7 |
| 12. Every listed state renders; `advanced` absent | AC23, AC32; Business Rule 18 |
| 13. Side-by-side mockup comparison before done | AC36 |
| 14. Depends on #2, #5, #10 | Depends-on line; AC8 (suggestion rule from #5), AC11 (data from #10), [Normative references](#normative-references); Out of Scope (#5, #10 ownership) |

---

## Deferral Notes

### Deferral Note 1 — the merchant editor

**Objective wording**: objective 1's `categorize` screen draws a tappable merchant name, and the
behavior contract attaches "recordar como default del comercio" to assigning a category.

**Rationale**: the editor is its own work item (#14) with its own states — renaming, alias
grouping, community suggestions, merchant statistics. Specifying it here would duplicate that item
and risk two different answers to the same question.

**Resolution**: this spec owns the hook and the round trip (Use Case 7, AC25–AC27) and defers the
editor. **Human confirmation requested**: no.

### Deferral Note 2 — stage numbering and repeat-visit copy

**Objective wording**: objective 1's `stage-intro`, whose drawn copy is first-stage copy ("Etapa
1", "Tu primera etapa", "🚀 ¡Empezar mi primera etapa!").

**Rationale**: the mockup draws exactly one intro screen and no variant for a returning person.
Numbering stages would need a persisted counter and copy that does not exist in the contract;
inventing either would break the rule that copy comes from the mockups.

**Resolution**: the MVP renders the drawn copy on every entry (A12), with the known cost that a
returning person reads "Tu primera etapa" again. **Human confirmation requested**: yes — the fix
is new mockup copy plus a stage counter, and both belong in the same pull request that changes the
mockups.

### Deferral Note 3 — re-including an excluded movement

**Objective wording**: objective 10's requirement that exclusion take a movement out of every
aggregate.

**Rationale**: the reverse operation is drawn on `transaction-detail` (`excluded` state, "ofrece
reincluir"), which is work item #16. Offering it here as well would put the same decision in two
places with no drawn design.

**Resolution**: this flow excludes only; re-inclusion is #16. **Human confirmation requested**:
no.

### Deferral Note 4 — what a person sees about their deferred movements

**Objective wording**: objective 3's review-later and uncertain marks.

**Rationale**: the marks are recorded here, but no screen in this item lists "the movements I said
I would review later" — the mockups draw no such filter, and the transactions list's filter set
(#15) is the natural home for one.

**Resolution**: the marks are written and are visible on the transaction detail screen; a
dedicated view is out of scope. **Human confirmation requested**: yes — if the product owner wants
a "revisar más tarde" filter, it is a small addition to #15 and needs a drawn state.
