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
| Abbreviation vector (category row) | `279000` / `235000` / `193000` / `156000` → `$279K` / `$235K` / `$193K` / `$156K` |
| Abbreviation vector (stat tile, half-up rounding) | `1352470` → `1.4M` |
| Abbreviation vector (balance row, signed) | `2347530` with `{ direction: 'in' }` → `+2.3M` |
| Date vector (short) | `2025-01-24` → `24 ene` |
| Date vector (long) | `2025-01-24` → `viernes, 24 de enero de 2025` |
| Date vector (month badge) | `2025-01-24` → `ene 2025` |
| Date vector (chart-bar month abbreviations) | `2024-11-24` / `2024-12-24` / `2025-01-24` → `nov` / `dic` / `ene` |
| Time-of-day vector (transaction meta `26 ene · 14:32`) | `formatShortDate('2025-01-26', 'es')` → `26 ene`; `formatTimeOfDay(new Date('2025-01-26T17:32:00Z'))` → `14:32` (`17:32Z` is `14:32` in `America/Santiago`, UTC−03, DST in effect in January) |
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

### Step 3: The formatted strings match the mockup, via a temporary Jest test

**Maps to**: AC1, AC3

`@finanzas/shared-utils` already configures Jest (`ts-jest`, `packages/shared-utils/jest.config.js`)
and exposes every helper from `src/index.ts` — use that harness, not an ad hoc Node REPL or
throwaway script, so the smoke check runs under the same module resolution and TypeScript
settings as the real test suite.

1. Create a temporary test file, `packages/shared-utils/src/smoke-runbook.test.ts`, that imports
   from `./index` and asserts every value in the Test Data table above with `expect(...).toBe(...)`:

   ```ts
   // Temporary — delete before committing (smoke-test runbook Step 3). Not part of the permanent
   // suite: money.test.ts / dates.test.ts / rut.test.ts already cover this behaviour exhaustively.
   import {
     formatClp,
     formatClpAbbreviated,
     formatShortDate,
     formatLongDate,
     formatMonthYear,
     formatMonthAbbreviation,
     formatTimeOfDay,
     formatRut,
   } from './index';

   describe('smoke-test runbook Step 3 — mockup fidelity', () => {
     it('money vectors match the mockup', () => {
       expect(formatClp(42000, { direction: 'out' })).toBe('$42.000');
       expect(formatClp(1200000, { direction: 'in' })).toBe('+$1.200.000');
       expect(formatClp(0)).toBe('$0');
       expect(formatClp(-500000)).toBe('−$500.000');
     });

     it('abbreviation vectors match the mockup, including half-up rounding and the signed balance row', () => {
       expect(formatClpAbbreviated(3700000)).toBe('3.7M');
       expect(formatClpAbbreviated(1352470)).toBe('1.4M');
       expect(formatClpAbbreviated(2347530, { direction: 'in' })).toBe('+2.3M');
       expect(formatClpAbbreviated(279000, { withCurrencySymbol: true })).toBe('$279K');
       expect(formatClpAbbreviated(235000, { withCurrencySymbol: true })).toBe('$235K');
       expect(formatClpAbbreviated(193000, { withCurrencySymbol: true })).toBe('$193K');
       expect(formatClpAbbreviated(156000, { withCurrencySymbol: true })).toBe('$156K');
     });

     it('date-label vectors match the mockup, and locale is honoured, not just accepted', () => {
       expect(formatShortDate('2025-01-24', 'es')).toBe('24 ene');
       expect(formatLongDate('2025-01-24', 'es')).toBe('viernes, 24 de enero de 2025');
       expect(formatMonthYear('2025-01-24', 'es')).toBe('ene 2025');
       expect(formatShortDate('2025-01-24', 'en')).toBe('Jan 24');
     });

     it('chart-bar month abbreviations match the mockup', () => {
       expect(formatMonthAbbreviation('2024-11-24', 'es')).toBe('nov');
       expect(formatMonthAbbreviation('2024-12-24', 'es')).toBe('dic');
       expect(formatMonthAbbreviation('2025-01-24', 'es')).toBe('ene');
     });

     it("matches the mockup's transaction meta \"26 ene · 14:32\"", () => {
       // 2025-01-26T17:32:00Z is 2025-01-26 14:32 in America/Santiago (UTC-03, DST in effect in
       // January — see AC3's Group D in the implementation plan).
       expect(formatShortDate('2025-01-26', 'es')).toBe('26 ene');
       expect(formatTimeOfDay(new Date('2025-01-26T17:32:00Z'))).toBe('14:32');
     });

     it('formatRut matches the mockup', () => {
       expect(formatRut('18456789K')).toBe('18.456.789-K');
     });
   });
   ```

2. Run `pnpm --filter @finanzas/shared-utils test -- smoke-runbook` and read the summary.
3. Every `expect(...).toBe(...)` above already fails on a stray comma or non-breaking space in a
   non-abbreviated money string, since string equality is exact — no separate manual check is
   needed.
4. Delete `packages/shared-utils/src/smoke-runbook.test.ts` before committing.

**Expected result**: `pnpm --filter @finanzas/shared-utils test -- smoke-runbook` reports every
`it` in the temporary file passing. The temporary test file is never committed.

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
   - the transaction meta `26 ene · 14:32` — confirm Step 3's
     `formatShortDate('2025-01-26', 'es')` result is the `26 ene` portion and Step 3's
     `formatTimeOfDay(new Date('2025-01-26T17:32:00Z'))` result is the `14:32` portion, with the
     ` · ` supplied by the caller, not by this package.
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

This step covers **two** distinct device failure modes, not one:

- **Missing/unresolvable time zone** — a device whose Hermes `Intl` cannot resolve
  `America/Santiago` at all. `deriveZonedParts`'s capability check throws a descriptive `Error` for
  this case (Group F in the implementation plan), so it is expected to surface as a thrown error,
  not a wrong value.
- **Silent-ignore** — a device whose Hermes `Intl` accepts the `timeZone` option but quietly
  computes with the *device's own* zone instead, without throwing. This is the failure mode a
  reviewer flagged as not provably caught by a Node-only Jest run: Node's ICU is fully
  spec-compliant, so this specific misbehaviour cannot be *literally* reproduced in a Jest test —
  only simulated via a mocked `Intl.DateTimeFormat`. Steps 5-6 below are what actually exercise it
  on a real device.

1. Launch `apps/mobile` on an iOS Simulator or device dev build (`pnpm dev:mobile`), with the
   simulator/device's system timezone left at its default.
2. From any temporary entry point in the app (for example a `useEffect` in
   `apps/mobile/app/index.tsx`), log the results of
   `deriveDateLocal(new Date('2025-04-06T03:00:00Z'))` and
   `formatTimeOfDay(new Date('2025-04-06T03:00:00Z'))`.
3. Read the values from the Metro console.
4. **Expected result for steps 1-3**: `2025-04-05` and `23:00` — the same values Step 1 asserts
   under Node. If the call throws the capability error instead, record the exact message and stop:
   the fallback is a caller-supplied UTC offset parameter, and that is an implementation-plan
   change, not a quick fix.
5. **Silent-ignore check.** Change the simulator/device's **system timezone** to something distinct
   from both `UTC` and `America/Santiago` — for example `America/New_York` (iOS Simulator:
   Settings app > General > Date & Time > Time Zone, or `xcrun simctl` with a timezone override) —
   and repeat step 2 with the same fixed instant, `2025-04-06T03:00:00Z`.
6. **Expected result for step 5**: unchanged from step 4 — `2025-04-05` and `23:00`. If the values
   instead shift to match the device's *new* local time (e.g. drift toward the device's
   `America/New_York` wall clock rather than staying pinned to `America/Santiago`),
   `deriveZonedParts` is silently substituting the device zone for the requested one — the exact
   Hermes failure mode the plan's `resolvedOptions()` cross-check targets. Record the exact
   observed values and the device/OS/Hermes version, and treat this as a **blocking** finding, not
   a note: it means the runtime's `Intl.DateTimeFormat.resolvedOptions()` itself misreports the
   zone it used, so the code-level guard cannot distinguish the substitution from success, and the
   only defense left is this device check.
7. Restore the simulator/device's system timezone to its default before continuing.
8. Remove the temporary logging before committing.

If this step cannot be executed in the current environment, mark it **pending human
verification** in the pull request description. Do not claim it as passing — this applies to both
the baseline check (steps 1-4) and the silent-ignore check (steps 5-6) independently; a device run
that only exercises the baseline device timezone has not verified the silent-ignore failure mode.

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

### Step 8: The package is still pure and still consumable by all three consumers

**Maps to**: brief rule 3 (`@finanzas/shared-utils` is consumed by `apps/mobile`,
`packages/bank-scraper` and `packages/shared-domain` — verified at plan time via each consumer's
`dependencies.@finanzas/shared-utils: workspace:*`)

1. Temporarily add `import { readFileSync } from 'node:fs';` to
   `packages/shared-utils/src/index.ts`, run `pnpm lint`, confirm it fails with the
   `sharedUtilsPurity` message, then remove it and confirm `pnpm lint` passes.
2. **`apps/mobile`** — this consumer has **no `build` script** (`apps/mobile/package.json`), so
   `pnpm build` cannot validate it; use its wiring test and a typecheck instead. Run
   `pnpm --filter @finanzas/mobile test` and confirm the existing
   `apps/mobile/src/__tests__/workspace-wiring.test.ts` still passes — `PACKAGE_NAME` must still
   be exported — then run `pnpm --filter @finanzas/mobile typecheck` and confirm it passes.
3. **`packages/bank-scraper` and `packages/shared-domain`** — both declare a `build` script and
   both depend on `@finanzas/shared-utils`. Run `pnpm build` and confirm it emits `dist/` with
   declarations for `packages/shared-utils`, `packages/bank-scraper` **and**
   `packages/shared-domain`. `pnpm build` validates these two package consumers; it does **not**
   build or validate `apps/mobile` (Step 8.2 covers that consumer separately).
4. Confirm `packages/shared-utils/package.json` still has **no** `dependencies` block.

**Expected result**: the purity rule fires and then clears; `apps/mobile`'s wiring test and
typecheck both pass; `packages/bank-scraper` and `packages/shared-domain` both build with
declarations; no dependency was added. All three consumers are covered — two by `pnpm build`, one
by its wiring test plus typecheck, never by `pnpm build` alone.

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
- [ ] The package remains pure and dependency-free, and all three consumers still consume it
      correctly — `packages/bank-scraper` and `packages/shared-domain` still build,
      `apps/mobile` (no `build` script) still passes its wiring test and typecheck (Step 8)

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
| Step 6's silent-ignore check (changing the device timezone) shows the resolved date/time drifting to the device's local zone instead of staying pinned to `America/Santiago` | Hermes' `Intl` accepts the `timeZone` option but silently computes with the device zone, and `resolvedOptions().timeZone` also misreports the zone it used (the one case the code-level cross-check in `deriveZonedParts` cannot catch) | This is a blocking finding, not a note — record the device/OS/Hermes version and escalate. Do not attempt a code-level fix without a plan change; this is exactly the residual risk documented in the implementation plan's Risks table |
| A time renders as `24:00` | `hour12: false` was used instead of `hourCycle: 'h23'` | Switch to `hourCycle: 'h23'` |
| `isValidRut` rejects a RUT a user says is real | Decision 10's 6-8 digit body range, or a leading-zero handling bug | Check the body length after leading zeros are stripped. Widening the range is a deliberate decision, not a quick patch — the RUT is the bank login, so a false rejection blocks a real user |
| `pnpm --filter @finanzas/mobile test` fails after this item | `PACKAGE_NAME` was removed from `packages/shared-utils/src/index.ts` | Restore it verbatim; `apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it |

---

## Known Limitations

- **Step 6 needs a real device or simulator and a dev build.** Expo Go is not sufficient for this
  project generally, and a Node-based Jest run cannot substitute for it: the whole point of Step 6
  is that Hermes' `Intl` implementation differs from Node's. In an automated agent environment
  this step is expected to be marked *pending human verification*.
- **Step 6's silent-ignore check has one irreducible residual gap.** It proves `deriveZonedParts`
  is not silently substituting the device zone by observing the actual computed wall-clock value on
  a real device with its system timezone deliberately changed. The one failure mode it cannot rule
  out by construction is a device whose `Intl.DateTimeFormat.resolvedOptions()` itself lies about
  the zone it used *and* happens to produce the correct wall-clock output for this one probe while
  failing elsewhere — an extremely narrow, effectively hypothetical combination. This gap is
  explicitly accepted in the implementation plan's Risks table rather than silently ignored.
- **This item ships no UI.** Steps 3 and 4 evaluate the library directly rather than exercising a
  screen. The screens that consume these helpers arrive with later items; the fidelity check in
  Step 5 compares the library's *output strings* against the mockup, not a rendered React Native
  screen against the mockup.
- **DST vectors are pinned to 2025.** Chile's transition dates are set by decree and have changed
  several times. If the government moves them, the Step 1 assertions still pass — they assert
  against the IANA database that the runtime ships — but the 2025 instants in the Test Data table
  will no longer sit on a transition. Re-derive them before relying on this runbook in a later
  year.
