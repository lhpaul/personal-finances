# Smoke Test Runbook: Bank Scraper — Banco de Chile

**Feature**: `@finanzas/bank-scraper` — on-device WebView read engine plus the four Banco de
Chile reading routines
**Spec**: [`../../specs/developments/20260801232904_6-port-bank-scraper-banco-de-chile/1_6-port-bank-scraper-banco-de-chile_specs.md`](../../specs/developments/20260801232904_6-port-bank-scraper-banco-de-chile/1_6-port-bank-scraper-banco-de-chile_specs.md)
**Implementation plan**: [`../../specs/developments/20260801232904_6-port-bank-scraper-banco-de-chile/2_6-port-bank-scraper-banco-de-chile_implementation-plan.md`](../../specs/developments/20260801232904_6-port-bank-scraper-banco-de-chile/2_6-port-bank-scraper-banco-de-chile_implementation-plan.md)
**Created in**: Plan Ready stage
**Updated in**: In Development stage

---

## Prerequisites

This item ships a headless library. It renders nothing a person sees, writes nothing to the
database, and is verified entirely against committed HTML fixtures — so this runbook runs on the
command line, not on a phone. There is no app to log into and no session to start.

- [ ] Node 22 active (`nvm use`; the repository pins Node 22 via `.nvmrc`)
- [ ] `pnpm install` has been run from the repository root
- [ ] You are on the implementation branch for issue #6 with a clean working tree
- [ ] No simulator, no device and no network access to a bank is required, and none is used

> **No design assets exist for this item.** Issue #6 has no `## Design assets` section, the
> spec states the item renders nothing, and `design/mockups/mobile/` contains no screen this
> item implements. There is therefore no expected-vs-actual fidelity step in this runbook, and
> no baseline is invented for one.

---

## Test Data

All values are fixed, committed inputs. No database seed data is required.

| Item | Value |
| --- | --- |
| Command prefix | `pnpm --filter @finanzas/bank-scraper` |
| Bank identifier | `banco-de-chile` |
| Country key | `cl` (the public API also accepts `CL`) |
| Allow-listed origin | `https://login.portales.bancochile.cl` |
| Rejected lookalike origin | `https://login.portales.bancochile.cl.evil.example` |
| Rejected sibling origin | `https://portales.bancochile.cl` |
| Credential sentinels | `ZZSENTINELRUTZZ` / `ZZSENTINELPASSZZ` (`src/test-utils/sentinels.ts`) |
| Punctuation password (AC4) | `ZZ"\\'<>&\u2028ZZ` |
| Fixture directory | `packages/bank-scraper/src/configs/cl/banco-de-chile/fixtures/` |
| Date vector (AC8) | `01/03/2026` → `2026-03-01` |
| Peso vector (AC7) | `$1.234.567` → `1234567` |
| Peso defect vector (AC7) | `$1.234,50` → throws `fraction_exceeds_currency_exponent` |
| Foreign vector (AC10) | `US$ 1.234,56` with `USD` → `123456` minor units |
| Retry bounds (AC19) | `MAX_STEP_ATTEMPTS = 3` / `STEP_RETRY_DELAY_MS = 1000`; `MAX_ELEMENT_ATTEMPTS = 10` / `ELEMENT_RETRY_DELAY_MS = 200`; `MAX_SUBMIT_ATTEMPTS = 1`; `READ_DEADLINE_MS = 240_000` |

---

## Smoke Test Steps

### Step 0: Clean baseline

1. From the repository root, run `pnpm install`.
2. Run `git status --short`.

**Expected result**: install completes; the working tree shows only this item's own changes.

---

### Step 1: The package suite is green, with no phone, no simulator and no network

**Maps to**: AC30

1. Disconnect from the network, or confirm no test opens a socket.
2. Run `pnpm --filter @finanzas/bank-scraper test`.
3. Read the summary line and confirm both Jest projects ran.

**Expected result**: every test passes and none is skipped. The output shows both the `engine`
(node) and `dom` (jsdom) projects. No simulator was started and no bank was contacted.

---

### Step 2: A full read completes with products and movements

**Maps to**: AC1, AC20, AC21

1. Run `pnpm --filter @finanzas/bank-scraper test -- scrape-session`.
2. Read the test names in the output.

**Expected result**: the happy-path case reports `outcome: 'complete'` with at least one product
and the movements belonging to it; the step sequence
`load-start → login-start → get-products-start → get-transactions-start → ready` is asserted in
order; reported progress never decreases; and running the same fixtures twice produces two
results describing every movement identically.

---

### Step 3: No credential reaches a trace, a failure, a result or the console

**Maps to**: AC2, AC3, AC4, AC29

1. Run `pnpm --filter @finanzas/bank-scraper test -- credential-leak`.
2. Confirm the punctuation-password case ran alongside the plain one.

**Expected result**: the sentinels appear in no trace, no failure report, no returned value and
no `console.*` call, in either credential variant. The same test also asserts the trail is
**substantive** — at least ten traces, a `'Step completed'` entry for `submit-form`, a product
count, and a masked identifier — so a redactor that simply blanked everything would fail here.

---

### Step 4: Prove the leak check fires, then prove it does not over-fire

**Maps to**: AC2

1. Confirm `git diff --stat` prints nothing.
2. Open `packages/bank-scraper/src/configs/cl/banco-de-chile/banco-de-chile.login.script.ts` and
   add a trace line that interpolates the RUT into its message.
3. Run `pnpm --filter @finanzas/bank-scraper test -- credential-leak` and record the failing
   test name and the file and line you edited.
4. Run `git checkout -- packages/bank-scraper/src/configs/cl/banco-de-chile/banco-de-chile.login.script.ts`.
5. Re-run the same command and run `git diff --stat`.

**Expected result**: step 3 fails, naming the offending trace; step 5 passes and `git diff
--stat` prints nothing — the tree is byte-identical to where it started. The check fires on a
real violation and stays quiet on clean code.

---

### Step 5: No credential is entered outside the bank's exact origin

**Maps to**: AC16

1. Run `pnpm --filter @finanzas/bank-scraper test -- origin-allowlist`.
2. Run `pnpm --filter @finanzas/bank-scraper test -- webview-driver`.

**Expected result**: the allow-listed origin is accepted (including with a query string, mixed
host case and an explicit `:443`); a redirect that lands off that origin partway through the
sign-in navigation is rejected; and the lookalike hostname is rejected. In both rejection cases
the login script is never injected, the read ends with a reason code rather than continuing, and
the credential holder reports itself cleared.

---

### Step 6: Prove the origin gate fires, then prove it does not over-fire

**Maps to**: AC16

1. Confirm `git diff --stat` prints nothing.
2. In `packages/bank-scraper/src/security/origin-allowlist.ts`, replace the `URL.origin`
   comparison with a `hostname.endsWith(...)` comparison.
3. Run `pnpm --filter @finanzas/bank-scraper test -- origin-allowlist webview-driver` and record
   the failing test names and the line you edited.
4. Run `git checkout -- packages/bank-scraper/src/security/origin-allowlist.ts`.
5. Re-run the same command, then run `pnpm --filter @finanzas/bank-scraper test` and
   `git diff --stat`.

**Expected result**: step 3 fails on the suffix-lookalike cases; step 5 passes, the full suite
including the happy-path read is still green, and `git diff --stat` prints nothing.

---

### Step 7: Fixtures contain no real personal data — one check per class

**Maps to**: AC5

1. Run `pnpm --filter @finanzas/bank-scraper test -- fixture-sanitization`.
2. Confirm the output lists four "no violations across every committed fixture" cases — RUT,
   name, balance, account number — plus, for each class, a planted-violation case and a
   does-not-flag-the-synthetic-value case.

**Expected result**: all twelve cases pass. Every failure message reports a detector name and a
byte offset and never reprints the matched text.

---

### Step 8: Prove one sanitization detector fires against a committed fixture

**Maps to**: AC5

1. Confirm `git diff --stat` prints nothing.
2. Open `packages/bank-scraper/src/configs/cl/banco-de-chile/fixtures/home.html` and replace one
   synthetic account balance with a real-looking amount (any Chilean-formatted value whose
   thousands are not identical digits, e.g. a mixed-digit figure).
3. Run `pnpm --filter @finanzas/bank-scraper test -- fixture-sanitization` and record the failing
   test name and the fixture and offset it reports.
4. Run `git checkout -- packages/bank-scraper/src/configs/cl/banco-de-chile/fixtures/home.html`.
5. Re-run the same command and run `git diff --stat`.

**Expected result**: step 3 fails on the balance detector only — the other three detectors stay
quiet, which is what shows the checks are per-class rather than one aggregate check wearing four
labels. Step 5 passes and `git diff --stat` prints nothing.

---

### Step 9: Every reading routine is exercised against a recorded page

**Maps to**: AC6, AC11, AC12, AC22, AC24, AC25

1. Run `pnpm --filter @finanzas/bank-scraper test -- dom`.

**Expected result**: four routine suites run — sign in, product list, account movements,
credit-card details. Within them: a product with no movements is a success with zero movements;
a page whose stated count exceeds the parsed rows is `parse_failed` for that product; two rows
with identical day, amount and description stay two movements distinguishable by
`positionInReadSnapshot`; two accounts of the same kind get different `instanceId` values, each
stable across two reads; and a product kind outside the enumerated set yields no product, a
diagnostic entry naming it, and still a `complete` outcome for the supported products.

---

### Step 10: Money is whole minor units, dates are timezone-independent

**Maps to**: AC7, AC8, AC9, AC10

1. Run `pnpm --filter @finanzas/bank-scraper test -- parsing`.
2. Run `TZ=Pacific/Kiritimati pnpm --filter @finanzas/bank-scraper test`.
3. Run `TZ=Pacific/Niue pnpm --filter @finanzas/bank-scraper test`.

**Expected result**: all three runs are identical and green. `$1.234.567` reads as `1234567`;
`$1.234,50` throws rather than rounding; `US$ 1.234,56` reads as `123456` minor units of USD with
no conversion and no invented peso amount; `01/03/2026` is `2026-03-01` in every timezone; every
reported amount is a positive whole number and the direction comes from the column the bank used,
including for card movements.

---

### Step 11: Failures are the four codes, partial data survives, cancellation is not a failure

**Maps to**: AC13, AC14, AC15, AC17, AC18, AC19, AC23

1. Run `pnpm --filter @finanzas/bank-scraper test -- scrape-session`.
2. Run `pnpm --filter @finanzas/bank-scraper test -- registry`.

**Expected result**: a read whose product list succeeds and whose one product's movements fail
reports `partial`, keeps everything already gathered, and names both the reason and the product;
a rejected sign-in reports `invalid_credentials`, gathers nothing, clicks submit exactly once,
names no product and attaches no bank text; `network`, `session_closed` and `parse_failed` are
each asserted separately; no fifth reason exists; an unknown bank or country is refused before
any navigation and is distinguishable from the four reasons; attempt counts appear in the trail
and no step exceeds its bound; a cancelled read reports `cancelled`, carries what it had, and
populates no failure reason; and no movement carries a bank-supplied identity the bank did not
supply.

---

### Step 12: Nothing leaves the device, and nothing is left behind

**Maps to**: AC31, AC32

1. Run `pnpm --filter @finanzas/bank-scraper test -- no-network-egress`.
2. Run `pnpm --filter @finanzas/bank-scraper lint`.
3. Search the package for network and persistence primitives:
   `grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon\|Sentry\|amplitude" packages/bank-scraper/src`

**Expected result**: the egress test passes (it scans the **generated script strings**, which
ESLint cannot see inside); lint passes with the package's `no-console: error` and its restricted
import and global rules in force; and the grep returns no hits outside the test that looks for
them. The teardown assertions confirm nothing from one read's session is carried into the next.

---

### Step 13: Bank knowledge is contained, and the dropped banks are absent

**Maps to**: AC27, AC28

1. Run `pnpm --filter @finanzas/bank-scraper test -- bank-containment`.
2. Run `grep -ril "falabella\|pelotillehue" packages/bank-scraper` and confirm the output is
   empty.
3. Read `packages/bank-scraper/src/configs/cl/index.ts`.

**Expected result**: the containment test passes — the only files mentioning Banco de Chile are
its own directory and the two registry files, and those match only on their import and
registration lines. The grep returns nothing. `CL_BANKS` has exactly one entry,
`BANCO_DE_CHILE_CONFIG`.

---

### Step 14: Nothing outside this package changed, and the workspace still builds

**Maps to**: AC33

1. From the repository root run `pnpm lint`, `pnpm typecheck` and `pnpm test`.
2. Run `git diff --name-only origin/develop...HEAD` and read the output.

**Expected result**: all three repository-level commands pass, including
`apps/mobile/src/__tests__/workspace-wiring.test.ts`, which still imports
`@finanzas/bank-scraper` and is not modified by this item. The changed-file list contains only
paths under `packages/bank-scraper/`, `docs/best-practices/stack/bank-scraper.md`,
`docs/project/3-software-architecture.md`, `CHANGELOG.md` and `pnpm-lock.yaml`. `.npmrc`,
`pnpm-workspace.yaml`, the root `package.json`, the root `eslint.config.mjs`,
`.github/workflows/**`, `docs/project/2-repo-architecture.md` and
`docs/project/4-database-model.md` are absent from the list.

---

### Last Step: Validate & Shut Down

- Confirm every assertion in the checklist below is met.
- Confirm `git diff --stat` shows only the item's intended changes — every planted-defect proof
  in Steps 4, 6 and 8 was reverted.

---

## Assertions Checklist

- [ ] **AC1** — a read of Banco de Chile completes with products and movements, steps in order
- [ ] **AC2** — no credential in any trace, failure, result or console call, asserted by test
- [ ] **AC3** — no credential held after success, failure or cancellation; `cancelled` carries
      gathered data; clear precedes teardown
- [ ] **AC4** — a punctuation-heavy credential reaches the form unchanged and alters nothing
- [ ] **AC5** — four per-class fixture checks, each proven to fire and proven not to over-fire
- [ ] **AC6** — all four reading routines tested against recorded pages
- [ ] **AC7** — Chilean amounts read as whole pesos; no reported peso amount has a decimal part
- [ ] **AC8** — `01/03/2026` is `2026-03-01` east and west of Santiago
- [ ] **AC9** — every amount positive; direction from the column, including for cards
- [ ] **AC10** — second-currency card movements in their own currency, exact minor units, no
      conversion
- [ ] **AC11** — an empty statement is a success with zero movements
- [ ] **AC12** — a stated count higher than the parsed rows is `parse_failed` for that product
- [ ] **AC13** — a partial read returns its data and names the reason and the product
- [ ] **AC14** — a rejected sign-in is `invalid_credentials`, never retried, no product, no bank
      text
- [ ] **AC15** — `network`, `session_closed` and `parse_failed` each asserted separately
- [ ] **AC16** — allowed origin permitted; off-origin redirect and lookalike host rejected
- [ ] **AC17** — exactly four failure reasons for a started read
- [ ] **AC18** — an unsupported bank or country is refused before anything is opened
- [ ] **AC19** — retries bounded, waits present, attempt counts in the trail, deadline honoured
- [ ] **AC20** — every step announced in order; progress never decreases
- [ ] **AC21** — two reads of the same fixtures describe every movement identically
- [ ] **AC22** — two identical same-day movements stay two, distinguishable
- [ ] **AC23** — no manufactured bank-supplied identity
- [ ] **AC24** — two same-kind accounts get two stable, opaque identities; neither is the raw
      number
- [ ] **AC25** — enumerated kinds and directions only; an unsupported kind is skipped and named
      and still allows `complete`
- [ ] **AC26** — codes not sentences; extras keyed stably; bank text preserved verbatim
- [ ] **AC27** — no Banco de Chile knowledge outside its own directory
- [ ] **AC28** — no Falabella or Pelotillehue material; exactly one bank for Chile
- [ ] **AC29** — RUT handling via `@finanzas/shared-utils`; no call site logs, caches or retains
      a RUT
- [ ] **AC30** — the suite runs with no phone, no simulator and no network, inside `pnpm test`
- [ ] **AC31** — no request to any non-bank server, no analytics, no export, no page HTML on disk
- [ ] **AC32** — nothing from a session carried into a later read
- [ ] **AC33** — every change inside `packages/bank-scraper/` apart from the two documentation
      files, the CHANGELOG and the regenerated lockfile

---

## Seed Data Reference

| Entity | Scenario | How to load |
| --- | --- | --- |
| Banco de Chile recorded pages | Login (clean and rejected), product list (normal and with an unsupported kind), account movements (normal, empty, count mismatch, duplicate rows), credit-card details (national and international) | Committed at `packages/bank-scraper/src/configs/cl/banco-de-chile/fixtures/`; loaded by `src/test-utils/load-fixture.ts`. No command to run |
| Credential sentinels | Leak assertions and the AC4 punctuation case | `packages/bank-scraper/src/test-utils/sentinels.ts` |
| Synthetic allowlist | The values the four fixture detectors are permitted to see | `packages/bank-scraper/src/testing/synthetic-allowlist.ts` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Cannot find module 'jest-environment-jsdom'` | The `dom` Jest project's environment was not added as a devDependency | Add `jest-environment-jsdom` to `packages/bank-scraper/package.json` and re-run `pnpm install` |
| `pnpm install --frozen-lockfile` fails | Dependencies were added without regenerating `pnpm-lock.yaml` | Run `pnpm install` at the repository root and commit the lockfile (plan Documented Deviation D1) |
| `apps/mobile` tests fail with an unresolved `react-native-webview` | `src/index.ts` re-exported the React component, so the barrel now pulls in the WebView | Keep the barrel headless; the component is reached at `@finanzas/bank-scraper/src/component` (plan Decision 3) |
| A `.dom.test.ts` file runs under the `node` environment | The filename does not match the `dom` project's pattern | Rename the file to end in `.dom.test.ts` |
| A fixture detector flags a value you believe is synthetic | The value does not satisfy the synthetic rule for its class | Change the fixture value to satisfy the rule, or add it to `synthetic-allowlist.ts` with a comment saying why. There is no inline suppression directive and none will be honoured |
| The date test passes by default but fails under a shifted `TZ` | Something reintroduced a `Date` into the date path | Restore the pure string manipulation and the `@finanzas/shared-utils` validation (plan Decision 11) |
| The credential-leak test passes but the trace array is empty | The redactor is blanking everything instead of redacting values | The test's substantiveness assertions should have caught this — check they are still present (plan Decision 5) |

---

## Known Limitations

- **The fixtures are hand-authored, not captured.** They are written from the selector contracts
  encoded in the ported reading routines, because committing a captured page would require a real
  session and the spec forbids committing anything real. A green suite therefore proves the
  routines agree with the fixtures, not that they agree with the live bank today. Provenance is
  recorded in `fixtures/README.md`; replacing them with scrubbed captures is follow-up F3 in the
  implementation plan.
- **No live read is exercised here.** The spec puts device end-to-end coverage out of scope for
  this item and assigns it to the connect flow's runbook. Nothing in this runbook signs into a
  real bank.
- **The planted-defect steps (4, 6, 8) mutate the working tree.** They must be run on a clean
  tree and reverted before continuing; each step ends with a `git diff --stat` check for exactly
  that reason.
- **`react-native-webview` prop names are unverified at plan time.** The package is not installed
  in this repository yet, so the component's props are confirmed during implementation rather
  than here. No test in this runbook depends on them.
