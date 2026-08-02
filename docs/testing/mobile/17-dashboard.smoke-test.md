# Smoke Test Runbook: Dashboard

**Feature**: Dashboard (`#screen=dashboard`) — issue
[#17](https://github.com/lhpaul/personal-finances/issues/17)
**Work item brief**: [issue #17](https://github.com/lhpaul/personal-finances/issues/17) — a
Refactor-type item, so there is no spec. The behaviour contract is
[`design/mockups/mobile/BEHAVIOR.md` → `dashboard`](../../../design/mockups/mobile/BEHAVIOR.md).
**Implementation plan**: [`2_17-dashboard_implementation-plan.md`](../../specs/developments/20260802181500_17-dashboard/2_17-dashboard_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

- [ ] Node 22 (`.nvmrc`) and pnpm 11.12.0; `pnpm install` has been run and `pnpm check:layout`
      passes.
- [ ] **A dev build, not Expo Go.** This screen depends on `expo-sqlite`, `expo-crypto` and
      `react-native-svg`, all native modules. `react-native-svg` arrives with item #12 — if the
      dev client predates that install, it must be **rebuilt** or it fails to resolve it at
      runtime.
- [ ] The Metro dev server is running: `pnpm dev:mobile`.
- [ ] The mockup is open for side-by-side comparison:
      `open design/mockups/mobile/index.html`.
- [ ] Items **#12**, **#5** and **#47** are merged. Without #12 there are no aggregates and no
      `LineChart`; without #5 there is no `apportionTenths`; without #47 there is no fidelity
      contract to run in Step 8.
- [ ] There is no login step in this product — the profile is the device (`AGENTS.md`
      non-negotiable 7). Ignore any "log out first" habit from other runbooks.

---

## Test Data

| Item | Value |
| --- | --- |
| Dashboard route | `/dashboard` — reachable by deep link `finanzas://dashboard`, and from `home`'s two *"Ver análisis completo →"* CTAs |
| Dev sample-data route | `/(dev)/sample-data` — deep link `finanzas://sample-data` (`__DEV__` only, built by item #12) |
| Design-system gallery | `/(dev)/gallery` — deep link `finanzas://gallery` (`__DEV__` only) |
| On-device fixture | `apps/mobile/src/db/__fixtures__/store-v1.sql` — loaded by the dev panel |
| Mockup reference | `design/mockups/mobile/index.html#screen=dashboard&state=month` and `&state=week` |
| Fidelity deep links | `finanzas:///dashboard?fidelity=1&fidelityScreen=dashboard&fidelityState=month` and `…&fidelityState=week` |

> **Why a dev panel is used**: item #10 (the sync engine) may not have landed, and a real sync
> needs live bank credentials. The `__DEV__`-only panel item #12 built loads the committed
> deterministic fixture, which is what makes this runbook executable and repeatable.

---

## Smoke Test Steps

### Step 1: Load the sample store

1. Open `finanzas://sample-data` on the dev build.
2. Tap **Vaciar datos de ejemplo**, then **Cargar datos de ejemplo**.

**Expected result**: the panel reports the fixture loaded. This guarantees the same movements,
categories and connection every run, so the figures below are comparable between runs.

### Step 2: Reach the dashboard the way a person does

**Maps to**: brief AC5; plan Decision 13.

1. Open `finanzas://(tabs)/home`.
2. Tap either *"Ver análisis completo →"* CTA.

**Expected result**: `/dashboard` opens with a topbar reading **Dashboard**, a back arrow on the
left and a ⚙️ on the right, and the **Mes** / **Semana** segment below it with **Mes** selected.
There is **no tab bar** on this screen — it is a pushed route, exactly as the mockup draws it.

### Step 3: The `month` state, card by card

**Maps to**: brief AC1, AC3, AC5; plan Decisions 3, 5, 7, 15, 16.

Open `design/mockups/mobile/index.html#screen=dashboard&state=month` beside the device and walk
the three cards top to bottom.

1. **Tendencia**. Subtitle reads *Últimos 6 meses*. Two flat tiles read **Ingresos** and
   **Gastos** with **full** amounts (`$3.700.000` form — thousands separators, **no** `3.7M`
   abbreviation anywhere on this screen, and **no** `+` / `−` sign). The chart shows three
   gridlines, a **green** income line, an **amber** expense line and a **grey dashed** line, and
   a three-row legend reading *Ingresos*, *Gastos*, *Promedio 3 períodos* whose dot colours match
   the three lines.
2. **Resumen de gastos**. A **💵 Total gastado** figure in full form, a badge reading
   `▼ N% vs período anterior` (green/ok) or `▲ N%` (amber/warn), **two** bars — the left one
   grey (previous period), the right one amber (this period) — with the month abbreviations
   below them (`dic`, `ene` form), and a two-row legend.
3. **Reporte por categorías**. An inner **Este mes** / **Mes anterior** segment. Below it a
   **Gastos** block: the label, the full total in amber, a donut and a legend of up to five rows,
   each with a coloured dot, an emoji + category name, and a percentage in the `20,6%` form
   (comma decimal, one digit). Then a separator, then an **Ingresos** block with the same shape
   and its total in green.

**Expected result**: every element above is present, in that order, and no amount anywhere on the
screen is abbreviated. Record any layout difference against the mockup.

### Step 4: The percentages agree with the donut, and add up

**Maps to**: brief AC2; plan Decision 6.

1. On the **Gastos** block, read the legend percentages and note them.
2. Compare each legend row's dot colour with the corresponding donut arc.
3. Sum the visible percentages.

**Expected result**: each arc's angular size is visibly proportional to its own legend value, in
the same order and the same colour. The visible percentages sum to **100 % only when the
direction has five or fewer categories**; with more than five, they sum to less and the unfilled
remainder is shown as the donut's pale track — that is the designed behaviour (plan Decision 6),
not a bug. On the **Ingresos** block, which the fixture keeps small, the arcs should close the
circle and the values should sum to `100,0%`.

### Step 5: `month` and `dashboard` agree with `home`

**Maps to**: brief AC1; `BEHAVIOR.md`'s hard rule that `home` and `dashboard` *no pueden
divergir*; plan Decision 1.

1. Note the dashboard's **Gastos** total and **Ingresos** total for the current month.
2. Go back to `/(tabs)/home` and read its two stat tiles.

**Expected result**: the two screens report the **same** figures for the same month. Home
abbreviates (`3.7M`) and the dashboard does not (`$3.700.000`) — that is the D2 default this
plan applies (Decision 5), and it is a formatting difference, not a data difference. If the
underlying numbers differ at all, stop: something is calling a query these screens do not share.

### Step 6: Exclusion is honoured, and an empty period is not a broken chart

**Maps to**: brief AC1 and AC4; plan Decisions 1 and 11.

1. Open `finanzas://(tabs)/transactions`, open any movement included in the current month, and
   exclude it from analysis.
2. Return to `/dashboard`.
3. Then switch the outer segment to **Semana**.

**Expected result**: after step 2, both the total and the corresponding donut slice have dropped
by exactly the excluded amount, and the same drop is visible on `home` — the excluded movement is
still listed in `transactions`, only removed from the totals (BR3/BR4). After step 3, if the
fixture's movements fall outside the current week, each card shows a **readable empty state**
inside the card — an icon, a short heading and a sentence — with its total still rendering as
`$0`. There must be **no** blank card, no `NaN`, no `0/0`, no chart drawn with a flat line at an
undefined position, and no crash.

### Step 7: The `week` state

**Maps to**: brief AC5, plan Decision 3; non-negotiable 6 (every manifest state is implemented).

Open `design/mockups/mobile/index.html#screen=dashboard&state=week` beside the device with
**Semana** selected.

**Expected result**: the trend card's subtitle reads *Últimas 6 semanas*; the spending card's two
bar labels read the positional `S-1` / `S-2` form instead of month abbreviations; the category
card's inner segment reads the week wording (*Esta semana* / *Semana anterior*). Everything else
keeps the same structure. Switching back to **Mes** restores the month wording, and switching
back and forth several times does not accumulate, duplicate or blank any card.

### Step 8: Design fidelity — expected vs actual

**Maps to**: brief AC5 (*"Open `design/mockups/mobile/index.html` and compare side by side before
marking done"*); plan Decision 14.

1. Reference assets (the authoritative baseline for this item):
   `design/mockups/mobile/index.html#screen=dashboard&state=month` and
   `#screen=dashboard&state=week`.
2. Manual comparison: place the device beside the mockup at each state and compare card order,
   spacing rhythm, type scale, chart proportions, legend alignment and every Spanish string
   character for character.
3. Automated comparison: run

   ```bash
   pnpm fidelity --issue 17
   ```

   which captures both `dashboard--month` and `dashboard--week` on the dedicated
   `Finanzas Fidelity` simulator and compares them against the mockup captures.

**Expected result**: the manual comparison finds no unexplained difference, and both automated
targets pass within their contracted `max_mismatch_pct` of **5.0** (the threshold item #47
seeded for this screen, carried over unchanged). Record both mismatch percentages. **A failing
target is fixed by fixing the screen** — raising the threshold requires a `threshold_note` and a
visible diff, and is not part of this runbook. If the `week` capture renders the empty state
because the fixture has no movements in the current week, that is a legitimate and stable
capture; note it rather than treating it as a defect.

### Step 9: Navigation seams

**Maps to**: plan Decision 13; `BEHAVIOR.md` → `dashboard`.

1. Tap the topbar's back arrow.
2. Return to `/dashboard` and tap ⚙️.

**Expected result**: back returns to `/(tabs)/home`; ⚙️ opens `/settings` (a placeholder until
#19 lands). Neither triggers a sync, and nothing on this screen writes to the database.

### Step 10: Accessibility and density

**Maps to**: the accessibility rule in `docs/best-practices/stack/expo-react-native.md`.

1. Tap each of the four segment options (outer **Mes** / **Semana**, inner *Este mes* /
   *Mes anterior*) and both topbar buttons.
2. Turn on the OS screen reader and traverse the screen once.

**Expected result**: every control is comfortably tappable and reports a selected state where
one applies. Both donuts and both charts carry an accessible label describing what they show
(the mockup's `aria-label` strings are the reference). No decorative element steals focus.

### Last Step: Validate & shut down

- Verify every assertion in the checklist below.
- Optionally tap **Vaciar datos de ejemplo** on the dev panel to leave the device clean.
- Stop the Metro dev server.

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion in the work item brief.

- [ ] **AC1** — Every figure on the screen comes from a SQL aggregate: the dashboard's monthly
      totals equal `home`'s for the same month (Step 5), and excluding a movement changes both
      identically (Step 6).
- [ ] **AC2** — The donut arcs and their legend rows carry the same percentages, in the same
      order and colour; a direction with five or fewer categories sums to `100,0%`, and a
      direction with more shows the remainder as track (Step 4).
- [ ] **AC3** — Income is green and expenses are amber wherever direction is carried: the two
      trend lines, the two flat tile amounts, the current-period bar, and the two category-report
      totals (Step 3).
- [ ] **AC4** — An empty period renders a readable per-card empty state with a `$0` total, and no
      `NaN`, blank card or crash (Step 6).
- [ ] **AC5** — Both manifest states (`month`, `week`) were compared side by side against
      `design/mockups/mobile/index.html`, manually and with `pnpm fidelity --issue 17`, and both
      passed within the contracted threshold (Steps 3, 7, 8).
- [ ] No amount anywhere on this screen is abbreviated (the D2 default this item applies —
      Step 3).
- [ ] The screen performs no write: after a full pass, `home` and `transactions` show exactly
      what they showed before, apart from the deliberate exclusion made in Step 6.

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| One `banco-de-chile` connection, two products, movements covering categorized / uncategorized / excluded / partially included | The populated `month` state, Steps 2-6 | `finanzas://sample-data` → **Cargar datos de ejemplo** (loads `apps/mobile/src/db/__fixtures__/store-v1.sql`) |
| Starter content only — institutions, categories, merchants, no movements | The empty-period path in Step 6 | `finanzas://sample-data` → **Vaciar datos de ejemplo** |
| `seed-default` | The two automated fidelity captures in Step 8 | Declared in `scripts/mobile-ui/fidelity-targets.json`; applied by `pnpm fidelity --issue 17` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Unable to resolve "react-native-svg"` at runtime | The dev client predates item #12's `expo install` | Rebuild the dev client; Expo Go cannot run this screen |
| The dashboard and `home` disagree on a total | Something bypassed the shared aggregates | Both screens must call `sumIncludedByDirectionAndCategory` / `sumIncludedByDirectionAndDay` from `apps/mobile/src/db/repositories/transactions.ts`. Run `pnpm --filter @finanzas/mobile test` — `inclusion-rule-single-definition` and `db-access-boundary` name the offending file |
| A percentage reads `NaN%` or a chart is blank rather than showing an empty state | A division guard is missing | Plan Decision 11b; the failing case is in `trend-report.test.ts`, `spending-overview.test.ts` or `category-report.test.ts` |
| Percentages do not sum to 100 for a direction with ≤ 5 categories | Apportionment ran over the displayed subset instead of all buckets | Plan Decision 6 — `apportionTenths` must be fed every bucket, and the top-5 cap applied afterwards |
| Amounts show decimals or are off by a factor of 100 | A float entered the money pipeline upstream | `formatClp` throws on a non-integer by design; the bug is at the source, not in the formatter |
| A movement lands in the wrong month or week | The local day was derived from the UTC timestamp | Every period on this screen comes from `deriveDateLocal` + `getMonthPeriod` / `getWeekPeriod` |
| `pnpm fidelity --issue 17` refuses to run | The two targets are still `status: "planned"`, or the simulator is not the profile device | Plan Decision 14; `capture-simulator.sh` prints the exact `simctl create` command when the named device is missing |
| The ⚙️ or back button does nothing | The destination route is still a `RoutePlaceholder` | Expected until #19 lands; only navigation must work |

---

## Known Limitations

- The `week` state's content depends on where the fixture's movements fall relative to the
  device clock, so it may legitimately render the empty state. That is a stable, correct capture
  — note it in the evidence rather than treating it as a failure.
- Until item #10 (the sync engine) lands, all data comes from the committed fixture through the
  `__DEV__` panel. Nothing in this runbook exercises a real bank sync.
- A foreign-currency movement is absent from every peso total on this screen with no on-screen
  indication. This is a deliberate, recorded deferral (plan Decision 4) with a follow-up filed;
  do not report it as a defect of this item.
- This runbook does not exercise past-period navigation, because the mockup draws none and the
  screen therefore shows only the period in progress (plan Decision 3, Assumption A3).
