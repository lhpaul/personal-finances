# Smoke Test Runbook: Home screen

**Feature**: Home screen (`#screen=home`) — issue
[#12](https://github.com/lhpaul/personal-finances/issues/12)
**Work item brief**: [issue #12](https://github.com/lhpaul/personal-finances/issues/12) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `home`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**: [`2_12-home-screen_implementation-plan.md`](../../specs/developments/20260802172715_12-home-screen/2_12-home-screen_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and
      `pnpm check:layout` passes.
- [ ] **A dev build, not Expo Go.** This screen depends on `expo-sqlite`, `expo-crypto` and
      `react-native-svg`, all native modules. If `react-native-svg` was installed in the same
      change, the dev client must be **rebuilt** — a stale client fails to resolve it at
      runtime.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison:
      `open design/mockups/mobile/index.html`.
- [ ] There is no login step in this product — the profile is the device
      (`AGENTS.md` non-negotiable 7). Ignore any "log out first" habit from other runbooks.

---

## Test Data

| Item | Value |
| --- | --- |
| Home route | `/(tabs)/home` — reachable by deep link `finanzas://(tabs)/home` |
| Dev sample-data route | `/(dev)/sample-data` — deep link `finanzas://sample-data` (`__DEV__` only) |
| Design-system gallery | `/(dev)/gallery` — deep link `finanzas://gallery` (`__DEV__` only) |
| On-device fixture | `apps/mobile/src/db/__fixtures__/store-v1.sql` — loaded by the dev panel |
| Mockup reference | `design/mockups/mobile/index.html#screen=home&state=<state>` |

> **Why a dev panel exists**: item #10 (the sync engine) has not landed, so there is no way to
> produce real movements on a device without live bank credentials. The `__DEV__`-only
> sample-data route loads the committed deterministic fixture instead. It returns `null` in a
> release build and has no reachable entry point there.

---

## Smoke Test Steps

### Step 1: Fresh install — the `empty` state

**Maps to**: brief AC2 ("All four states render, including first-sync `empty`"),
implementation plan Decision 4 (priority 1), Assumption A2.

1. Delete the app from the simulator/device (or run the dev panel's **Vaciar datos de
   ejemplo** action) so the store has starter content only and no connection with a successful
   sync.
2. Launch the dev build and deep-link to `finanzas://(tabs)/home`.
3. Open `design/mockups/mobile/index.html#screen=home&state=empty` beside it.

**Expected result**: the header (💰 *Finanzas* / *Tu asistente financiero* / ⚙️), then the
🌱 empty block with *Estamos preparando tus datos*, the explanatory paragraph naming Banco de
Chile, and a progress bar. The bar **animates continuously** rather than sitting at a fixed
percentage (plan Decision 10 — there is no progress signal in the data model). No summary card,
no trend card, no category card, no recent list, no banks card, no hero, no dots.

### Step 2: Load the sample store

1. Deep-link to `finanzas://sample-data`.
2. Tap **Cargar datos de ejemplo**.
3. Return to `finanzas://(tabs)/home`.

**Expected result**: the panel reports success; home now renders the full set of cards.
The screen must **not** require an app restart to pick up the new data — returning to the tab
re-reads it (plan Decision 7, focus invalidation).

### Step 3: The `pending` state

**Maps to**: brief AC2, plan Decision 4 (priority 3).

1. With the sample store loaded and at least one uncategorized, non-excluded movement present,
   view `/(tabs)/home`.
2. Open `#screen=home&state=pending` beside it.

**Expected result**, top to bottom:

- The purple **challenge hero** (🎯) with a title and a subtitle of the form
  *«N transacciones pendientes · ~M min»*, where **N matches the real uncategorized count** —
  change one movement's category with the dev panel or by categorizing, and confirm N moves.
- Three dots below the hero, the first one active (plan Assumption A3 — decorative, not
  swipeable).
- **Resumen financiero** with the current month badge (e.g. `ene 2025`), two stat tiles
  (*Ingresos* ↑ green, *Gastos* ↓ amber) each with an abbreviated value and a *«N movimientos»*
  sub-line, and a **Balance del mes** row.
- **Análisis de tendencias**: month badge, a *Gastos | Ingresos* segment, a line chart with
  gridlines, a solid current-month line and a dashed previous-month line, a legend reading
  *Este mes* and the previous month's label, and *Ver análisis completo →*.
- **Análisis por categorías**: subtitle *«N categorías · <month>»*, up to four rows, each with
  an emoji, name, abbreviated amount, a proportional bar and *«N transacciones · P,P%»*.
- **Transacciones recientes** with *Ver todas* and three rows.
- **Bancos conectados** with an *Al día* badge and one bank row.

### Step 4: The `all-clear` state

**Maps to**: brief AC2, plan Decision 4 (priority 4).

1. Categorize (or, via the dev panel, assign a category to) every uncategorized non-excluded
   movement so the queue reaches zero.
2. Return to `/(tabs)/home` and open `#screen=home&state=all-clear`.

**Expected result**: the green **¡Todo al día!** hero with *No tienes transacciones pendientes*
replaces the purple challenge hero. The dots and every card below stay exactly as in Step 3.
Tapping the all-clear hero does nothing — it is not a button in the mockup.

### Step 5: The `sync-error` state

**Maps to**: brief AC2, plan Decision 4 (priority 2), Assumption A1.

1. On the dev panel, tap **Simular error de sincronización**.
2. Return to `/(tabs)/home` and open `#screen=home&state=sync-error`.

**Expected result**:

- A red-bordered ⚠️ note replaces the hero: *No pudimos sincronizar Banco de Chile.* on the
  first line, and *Último sync exitoso: <relative time>.* followed by a brand-coloured
  **Reintentar** on the second. The bank name and the timestamp are **real values from the
  connection row**, not the mockup's literals.
- The dots and every card below still render.
- The **Bancos conectados** badge reads *Error* (red) instead of *Al día*, and the bank row's
  sub-label reads *Error de sincronización*.
- **Precedence check**: with uncategorized movements still present, the challenge hero must
  **not** appear — `sync-error` outranks `pending`.
- Tapping **Reintentar** navigates to the bank review route for that connection
  (`/settings/banks/[bankId]`). It is a placeholder screen today (item #20) — confirm the route
  opens and shows the placeholder with the right id.

### Step 6: Totals are real, and they honour exclusion

**Maps to**: brief AC3 ("Totals match the dashboard exactly — both read the shared inclusion
fragment"), `BEHAVIOR.md` hard rule, Business Rule 4.

1. Note the *Gastos* total and the amount on one category row.
2. Exclude one expense movement from that category (transaction detail → *Excluir del
   análisis*, or the dev panel).
3. Return to `/(tabs)/home`.

**Expected result**: the *Gastos* total, that category row's amount, its movement count, its
percentage, its bar length and the trend chart's current-month line **all decrease
consistently**. The excluded movement still appears in **Transacciones recientes**, dimmed —
it left the analysis, it was not deleted (Business Rule 3).

4. Re-include it and confirm every figure returns to its Step 1 value.

### Step 7: Month boundaries are local, not UTC

**Maps to**: `BEHAVIOR.md` → `home` ("mes por `deriveDateLocal`, nunca UTC"), plan Decision 8.

1. Set the device timezone to `America/Santiago` and the clock to the **last day of the
   month, 23:30**.
2. Open `/(tabs)/home` and note the month badge and the *Gastos* total.
3. Advance the clock past local midnight into the first day of the next month, then reopen the
   tab.

**Expected result**: the month badge rolls over to the new month and the totals reset to the
new month's data at **local** midnight, not at 21:00 or 03:00 local (which is what a UTC-derived
day boundary would produce).

### Step 8: Navigation seams

**Maps to**: plan Decision 13. Every destination is a placeholder screen owned by a later item;
this step verifies the **seam**, not the destination's content.

| Tap | Expected destination |
| --- | --- |
| Challenge hero (in `pending`) | `/categorize/intro` |
| Header ⚙️ | `/settings` |
| *Ver análisis completo →* (trend card) | `/dashboard` |
| *Ver análisis completo →* (category card) | `/dashboard` |
| *Ver todas* | `/(tabs)/transactions` |
| A recent-movement row | `/transactions/[transactionId]` with that movement's id |
| The bank row | `/settings/banks/[bankId]` |
| The *Transacciones* tab | `/(tabs)/transactions` |

**Expected result**: each tap opens the placeholder for the named route, and the back gesture
returns to home with its data intact.

### Step 9: The tab bar

**Maps to**: `AGENTS.md` non-negotiable 6 and item #1's AC14.

**Expected result**: exactly **two** tabs — *Inicio* and *Transacciones*. No *Presupuestos*,
no *Beneficios*, not even disabled, even though the mockup draws four. Those two screens are
`mvp: false`.

### Step 10: Accessibility and density

1. Enable the OS's largest non-accessibility text size.
2. Re-open `/(tabs)/home`.

**Expected result**: no clipped card title, no truncated amount, no overlapping stat-tile
arrow. Every tappable element (header action, hero, category row, bank row, ghost buttons,
segment items, transaction rows) remains at least 44 pt on its vertical axis. Amount tone is
never the only signal — income keeps its `+` and its ↑, expenses keep their ↓.

### Step 11: Design fidelity — expected vs actual

**Maps to**: brief AC5 ("Open `design/mockups/mobile/index.html` and compare side by side
before marking done"), `AGENTS.md` non-negotiable 6,
`docs/best-practices/stack/mobile-ui-fidelity.md`.

Reference asset: `design/mockups/mobile/index.html` — the repository's UI contract. No other
design asset exists for this item (no `## Design assets` section on issue #12, no tracker
attachment, no `assets/` folder in the development folder).

For **each** of the four states, open the mockup at the matching hash and compare side by side:

1. `design/mockups/mobile/index.html#screen=home&state=pending`
2. `design/mockups/mobile/index.html#screen=home&state=all-clear`
3. `design/mockups/mobile/index.html#screen=home&state=empty`
4. `design/mockups/mobile/index.html#screen=home&state=sync-error`

Check, per state: section order, card presence, copy (Spanish, from the mockup), colour
semantics (expenses amber, income green — never inverted), amount formatting, spacing rhythm
and badge tone.

Record PASS/FAIL per state with expected-vs-actual detail on failure. Capture at least one
small-screen and one normal-screen viewport (Spanish copy is long). Keep screenshots under
`.tmp/` unless the PR asks for a committed artifact.

**Known acceptable differences** (documented, do not raise as defects):

| Difference | Why |
| --- | --- |
| Hero and stat-tile backgrounds are a flat fill, not a CSS gradient | Item #2's documented limitation — no gradient renderer was added; see `Hero`'s doc comment |
| Stat-tile arrows render `↑` / `↓` where the mockup draws `↗` / `↘` | Inherited from item #2's merged `ARROW_GLYPH` map (plan Assumption A14) |
| The `empty` state's progress bar animates instead of sitting at 45% | Plan Decision 10 — no progress signal exists in the data model |
| The `‹ ›` month glyphs are inert | Plan Decision 14 — `BEHAVIOR.md` scopes home to the month in progress |
| Amounts, counts and percentages differ from the mockup's sample numbers | The mockup's numbers are illustrative; the screen renders the fixture's real aggregates |

### Step 12: The dev surface does not ship

**Maps to**: plan Decision 11.

1. Confirm no product screen links to `/(dev)/sample-data` or `/(dev)/gallery`.
2. Confirm `apps/mobile/app/(dev)/sample-data.tsx` returns `null` when `__DEV__` is false and
   `require()`s its panel **inside** that branch.

**Expected result**: both dev routes are reachable only by deep link in a dev build.

### Last Step: Validate & shut down

- Work through the assertions checklist below.
- Stop Metro and close the simulator.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion in the work item brief.

- [ ] **AC1** — the "por categorizar" count uses the partial index, not a full scan.
      Evidence: `pnpm --filter @finanzas/mobile test` shows the `EXPLAIN QUERY PLAN` assertion
      in `src/db/__tests__/indexes.test.ts` naming `transactions_uncategorized_idx`, and the
      hero's count matches the real number of uncategorized non-excluded movements (Step 3).
- [ ] **AC2** — all four states render, including first-sync `empty` and `sync-error`
      (Steps 1, 3, 4, 5), with the documented precedence (Step 5).
- [ ] **AC3** — totals match the dashboard exactly, because both read the shared inclusion
      fragment. Evidence: Step 6 behaves consistently across every figure, and
      `inclusion-rule-single-definition.test.ts` plus `db-access-boundary.test.ts` are green.
- [ ] **AC4** — charts are memoized; no recomputation on unrelated re-renders. Evidence:
      switching the *Gastos / Ingresos* segment redraws only the trend line, and the
      memoization test in `src/features/home/__tests__/` passes.
- [ ] **AC5** — the mockup was opened and compared side by side, for **all four** states
      (Step 11), with the known acceptable differences recorded.
- [ ] Copy renders entirely from the i18n catalogues — no Spanish literal in JSX
      (`pnpm --filter @finanzas/mobile lint` reports no `i18next/no-literal-string` error).
- [ ] Money is never a float and never carries decimals or a wrong separator; abbreviation
      appears **only** in the two stat tiles, the balance line and the category rows
      (plan Decision 9 / D2).
- [ ] Navigation seams all resolve (Step 8) and no adjacent screen was built.
- [ ] Exactly two tabs render (Step 9).
- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` are green at the repo root.

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Starter content (institutions, categories, merchants) | Baseline for every state; the `empty` state uses this alone | Automatic on first launch (`ensureDatabaseReady` → `applySeeds`) |
| Connection + products + movements | `pending`, `all-clear`, `sync-error` | Dev panel → **Cargar datos de ejemplo** (executes the committed `apps/mobile/src/db/__fixtures__/store-v1.sql`) |
| Failed connection | `sync-error` | Dev panel → **Simular error de sincronización** |
| Back to no successful sync | `empty` | Dev panel → **Vaciar datos de ejemplo**, or delete and reinstall the app |
| Regenerate the fixture (only if the schema or starter content changed) | — | `pnpm --filter @finanzas/mobile db:seed`; the output must be byte-identical when re-run |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Unable to resolve "react-native-svg"` at runtime | The dev client predates the dependency | Rebuild the dev build; Expo Go cannot run this screen |
| The screen is blank with no error | The database is still bootstrapping, or bootstrap failed | Home renders nothing until the database is ready (plan Assumption A15). Check the Metro log for `DatabaseBootstrapError` |
| Totals do not change after excluding a movement | A write bypassed the repository, or the query cache was not invalidated | Confirm the exclusion wrote `excluded_at`, then confirm home invalidates its query keys on focus |
| `home` and `dashboard` disagree | Someone hand-wrote an exclusion filter | Both must call `sumIncludedByDirectionAndCategory`; `inclusion-rule-single-definition.test.ts` should already have failed |
| Amounts are off by a factor of 100, or show decimals | A float entered the money pipeline upstream | `formatClp` throws a `TypeError` on non-integer input by design — fix the producer, not the formatter |
| A movement shows up in the wrong month | The local day was derived from the UTC timestamp | Every boundary must come from `deriveDateLocal` + `getMonthPeriod` (plan Decision 8) |
| The dev panel does nothing | Running a release build, or the deep link did not resolve | The route returns `null` unless `__DEV__`; confirm the scheme with `finanzas://sample-data` |
| Percentages do not sum to 100 across all buckets | Apportionment ran over the displayed four rows instead of every bucket | Plan Decision 3 — apportion over all buckets, display the top four |

---

## Known Limitations

- **The `empty` state's progress bar carries no real progress**, because no progress signal
  exists in the data model. It animates indeterminately. Revisit when item #11 (bank syncing
  progress) lands.
- **The sample-data path is not the production path.** It loads a committed fixture rather than
  the output of a real sync. Once item #10 ships, re-run Steps 3-6 against a genuine Banco de
  Chile sync before treating the screen as production-verified.
- **Home is reached by deep link**, because `app/index.tsx` still redirects unconditionally to
  onboarding. The launch gate belongs to item #8; re-run Step 1 through the normal launch path
  once it lands.
- **Fidelity comparison is manual.** The automated mockup capture/compare tooling is tracked
  separately (issue #47); until it lands this runbook is the check, and the PR must say so.
- **D2 is still open.** The abbreviation scope this screen implements is the reversible default
  recorded in the plan's Decision 9, not a settled product decision.
</content>
