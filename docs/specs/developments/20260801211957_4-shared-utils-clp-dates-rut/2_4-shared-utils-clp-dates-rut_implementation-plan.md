# shared-utils: CLP Money, Dates and RUT — Implementation Plan

**Spec**: None — this is a **Refactor**-routed item. The work item brief is
[GitHub issue #4](https://github.com/lhpaul/personal-finances/issues/4) and it is the
specification of record for this plan.
**Smoke test runbook**: [`../../../testing/mobile/4-shared-utils-clp-dates-rut.smoke-test.md`](../../../testing/mobile/4-shared-utils-clp-dates-rut.smoke-test.md)
**Issue**: lhpaul/personal-finances#4

---

## Summary

**Approach**: Fill in the empty `@finanzas/shared-utils` workspace with three pure modules —
`money.ts`, `dates.ts`, `rut.ts` — re-exported from `index.ts`. Money and dates are treated
**asymmetrically, and deliberately so** (`docs/best-practices/stack/i18n.md`, "Formatting"):
CLP strings are built by hand from integer arithmetic, hard-coded and locale-invariant, because
platform `Intl.NumberFormat` output disagrees with the mockup for the tags this app actually
uses — the mockup wins, per that doc's own rule, "If the platform output differs, format by
hand — the mockup wins, not the platform default." Date labels take the opposite path: Hermes on
RN 0.81.5 / Expo 54 has full ICU, `Intl.DateTimeFormat(locale, {...})` reproduces every mockup
date literal exactly, and that same doc forbids a hardcoded Spanish month table ("hardcoding one
leaves Spanish dates under an English UI") — so every date-label formatter takes `locale` as a
parameter instead. All calendar arithmetic (month/week period boundaries, month lengths,
day-of-week) runs on **UTC civil-date math**, which has no DST by construction. Two narrow,
cached, capability-checked `Intl` seams carry all locale/timezone-dependent behaviour:
`deriveZonedParts`, which converts an instant to Chilean wall-clock fields via
`Intl.DateTimeFormat(...).formatToParts` (the one place the DST acceptance criterion is tested),
and the date-label formatters, which call `Intl.DateTimeFormat(locale, {...}).format(...)`
directly. Neither seam is `toLocaleString`, so AC4 (banning `toLocaleString`/`toLocaleDateString`/
`toLocaleTimeString`) is unaffected by either. RUT helpers are pure `string -> string | boolean`
functions that never log, never cache and never embed the input in an error message.

**Estimated complexity**: M

<!-- S: < 1 day | M: 1-3 days | L: 3+ days -->

**Rationale**: Roughly 700 lines of source plus a large, mostly mechanical test suite across
four new files in one workspace. No new dependencies, no new toolchain, no UI, no database, no
async. The complexity is entirely in getting the string contracts exactly right against the
mockup and in the DST/period edge cases — which is verification work, not integration work. It
is above S because the acceptance criteria demand exhaustive enumeration rather than a happy
path, and because two files outside the package (the root ESLint config and several docs) must
change to make acceptance criterion AC4 mechanically enforced.

**Dependencies**: Issue #1 (monorepo + workspace bootstrap) — **already merged** (commit
`107deee`). `packages/shared-utils/` exists with its manifest, `tsconfig.json`,
`jest.config.js`, `eslint.config.mjs` and a placeholder `src/index.ts`. Nothing else blocks this
item. Items #2 (theme + design-system primitives) and #3 (local database) run concurrently and
are **consumers**, not blockers.

---

## Verification Log

> Reproducible plan-time verification. Repo revision for every row below except the three marked
> `[correction]`: `14b9a9e` (`implementation-plan/4-shared-utils-clp-dates-rut`, branched from
> `develop`). Verified 2026-08-01T21:20Z, in the isolated worktree `.claude/worktrees/item-4`. The
> three `[correction]` rows were re-verified at `5301787` on the same branch, 2026-08-01T22:18Z,
> during the human-directed correction that replaced the money/dates design in this plan (see the
> "Known documentation drift" correction note below).

| Check | Command / query | Result |
| --- | --- | --- |
| Repo revision | `git rev-parse --short HEAD` | `14b9a9e` |
| Existing package surface (what this item fills in, rather than creates) | `find packages/shared-utils -type f -not -path '*/node_modules/*'` | 6 files: `package.json`, `tsconfig.json`, `jest.config.js`, `eslint.config.mjs`, `src/index.ts`, `src/index.test.ts`. `src/index.ts` contains only `export const PACKAGE_NAME = '@finanzas/shared-utils';` |
| `PACKAGE_NAME` has an existing consumer that must not break | `grep -rn "PACKAGE_NAME" apps packages --include='*.ts'` | `apps/mobile/src/__tests__/workspace-wiring.test.ts` imports it from all three packages. **`PACKAGE_NAME` must remain exported** |
| Consumers of the package (brief rule 3) | `grep -n '@finanzas/shared-utils' apps/mobile/package.json packages/*/package.json` | `apps/mobile` (dependency), `packages/bank-scraper` (dependency), `packages/shared-domain` (dependency). Three consumers, matching `docs/project/2-repo-architecture.md` line 101-103 |
| AC4 baseline — `toLocaleString` occurrences in app code today | `grep -rn 'toLocaleString\|toLocaleDateString\|toLocaleTimeString' --include='*.ts' --include='*.tsx' --include='*.js' apps packages` | **0 matches.** AC4 is satisfied at baseline; this item must keep it satisfied and make it mechanically enforced rather than merely true-by-accident |
| Money literals in the UI contract (drives every `formatClp` test vector) | `grep -oE '[+−-]?\$[0-9][0-9.]*' design/mockups/mobile/index.html \| sort -u` | 38 distinct literals. Extremes and shapes: `$0`, `$156`… (see note), `$42.000`, `$60.200`, `$1.200.000`, `$1.352.470`, `$38.400.000`, `+$1.200.000`, `+$2.500.000`. **No negative money literal exists in the mockup**; the only `−` (U+2212) literals are percentages |
| Abbreviated money literals | `grep -oE '[+−-]?[0-9]+\.[0-9]M' design/mockups/mobile/index.html \| sort -u` and `grep -oE '\$[0-9]+K' …` | `3.7M`, `1.4M`, `+2.3M` (bare, no `$` — `home` stat tiles and the balance row, lines 1472/1478/1484/2629/2630) and `$279K`, `$235K`, `$193K`, `$156K` (**with** `$` — `home` category rows, lines 1515-1518) |
| The authoritative CLP formatting rule inside the mockup itself | `grep -n 'Formato CLP' design/mockups/mobile/index.html` | Line 2567, on the `ds-typography` screen: *"Formato CLP: punto como separador de miles, sin decimales. Ingresos con signo **+**; gastos sin signo."* with canonical `--in` = `+$2.500.000` and `--out` = `$35.000` (lines 2564-2565) |
| Date literals in the UI contract | `grep -oE '[0-9]{1,2} (ene\|…\|dic)' …`, `grep -oE '(ene\|dic) 20[0-9]{2}' …`, weekday regex | Short: `11 dic`, `14 ene`, `19 ene`, `23 ene`, `24 ene`, `26 ene`, `27 dic`, `27 ene`, `29 dic` — **every sample is a two-digit day; there is no single-digit-day sample**. Month+year: `ene 2025`, `dic 2024`. Long: `viernes, 24 de enero de 2025` (one occurrence). Bare month: `nov`, `dic`, `ene` (chart bar labels, lines 1337-1339, 1828-1829) |
| Short date composed with a time | `grep -oE '.{0,60}(ene\|dic) · [0-9]{2}:[0-9]{2}.{0,20}' …` | `<span class="mu-small">26 ene · 14:32</span>`, `<span class="mu-small">27 ene · 21:00</span>` — the ` · ` separator is markup-level composition; the date and the 24-hour time are the two formatted pieces |
| RUT literals in the UI contract | `grep -oE '[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9kK]' …` plus line context | `12.345.678-9` (line 891, input **placeholder**), `18.456.789-0` (lines 892, 893, 2199, 2223 — filled value, `rut-locked` value, settings display). **Both have invalid check digits** — see the Verification Log note below |
| Check digits of the mockup RUT bodies (modulo-11, weights 2..7 right-to-left) | `node -e "…"` reference implementation run at plan time | `12345678 -> 5` (mockup shows `-9`), `18456789 -> K` (mockup shows `-0`), `999999 -> K`, `9876543 -> 3`, `7123456 -> 8`, `11111111 -> 1`, `30686957 -> 4`, `5126663 -> 3` |
| Chile DST transition instants in 2025 (drives the DST test vectors) | `node -e "new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',…,timeZoneName:'shortOffset'}).format(new Date(iso))"` for a sweep of instants | DST **ends** at `2025-04-06T03:00:00Z` (`02:59Z` → `2025-04-05 23:00 GMT-3`; `03:00Z` → `2025-04-05 23:00 GMT-4` — the same wall-clock hour occurs twice). DST **starts** at `2025-09-07T04:00:00Z` (`03:00Z` → `2025-09-06 23:00 GMT-4`; `04:00Z` → `2025-09-07 01:00 GMT-3` — local `00:00`-`00:59` never exists). Chile therefore **does** observe DST; the AC is testable as written |
| Year/month-boundary offset behaviour | same probe | `2025-01-01T02:00:00Z` → local `2024-12-31 23:00 GMT-3`; `2025-12-31T03:00:00Z` → local `2025-12-31 00:00 GMT-3`. A naive UTC read would put the first instant in January 2025 — the exact bug `date_local` exists to prevent |
| `Intl.DateTimeFormat.formatToParts` shape on the plan-time runtime | `node -e "…formatToParts(new Date('2025-01-24T23:30:00Z'))"` | `[{year,'2025'},{literal,'-'},{month,'01'},{literal,'-'},{day,'24'}]` — parts are addressable by `type`, so the implementation must read by `type` and never by position or locale ordering |
| Data model contract for `amount` (drives the money API shape) | `sed -n '240,275p' docs/project/4-database-model.md` | `amount` is `INTEGER NOT NULL`, "Minor units, **always positive**. Direction comes from `type`" (`debit` \| `credit`). `date_local` is `TEXT NOT NULL`, `YYYY-MM-DD`, used for month grouping |
| Data model contract for the RUT (drives the privacy rules) | `sed -n '96,103p' docs/best-practices/stack/sqlite-drizzle.md` | "Credentials — including **the RUT** … There is no `national_id_value` column, by design". Confirms revision `de4c364`; the RUT is never persisted |
| ESLint wiring the new rules must flow through | `cat eslint.config.mjs apps/mobile/eslint.config.mjs packages/shared-domain/eslint.config.mjs` | Root default-exports the shared flat-config array and named-exports `sharedDomainPurity`. Every workspace config spreads `rootConfig`; `apps/mobile` spreads `rootConfig` then `expoConfig`. A rule added to the root shared array reaches all four workspaces |
| `[correction]` Doc drift found while reading conventions (recorded, not a blocker — see "Known documentation drift") | `sed -n '59,71p' docs/best-practices/stack/expo-react-native.md` | Line 70 says "Formatting lives in `lib/format.ts`"; line 67 says abbreviate "**only** in the stat tiles on `home`", which the `$279K` category rows contradict |
| `[correction]` `docs/best-practices/stack/i18n.md` exists and governs date formatting (corrects a false claim in an earlier draft of this plan) | `ls docs/best-practices/stack/` and `sed -n '1,90p' docs/best-practices/stack/i18n.md` | The file exists (`bank-scraper.md`, `design-tokens.md`, `expo-react-native.md`, `i18n.md`, `mobile-ui-fidelity.md`, `sqlite-drizzle.md`, `turborepo-pnpm.md`, `typescript.md`); it landed in `ecf46ef`. Its "Formatting" section is the authoritative source for this plan's date-vs-money asymmetry: formatters "take the active locale as a parameter and use `Intl`", "Do not hand-write a Spanish month table", Hermes needs full ICU for non-English `Intl` output (verified true below), and for CLP "If the platform output differs, format by hand — the mockup wins, not the platform default." `docs/best-practices/stack/expo-react-native.md` line 64's `[i18n.md](i18n.md)` link resolves correctly; it is not dangling |
| `[correction]` Full-ICU confirmation for `Intl.DateTimeFormat(locale, …)` (the caveat `i18n.md` says to verify rather than assume) | `node -e "…new Intl.DateTimeFormat('es',{day:'numeric',month:'short'}).format(…)"` etc., run at plan time on this repo's Node runtime, cross-checked against the human's confirmed Hermes/RN-0.81.5/Expo-54 finding | `new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date('2025-01-24T12:00:00Z'))` → `'24 ene'`; `('2025-01-05')` → `'5 ene'` (no leading zero, matching Decision 8); `{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }` on `'2025-01-24'` → `'viernes, 24 de enero de 2025'` (the exact mockup literal, already lowercase — no manual lowercasing needed); on `'2024-02-29'` → `'jueves, 29 de febrero de 2024'`; `{ month: 'short', year: 'numeric' }` → `'ene 2025'`. `en` locale produces `'Jan 24'` / `'Friday, January 24, 2025'`. Every value matches the mockup byte-for-byte with no hardcoded table, confirming the human's Hermes-has-full-ICU finding needs no `es` fallback table. Also verified: `Intl.DateTimeFormat('es', { month: 'short' })` renders September as `sept` (four letters) — see Decision 7's width caveat and the Risks table |
| Bounded same-surface PR scope | `gh pr list --state open --json number` and `git worktree list` | `[]` — **no open pull requests in the repository**. Concurrent invocation items are `{#2, #3, #4}`, each in its own worktree (`item-2` on `implementation-plan/2-…`, `item-3` on `spec/3-…`, `item-4` on this branch) |
| Design-asset discovery | Issue #4 body has no `## Design assets` section; no tracker attachments; no `<dev-folder>/assets/` directory | The authoritative visual reference is the repository's own UI contract, `design/mockups/mobile/index.html` (AGENTS.md non-negotiable 6). Fidelity steps in the runbook name it |
| Nested-artifact guard | `run-nested-artifact-guard.sh --mode pre-create --issue 4 --expected-branch implementation-plan/4-shared-utils-clp-dates-rut --approved-base develop` (run by the parent orchestrator before dispatch) | `RESULT=clean`; `validate-branch-reuse.sh` → `RESULT=compatible`. The `pre-pr` run is Implementation-Order-independent and happens immediately before the plan PR is opened |

> **Note on `$156` / `$193` / `$235` / `$279`**: the raw `$…` grep matches the numeric prefix of
> `$156K` / `$193K` / `$235K` / `$279K`. They are abbreviated amounts, not sub-thousand amounts.
> The mockup contains no genuine sub-thousand CLP literal other than `$0`.

> **Note on the mockup RUT check digits**: `12.345.678-9` and `18.456.789-0` are both
> **structurally** correct and **arithmetically** invalid. This is normal for mockup data and the
> implementer must **not** "fix" the mockup — `design/mockups/mobile/` is the UI contract for
> layout and copy, not a fixture of real identities. The invalidity is a gift: it supplies AC2's
> negative vector directly from the UI contract, and its correction (`18.456.789-K`) supplies
> AC2's `K` vector.

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Repository mode / artifact owner | `single_repo` (no `mode` key present) — this repository owns the plan and the plan PR | `.ai-dev-workflow.yaml`: no `mode`, no `workflow_hub`, no `product_repo` section | 2026-08-01T21:20Z, `14b9a9e` | Current invocation items `{#2, #3, #4}`; `gh pr list --state open` → `[]`, so no open PR changes artifact ownership | `Verified` |
| Approved base branch for the plan PR | `develop` | Parent orchestrator handoff for this run; `AGENTS.md` → *Git & Branching* ("spec/plan/feature/fix PRs target `develop`"); the merged bootstrap PR #28 targeted `develop` | 2026-08-01T21:20Z, `14b9a9e` | Current invocation items `{#2, #3, #4}`; no open PR, so nothing is changing branching policy | `Verified` |
| Package identity and dependency graph this plan writes into | `@finanzas/shared-utils`, source-first (`"main": "src/index.ts"`), consumed by `apps/mobile`, `@finanzas/bank-scraper` and `@finanzas/shared-domain` via `workspace:*` | `packages/shared-utils/package.json`; the three consumers' `package.json`; [`../../../project/2-repo-architecture.md`](../../../project/2-repo-architecture.md) lines 91 and 101-103 | 2026-08-01T21:20Z, `14b9a9e` | Same-surface scan across the three active worktrees: item #2 is on `implementation-plan/2-theme-design-system-primitives` (plan stage, no source edits), item #3 is on `spec/3-local-database-schema-migrations-seed-data` (spec stage). Neither branch has a commit touching `packages/shared-utils/` or any `package.json` | `Verified` |
| Files owned by concurrently running items (write-collision surface) | Item #2 owns `apps/mobile/src/theme.ts` and `apps/mobile/src/components/`; item #3 owns `apps/mobile/src/db/`. **This plan writes to none of them** | Parent orchestrator handoff for this run; `git worktree list` | 2026-08-01T21:20Z, `14b9a9e` | Current invocation items `{#2, #3, #4}`; the Files-to-Create/Modify sections below contain no path under those three roots | `Verified` |
| Shared file this plan does modify: root `eslint.config.mjs` | One additive rules entry (`no-restricted-properties` for the `toLocale*` family) plus one new named export (`sharedUtilsPurity`). No rename, no removal, no reordering of existing entries | `eslint.config.mjs` at `14b9a9e`; Decision 11 below | 2026-08-01T21:20Z, `14b9a9e` | No open PR touches `eslint.config.mjs`; items #2 and #3 are both pre-implementation. An additive-only edit merges cleanly even if one of them later appends to the same file | `Verified` |
| Canonical Chilean timezone identifier | `America/Santiago`, exported as `SANTIAGO_TIME_ZONE` | No prior repository value existed (`grep -rn 'America/Santiago\|timezone' docs/ apps/ packages/` → only the `date_local` prose in `docs/project/4-database-model.md` line 23 and `docs/best-practices/stack/sqlite-drizzle.md` lines 92-94). This plan establishes it | 2026-08-01T21:20Z, `14b9a9e` | No open PR and no sibling item defines a timezone constant; item #3's schema work consumes `date_local` as an opaque `TEXT` column and does not need the identifier | `Verified` |

No `Conflict` rows. Nothing in this check blocks implementation.

### Known documentation drift (not an operational-assumption conflict)

Two statements in `docs/best-practices/stack/expo-react-native.md` predate this package and
disagree with the issue brief and the mockup. Per protocol 02, architecture/documentation
statements are **not** cross-cutting operational assumptions, so these are recorded here and
scheduled as documentation updates rather than escalated:

1. **Line 70 — "Formatting lives in `lib/format.ts` and is unit-tested."** Superseded.
   `@finanzas/bank-scraper` depends on `@finanzas/shared-utils` and cannot import from
   `apps/mobile`, so the formatters must live in the package. `apps/mobile/src/lib/format.ts`,
   if it is ever created, is a thin app-only composition layer (for example gluing
   `formatShortDate(...)` and `formatTimeOfDay(...)` into `26 ene · 14:32`) that delegates to
   this package. Authority for the resolution: issue #4 (the tracker item that owns the
   package), `packages/shared-utils/package.json`'s own description, and
   `docs/project/2-repo-architecture.md` lines 91 and 101-103 — three sources against one.
2. **Line 67 — abbreviate "only in the stat tiles on `home`."** The mockup itself shows `$279K`
   on `home`'s category rows (lines 1515-1518), so the abbreviation has two consumer shapes, not
   one. The mockup wins (AGENTS.md non-negotiable 6). The API supports both shapes; the *rule*
   is unchanged, only the enumeration of call sites.

**Correction to an earlier draft of this plan**: that draft additionally claimed "Line 64 —
`[i18n.md](i18n.md)` is a dangling link... does not exist." That was false even when written —
`docs/best-practices/stack/i18n.md` landed in `ecf46ef`, before this plan branch was created —
and it is re-verified false now (Verification Log). The link resolves correctly and is not
listed here. That file's "Formatting" section is in fact the authoritative source this plan
follows for the money/dates asymmetry (Decision 1) and for the date-label `Intl` seam
(Decision 2).

---

## Key Decisions

Each decision below is referenced by index from the Layer-by-Layer, Testing and Implementation
Order sections. Indices are stable within this document.

**Decision 1 — no `Intl` for currency/number formatting; every money string is hand-built and
locale-invariant.** Every numeric separator, the currency symbol and the sign are hard-coded
constants in `money.ts`. Rationale, scoped precisely:
`Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })` returns `$1.200.000` on
full-ICU Node, but its output for the locale tags this app actually renders under (`es`, `en` —
not `es-CL`) is not guaranteed to match
the mockup, and `Intl.NumberFormat.prototype.formatToParts` is unimplemented on iOS Hermes
(`llvm_unreachable` at call time) — a device-verified finding from this correction's brief, not
reproducible from this plan's Node-based verification environment, and recorded as its own row in
the Risks table below because it rules out one specific alternative design (assembling a money
string from `Intl.NumberFormat.formatToParts` output instead of hand-building it) rather than
merely motivating the chosen one. `docs/best-practices/stack/i18n.md`'s own rule for this exact
situation is: "If the platform output differs, format by hand — the mockup wins, not the platform
default." That is the standard this decision applies,
not a blanket claim that `Intl` is broken or unusable. `Intl.NumberFormat` also takes a `number`,
which is exactly the float surface AGENTS.md non-negotiable 2 forbids. Hand-built strings are
therefore the only way to guarantee the mockup's money literals byte-for-byte on every device,
**and they are deliberately locale-invariant** — CLP has one accepted rendering (`$1.200.000`)
regardless of whether the active app locale is `es` or `en`, so `formatClp` and
`formatClpAbbreviated` take no `locale` parameter. This also satisfies AC4 in spirit, not just in
letter.

**This decision does not extend to dates.** `Intl.DateTimeFormat` does not disagree with the
mockup (Decision 2 verifies this directly), so date labels are the opposite case: they use
`Intl`, parameterised by locale, precisely because `i18n.md` forbids a hardcoded Spanish table
("hardcoding one leaves Spanish dates under an English UI") and because Hermes on RN 0.81.5 /
Expo 54 has been confirmed to carry full ICU, so no fallback table is needed. The asymmetry
between money (hand-built, locale-invariant) and dates (`Intl`-built, locale-parameterised) is
deliberate and is the point of this decision, not an inconsistency for a reviewer to flag.

**Decision 2 — two narrow `Intl` seams: one for timezone fields, one for locale-parameterised
date labels.** Both are cached, capability-checked, and read structured output by `type`/field
rather than by parsing a rendered string, so neither is `toLocaleString` and AC4 is unaffected by
either; the Implementation Order records the distinction so a reviewer does not read this as a
violation.

- **Timezone seam.** `deriveZonedParts(instant, timeZone)` uses
  `Intl.DateTimeFormat('en-US', { timeZone, year, month, day, hour, minute, hourCycle: 'h23' }).formatToParts(instant)`
  and reads the `year` / `month` / `day` / `hour` / `minute` parts **by
  `type`**, never by position and never by parsing a formatted string. It returns integers, not
  copy, and takes no `locale` parameter — the fixed `'en-US'` tag is an internal implementation
  detail used only to get stable, ASCII, `2-digit`/`numeric` part values out of `formatToParts`;
  it has no bearing on what the caller sees. Rationale: converting a UTC instant to a Chilean
  wall-clock date requires the IANA timezone database. Hand-rolling Chile's DST rules is not
  maintainable — the transition dates have been changed by decree repeatedly (2015, 2016, 2019,
  2022) and the Magallanes region does not follow the continental rule at all. `formatToParts` is
  the standard, DST-database-backed way to do this.
- **Date-label seam.** `formatShortDate`, `formatLongDate`, `formatMonthYear` and
  `formatMonthAbbreviation` each take `locale: SupportedLocale` (`'es' | 'en'`) as a required
  parameter and call a cached
  `Intl.DateTimeFormat(locale, { day, month, weekday?, year?, timeZone: 'UTC' }).format(civilDateAsUtcMidnightInstant)`
  directly — reading the **rendered
  string**, not parts, because the whole rendered string (with its Spanish or English
  month/weekday name) is the desired output, not a value to extract. `timeZone: 'UTC'` is
  explicit and non-optional here: the underlying civil date is UTC-anchored (Decision 3), so the
  instant handed to this formatter is `Date.UTC(year, month - 1, day)`, and without a pinned
  `timeZone` the formatter would fall back to the *host* system timezone, which Group E's hostile
  `Pacific/Kiritimati` test would then be able to shift onto an adjacent day. Pinning `'UTC'`
  keeps this seam as deterministic under a hostile host timezone as the civil-date arithmetic it
  formats. Verified at plan time (Verification Log) against both `es` and `en`: every mockup date
  literal reproduces byte-for-byte, already lowercase for `es`, with no hardcoded month or
  weekday table (Decision 7 replaces the earlier table-based design).

**Decision 3 — all calendar arithmetic is UTC civil-date math, so period boundaries are
DST-immune by construction.** Period boundaries are `YYYY-MM-DD` strings (`DateLocal`), matching
the `date_local` column that the app actually groups and filters on
(`docs/best-practices/stack/sqlite-drizzle.md` lines 92-94). Month lengths, leap years,
day-of-week and day addition are computed with `Date.UTC(...)` and `getUTCDay()` /
`getUTCDate()`. UTC has no offset transitions, so no boundary computation can be perturbed by
DST. This is what makes AC3 ("period boundaries correct across month ends and DST") provable
rather than hopeful: month-end correctness is tested directly on civil dates, and DST exposure is
confined to Decision 2's timezone seam (`deriveZonedParts`, and `deriveDateLocal` /
`formatTimeOfDay` which call it), which is tested at the exact 2025 transition instants.
Decision 2's date-label seam is `timeZone: 'UTC'`-pinned and therefore carries no DST exposure at
all — it depends only on `locale`. Consequence: `deriveZonedParts`, `deriveDateLocal` and
`formatTimeOfDay` are the **only** functions in `dates.ts` whose output can depend on a real
(non-`'UTC'`) timezone; the date-label formatters depend only on `locale`.

**Supported year range, and why `Date.UTC`'s legacy two-digit-year remap does not corrupt it.**
`Date.UTC(year, …)` (and `new Date(year, …)`) has a well-known ECMA-262 legacy behaviour: any
`year` from `0` to `99` is silently remapped to `1900 + year` — confirmed at plan time
(Verification Log): `Date.UTC(50, 0, 1)` produces the instant for `1950-01-01`, not `0050-01-01`.
This item calls `Date.UTC` in `formatShortDate`, `formatLongDate`, `getMonthPeriod` and
`getWeekPeriod` (Code Samples, below), so an unvalidated two-digit `DateLocal` year would silently
render or bucket transactions under the wrong century. The fix is validation, not a `Date.UTC`
workaround: `isValidDateLocal` (and therefore `parseDateLocal`, which throws `RangeError` on
anything `isValidDateLocal` rejects) restricts the supported `DateLocal` year to **`0100`-`9999`**,
which subsumes the existing rejection of `'0000'` and additionally rejects every two-digit year
`'0001'`-`'0099'` that `Date.UTC` would remap. Years `100`-`9999` are unaffected by the remap —
confirmed at plan time that `Date.UTC(100, 0, 1)` through `Date.UTC(9999, 0, 1)` all round-trip to
the literal year passed in — so no correction to any `Date.UTC` call site is needed; the guard
lives entirely at the shared `DateLocal` parsing boundary, once, rather than duplicated at every
call site. This is also the correct scope for the domain: bank transactions the app ever ingests
carry a real, recent calendar year, so restricting `DateLocal` to a four-digit year in the
`100`-`9999` range is simpler and safer than teaching every `Date.UTC` call site to correct for a
quirk no real transaction date will ever trigger.

**Arithmetic self-consistency at the range boundary.** The `0100`-`9999` floor above is a
*parsing*-boundary guard on a directly-constructed or parsed `DateLocal`; it does not, by itself,
guarantee that a *derived* `DateLocal` — the result of `addDays`, `getWeekPeriod`,
`getMonthPeriod`, `shiftMonthPeriod` or `shiftWeekPeriod` — stays inside that same range.
`getWeekPeriod('0100-01-01')` (a Friday) must walk back to the preceding Monday-start, which lands
on `0099-12-28`; `addDays('0100-01-01', -1)` has the identical problem. Symmetrically,
`addDays('9999-12-31', 1)` and `getWeekPeriod('9999-12-31')` cross into the five-digit year
`10000`. Without a fix, each of these would return a `DateLocal` string that `isValidDateLocal`
itself rejects — a function documented to return `DateLocal` silently breaking its own contract.
The fix reuses the same one-guard-not-many principle as the parsing side: `toDateLocal` — the
single construction point every `DateLocal`-returning function in this file routes through —
throws `RangeError` if the year it is asked to render falls outside `0100`-`9999`. `addDays`,
`getWeekPeriod`, `shiftMonthPeriod` and `shiftWeekPeriod` therefore all throw `RangeError` (never
silently clamp, wrap or return an out-of-range string) whenever the arithmetic would cross either
edge; `getMonthPeriod` cannot cross the boundary on its own because it never changes the input's
year. This is the correct behaviour for the domain, not merely the cheapest one: bank transactions
the app ever ingests carry a real, recent calendar year, so a caller reaching either edge (a period
computation anchored on a `0100` or `9999` transaction date) already indicates a bug upstream, and
failing loudly there is strictly better than silently returning a value the package's own validator
would reject. The Testing Strategy's AC3 Group B addendum and `dates.test.ts` cover both edges
explicitly (`addDays('0100-01-01', -1)`, `getWeekPeriod('0100-01-01')`, `addDays('9999-12-31', 1)`,
`getWeekPeriod('9999-12-31')`), alongside an in-range low-year case
(`getWeekPeriod('0100-01-05')` → `{ '0100-01-01', '0100-01-07' }`) proving the guard fires only at
the actual boundary, not for every low-year input.

**Decision 4 — the money sign is one total rule, not three special cases.** For both
`formatClp` and `formatClpAbbreviated`:

```text
sign = signDisplay === 'never'   -> ''
     | amountMinorUnits < 0      -> '−'   (U+2212 MINUS SIGN)
     | amountMinorUnits === 0    -> ''
     | direction === 'in'        -> '+'
     | otherwise                 -> ''
```

Defaults are `direction: 'neutral'` and `signDisplay: 'directional'`, which reproduce the
mockup's design-system card verbatim (`--in` → `+$2.500.000`, `--out` → `$35.000`, line 2567:
"Ingresos con signo `+`; gastos sin signo"). `signDisplay: 'never'` is the opt-out used by the
aggregate rows that are styled `--in` but carry no `+` (mockup lines 1195, 1864, 2065). Zero is
never signed, so a `+$0` can never be produced. U+2212 is chosen for negatives because it is the
character the mockup already uses for negative values (`−12%`, `−55%`); a hyphen-minus would be
visually inconsistent within the same screen.

**Decision 5 — negative amounts are legal input, non-integers are not.** The `transactions.amount`
column is always positive and direction lives in `type`, but a computed *balance*
(`ingresos − gastos`, mockup's "Balance del mes") can legitimately be negative and must render
as `−$500.000`. So `formatClp` accepts the whole safe-integer range. It **throws `TypeError`**
when the input is not a safe integer (`1200.5`, `NaN`, `Infinity`, `1e21`, a `string`).
Rationale: a fractional peso means a float leaked into the money pipeline — the precise failure
AGENTS.md non-negotiable 2 exists to prevent — and silently rounding it would hide the leak
behind a plausible-looking amount. To keep a throw out of the render path, the package also
exports the non-throwing guard `isValidMoneyMinorUnits(value): value is number`
(`typeof value === 'number' && Number.isSafeInteger(value)`), which is the check item #2's
`Amount` component uses at its prop boundary. Money error messages **may** include the offending
value (it is not credential material); RUT error messages may not (Decision 9).

**Decision 6 — abbreviation tiers: `K` with zero decimals, `M` with exactly one.** Derived from
the mockup, not invented: `$279K` (`279_000`), `$235K`, `$193K`, `$156K` carry no decimal, while
`3.7M` (`3_700_000`), `1.4M` (`1_352_470`) and `+2.3M` (`2_347_530`) carry exactly one. Rules:

- `|v| < 1_000` → plain integer, no suffix (`500` → `500`).
- `1_000 ≤ |v| < 1_000_000` → `K`, magnitude rounded half-up to whole thousands.
- `|v| ≥ 1_000_000` → `M`, magnitude rounded half-up to tenths of a million, tenth **always**
  rendered including `.0` (`4_000_000` → `4.0M`) so stat-tile widths stay stable.
- **Promotion**: if `K` rounding reaches `1000`, re-render in the `M` tier (`999_500` → `1.0M`),
  never `1.000K`.
- The numeral inside an abbreviation is **never** thousands-grouped, because in `3.7M` the `.` is
  a decimal point while in `$1.200.000` the same character is a thousands separator. Grouping
  `1_000_000_000` as `1.000,0M` would collide the two meanings; it renders `1000.0M`. This
  ambiguity is inherited from the UI contract, not introduced here.

Rounding is half-up on the **magnitude**, so overall it is half-away-from-zero. It is computed by
an internal `divideRoundHalfUp(numerator, denominator)` that stays **exact across the full
safe-integer range**, not just "well below `2^53`": `formatClpAbbreviated` accepts every
`amountMinorUnits` that `formatClp` does (Decision 5), so `numerator` can reach
`Number.MAX_SAFE_INTEGER`, and at that magnitude `numerator + Math.floor(denominator / 2)` (with
`denominator = 100_000` for the `M` tier) already exceeds `Number.MAX_SAFE_INTEGER` — confirmed at
plan time (Verification Log): `Number.MAX_SAFE_INTEGER * 10` as a plain `Number` is stored as
`90071992547409900`, not the exact `90071992547409910`, so a naive `Number`-only implementation is
not guaranteed correct at the top of the range. `divideRoundHalfUp` is therefore implemented over
`BigInt`: `Number((BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator))`.
`denominator` is always one of the two compile-time constants used by this item — `1_000` (`K`
tier) or `100_000` (`M` tier), both even, so `BigInt(denominator) / 2n` is itself exact integer
division with no remainder to lose — and `BigInt` division on non-negative operands truncates
toward zero, which is floor for non-negative values, matching the original `Math.floor` semantic
exactly. The final `BigInt` quotient is always far below `2^53` (at most `90_071_992_547` for the
largest possible `M`-tier input), so converting it back with `Number(...)` is exact too. No
`Math.round` on a float ratio, no `toFixed`.

**Decision 7 — month, weekday and month-abbreviation names come from
`Intl.DateTimeFormat(locale, …)`, not a hardcoded table.** There is no `MONTH_ABBREVIATIONS_ES` constant, no
`MONTH_NAMES_ES`/`WEEKDAY_NAMES_ES` table, and no parallel mechanism next to Decision 2's
timezone seam — the date-label formatters *are* the seam that produces these names, for whichever
`locale` the caller passes. This directly follows `docs/best-practices/stack/i18n.md`'s rule
against hand-writing a Spanish month table ("hardcoding one leaves Spanish dates under an English
UI") and the human's confirmed finding that Hermes on RN 0.81.5 / Expo 54 carries full ICU, so no
`es` fallback table is needed behind the locale-parameterised signature. Verified at plan time
(Verification Log) against `es`: `Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' })`
reproduces the mockup's three abbreviation samples exactly — `ene`, `nov`, `dic`, three letters,
lowercase, no trailing period — and
`Intl.DateTimeFormat('es', { weekday: 'long', month: 'long', … })` reproduces `viernes` / `enero`
in `viernes, 24 de enero de 2025`, all lowercase, with no manual case transformation required.

**Known width caveat, recorded rather than worked around.** The same plan-time probe shows
`Intl.DateTimeFormat('es', { month: 'short' })` renders September as `sept` (four letters), not
the three-letter `sep` a hand-built table might have chosen. The mockup contains no September
sample, so this is not a byte-for-byte mismatch against a literal — but the superseded table-based
design's rationale for choosing `sep` was "every month has identical width" in the `.mu-bars__lbl`
chart-bar row. Re-checked against the mockup's own CSS:
`.mu-bars__lbl { font-size: 10px; color: var(--t3); }` (`design/mockups/mobile/index.html` line
494) declares no fixed width, no
`white-space: nowrap`, and no monospace font — it is a normal flow label, so a four-letter
September abbreviation does not violate any layout constraint the mockup actually imposes. This
item accepts `Intl`'s locale-provided abbreviation as-is rather than reintroducing a hardcoded
table to force three-letter uniformity, which would recreate the defect this correction removes.

**Decision 8 — days are rendered without a leading zero.** `formatShortDate('2025-01-05', 'es')` →
`5 ene`, and `formatLongDate('2025-01-05', 'es')` → `domingo, 5 de enero de 2025`. The mockup contains
no single-digit-day sample (Verification Log), so this is a decision, not an observation from the
mockup — but with Decision 7's move to `Intl.DateTimeFormat(locale, { day: 'numeric', … })`, it is
no longer a hand-picked convention either: `day: 'numeric'` (as opposed to `day: '2-digit'`) is
what produces no leading zero, and the plan-time probe (Verification Log) confirms
`'2025-01-05'` → `'5 ene'` under that option directly. Spanish convention writes `5 de enero`, not
`05 de enero`, and `formatLongDate`'s only mockup sample (`24 de enero`) is consistent with either
reading. Recorded explicitly, with the exact `Intl` option that produces it, so a reviewer can
challenge it cheaply by naming the one option to flip (`day: '2-digit'`) rather than by editing a
hardcoded table.

**Decision 9 — the RUT helpers are non-persisting, non-logging, and value-free in errors.** All
four RUT functions are pure `string -> string | boolean`. They perform no I/O, keep no
module-level cache keyed on a RUT, and every thrown error message is a fixed constant string
that does **not** interpolate the input (`throw new TypeError('formatRut: malformed RUT input')`,
never `` `invalid RUT: ${input}` ``). Rationale: AGENTS.md non-negotiable 1 and data-model
revision `de4c364` — the RUT is half of the bank login and must never reach a log line or an
error payload. This is enforced three ways: a unit test asserting no thrown message contains any
input substring, `'no-console': 'error'` for this workspace (Decision 11), and the fact that the
functions have no writable surface at all.

**Decision 10 — RUT validation is a typo filter, not a registry.** `isValidRut` normalizes,
strips leading zeros from the body, then requires the body to match `^[1-9][0-9]{5,7}$` (6-8
significant digits) and the check digit to match `^[0-9K]$` after upper-casing, before running
modulo-11. Rationale: the RUT is the bank **login**; a validator that is stricter than reality
locks a real user out of the product, which is a worse failure than passing a malformed value
that the bank will reject anyway. 8 digits covers every modern natural-person and company RUT,
6-7 covers legacy short ones; below 6 is certainly a typo. Leading zeros are stripped because
`07.123.456-8` is a common hand-entry and, since modulo-11 weights from the right, stripping them
cannot change the result. Critically, `formatRut` does **not** check the check digit — the mockup
renders `18.456.789-0` (an arithmetically invalid RUT) in the `error` state, so formatting must
work on values that fail validation.

The check-digit algorithm: multiply the body digits right-to-left by the repeating weight cycle
`2,3,4,5,6,7`; sum; `r = 11 − (sum mod 11)`; `r === 11` → `'0'`, `r === 10` → `'K'`, otherwise
`String(r)`.

**Decision 11 — AC4 becomes a lint rule, not a grep.** The root `eslint.config.mjs` shared array
gains a `no-restricted-properties` entry banning `toLocaleString`, `toLocaleDateString` and
`toLocaleTimeString` on any object, with a message pointing at `@finanzas/shared-utils`. Its
`files` glob is `**/*.{ts,tsx,js,jsx,mjs,cjs}`, not `**/*.{ts,tsx}` — narrower would leave the rule
covering less than the AC4 residual scan and the changelog claim, both of which include `.js`
(Testing Strategy `AC4 baseline` row), and the repo already has real, committed `.js` files this
rule must reach. Because every workspace config spreads `rootConfig` (verified above), the ban
reaches `apps/mobile`, `shared-domain`, `shared-utils` and `bank-scraper` in one edit. The root file additionally gains a
new named export `sharedUtilsPurity` — a `no-restricted-imports` block mirroring the existing
`sharedDomainPurity` shape and additionally banning `react`, `react-*` and the Node I/O builtins
— which `packages/shared-utils/eslint.config.mjs` applies, mechanically enforcing brief rule 3
(no React, no SQL, no `expo-*`, no I/O). That workspace config also raises `no-console` from the
root's `'warn'` to `'error'` (Decision 9). The existing `sharedDomainPurity` export is **not**
renamed and `packages/shared-domain/eslint.config.mjs` is **not** touched: an additive-only edit
cannot conflict with concurrent items #2 and #3.

**Decision 12 — `formatTimeOfDay` is a deliberate, small scope addition.** The issue's date scope
lists `date_local` derivation, period boundaries and Spanish labels; it does not list time. But
the transaction rows render `26 ene · 14:32`, and producing `14:32` needs exactly the same
timezone seam as `deriveDateLocal`. Adding a five-line `formatTimeOfDay(instant, timeZone)` that
reuses the cached formatter from Decision 2 costs one test group and prevents a later item from
building a second, differently-behaved `Intl` seam inside `apps/mobile`. Flagged explicitly so a
reviewer can strike it cheaply if they disagree. The ` · ` separator itself is **not** in scope —
it is markup-level composition owned by the calling component.

**Decision 13 — explicit scope boundaries.** The following are **out of scope** and no code is
written for them:

- **Percent formatting** (`−12%`, `−55%`). The issue scopes "CLP formatting"; percentages are
  not currency, use a decimal comma (`20,6%`), and belong to whichever item builds the dashboard
  deltas. Only the U+2212 character choice is borrowed (Decision 4).
- **CLP parsing** (string → integer). `docs/best-practices/STACK-SPECIFIC.md` places bank-string
  parsing inside the scraper's parser; adding a second parser here would create two places that
  can disagree about a bank's number format.
- **Copy catalogues.** AGENTS.md non-negotiable 8 puts user-facing copy in
  `apps/mobile/src/i18n/`. This package owns locale *format primitives* (separators, month and
  weekday tables) — the structural vocabulary a formatter needs — not sentences. The two
  surfaces do not overlap, and `bank-scraper` (which has no i18n catalogue) proves the primitives
  cannot live in the app.
- **The ` · ` composition** in `26 ene · 14:32` (Decision 12).

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **No change.** This item writes no schema, no migration and no query. It supplies
      `deriveDateLocal`, which item #3 and the scraper will call to *produce* the `date_local`
      value, but it neither reads nor writes SQLite. `apps/mobile/src/db/` is owned by
      concurrently running item #3 and is not touched.

### Backend / API

- [ ] **Not applicable.** There is no backend (AGENTS.md: "There is no backend").

### Shared Packages / Libraries

All source changes are inside `packages/shared-utils/`.

- [ ] `src/money.ts` — CLP formatting. Public surface (Decisions 4, 5, 6):

  | Export | Signature | Returns |
  | --- | --- | --- |
  | `MoneyDirection` | `type MoneyDirection = 'in' \| 'out' \| 'neutral'` | — |
  | `MoneySignDisplay` | `type MoneySignDisplay = 'directional' \| 'never'` | — |
  | `FormatClpOptions` | `interface FormatClpOptions { direction?: MoneyDirection; signDisplay?: MoneySignDisplay }` | — |
  | `FormatClpAbbreviatedOptions` | `interface FormatClpAbbreviatedOptions extends FormatClpOptions { withCurrencySymbol?: boolean }` | — |
  | `CLP_CURRENCY_SYMBOL` | `const CLP_CURRENCY_SYMBOL = '$'` | — |
  | `CLP_THOUSANDS_SEPARATOR` | `const CLP_THOUSANDS_SEPARATOR = '.'` | — |
  | `MINUS_SIGN` | `const MINUS_SIGN = '−'` (U+2212) | — |
  | `isValidMoneyMinorUnits` | `(value: unknown) => value is number` | `true` iff a safe integer |
  | `formatThousands` | `(value: number) => string` | `1200000` → `1.200.000`. Requires a **non-negative** safe integer; throws `TypeError` otherwise. Sign handling belongs to `formatClp` |
  | `formatClp` | `(amountMinorUnits: number, options?: FormatClpOptions) => string` | `$1.200.000`, `+$1.200.000`, `−$500.000`, `$0` |
  | `formatClpAbbreviated` | `(amountMinorUnits: number, options?: FormatClpAbbreviatedOptions) => string` | `3.7M`, `+2.3M`, `$279K` |

  Defaults: `direction: 'neutral'`, `signDisplay: 'directional'`, `withCurrencySymbol: false`.
  Internal, not exported: `divideRoundHalfUp(numerator, denominator)` (Decision 6).

- [ ] `src/dates.ts` — `date_local` derivation, period boundaries, Spanish labels
      (Decisions 2, 3, 7, 8, 12):

  | Export | Signature | Returns |
  | --- | --- | --- |
  | `DateLocal` | `type DateLocal = string` (documented as `YYYY-MM-DD`, supported year range `0100`-`9999` — Decision 3) | — |
  | `SupportedLocale` | `type SupportedLocale = 'es' \| 'en'` | The app's two supported locales (`docs/best-practices/stack/i18n.md`); no formatter accepts a wider string |
  | `CivilDate` | `interface CivilDate { year: number; month: number; day: number }` (`month` is 1-12) | — |
  | `ZonedParts` | `interface ZonedParts { year: number; month: number; day: number; hour: number; minute: number }` | — |
  | `Period` | `interface Period { start: DateLocal; end: DateLocal }` (both **inclusive**) | — |
  | `SANTIAGO_TIME_ZONE` | `const SANTIAGO_TIME_ZONE = 'America/Santiago'` | — |
  | `deriveZonedParts` | `(instant: Date, timeZone?: string) => ZonedParts` | The timezone `Intl` call site (Decision 2) |
  | `deriveDateLocal` | `(instant: Date, timeZone?: string) => DateLocal` | `2025-01-24` |
  | `formatTimeOfDay` | `(instant: Date, timeZone?: string) => string` | `14:32` (24-hour, zero-padded). Numeric only, so it takes no `locale` |
  | `isValidDateLocal` | `(value: string) => boolean` | Shape, calendar validity, **and** the `0100`-`9999` year range (Decision 3 — rejects the two-digit years `Date.UTC` would remap) |
  | `parseDateLocal` | `(dateLocal: DateLocal) => CivilDate` | Throws `RangeError` on an invalid date |
  | `toDateLocal` | `(civil: CivilDate) => DateLocal` | Zero-pads month and day. Throws `RangeError` if `civil.year` falls outside `0100`-`9999` — the single construction-side guard every `DateLocal`-returning function in this file routes through (Decision 3) |
  | `addDays` | `(dateLocal: DateLocal, days: number) => DateLocal` | Signed. Throws `RangeError` (via `toDateLocal`) if the result's year would fall outside `0100`-`9999` (Decision 3) |
  | `getMonthPeriod` | `(dateLocal: DateLocal) => Period` | `2025-01-24` → `{ start: '2025-01-01', end: '2025-01-31' }`. Never crosses the `0100`-`9999` boundary on its own — it never changes the input's year (Decision 3) |
  | `getWeekPeriod` | `(dateLocal: DateLocal) => Period` | Monday-start. `2025-01-24` (Fri) → `{ start: '2025-01-20', end: '2025-01-26' }`. Throws `RangeError` (via `addDays`) if walking back to Monday or forward to Sunday would cross `0100`-`9999` (Decision 3) |
  | `shiftMonthPeriod` | `(period: Period, months: number) => Period` | Drives the mockup's `‹ ›` month nav. Throws `RangeError` (via `toDateLocal`) if the shifted month's year would fall outside `0100`-`9999` (Decision 3) |
  | `shiftWeekPeriod` | `(period: Period, weeks: number) => Period` | Drives the `S-1` / `S-2` chart columns. Throws `RangeError` (via `addDays`) if the shifted week would cross `0100`-`9999` (Decision 3) |
  | `formatShortDate` | `(dateLocal: DateLocal, locale: SupportedLocale) => string` | `24 ene` (`es`) / `Jan 24` (`en`) — the label `Intl` seam (Decision 2) |
  | `formatLongDate` | `(dateLocal: DateLocal, locale: SupportedLocale) => string` | `viernes, 24 de enero de 2025` (`es`) / `Friday, January 24, 2025` (`en`) |
  | `formatMonthYear` | `(dateLocal: DateLocal, locale: SupportedLocale) => string` | `ene 2025` (`es`) / `Jan 2025` (`en`) |
  | `formatMonthAbbreviation` | `(dateLocal: DateLocal, locale: SupportedLocale) => string` | `ene` (`es`) / `Jan` (`en`) |

  `timeZone` defaults to `SANTIAGO_TIME_ZONE` in the three instant-taking functions
  (`deriveZonedParts`, `deriveDateLocal`, `formatTimeOfDay`); `locale` has **no default** on the
  four date-label formatters — every call site (item #2's UI layer, driven by
  `apps/mobile/src/i18n/`) must pass it explicitly, so a future call site cannot silently render
  Spanish under an English UI or vice versa. Internal, not exported: the
  `Map<string, Intl.DateTimeFormat>` formatter cache (keyed on the full options set, so the
  timezone seam and the four label formatters do not collide in the same cache entry), and
  nothing else — there is no hardcoded month, day or weekday table (Decision 7). `shiftMonthPeriod`
  throws `RangeError` if `period.start` is not the first of a month; because
  it always anchors on day 1 it needs no end-of-month clamping.

- [ ] `src/rut.ts` — normalization, modulo-11 validation, display formatting
      (Decisions 9, 10):

  | Export | Signature | Returns |
  | --- | --- | --- |
  | `normalizeRut` | `(input: string) => string` | Strips `.`, `-` and all Unicode whitespace, upper-cases. `12.345.678-5` → `123456785`. Does **not** validate |
  | `computeRutCheckDigit` | `(bodyDigits: string) => string` | `'12345678'` → `'5'`. Throws `TypeError` (value-free) on non-digit input |
  | `isValidRut` | `(input: string) => boolean` | Never throws — returns `false` for any malformed input |
  | `formatRut` | `(input: string) => string` | `123456789` → `12.345.678-9`. Throws `TypeError` (value-free) on structurally malformed input. Does **not** check the check digit |

- [ ] `src/index.ts` — keep `export const PACKAGE_NAME = '@finanzas/shared-utils';` **verbatim**
      (`apps/mobile/src/__tests__/workspace-wiring.test.ts` asserts on it), and add
      `export * from './money';`, `export * from './dates';`, `export * from './rut';`.
      These are intra-package relative imports, which AGENTS.md non-negotiable 9 permits; the
      rule forbids *cross*-package relative imports.

- [ ] `packages/shared-utils/eslint.config.mjs` — apply `sharedUtilsPurity` and raise
      `no-console` to `'error'` (Decision 11).

- [ ] `packages/shared-utils/package.json` — **no change.** No dependency is added; the package
      stays dependency-free.

### Frontend / UI

- [ ] **No component is created or modified by this item.** The consumption seam for item #2's
      `Amount` primitive is specified below and in the runbook, but the component itself is item
      #2's. `apps/mobile/src/theme.ts`, `apps/mobile/src/components/` and `apps/mobile/src/db/`
      are not touched.

**Consumption seam for item #2's `Amount` primitive.** `Amount` renders a formatted CLP string
and applies the `--in` / `--out` colour token; it must not build the string itself. The intended
call is a direct pass-through of its own props:

```tsx
// Illustrative — adapt during implementation (item #2, not this item)
const text = abbreviated
  ? formatClpAbbreviated(amountMinorUnits, { direction, signDisplay, withCurrencySymbol })
  : formatClp(amountMinorUnits, { direction, signDisplay });
```

The seam contract this item guarantees:

1. `MoneyDirection` (`'in' | 'out' | 'neutral'`) maps 1:1 onto the mockup's `mu-amount--in`,
   `mu-amount--out` and bare `mu-amount` classes, so `Amount` can use the same prop for the
   string and for the colour token — no second vocabulary.
2. Both formatters are **total** over valid input and never return a `number`, never return
   `undefined`, and never emit a decimal separator in the non-abbreviated form.
3. `isValidMoneyMinorUnits` is exported so `Amount` can guard its prop at the boundary instead of
   wrapping a render in `try`/`catch` (Decision 5).
4. Defaults are chosen so that `formatClp(v, { direction })` alone already reproduces the
   design-system card (Decision 4); `Amount` only needs to pass `signDisplay: 'never'` for the
   aggregate rows at mockup lines 1195, 1864 and 2065.

### Infrastructure / Configuration

- [ ] Root `eslint.config.mjs` — add the `no-restricted-properties` `toLocale*` ban to the
      shared array, and add the `sharedUtilsPurity` named export (Decision 11). **Additive
      only**: no existing entry is renamed, removed or reordered.

---

## Files to Create

| File | Purpose |
| --- | --- |
| `packages/shared-utils/src/money.ts` | CLP formatting (Decisions 4, 5, 6) |
| `packages/shared-utils/src/money.test.ts` | AC1 — Groups A-E |
| `packages/shared-utils/src/dates.ts` | `date_local` derivation, period boundaries, es-CL labels (Decisions 2, 3, 7, 8, 12) |
| `packages/shared-utils/src/dates.test.ts` | AC3 — Groups A-G, plus the `DateLocal` parser-risk enumeration |
| `packages/shared-utils/src/rut.ts` | Normalization, modulo-11 validation, display formatting (Decisions 9, 10) |
| `packages/shared-utils/src/rut.test.ts` | AC2 — Groups A-F, plus the RUT parser-risk enumeration |
| `docs/testing/mobile/4-shared-utils-clp-dates-rut.smoke-test.md` | Smoke runbook (created by this plan PR) |

## Files to Modify

| File | Change | Owner check |
| --- | --- | --- |
| `packages/shared-utils/src/index.ts` | Add three `export *` lines; keep `PACKAGE_NAME` byte-identical | This item |
| `packages/shared-utils/src/index.test.ts` | Add the barrel-surface test (Implementation Order Step 7) | This item |
| `packages/shared-utils/eslint.config.mjs` | Apply `sharedUtilsPurity`; raise `no-console` to `'error'` (Decision 11) | This item |
| `eslint.config.mjs` (root) | **Additive only** — one `no-restricted-properties` entry and one new named export (Decision 11) | Shared file; no open PR touches it (Verification Log) |
| `CHANGELOG.md` | One `[Unreleased]` → `### Added` entry (Implementation Order Step 12) | Shared file; merge conflicts are resolved by protocol 94 |
| The five docs in **Documentation Updates** | See that section | This item |

**Explicitly not modified**: `apps/mobile/src/theme.ts` and `apps/mobile/src/components/`
(owned by concurrently running item #2), `apps/mobile/src/db/` (owned by item #3),
`packages/shared-domain/eslint.config.mjs` and the `sharedDomainPurity` export (Decision 11
deliberately leaves them alone), `packages/shared-utils/package.json` (no dependency is added),
and `design/mockups/` (the UI contract is read, never edited — including its intentionally
invalid RUT check digits).

`apps/mobile/src/__tests__/workspace-wiring.test.ts` is touched **only** by the temporary,
never-committed lint probes in Implementation Order Step 6.

---

## Testing Strategy

**Test types**: Unit (Jest + ts-jest, `packages/shared-utils`) only, plus a command-line smoke
runbook. There is no UI, no database, no network and no async surface in this item, so there is
nothing for an integration or device-E2E tier to cover.

**Test files** (all new, all under `packages/shared-utils/src/`):
`money.test.ts`, `dates.test.ts`, `rut.test.ts`, plus an extension of the existing
`index.test.ts`.

**Key scenarios to test**:

1. Every money literal in the UI contract round-trips from its integer minor units (**AC1**).
2. Money boundary behaviour: zero, negatives, non-integers, non-numbers (**AC1**).
3. Abbreviation tiers and rounding, including tier promotion (**AC1**).
4. RUT check digit: correct accepted, wrong rejected, `K`/`k` accepted (**AC2**).
5. RUT normalization and display formatting over messy input (**AC2**).
6. RUT privacy: no thrown message contains the input (**AC2**, AGENTS.md non-negotiable 1).
7. Month and week period boundaries across every month-end shape (**AC3**).
8. `deriveDateLocal` across both 2025 Chile DST transitions and both year boundaries (**AC3**).
9. Determinism under a hostile host timezone (**AC3**).
10. Spanish label exactness against the mockup (**AC3**, AGENTS.md non-negotiable 6).
11. `toLocaleString` absence is lint-enforced, not just currently true (**AC4**).
12. The public surface is reachable through the package entry point.

### AC1 — Money functions exhaustively unit-tested, including zero, negative input and rounding

`packages/shared-utils/src/money.test.ts`.

**Group A — every mockup literal (`formatClp`).** One `it` per row; each asserts an exact string.

| Input | Options | Expected | Mockup anchor |
| --- | --- | --- | --- |
| `0` | — | `$0` | `mu-amount">$0<` |
| `42000` | `{ direction: 'out' }` | `$42.000` | `mu-tx__amount">$42.000<` |
| `35000` | `{ direction: 'out' }` | `$35.000` | DS card line 2565 |
| `46700` | — | `$46.700` | `mu-amount mu-mt1` |
| `60200` | — | `$60.200` | `mu-amount` |
| `412000` | `{ direction: 'out' }` | `$412.000` | `mu-amount--out` |
| `508400` | — | `$508.400` | `mu-amount` |
| `1200000` | `{ direction: 'in' }` | `+$1.200.000` | line 1532 |
| `2500000` | `{ direction: 'in' }` | `+$2.500.000` | DS card line 2564 |
| `1200000` | `{ direction: 'in', signDisplay: 'never' }` | `$1.200.000` | line 1195 (hero, `--in`, unsigned) |
| `1352470` | `{ direction: 'out' }` | `$1.352.470` | `mu-amount--out` |
| `1842300` | — | `$1.842.300` | `mu-amount` |
| `3700000` | `{ direction: 'in', signDisplay: 'never' }` | `$3.700.000` | line 1864 |
| `32100000` | `{ direction: 'out' }` | `$32.100.000` | `mu-amount--out` |
| `38400000` | `{ direction: 'in', signDisplay: 'never' }` | `$38.400.000` | line 2065 |

**Group B — the sign rule as a truth table (Decision 4).** Nine cases: the cross product of
`direction ∈ {in, out, neutral}` with `amountMinorUnits ∈ {positive, zero, negative}`, all at
`signDisplay: 'directional'`; plus the same three directions at `signDisplay: 'never'` for a
negative value. Explicit assertions:

- `formatClp(0, { direction: 'in' })` → `$0` — **zero is never signed**, no `+$0`.
- `formatClp(-500000)` → `−$500.000`, and the sign character is U+2212, asserted by codepoint
  (`expect(result.charCodeAt(0)).toBe(0x2212)`) so a hyphen-minus regression cannot pass.
- `formatClp(-500000, { signDisplay: 'never' })` → `$500.000`.
- `formatClp(1200000, { direction: 'out' })` → `$1.200.000` — `out` never adds a sign.

**Group C — grouping boundaries (`formatThousands` via `formatClp`).** `0` → `$0`; `1` → `$1`;
`999` → `$999`; `1000` → `$1.000`; `9999` → `$9.999`; `10000` → `$10.000`; `999999` → `$999.999`;
`1000000` → `$1.000.000`; `1000000000` → `$1.000.000.000`; `Number.MAX_SAFE_INTEGER` → the
correctly grouped 16-digit string. Plus a regression assertion that **no** `formatClp` output
ever contains a `,` or a `U+00A0` — the two characters an `Intl` fallback would introduce
(Decision 1).

**Group D — invalid input (Decision 5).** `formatClp` throws `TypeError` for `1200.5`, `-1200.5`,
`0.5`, `NaN`, `Infinity`, `-Infinity`, `1e21`, `Number.MAX_SAFE_INTEGER + 1`, and (cast through
`unknown`) `'1200'`, `null`, `undefined`. `formatThousands(-1)` throws `TypeError`.
`isValidMoneyMinorUnits` returns the matching boolean for every one of those values plus `0`,
`-1`, `1200`.

**Group E — abbreviation tiers and rounding (`formatClpAbbreviated`, Decision 6).**

| Input | Options | Expected | Why |
| --- | --- | --- | --- |
| `3700000` | — | `3.7M` | mockup line 1472 |
| `1352470` | — | `1.4M` | mockup line 1478 — proves half-up at the tenth (`13.5247` → `14`) |
| `2347530` | `{ direction: 'in' }` | `+2.3M` | mockup line 1484 |
| `279000` | `{ withCurrencySymbol: true }` | `$279K` | mockup line 1515 |
| `235000` | `{ withCurrencySymbol: true }` | `$235K` | mockup line 1516 |
| `193000` | `{ withCurrencySymbol: true }` | `$193K` | mockup line 1517 |
| `156000` | `{ withCurrencySymbol: true }` | `$156K` | mockup line 1518 |
| `0` | — | `0` | zero has no tier and no sign |
| `999` | — | `999` | below the `K` tier |
| `1000` | — | `1K` | exact `K` tier entry |
| `1499` | — | `1K` | rounds down |
| `1500` | — | `2K` | **half rounds up** |
| `999499` | — | `999K` | just below promotion |
| `999500` | — | `1.0M` | **tier promotion** — never `1.000K` |
| `1000000` | — | `1.0M` | exact `M` tier entry |
| `1049999` | — | `1.0M` | rounds down to the tenth |
| `1050000` | — | `1.1M` | **half rounds up at the tenth** |
| `4000000` | — | `4.0M` | trailing `.0` is kept |
| `-1500` | — | `−2K` | half-**away-from-zero** on the magnitude; U+2212 asserted by codepoint |
| `-3700000` | `{ withCurrencySymbol: true }` | `−$3.7M` | sign precedes the symbol |
| `1000000000` | — | `1000.0M` | ungrouped whole part (Decision 6) |
| `Number.MAX_SAFE_INTEGER` (`9007199254740991`) | — | `9007199254.7M` | proves `divideRoundHalfUp` stays exact past `2^53` (Decision 6) — verified at plan time via exact `BigInt` arithmetic, not `Number.MAX_SAFE_INTEGER * 10` |

Plus: `formatClpAbbreviated` rejects the same invalid inputs as Group D.

### AC2 — RUT validation rejects a wrong check digit and accepts `K`

`packages/shared-utils/src/rut.test.ts`.

**Group A — `computeRutCheckDigit`** (vectors computed at plan time, Verification Log):
`'12345678'` → `'5'`; `'18456789'` → `'K'`; `'999999'` → `'K'`; `'9876543'` → `'3'`;
`'7123456'` → `'8'`; `'11111111'` → `'1'`; `'30686957'` → `'4'`; `'5126663'` → `'3'`.
Throws `TypeError` for `''`, `'12a45678'`, `'12.345.678'`.

**Group B — the acceptance criterion, both halves, from the UI contract:**

- `isValidRut('18.456.789-0')` → **`false`** (the mockup's own literal; the correct digit is `K`)
  — *rejects a wrong check digit*.
- `isValidRut('18.456.789-K')` → **`true`** and `isValidRut('18.456.789-k')` → **`true`**
  — *accepts `K`, upper and lower case*.
- `isValidRut('12.345.678-9')` → `false`; `isValidRut('12.345.678-5')` → `true`.
- Every other digit `0`-`9` substituted for the correct check digit of `18456789` returns
  `false` — a ten-case loop that proves the validator is not merely accepting everything.

**Group C — `normalizeRut`.** `'12.345.678-5'` → `'123456785'`; `'12345678-5'` → `'123456785'`;
`'123456785'` → `'123456785'`; `'18.456.789-k'` → `'18456789K'`; `'  12.345.678 - 5  '` →
`'123456785'`; a value containing U+00A0 (non-breaking space) and U+2009 (thin space) → the same
compacted string. Normalization does not validate: `normalizeRut('abc')` → `'ABC'`.

**Group D — `isValidRut` structural rejection (Decision 10).** `''`, `'-5'`, `'5'`, `'1-9'`,
`'12345-5'` (5-digit body, too short), `'123456789-0'` (9-digit body, too long), `'1234567X'`
(bad check character), `'12.345.678-55'` (two check characters), `'--'`, `'0-0'` all → `false`,
and none of them throws. Leading zeros: `'07.123.456-8'` → `true` (same as `'7.123.456-8'`);
`'00000000-0'` → `false` (body reduces to nothing).

**Group E — `formatRut`.** `'123456785'` → `'12.345.678-5'`; `'12345678-5'` → `'12.345.678-5'`;
`'18456789K'` → `'18.456.789-K'`; `'18456789k'` → `'18.456.789-K'`; `'9876543-3'` →
`'9.876.543-3'` (7-digit body groups as `9.876.543`); `'999999-K'` → `'999.999-K'`.
**`formatRut('18456789-0')` → `'18.456.789-0'`** — formatting must succeed on an
arithmetically invalid RUT, because the mockup renders exactly that string in the `error` state
(Decision 10). `formatRut('')` and `formatRut('abc')` throw `TypeError`.

**Group F — privacy (Decision 9, AGENTS.md non-negotiable 1).** For each throwing input in
Groups A and E, catch the error and assert that `error.message` does **not** contain the input
string, the normalized input, or any 6-or-more-digit substring of it. Additionally, a static
assertion that `rut.ts` contains no `console.` call (covered mechanically by
`'no-console': 'error'` in Implementation Order Step 6).

### AC3 — Period boundaries correct across month ends and DST

`packages/shared-utils/src/dates.test.ts`.

**Group A — `getMonthPeriod` across every month-end shape.** `2025-01-24` →
`{ '2025-01-01', '2025-01-31' }` (31 days); `2025-04-15` → `…-04-01`/`…-04-30` (30);
`2025-02-10` → `…-02-01`/`…-02-28` (common year); `2024-02-10` → `…-02-01`/`…-02-29` (leap year);
`2000-02-05` → `…-02-29` (century leap year); `1900-02-05` → `…-02-28` (century non-leap);
`2025-12-31` → `…-12-01`/`…-12-31`; `2025-01-01` and `2025-01-31` (the boundaries themselves)
both → `{ '2025-01-01', '2025-01-31' }`.

**Group B — `getWeekPeriod`, Monday-start.** `2025-01-24` (Fri) →
`{ '2025-01-20', '2025-01-26' }`; `2025-01-20` (Mon, the start) → the same; `2025-01-26` (Sun,
the end) → the same; `2025-01-27` (the next Mon) → `{ '2025-01-27', '2025-02-02' }` — a week
that **crosses a month end**; `2024-12-30` (Mon) → `{ '2024-12-30', '2025-01-05' }` — a week that
**crosses a year end**; `2025-03-03` → `{ '2025-03-03', '2025-03-09' }`.

**Group B addendum — the `0100`/`9999` arithmetic boundary (Decision 3, "Arithmetic
self-consistency").** `addDays('0100-01-01', -1)` throws `RangeError` (the naive result,
`0099-12-31`, is outside the supported range); `getWeekPeriod('0100-01-01')` throws `RangeError`
for the same underlying reason — its Monday-start would be `0099-12-28`. Symmetrically,
`addDays('9999-12-31', 1)` throws `RangeError` (the naive result is the five-digit year
`10000-01-01`), and `getWeekPeriod('9999-12-31')` throws `RangeError` because its Sunday-end would
be `10000-01-02`. A guard-doesn't-misfire control case, `getWeekPeriod('0100-01-05')` (safely
inside the range on both ends), still returns `{ '0100-01-01', '0100-01-07' }` normally. Every
`RangeError` message in this addendum names the operation and the offending year (dates are not
credential material, unlike RUTs — Decision 9's no-echo rule does not apply here).

**Group C — `shiftMonthPeriod` / `shiftWeekPeriod`.** `shiftMonthPeriod({ '2025-01-01',
'2025-01-31' }, -1)` → `{ '2024-12-01', '2024-12-31' }` (back across a year end);
`shiftMonthPeriod({ '2025-01-01', '2025-01-31' }, 1)` → `{ '2025-02-01', '2025-02-28' }` (31-day
month to a 28-day month, no clamping bug); `shiftMonthPeriod({ '2024-01-01', '2024-01-31' }, 1)`
→ `{ '2024-02-01', '2024-02-29' }`; `shiftMonthPeriod(p, 0)` → `p`; `shiftMonthPeriod(p, -13)`
crosses more than a year. `shiftMonthPeriod({ '2025-01-15', '2025-01-31' }, 1)` throws
`RangeError` (start is not the first of a month). `shiftWeekPeriod({ '2025-01-20',
'2025-01-26' }, -6)` → the six-weeks-ago window that the `Últimas 6 semanas` chart needs.

**Group D — `deriveDateLocal` across the 2025 Chile DST transitions** (instants verified at plan
time, all with the default `SANTIAGO_TIME_ZONE`):

| Instant (UTC) | Expected `DateLocal` | Expected `formatTimeOfDay` | What it proves |
| --- | --- | --- | --- |
| `2025-04-06T02:00:00Z` | `2025-04-05` | `23:00` | Last hour before DST ends (offset −03) |
| `2025-04-06T03:00:00Z` | `2025-04-05` | `23:00` | **The repeated wall-clock hour** — a different instant, offset −04, same local date *and* same local time. A naive fixed-offset implementation puts this on `2025-04-06` |
| `2025-04-06T04:00:00Z` | `2025-04-06` | `00:00` | First instant of the new civil day after DST ends |
| `2025-09-07T03:00:00Z` | `2025-09-06` | `23:00` | Last instant before DST starts (offset −04) |
| `2025-09-07T04:00:00Z` | `2025-09-07` | `01:00` | **The skipped hour** — local `00:00`-`00:59` never exists on this date |
| `2025-09-07T05:00:00Z` | `2025-09-07` | `02:00` | Settled into offset −03 |
| `2025-01-01T02:00:00Z` | `2024-12-31` | `23:00` | **Year-boundary trap** — naive UTC reads January 2025 |
| `2025-01-01T03:00:00Z` | `2025-01-01` | `00:00` | The real start of the Chilean year |
| `2025-12-31T02:59:00Z` | `2025-12-30` | `23:59` | Month/year-end minute |
| `2025-04-01T02:00:00Z` | `2025-03-31` | `23:00` | **Month-end trap** — naive UTC moves this transaction into April, changing its month grouping |

Each DST row is then composed with `getMonthPeriod(deriveDateLocal(instant))` and asserted, which
is the literal statement of AC3: the period a transaction falls into is correct across month ends
and DST.

**Group E — determinism under a hostile host timezone.** `dates.test.ts` runs with
`process.env.TZ = 'Pacific/Kiritimati'` (UTC+14, the furthest possible from Chile) set via a
`beforeAll` or the file's Jest config block. Every assertion in Groups A-D must still pass —
proving no code path reads the host timezone, and that "pass the clock in" (brief rule 4) is
actually honoured. A companion test asserts that calling `deriveDateLocal` twice with the same
instant returns the same value, and that no function in the module is called without an explicit
instant argument.

**Group F — `deriveZonedParts` contract.** `deriveZonedParts(new Date('2025-01-24T23:30:00Z'))`
→ `{ year: 2025, month: 1, day: 24, hour: 20, minute: 30 }` (month is 1-based, not 0-based —
a classic off-by-one that must be pinned). `formatTimeOfDay` at local midnight returns `00:00`
and never `24:00` (this is what `hourCycle: 'h23'` buys; `hour12: false` is a known source of
`24:00` on some ICU builds). An explicit non-default timezone
(`deriveDateLocal(instant, 'UTC')`) returns the UTC civil date, proving the parameter is honoured
rather than ignored. A capability-failure test stubs `Intl.DateTimeFormat` so `formatToParts`
returns parts without a `year` entry, and asserts a descriptive `Error` naming the timezone —
never a silently wrong date. A second, independent test exercises the **silent-ignore** failure
mode, not just the missing-part one: it stubs `Intl.DateTimeFormat` so `resolvedOptions().timeZone`
reports a different zone (e.g. `'UTC'`, standing in for a device's host zone) than the requested
`'America/Santiago'`, while `formatToParts` still returns every required part type — the exact
shape a Hermes build that accepts but silently ignores the `timeZone` option would produce, and
the case the missing-part check alone would pass straight through. The test asserts the
honoured-zone cross-check (Code Samples, `deriveZonedParts`) throws a descriptive `Error` naming
both the requested and the resolved zone, never a silently wrong date. A third test asserts the
happy path is unaffected: when `resolvedOptions().timeZone` matches the requested zone exactly
(the real behaviour of every runtime this item ships against — Node in Jest, and Hermes with full
ICU, per the plan-time verification), `deriveZonedParts` returns normally with no extra cost.

**Group G — locale-parameterised labels, exact against the mockup for `es` and honoured for `en`
(Decision 7, 8).** Every call below passes `locale` explicitly — there is no default.
`formatShortDate('2025-01-24', 'es')` → `24 ene`; `('2024-12-11', 'es')` → `11 dic`;
`('2024-12-29', 'es')` → `29 dic`; `('2025-01-05', 'es')` → `5 ene` (**no leading zero**,
Decision 8). `formatLongDate('2025-01-24', 'es')` → `viernes, 24 de enero de 2025` (the exact
mockup literal); `('2025-01-05', 'es')` → `domingo, 5 de enero de 2025`; `('2024-02-29', 'es')` →
`jueves, 29 de febrero de 2024` (leap day and an accent-free weekday); `('2025-03-01', 'es')` →
`sábado, 1 de marzo de 2025` (asserts `á` is U+00E1, not a decomposed sequence).
`formatMonthYear('2025-01-24', 'es')` → `ene 2025`; `('2024-12-01', 'es')` → `dic 2024`.
`formatMonthAbbreviation(..., 'es')` for all twelve months is asserted against the exact
`Intl.DateTimeFormat('es', { month: 'short' })` output pinned at plan time (Verification Log):
`ene, feb, mar, abr, may, jun, jul, ago, sept, oct, nov, dic`. **`sept` (four letters) is
asserted, not `sep`** — this is `Intl`'s own `es` CLDR data, re-verified rather than assumed
uniform-width (see Decision 7's width caveat); the mockup has no September sample to contradict
it. A weekday sweep over seven consecutive dates with `locale: 'es'` asserts the full
`domingo`…`sábado` cycle in order.

**`en` locale, honoured rather than assumed.** One representative case per formatter with
`locale: 'en'`: `formatShortDate('2025-01-24', 'en')` → `Jan 24`;
`formatLongDate('2025-01-24', 'en')` → `Friday, January 24, 2025`;
`formatMonthYear('2025-01-24', 'en')` → `Jan 2025`;
`formatMonthAbbreviation('2025-01-24', 'en')` → `Jan`. These four assertions are the direct proof
that the `locale` parameter is read and honoured, not merely accepted and ignored (mirroring the
existing `deriveDateLocal(instant, 'UTC')` non-default-timezone proof in Group F).

### AC4 — No `toLocaleString` calls remain in app code

Baseline is already zero (Verification Log). This item makes it enforced:

1. **Lint rule** (Decision 11, Implementation Order Step 6). Verified by the standard negative
   probe used elsewhere in this repo: temporarily insert `(1200000).toLocaleString('es-CL')` into
   `apps/mobile/src/__tests__/workspace-wiring.test.ts`, run `pnpm lint`, confirm it fails naming
   `@finanzas/shared-utils`, then remove it and confirm `pnpm lint` passes. The violation is
   **never committed** — a permanent one would permanently break `pnpm lint`. Both outputs are
   captured for the PR description.
2. **Residual verification** (see below).

### Residual verification strategy

This item makes a repository-wide "no occurrences remain" claim, so the evidence source is named
here rather than left to the implementation agent:

- **Evidence type**: occurrence count, from a single reproducible command.
- **Command**:
  `grep -rn 'toLocaleString\|toLocaleDateString\|toLocaleTimeString' --include='*.ts' --include='*.tsx' --include='*.js' apps packages`
- **Expected**: no matches. The implementation PR description must paste the command and its
  (empty) output, alongside the pass/fail outputs from the lint probe above.
- **Out-of-scope residuals**: `design/mockups/` is static HTML, not app code, and is excluded
  from the claim; `node_modules` is excluded by the `apps packages` scope.

### Parser-risk addendum

**Classified parser-risk**, scoped to two string-scanning surfaces: RUT normalization/validation
(a regex over arbitrary user-typed credential-adjacent input) and `DateLocal` structural parsing
(`isValidDateLocal` / `parseDateLocal`, whose output drives every period boundary). A silent
acceptance bug in either one silently weakens AC2 or AC3. `money.ts` is arithmetic, not parsing,
and is excluded from this classification.

**Edge-case enumeration — RUT input** (each row is one `it` in `rut.test.ts`; the "Group"
column names the group above that owns it):

| Input | Expected | Category | Group |
| --- | --- | --- | --- |
| `'18.456.789-K'` | valid | Canonical accepted form | B |
| `'18456789K'` | valid | Fully compact, no separators | C, B |
| `'18.456.789-k'` | valid | Lowercase check digit (boundary character) | B |
| `'18.456.789-0'` | invalid | Wrong check digit (mockup literal) | B |
| `'12.345.678-9'` | invalid | Wrong check digit (mockup placeholder) | B |
| `'  12.345.678 - 5  '` | valid | Leading/trailing/interior ASCII whitespace | C |
| `'12.345.678 - 5'` | valid | Non-breaking + thin space (boundary characters) | C |
| `'07.123.456-8'` | valid | Leading zero in the body | D |
| `'00000000-0'` | invalid | Body is all zeros — reduces to empty | D |
| `'1-9'` | invalid | Body far below the minimum length | D |
| `'12345-5'` | invalid | 5-digit body — **just** below the 6-digit floor | D |
| `'999999-K'` | valid | 6-digit body — **exactly** at the floor | D, E |
| `'123456789-0'` | invalid | 9-digit body — **just** above the 8-digit ceiling | D |
| `'1234567X'` | invalid | Check character that is neither a digit nor `K` | D |
| `'12.345.678-55'` | invalid | Two check characters | D |
| `'12.345.678'` | invalid | Missing check digit entirely | D |
| `'K12345678'` | invalid | `K` in the body position (looks like a match, is not) | D |
| `'12.345.678-5-9'` | invalid | Multiple separators/segments on one value | D |
| `'12,345,678-5'` | invalid | Comma separators — negative lookalike, must not normalize | D |
| `'١٢٣٤٥٦٧٨-٥'` (Arabic-Indic digits) | invalid | Non-ASCII digits must not be treated as digits | D |
| `''` | invalid (no throw from `isValidRut`) | Empty string | D |

**Edge-case enumeration — `DateLocal` parsing** (each row is one `it` in `dates.test.ts`):

| Input | `isValidDateLocal` | Category |
| --- | --- | --- |
| `'2025-01-24'` | `true` | Canonical |
| `'2024-02-29'` | `true` | Valid leap day |
| `'2025-02-29'` | `false` | **Calendar-invalid** day that is structurally well-formed |
| `'2025-13-01'` | `false` | Month out of range |
| `'2025-00-10'` | `false` | Month zero |
| `'2025-04-31'` | `false` | Day beyond that month's length |
| `'2025-01-00'` | `false` | Day zero |
| `'2025-1-24'` | `false` | Unpadded month — must not be leniently accepted |
| `'2025-01-24T00:00:00Z'` | `false` | Full ISO instant — a negative lookalike |
| `'2025-01-24 '` | `false` | Trailing whitespace |
| `'20250124'` | `false` | Separator-free |
| `'2025/01/24'` | `false` | Wrong separator |
| `'-2025-01-24'` | `false` | Leading sign |
| `'0000-01-01'` | `false` | Year zero — inside the rejected two-digit-year range (Decision 3) |
| `'0099-12-31'` | `false` | Two-digit year — the top of `Date.UTC`'s legacy remap range (Decision 3) |
| `'0100-01-01'` | `true` | First year **outside** the remap range — the year-range floor (Decision 3) |
| `''` | `false` | Empty string |

`parseDateLocal` throws `RangeError` for every `false` row above, and the thrown message names
the expected format without echoing an unbounded input. `toDateLocal({ year: 2025, month: 1,
day: 5 })` → `'2025-01-05'` (zero padding on both fields) and `toDateLocal(parseDateLocal(d))
=== d` holds for every `true` row — a round-trip property test.

**Unit test mapping**: every row in both tables above is one `it(...)` in `rut.test.ts` /
`dates.test.ts` respectively, each asserting the exact expected value. No row is covered only by
the smoke runbook.

**Suppression semantics**: **Not applicable.** Neither helper supports, recognizes, or should
gain an inline suppression directive. A RUT the validator rejects is a data or policy question
(Decision 10), never something a caller may suppress; a malformed `DateLocal` is a bug.

### Concurrent-event-source addendum

**Not applicable**, and the classification is worth stating explicitly because the package does
hold one piece of module-level mutable state.

- **Shared mutable state guards**: the only module-level mutable value is the
  `Map<string, Intl.DateTimeFormat>` formatter cache in `dates.ts` (Decision 2). It is a
  write-once-per-timezone memo populated synchronously inside a single function call; there is no
  `await` between the `get` and the `set`, so no interleaving is possible in JavaScript's
  single-threaded model. The worst case under any conceivable re-entry is constructing the same
  formatter twice and keeping the second — semantically identical, since `Intl.DateTimeFormat` is
  deterministic for a given options set.
- **Re-entrancy / in-flight tracking**: not applicable — every exported function is synchronous
  and returns a value; there is no handler and no in-flight state.
- **Event deduplication**: not applicable — no events.
- **Listener and resource cleanup**: not applicable — no listeners, timers or handles are
  registered. The formatter cache holds at most a handful of small objects for the process
  lifetime, which is the intended behaviour, not a leak.
- **Race conditions at initialization**: not applicable — there is no initialization phase; the
  module has no side effects at import time beyond declaring frozen constant tables.
- **Race conditions at teardown**: not applicable — there is no teardown.
- **Error propagation across async boundaries**: not applicable — no async boundary exists. All
  errors are thrown synchronously to the direct caller, and `isValidRut` /
  `isValidMoneyMinorUnits` / `isValidDateLocal` are the non-throwing alternatives for callers
  that need a boolean instead.

The package introduces **no** concurrent event handling pattern, and brief rule 4 ("pass the
clock in") plus the ban on I/O means it cannot acquire one without an explicit API change.

---

## Seed Data

| Entity | Values / Scenario | File |
| --- | --- | --- |
| — | **None.** This item introduces no database rows, no fixtures and no sample product data. Every test input is an inline literal in the test file that declares it; the money and date vectors are transcribed from `design/mockups/mobile/index.html`, which is existing committed repository content, not seed data. | — |

---

## Documentation Updates

To be executed by the developer during implementation (not now).

- [ ] `docs/best-practices/stack/expo-react-native.md` — two corrections, both recorded under
      "Known documentation drift" above. (a) In **Copy and formatting**, replace "Formatting
      lives in `lib/format.ts` and is unit-tested. No inline `toLocaleString` calls." with a
      statement that money, date and RUT formatting live in `@finanzas/shared-utils` (because
      `@finanzas/bank-scraper` consumes them and cannot import from `apps/mobile`), that
      `apps/mobile/src/lib/format.ts` — if it is ever created — is a thin composition layer that
      delegates, and that `toLocale*` is now an ESLint error rather than a convention. Also add
      one clause noting that the date labels in the "Dates" bullet immediately below are produced
      by `Intl.DateTimeFormat(locale, …)` inside `@finanzas/shared-utils`, per
      [`i18n.md`](i18n.md) — not by a hardcoded table. (b) Change "Abbreviate (`3.7M`) **only** in
      the stat tiles on `home`" to also cover the `home` category rows, which the mockup renders
      as `$279K`. The `[i18n.md](i18n.md)` link at line 64 already resolves correctly (the file
      exists — Verification Log) and needs no change.
- [ ] `docs/best-practices/STACK-SPECIFIC.md` — in **Quick Reference**, extend the money bullet
      to name `formatClp` / `formatClpAbbreviated` as the only sanctioned CLP formatters and
      state that a hand-built amount string is a review blocker; extend the "Spanish (es-CL) in
      user-facing copy" bullet to say that Spanish **date labels** come from
      `@finanzas/shared-utils`'s `Intl.DateTimeFormat(locale, …)`-based formatters — locale-
      parameterised, no hardcoded table (Decisions 1, 2, 7) — while **copy** comes from
      `apps/mobile/src/i18n/`, and that the two surfaces do not overlap.
- [ ] `docs/best-practices/stack/sqlite-drizzle.md` — in **Dates**, name `deriveDateLocal` as the
      one sanctioned way to produce a `date_local` value from an instant, and reference
      `SANTIAGO_TIME_ZONE`. Keep the existing warning that deriving the local day at query time
      reintroduces the timezone bug.
- [ ] `docs/project/2-repo-architecture.md` — in the **Dependency Graph** section (around lines
      106-108), add a sentence that `@finanzas/shared-utils` purity is enforced by the
      `sharedUtilsPurity` `no-restricted-imports` rule, defined in the root `eslint.config.mjs`
      and applied by `packages/shared-utils/eslint.config.mjs`, mirroring the existing
      `sharedDomainPurity` sentence. The Shared Packages table row (line 91) already describes
      this package correctly and needs no change.
- [ ] `AGENTS.md` (and therefore `CLAUDE.md`, which is a symlink) — in **Troubleshooting**,
      extend the "Amounts off by a factor of 100, or with decimals" row to point at
      `@finanzas/shared-utils` and note that `formatClp` throws on a non-integer input by design,
      so a `TypeError` there means a float entered the money pipeline upstream. Add one row for
      "A transaction shows up in the wrong month" → the local day was derived from the UTC
      timestamp instead of `deriveDateLocal`.
- [ ] `docs/project/4-database-model.md` — **no change.** This item writes no schema.
- [ ] `docs/project/3-software-architecture.md` — **no change.** The `lib/` line in the frontend
      tree ("Query client, db provider, formatters, logger") stays accurate: an app-local
      composition layer may still live there (Decision 13), it simply does not own the primitives.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Hermes does not support `Intl.DateTimeFormat` with a real IANA `timeZone` option (e.g. `America/Santiago`) on some target device and throws**, while every Node-based Jest test passes | Medium | High | Decision 2 isolates the whole risk in the timezone seam (`deriveZonedParts`) with an explicit capability check that throws a descriptive error instead of returning a silently wrong date. This risk does **not** extend to the date-label seam, which is pinned to `timeZone: 'UTC'` — a built-in identifier every ICU implementation supports without timezone-database lookups — so `formatShortDate` et al. are not exposed to this failure mode even if the timezone seam is. Runbook Step 6 is a device/simulator check that is marked **human-verification-required** and must not be claimed as passing from a Node run. If it fails on device, the fallback is a caller-supplied `utcOffsetMinutes` parameter — but do **not** pre-build that fallback; confirm the failure first |
| **A Hermes build accepts the `timeZone` option but silently substitutes the device zone instead of throwing**, so `deriveDateLocal` quietly places a transaction on the wrong day/month when the device is outside Chile — the failure the original missing-part capability check could not catch, because a substituted zone still yields a complete, plausible-looking set of parts | Low-Medium | High | `deriveZonedParts` (Code Samples) also compares `formatter.resolvedOptions().timeZone` against the requested `timeZone` and throws if the runtime resolved to a different zone; Group F's mocked-`Intl` test exercises exactly this substitution, not just the missing-part case. This closes the gap for any runtime whose `resolvedOptions()` honestly reports the zone it actually used — which a spec-conformant engine must (ECMA-402 §12.1.3). **Residual risk, explicitly accepted rather than claimed closed**: this cannot be *fully* proven in Jest, because Node's ICU is fully spec-compliant and cannot be made to genuinely mis-resolve a zone without mocking `Intl` itself; a runtime so non-conformant that `resolvedOptions()` *also* misreports the zone it used would defeat this guard too. Runbook Step 6 now includes a device-only check (change the simulator's system timezone away from both UTC and `America/Santiago`, then re-run the fixed-instant assertion) that would visibly catch this exact substitution on a real device even in that worst case, because it observes the *actual* computed wall-clock value rather than trusting any in-process report |
| A future ICU/Hermes upgrade changes `formatToParts` output shape and dates silently shift | Low | High | Parts are read by `type`, never by position or by parsing a formatted string (Decision 2), and Group F pins the exact `ZonedParts` contract including the 1-based month. The capability check fails loudly on a missing part |
| `Intl.NumberFormat.prototype.formatToParts` is unimplemented on iOS Hermes (throws `llvm_unreachable` at call time) — a device-verified finding from this item's brief | N/A (already confirmed, not hypothetical) | High if the design had relied on it | This is precisely why Decision 1 hand-builds every money string from integer arithmetic rather than assembling one from `Intl.NumberFormat.formatToParts` parts (the pattern Decision 2 uses safely for *dates*, where the equivalent `Intl.DateTimeFormat.formatToParts` call is well-supported). `money.ts` therefore has zero `Intl` call sites of any kind |
| `Intl.DateTimeFormat('es', { month: 'short' })` renders September as `sept` (four letters), not a hand-picked three-letter `sep` | Low | Low | Decision 7's width caveat: the mockup's `.mu-bars__lbl` CSS declares no fixed width or monospace font (`design/mockups/mobile/index.html` line 494), so this does not break the chart-bar layout the superseded table-based design was protecting. Accepted as-is rather than reintroducing a hardcoded table to force uniform width |
| The `$279K` category rows contradict "abbreviate only in stat tiles", and a reviewer reads the wider API as scope creep | High | Low | Recorded up front under "Known documentation drift" with the mockup line numbers (1515-1518), and the doc is scheduled for correction. The mockup is the UI contract (AGENTS.md non-negotiable 6) |
| `formatClp` throwing on invalid input crashes a screen in production | Medium | Medium | `isValidMoneyMinorUnits` is exported specifically as the non-throwing boundary guard, and the consumption seam above tells item #2 to use it at the prop boundary (Decision 5). The alternative — silently rounding a float — is worse: it produces a plausible wrong amount in a finance app |
| Decision 8 (no leading zero on single-digit days) is wrong, because the mockup has no sample to confirm it | Medium | Low | Called out explicitly as a decision rather than an observation, with the Spanish-convention rationale stated and the exact `Intl` option (`day: 'numeric'`) named, so a reviewer can overturn it by flipping one formatter option (to `day: '2-digit'`) and one test. The cost of being wrong is a one-line fix |
| A `DateLocal`-returning arithmetic function (`addDays`, `getWeekPeriod`, `shiftMonthPeriod`, `shiftWeekPeriod`) crosses the `0100`/`9999` year floor/ceiling from Decision 3's parsing-boundary guard and returns a string `isValidDateLocal` itself rejects | Low | Medium | "Arithmetic self-consistency at the range boundary" (Decision 3) closes this: `toDateLocal`, the single construction point every one of these functions routes through, throws `RangeError` at either edge instead of returning an out-of-range string. The Testing Strategy's AC3 Group B addendum pins both edges (`addDays('0100-01-01', -1)`, `getWeekPeriod('0100-01-01')`, `addDays('9999-12-31', 1)`, `getWeekPeriod('9999-12-31')`) plus an in-range control case so the guard is proven to fire only at the actual boundary. No real transaction date reaches either edge, so throwing (rather than silently widening the supported range) is the correct, narrowly-scoped fix |
| Decision 10's 6-8 digit body range rejects a real user's RUT and blocks them from connecting their bank | Low | High | The range is deliberately permissive on the low end (6 digits covers legacy RUTs) and leading zeros are stripped rather than rejected. The rationale — a validator stricter than reality is worse than a lenient one, because the bank rejects bad values anyway — is recorded in Decision 10 so it is not silently tightened later |
| The root `eslint.config.mjs` edit conflicts with a concurrent item | Low | Low | The edit is additive only: one new entry in the shared rules array and one new named export. Nothing is renamed, removed or reordered, and `sharedDomainPurity` and `packages/shared-domain/eslint.config.mjs` are deliberately left alone (Decision 11). No open PR touches the file (Verification Log) |
| `eslint-config-expo`, which `apps/mobile/eslint.config.mjs` spreads **after** the root config, resets `no-restricted-properties` and silently disables the AC4 ban in the app | Low | Medium | Implementation Order Step 6 verifies the ban by an actual negative probe inside `apps/mobile`, not by reading the config. If the probe does not fail, the rule must be re-applied in `apps/mobile/eslint.config.mjs` after the Expo spread |
| Copy-paste drift between the mockup literals and the test vectors | Medium | Medium | Every money and date vector in the Testing Strategy carries a mockup line number or element-class anchor, and runbook Step 5 is an expected-vs-actual fidelity check against `design/mockups/mobile/index.html` |
| A future contributor "fixes" the mockup's invalid RUT check digits, breaking AC2's negative vector | Medium | Low | The Verification Log note and Decision 10 both state that the invalidity is intentional mockup data; `rut.test.ts` asserts `isValidRut('18.456.789-0') === false` with a comment naming the mockup line |

---

## Code Samples

> All samples are **illustrative** — adapt during implementation. Production code belongs in the
> implementation PR.

Money sign rule and thousands grouping (`src/money.ts`, Decisions 4 and 5):

```ts
// Illustrative — adapt during implementation
export function isValidMoneyMinorUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function formatClp(amountMinorUnits: number, options: FormatClpOptions = {}): string {
  if (!isValidMoneyMinorUnits(amountMinorUnits)) {
    throw new TypeError(`formatClp: amountMinorUnits must be a safe integer, received ${String(amountMinorUnits)}`);
  }
  const { direction = 'neutral', signDisplay = 'directional' } = options;
  const sign = resolveSign(amountMinorUnits, direction, signDisplay);
  return `${sign}${CLP_CURRENCY_SYMBOL}${formatThousands(Math.abs(amountMinorUnits))}`;
}

function resolveSign(value: number, direction: MoneyDirection, signDisplay: MoneySignDisplay): string {
  if (signDisplay === 'never') return '';
  if (value < 0) return MINUS_SIGN; // U+2212, as used by the mockup's −12% deltas
  if (value === 0) return '';
  return direction === 'in' ? '+' : '';
}
```

The timezone seam (`src/dates.ts`, Decision 2) — note that parts are read by `type`, and the
*resolved* zone is cross-checked against the *requested* one before the parts are trusted:

```ts
// Illustrative — adapt during implementation
const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function deriveZonedParts(instant: Date, timeZone: string = SANTIAGO_TIME_ZONE): ZonedParts {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // NOT hour12:false — some ICU builds render midnight as 24:00
    });
    // Honoured-zone check: a spec-compliant Intl.DateTimeFormat.resolvedOptions() must report the
    // zone the formatter actually applied (ECMA-402 §12.1.3), so on a runtime that accepts but
    // silently substitutes a different zone for an unsupported/ignored `timeZone` option, this is
    // what catches it. formatToParts's presence-only check below cannot: a silently-substituted
    // zone still yields a complete, plausible-looking set of parts (Group F exercises exactly this
    // case with a mocked Intl.DateTimeFormat, not just the missing-part case).
    const resolvedTimeZone = formatter.resolvedOptions().timeZone;
    if (resolvedTimeZone !== timeZone) {
      throw new Error(
        `deriveZonedParts: runtime resolved time zone "${resolvedTimeZone}" instead of the requested "${timeZone}" — this device's Intl implementation is not honoring the requested time zone`,
      );
    }
    formatterCache.set(timeZone, formatter);
  }
  const found: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(instant)) {
    found[part.type] = part.value;
  }
  // Capability check: fail loudly rather than return a silently wrong civil date.
  for (const key of ['year', 'month', 'day', 'hour', 'minute'] as const) {
    if (found[key] === undefined) {
      throw new Error(`deriveZonedParts: runtime Intl cannot resolve "${key}" for time zone ${timeZone}`);
    }
  }
  return {
    year: Number(found.year),
    month: Number(found.month), // 1-based
    day: Number(found.day),
    hour: Number(found.hour),
    minute: Number(found.minute),
  };
}
```

This closes the gap for any runtime whose `resolvedOptions()` correctly reports the zone it
actually used — which a spec-conformant engine must. The one case this check cannot close (see the
Risks table row above) is a runtime so non-conformant that `resolvedOptions()` *also* misreports
the zone; that residual case is out of reach of a Node-based Jest run by construction and is
tracked as a device-verification step in the runbook instead of claimed as covered here.

The locale-label seam (`src/dates.ts`, Decision 2 and 7) — no hardcoded table, `timeZone: 'UTC'`
pinned so a host timezone cannot shift the day, `locale` has no default:

```ts
// Illustrative — adapt during implementation
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getLabelFormatter(locale: SupportedLocale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

export function formatShortDate(dateLocal: DateLocal, locale: SupportedLocale): string {
  const { year, month, day } = parseDateLocal(dateLocal);
  const instant = new Date(Date.UTC(year, month - 1, day));
  return getLabelFormatter(locale, { day: 'numeric', month: 'short' }).format(instant);
}

export function formatLongDate(dateLocal: DateLocal, locale: SupportedLocale): string {
  const { year, month, day } = parseDateLocal(dateLocal);
  const instant = new Date(Date.UTC(year, month - 1, day));
  return getLabelFormatter(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}
```

DST-immune period math (`src/dates.ts`, Decision 3) — `Date.UTC` has no offset transitions:

```ts
// Illustrative — adapt during implementation
export function getMonthPeriod(dateLocal: DateLocal): Period {
  const { year, month } = parseDateLocal(dateLocal);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
  return { start: toDateLocal({ year, month, day: 1 }), end: toDateLocal({ year, month, day: lastDay }) };
}

export function getWeekPeriod(dateLocal: DateLocal): Period {
  const { year, month, day } = parseDateLocal(dateLocal);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  const daysSinceMonday = (weekday + 6) % 7;
  const start = addDays(dateLocal, -daysSinceMonday); // propagates addDays' RangeError at the year floor
  return { start, end: addDays(start, 6) }; // propagates addDays' RangeError at the year ceiling
}
```

Neither function catches or wraps the `RangeError` `addDays` / `toDateLocal` throw at the `0100`/`9999`
boundary ("Arithmetic self-consistency at the range boundary", Decision 3) — it propagates to the
caller unchanged, exactly like `parseDateLocal`'s existing `RangeError` for a directly out-of-range
input.

RUT check digit and value-free errors (`src/rut.ts`, Decisions 9 and 10):

```ts
// Illustrative — adapt during implementation
export function computeRutCheckDigit(bodyDigits: string): string {
  if (!/^[0-9]+$/.test(bodyDigits)) {
    // Never interpolate the input: the RUT is credential material (AGENTS.md non-negotiable 1).
    throw new TypeError('computeRutCheckDigit: body must contain digits only');
  }
  let sum = 0;
  let weight = 2;
  for (let i = bodyDigits.length - 1; i >= 0; i -= 1) {
    sum += Number(bodyDigits[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}
```

AC4 lint ban (root `eslint.config.mjs`, Decision 11) — additive entries in the shared array. The
`toLocale*` ban is deliberately on its **own** entry with a wider `files` glob than the existing
`no-console` entry: AC4's residual scan (Testing Strategy, `AC4 baseline` row) and the changelog
claim both cover `.js` alongside `.ts`/`.tsx` — this repo already has real, committed `.js` files
(`apps/mobile/{app.config,jest.config,metro.config,babel.config}.js`, every workspace's own
`jest.config.js`; verified at plan time, Verification Log), and `packages/bank-scraper` is
documented (AGENTS.md) as holding "per-bank script configs", which are a plausible home for a
future plain-`.js` file. Scoping `no-restricted-properties` to `**/*.{ts,tsx}` only would leave the
lint rule narrower than what AC4 and the residual scan claim to cover, so the rule's `files` glob
adds `js`, `jsx`, `mjs` and `cjs`:

```js
// Illustrative — adapt during implementation
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-console': 'warn',
  },
},
{
  // Wider than the no-console entry above, on purpose (see prose above): AC4's residual scan and
  // changelog claim cover `.js` too, so the toLocale* ban must not be TypeScript-only.
  files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
  rules: {
    'no-restricted-properties': [
      'error',
      ...['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].map((property) => ({
        property,
        message:
          'Locale formatting is not byte-stable across Hermes and ICU builds. Use @finanzas/shared-utils (formatClp, formatShortDate, formatLongDate) instead.',
      })),
    ],
  },
}
```

---

## Implementation Order

> Paths written as `src/…` in this section are relative to `packages/shared-utils/`. Every other
> path is relative to the repository root. All `pnpm` commands are run from the repository root.

1. **`src/money.ts`.** Create the module with the full public surface from the Layer-by-Layer
   table, plus the internal `divideRoundHalfUp`. No imports from anywhere.
   *Verify*: `pnpm --filter @finanzas/shared-utils typecheck` passes.

2. **`src/money.test.ts`.** Write Groups A-E from the AC1 section — one `it` per enumerated row.
   *Verify*: `pnpm --filter @finanzas/shared-utils test -- money` is green, and the run reports at
   least one test for every row of Groups A and E. Confirm by reading the output that the
   `1352470 → 1.4M` and `999500 → 1.0M` cases are present and passing — those two are the
   rounding and tier-promotion guarantees.

3. **`src/dates.ts`.** Create the module in three clearly separated sections: the pure civil-date
   arithmetic (`parseDateLocal`, `toDateLocal`, `isValidDateLocal`, `addDays`, the four period
   functions — no `Intl`, no table); the timezone seam (`deriveZonedParts`, `deriveDateLocal`,
   `formatTimeOfDay`, `SANTIAGO_TIME_ZONE`, the formatter cache — Decision 2's first seam); and
   the locale-label seam (`SupportedLocale`, `formatShortDate`, `formatLongDate`,
   `formatMonthYear`, `formatMonthAbbreviation` — Decision 2's second seam, sharing the same
   formatter cache, keyed so the two seams' entries cannot collide). Add a file-header comment
   stating Decision 2 — that these five functions (`deriveZonedParts` plus the four label
   formatters) are the **only** functions permitted to call `Intl`, and that no month, day or
   weekday name may be hardcoded (Decision 7) — so a later contributor does not scatter `Intl`
   through the file or reintroduce a label table.
   *Verify*: `pnpm --filter @finanzas/shared-utils typecheck` passes; `grep -n 'Intl' src/dates.ts`
   confirms every match is inside `deriveZonedParts`, `formatShortDate`, `formatLongDate`,
   `formatMonthYear` or `formatMonthAbbreviation`, and that `parseDateLocal`, `toDateLocal`,
   `isValidDateLocal`, `addDays` and the four period functions contain none.

4. **`src/dates.test.ts`.** Write Groups A-G from the AC3 section, with `process.env.TZ` forced to
   `Pacific/Kiritimati` for the whole file (Group E).
   *Verify*: `pnpm --filter @finanzas/shared-utils test -- dates` is green. Then re-run the same
   command with the host TZ forced two more ways —
   `TZ=UTC pnpm --filter @finanzas/shared-utils test -- dates` and
   `TZ=America/Santiago pnpm --filter @finanzas/shared-utils test -- dates` — and confirm the
   results are identical. Three identical runs under three host zones is the evidence that
   "pass the clock in" holds.

5. **`src/rut.ts` and `src/rut.test.ts`.** Create both together; the parser-risk enumeration is
   the test plan.
   *Verify*: `pnpm --filter @finanzas/shared-utils test -- rut` is green. Then read the file and
   confirm by inspection that **no** thrown message and **no** comment contains a template
   literal interpolating a RUT value — this is the Decision 9 guarantee and a reviewer will check
   it by hand.

6. **ESLint enforcement.** Add the `no-restricted-properties` `toLocale*` entry to the root
   `eslint.config.mjs` shared array and the `sharedUtilsPurity` named export (Decision 11); apply
   `sharedUtilsPurity` and `'no-console': 'error'` in `packages/shared-utils/eslint.config.mjs`.
   *Verify*: run `pnpm lint` — it must pass. Then run the three negative probes, capturing both
   the failing and the passing output for the PR description:
   (a) temporarily add `(1200000).toLocaleString('es-CL');` to
   `apps/mobile/src/__tests__/workspace-wiring.test.ts`, run `pnpm lint`, confirm it fails with
   the message naming `@finanzas/shared-utils`, then remove it and confirm `pnpm lint` passes
   again — this is what proves `eslint-config-expo` does not reset the rule;
   (b) temporarily add `import { readFileSync } from 'node:fs';` to
   `packages/shared-utils/src/index.ts`, run `pnpm lint`, confirm it fails with the
   `sharedUtilsPurity` message, then remove it and confirm `pnpm lint` passes again;
   (c) a **JavaScript** negative probe, proving the ban's `files` glob actually reaches `.js` (the
   Testing Strategy's `AC4 baseline` residual scan and the changelog claim both cover `.js`, not
   just `.ts`/`.tsx`): temporarily add `(1200000).toLocaleString('es-CL');` inside the function
   body of `apps/mobile/babel.config.js` (a real, committed `.js` file `eslint .` already lints),
   run `pnpm lint`, confirm it fails with the message naming `@finanzas/shared-utils`, then remove
   it and confirm `pnpm lint` passes again.
   **None of the three violations is committed** — a committed one would permanently break
   `pnpm lint`.

7. **`src/index.ts` and `src/index.test.ts`.** Add the three `export *` lines, keeping
   `PACKAGE_NAME` byte-identical. Extend `index.test.ts` with a surface test that imports
   `formatClp`, `formatClpAbbreviated`, `deriveDateLocal`, `getMonthPeriod`, `formatLongDate`,
   `isValidRut` and `formatRut` **from `./index`** and asserts each is a function — proving the
   barrel actually re-exports and that no name collides between the three modules.
   *Verify*: `pnpm --filter @finanzas/shared-utils test` is fully green; then
   `pnpm --filter @finanzas/mobile test` still passes (the existing `workspace-wiring` test must
   not have been broken by the `index.ts` edit); then `pnpm build` succeeds, proving the package
   still emits declarations.

8. **Full gate from the repository root.** Run `pnpm install && pnpm lint && pnpm typecheck &&
   pnpm test` and confirm all four are green across all four workspaces.
   *Verify*: paste the four command results into the PR description.

9. **Residual verification for AC4.** Run the residual command from the Testing Strategy and
   confirm it returns no matches; paste the command and its empty output into the PR description
   alongside the Step 6 probe outputs.

10. **Execute the smoke test runbook**
    `docs/testing/mobile/4-shared-utils-clp-dates-rut.smoke-test.md`, including the
    expected-vs-actual fidelity step against `design/mockups/mobile/index.html`. Mark the device
    check (runbook Step 6) as pending human verification if it cannot be executed in the agent
    environment — do not claim it.

11. **Project docs.** Execute every item in the **Documentation Updates** section above.
    *Verify*: `npx markdownlint-cli2 "docs/**/*.md"` reports no new violation on the files you
    touched. The `[i18n.md](i18n.md)` link at `docs/best-practices/stack/expo-react-native.md`
    line 64 already resolves correctly (Verification Log) and is unaffected by this step.

12. **CHANGELOG.** Add this entry under `[Unreleased]` → `### Added` in `CHANGELOG.md`, verbatim:

    ```markdown
    - **shared-utils: CLP money, dates and RUT** (#4): `@finanzas/shared-utils` now ships CLP formatting (`formatClp`, `formatClpAbbreviated`), Chilean date helpers (`deriveDateLocal`, month/week period boundaries, es-CL labels) and RUT normalization, modulo-11 validation and display formatting. Locale formatting via `toLocaleString` is now an ESLint error repository-wide.
    ```
