# Smoke Test Runbook: shared-utils — CLP Money, Dates and RUT

**Feature**: `@finanzas/shared-utils` — CLP money formatting, Chilean date/period helpers, RUT
normalization and validation
**Spec**: None — this is a **Refactor**-routed item. The work item brief is
[GitHub issue #4](https://github.com/lhpaul/personal-finances/issues/4).
**Implementation plan**: [`../../specs/developments/20260801211957_4-shared-utils-clp-dates-rut/2_4-shared-utils-clp-dates-rut_implementation-plan.md`](../../specs/developments/20260801211957_4-shared-utils-clp-dates-rut/2_4-shared-utils-clp-dates-rut_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

This item ships a pure TypeScript library with no UI, no database and no network. Most of this
runbook therefore runs on the command line rather than in the app.

- [ ] Node 22 active (`nvm use`; the repository pins Node 22 via `.nvmrc`)
- [ ] `pnpm install` has been run from the repository root
- [ ] You are on the implementation branch for issue #4, with a clean working tree
- [ ] `design/mockups/mobile/index.html` opens in a browser (`pnpm mockups:mobile`)
- [ ] For Step 6 only: an iOS Simulator or a physical device with a dev build of
      `apps/mobile` (Expo Go is not sufficient — see Known Limitations)

---

## Test Data

All values below are transcribed from the UI contract, `design/mockups/mobile/index.html`. No
database seed data is required.

| Item | Value |
| --- | --- |
| Repository root command prefix | `pnpm --filter @finanzas/shared-utils` |
| Money vector (expense) | `42000` → `$42.000` |
| Money vector (income) | `1200000` → `+$1.200.000` |
| Money vector (zero) | `0` → `$0` |
| Money vector (negative balance) | `-500000` → `−$500.000` (U+2212) |
| Abbreviation vector (stat tile) | `3700000` → `3.7M` |
| Abbreviation vector (category row) | `279000` → `$279K` |
| Date vector (short) | `2025-01-24` → `24 ene` |
| Date vector (long) | `2025-01-24` → `viernes, 24 de enero de 2025` |
| Date vector (month badge) | `2025-01-24` → `ene 2025` |
| DST instant (repeated hour) | `2025-04-06T03:00:00Z` → `2025-04-05` / `23:00` |
| DST instant (skipped hour) | `2025-09-07T04:00:00Z` → `2025-09-07` / `01:00` |
| RUT (valid, `K` check digit) | `18.456.789-K` |
| RUT (invalid check digit, from the mockup) | `18.456.789-0` |
| Mockup reference | `design/mockups/mobile/index.html`, screens `#screen=home`, `#screen=dashboard`, `#screen=bank-credentials`, `#screen=settings-account`, `#screen=ds-typography` |

---

## Smoke Test Steps

### Step 0: Clean baseline

1. From the repository root, run `pnpm install`.
2. Run `git status --short` and confirm the working tree is clean apart from this item's own
   changes.

**Expected result**: install completes; no unexpected modified files.

### Step 1: The package's own suite is green

**Maps to**: AC1, AC2, AC3

1. Run `pnpm --filter @finanzas/shared-utils test`.
2. Read the summary line.

**Expected result**: every test passes and zero are skipped. The output includes test names for
`money`, `dates` and `rut`.

### Step 2: Date helpers are independent of the host timezone

**Maps to**: AC3

1. Run `TZ=Pacific/Kiritimati pnpm --filter @finanzas/shared-utils test -- dates`.
2. Run `TZ=UTC pnpm --filter @finanzas/shared-utils test -- dates`.
3. Run `TZ=America/Santiago pnpm --filter @finanzas/shared-utils test -- dates`.

**Expected result**: all three runs pass, with the same number of passing tests. A difference
between any two runs means a code path is reading the host clock or the host zone instead of the
instant and time zone passed in.

### Step 3: The formatted strings match the mockup, checked by hand

**Maps to**: AC1, AC3

1. From the repository root, start a Node REPL that can load the package source, or add a
   throwaway script — whichever the implementer prefers — and evaluate each of these:

   - `formatClp(42000, { direction: 'out' })`
   - `formatClp(1200000, { direction: 'in' })`
   - `formatClp(0)`
   - `formatClp(-500000)`
   - `formatClpAbbreviated(3700000)`
   - `formatClpAbbreviated(279000, { withCurrencySymbol: true })`
   - `formatShortDate('2025-01-24', 'es')`
   - `formatLongDate('2025-01-24', 'es')`
   - `formatMonthYear('2025-01-24', 'es')`
   - `formatShortDate('2025-01-24', 'en')` (expect `Jan 24` — confirms `locale` is honoured, not
     just accepted)
   - `formatRut('18456789K')`

2. Compare each result against the Test Data table above, character by character.
3. Confirm no non-abbreviated money string contains a comma or a non-breaking space.

**Expected result**: every value matches exactly. Delete the throwaway script before committing.

### Step 4: RUT behaviour and privacy

**Maps to**: AC2

1. Evaluate `isValidRut('18.456.789-0')` — expect `false`.
2. Evaluate `isValidRut('18.456.789-K')` and `isValidRut('18.456.789-k')` — expect `true` for
   both.
3. Evaluate `formatRut('18456789-0')` — expect `'18.456.789-0'` (formatting must succeed on a
   RUT whose check digit is wrong; the mockup renders exactly this string in the `error` state).
4. Call `formatRut('')` inside a `try`/`catch`, print `error.message`, and read it.
5. Open `packages/shared-utils/src/rut.ts` and search it for `console.`, for `${` inside any
   `throw` statement, and for any assignment to a module-level variable.

**Expected result**: steps 1-3 match. The error message in step 4 is a fixed sentence that does
**not** contain the input. Step 5 finds no `console.` call, no interpolated value in any thrown
message, and no module-level mutable state in `rut.ts`.

### Step 5: Design fidelity — expected vs actual

**Maps to**: AC1, AC3 (the mockup is the UI contract, AGENTS.md non-negotiable 6)

1. Open the reference asset: `design/mockups/mobile/index.html` (`pnpm mockups:mobile`).
2. Navigate to `#screen=ds-typography` and find the **Montos** card. Confirm the rule text reads
   "Formato CLP: punto como separador de miles, sin decimales. Ingresos con signo **+**; gastos
   sin signo.", and that the two canonical examples are `+$2.500.000` (`--in`) and `$35.000`
   (`--out`).
3. Navigate to `#screen=home`. Compare, against the Step 3 output:
   - the stat tile values `3.7M` and `1.4M`, and the balance row `+2.3M`;
   - the category row amounts `$279K`, `$235K`, `$193K`, `$156K`;
   - the transaction row amounts `+$1.200.000` and `$42.000`;
   - the badge `ene 2025` and the chart bar labels `nov`, `dic`, `ene`;
   - the transaction meta `26 ene · 14:32` — confirm your `formatShortDate('...', 'es')` output is
     the `26 ene` portion and your `formatTimeOfDay` output is the `14:32` portion, with the ` · `
     supplied by the caller, not by this package.
4. Navigate to `#screen=bank-credentials` and `#screen=settings-account`. Confirm the RUT is
   rendered as `12.345.678-9` (placeholder) and `18.456.789-0` (filled), matching
   `formatRut`'s grouping and dash placement.
5. Record PASS/FAIL, with expected-vs-actual detail on any failure.

**Expected result**: every string produced by the package is character-identical to its mockup
counterpart. Differences that matter for the acceptance criteria are absent.

> Do **not** "fix" the mockup's RUT check digits. `12.345.678-9` and `18.456.789-0` are
> arithmetically invalid on purpose — they are fake identities in a mockup, and `18.456.789-0` is
> the source of AC2's negative test vector.

### Step 6: Device check for the timezone seam — **human verification required**

**Maps to**: AC3

`deriveZonedParts` (and `deriveDateLocal` / `formatTimeOfDay`, which call it) is the function that
resolves a **real IANA timezone** (`America/Santiago`) via `Intl`. Jest runs on Node, which ships
full ICU; React Native runs on Hermes, which delegates to the platform. A Node-only pass does not
prove device behaviour for this specific seam. The four date-label formatters
(`formatShortDate`, `formatLongDate`, `formatMonthYear`, `formatMonthAbbreviation`) also call
`Intl`, but are pinned to `timeZone: 'UTC'` — a built-in identifier every ICU implementation
supports without a timezone-database lookup — and the human confirmed empirically that Hermes on
RN 0.81.5 / Expo 54 carries full ICU (locale data included), so this device check is scoped to
the IANA-timezone seam only and does not need to be repeated for the label seam.

1. Launch `apps/mobile` on an iOS Simulator or device dev build (`pnpm dev:mobile`).
2. From any temporary entry point in the app (for example a `useEffect` in
   `apps/mobile/app/index.tsx`), log the results of
   `deriveDateLocal(new Date('2025-04-06T03:00:00Z'))` and
   `formatTimeOfDay(new Date('2025-04-06T03:00:00Z'))`.
3. Read the values from the Metro console.
4. Remove the temporary logging before committing.

**Expected result**: `2025-04-05` and `23:00` — the same values Step 1 asserts under Node. If the
call throws the capability error instead, record the exact message and stop: the fallback is a
caller-supplied UTC offset parameter, and that is an implementation-plan change, not a quick fix.

If this step cannot be executed in the current environment, mark it **pending human
verification** in the pull request description. Do not claim it as passing.

### Step 7: `toLocaleString` is banned, not merely absent

**Maps to**: AC4

1. Run
   `grep -rn 'toLocaleString\|toLocaleDateString\|toLocaleTimeString' --include='*.ts' --include='*.tsx' --include='*.js' apps packages`
   and confirm there is no output.
2. Temporarily add `(1200000).toLocaleString('es-CL');` to
   `apps/mobile/src/__tests__/workspace-wiring.test.ts`.
3. Run `pnpm lint` and read the failure.
4. Remove the line and run `pnpm lint` again.

**Expected result**: step 1 produces no matches. Step 3 fails with a message naming
`@finanzas/shared-utils`, proving the rule survives `eslint-config-expo`, which
`apps/mobile/eslint.config.mjs` spreads after the root config. Step 4 passes. The temporary
violation is **never** committed.

### Step 8: The package is still pure and still consumable

**Maps to**: brief rule 3 (`@finanzas/shared-utils` is consumed by both `apps/mobile` and
`@finanzas/bank-scraper`)

1. Temporarily add `import { readFileSync } from 'node:fs';` to
   `packages/shared-utils/src/index.ts`, run `pnpm lint`, confirm it fails with the
   `sharedUtilsPurity` message, then remove it and confirm `pnpm lint` passes.
2. Run `pnpm --filter @finanzas/mobile test` and confirm the existing
   `apps/mobile/src/__tests__/workspace-wiring.test.ts` still passes — `PACKAGE_NAME` must still
   be exported.
3. Run `pnpm build` and confirm `packages/shared-utils` emits `dist/` with declarations.
4. Confirm `packages/shared-utils/package.json` still has **no** `dependencies` block.

**Expected result**: the purity rule fires and then clears; the app's wiring test still passes;
the package builds; no dependency was added.

### Last Step: Validate & shut down

- Verify every assertion in the checklist below is met
- Confirm no temporary probe, throwaway script or logging statement remains in the working tree
  (`git status --short`)
- Shut down the simulator if Step 6 was executed

---

## Assertions Checklist

Each checkbox maps to an acceptance criterion from
[issue #4](https://github.com/lhpaul/personal-finances/issues/4).

- [ ] **AC1** — Money functions are exhaustively unit-tested, including zero (`$0`), negative
      input (`−$500.000`, U+2212) and rounding (`1352470` → `1.4M`, `1500` → `2K`,
      `999500` → `1.0M`). Non-integer input throws rather than silently rounding
      (Steps 1, 3, 5)
- [ ] **AC2** — RUT validation rejects a wrong check digit (`18.456.789-0` → `false`) and accepts
      `K` in both cases (`18.456.789-K` and `18.456.789-k` → `true`) (Steps 1, 4)
- [ ] **AC3** — Period boundaries are correct across month ends (January/February/leap February,
      week crossing a month end, week crossing a year end) and across both 2025 Chile DST
      transitions (Steps 1, 2, 6)
- [ ] **AC4** — No `toLocaleString` calls remain in app code, and the ban is enforced by ESLint
      rather than by convention (Step 7)
- [ ] Every formatted string is character-identical to the mockup (Steps 3, 5)
- [ ] The RUT never reaches a log line or an error message (Step 4)
- [ ] The package remains pure and dependency-free, and its three consumers still build
      (Step 8)

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| — | None. Every input is an inline literal in a test file or in the Test Data table above; the vectors are transcribed from `design/mockups/mobile/index.html`, which is committed repository content. | — |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| An amount renders with a comma, a space before the digits, or `CLP` instead of `$` | An `Intl.NumberFormat` crept in, or the string is being built by the caller instead of by `formatClp` | Remove it. Decision 1 in the plan: money strings are hand-built and locale-invariant because platform `Intl.NumberFormat` output does not match the mockup — this does **not** apply to dates, which do use `Intl` (Decision 2) |
| A date label renders in the wrong language (e.g. Spanish under an English UI, or vice versa) | The caller did not pass the active app `locale` to `formatShortDate` / `formatLongDate` / `formatMonthYear` / `formatMonthAbbreviation`, or passed a stale one | These formatters have no default `locale` by design (Decision 2, 7) — fix the call site to pass the current locale from `apps/mobile/src/i18n/`. Do not "fix" this by adding a hardcoded Spanish table |
| An amount renders with a decimal point in the non-abbreviated form | A float entered the money pipeline upstream. CLP has no cents | Do not add rounding to the formatter. Find the caller that produced the float; `formatClp` throwing a `TypeError` here is the intended alarm (Decision 5) |
| A transaction appears in the wrong month | The local day was derived from the UTC timestamp instead of via `deriveDateLocal` | Use `deriveDateLocal(instant)` and group on the resulting `date_local` — this is exactly the bug the column exists to prevent |
| Step 2 gives different results under different `TZ` values | A code path reads the host zone (a no-argument `new Date()`, `getMonth()` instead of `getUTCMonth()`, or a missing `timeZone` option) | Pass the clock in; use `Date.UTC` / `getUTC*` for all civil arithmetic (Decision 3) |
| `deriveZonedParts` throws on device but passes in Jest | Hermes' `Intl` cannot resolve the time zone on that platform | Record the exact message and escalate. The fallback is a caller-supplied UTC offset, which is a plan change — do not silently substitute the device zone |
| A time renders as `24:00` | `hour12: false` was used instead of `hourCycle: 'h23'` | Switch to `hourCycle: 'h23'` |
| `isValidRut` rejects a RUT a user says is real | Decision 10's 6-8 digit body range, or a leading-zero handling bug | Check the body length after leading zeros are stripped. Widening the range is a deliberate decision, not a quick patch — the RUT is the bank login, so a false rejection blocks a real user |
| `pnpm --filter @finanzas/mobile test` fails after this item | `PACKAGE_NAME` was removed from `packages/shared-utils/src/index.ts` | Restore it verbatim; `apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it |

---

## Known Limitations

- **Step 6 needs a real device or simulator and a dev build.** Expo Go is not sufficient for this
  project generally, and a Node-based Jest run cannot substitute for it: the whole point of Step 6
  is that Hermes' `Intl` implementation differs from Node's. In an automated agent environment
  this step is expected to be marked *pending human verification*.
- **This item ships no UI.** Steps 3 and 4 evaluate the library directly rather than exercising a
  screen. The screens that consume these helpers arrive with later items; the fidelity check in
  Step 5 compares the library's *output strings* against the mockup, not a rendered React Native
  screen against the mockup.
- **DST vectors are pinned to 2025.** Chile's transition dates are set by decree and have changed
  several times. If the government moves them, the Step 1 assertions still pass — they assert
  against the IANA database that the runtime ships — but the 2025 instants in the Test Data table
  will no longer sit on a transition. Re-derive them before relying on this runbook in a later
  year.
