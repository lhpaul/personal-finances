# Bank Scraper: Banco de Chile — Implementation Plan

**Spec**: [`1_6-port-bank-scraper-banco-de-chile_specs.md`](1_6-port-bank-scraper-banco-de-chile_specs.md)
**Smoke test runbook**: [`../../../testing/mobile/6-port-bank-scraper-banco-de-chile.smoke-test.md`](../../../testing/mobile/6-port-bank-scraper-banco-de-chile.smoke-test.md)
**Work item**: [GitHub issue #6](https://github.com/lhpaul/personal-finances/issues/6)

---

## Summary

**Approach**: Port the proven Banco de Chile scraper out of the gitignored
`bank-scrapper-app/apps/native/src/components/bank-scrapper/` reference into
`packages/bank-scraper`, restructured around four changes the spec requires and the source does
not have: (1) a **split of responsibilities** — the injected in-page scripts do DOM traversal,
identity hashing and masking only, while every amount, date and enum is parsed on the React
Native side by plain, unit-tested TypeScript; (2) a **security perimeter** — an exact
origin allowlist checked at three independent points, a single-owner `CredentialHolder`, and a
redactor that every trace and error passes through before it becomes text; (3) an **explicit
read result** — `complete` / `partial` / `failed` / `cancelled` with a stable opaque product
identity and enough per-movement detail for item #10 to fingerprint a repeat; and (4) a
**test suite that fails on a real violation and stays quiet on clean code**, including one
sanitization check per prohibited fixture data class. Banco Falabella and Banco Pelotillehue are
not ported.

**Estimated complexity**: L

**Rationale**: 33 acceptance criteria across a security perimeter, a bank-independent engine, a
four-routine bank config, a parsing layer, and roughly 45 new files including hand-authored HTML
fixtures. Two of the four reading routines (account movements, credit-card details) are the
largest and most selector-dense code in the repository. The restructuring is not a copy-paste:
every credential path, every amount path and every date path changes shape during the port.

**Dependencies**:

- **#1 — Bootstrap the monorepo and the Expo app**: Merged. `packages/bank-scraper` exists as a
  skeleton (Verification Log V2).
- **#4 — shared-utils (CLP, dates, RUT)**: Merged. `formatRut`, `isValidRut`, `normalizeRut`,
  `toDateLocal`, `isValidDateLocal` are available on `develop` (Verification Log V5).
- Nothing else. This item does not depend on #3 (database) or #10 (sync) and must not
  anticipate their schemas beyond the shape contract recorded below.

---

## Verification Log

| Check | Command / query | Result |
| --- | --- | --- |
| V1 — Repo revision | `git rev-parse --short HEAD` | `54d4390` (branch `implementation-plan/6-port-bank-scraper-banco-de-chile`, created from `origin/develop` at `54d4390`) |
| V2 — Current package contents | `find packages/bank-scraper -type f -not -path "*/node_modules/*"` | 6 files: `package.json`, `jest.config.js`, `tsconfig.json`, `eslint.config.mjs`, `src/index.ts`, `src/index.test.ts`. No engine, no configs, no fixtures — this item writes all of them |
| V3 — Falabella / Pelotillehue residue in the repo | `grep -ril "falabella\|pelotillehue" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" .` (excluding `node_modules`) | 4 files, all documentation: this item's own spec, the #3 spec and plan, and `docs/project/4-database-model.md:336` (which seeds Falabella as a `coming_soon` **bank-picker row**, not a scraper config). Zero matches under `packages/`. AC28's residual target is therefore "zero matches under `packages/bank-scraper/`", not "zero in the repo" |
| V4 — Source reading routines to port | `find bank-scrapper-app/apps/native/src/components/bank-scrapper -type f -name "*banco-de-chile*"` | 5 files: `.config.ts`, `.login.script.ts`, `.home.script.ts`, `.account-transactions.script.ts`, `.credit-card-details.script.ts` — the four reading routines the spec names plus the config |
| V5 — shared-utils exports consumed here | `cat packages/shared-utils/src/index.ts` and read `rut.ts` / `dates.ts` | `formatRut`, `isValidRut`, `normalizeRut`, `computeRutCheckDigit`, `toDateLocal`, `isValidDateLocal`, `parseDateLocal`. `rut.ts`'s header states it has no `console.` call, no module-level cache keyed on a RUT, and value-free error messages — the property AC29 requires every call site to preserve |
| V6 — Existing cross-package consumer of the barrel | `grep -rn "bank-scraper" apps/mobile` (excluding `node_modules`) | `apps/mobile/src/__tests__/workspace-wiring.test.ts:1` does `import { PACKAGE_NAME } from '@finanzas/bank-scraper'`. **Constraint**: the barrel must keep exporting `PACKAGE_NAME` and must not transitively import `react-native-webview`, which `apps/mobile` does not depend on (see Decision 3) |
| V7 — Installed dependency layout | `ls node_modules` at the repo root | 14 entries — root dev-tooling only. `react`, `react-native`, `jsdom`, `jest-environment-jsdom` and `react-native-webview` are **not** resolvable from `packages/bank-scraper` today. This plan therefore declares every runtime and test dependency explicitly rather than relying on hoisting (Decision 2) |
| V8 — CI install mode | `.github/workflows/ci.yml` lint/typecheck/test jobs | All three run `pnpm install --frozen-lockfile`. Any dependency addition **must** ship a regenerated `pnpm-lock.yaml` or CI fails at install (see Documented Deviation D1) |
| V9 — Root lint rules already in force | `cat eslint.config.mjs` | `no-console: 'warn'` for `**/*.{ts,tsx}`; `no-restricted-properties` bans `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` repo-wide, including `.js`. Per-workspace configs may raise these (`packages/shared-utils/eslint.config.mjs` raises `no-console` to `error`) |
| V10 — Failure-reason copy keys | `apps/mobile/src/i18n/es.json` flattened and filtered for `credential` / `sync` / `bank` / `error` | Only design-system keys (`ds.badge.danger`, `ds.note.danger`, …). Item #34 shipped the i18n **infrastructure**; the `invalid_credentials` / `session_closed` / `network` / `parse_failed` copy keys **do not exist yet** and are owned by the item that first renders them. This plan emits codes only and adds no catalogue entry |
| V11 — Enumerated values this result must speak | `docs/project/4-database-model.md` lines 155, 176, 246-249 | `last_error_code` ∈ {`invalid_credentials`, `session_closed`, `network`, `parse_failed`}; product `type` ∈ {`checking`, `sight`, `savings`, `credit_card`, `credit_line`}; transaction `type` ∈ {`debit`, `credit`}; `amount INTEGER … always positive`; `dedup_hash = sha256(user_financial_product_id, date_local, amount, raw_description)` |

Residual verification strategy for the pattern-completeness claims in AC27 and AC28 is a
**committed test**, not a one-off grep — see [Bank containment and residue](#bank-containment-and-residue).

---

## Cross-Cutting Operational Assumption Check

### Applicable

| Assumption surface | Recorded value | Authoritative source | Verified at | Bounded cross-check scope | Result |
| --- | --- | --- | --- | --- | --- |
| Workspace dependency-resolution layout (does `packages/bank-scraper` need to declare `react`, `react-native`, `react-native-webview`, `jest-environment-jsdom` itself, or can it rely on hoisting?) | **Declare explicitly.** The plan does not rely on any hoisting behaviour | `ls node_modules` at repo root (V7); `.npmrc` = `node-linker=hoisted`; `pnpm-workspace.yaml` | 2026-08-02, repo SHA `54d4390` | Current invocation item list only: #3 (`apps/mobile/src/db/`), #5 (`packages/shared-domain/`), #6 (this item), #35 (`.npmrc`, `.github/workflows/`). #35 is the only same-surface item | `Verified` |
| Artifact ownership and base branch for this plan | Repository mode is `single_repo` (no `repository_mode` override in `.ai-dev-workflow.yaml`); this repository owns the plan; artifact base is `develop`; branch is `implementation-plan/6-port-bank-scraper-banco-de-chile` | `.ai-dev-workflow.yaml`; parent orchestrator handoff; `git rev-parse --abbrev-ref HEAD` | 2026-08-02, repo SHA `54d4390` | Current invocation only | `Verified` |
| Exclusive ownership of `packages/bank-scraper/` in this batch | This item owns the directory exclusively | Parent orchestrator handoff; open PR list (#39, unrelated surface) | 2026-08-02, repo SHA `54d4390` | Bounded to the four batch items and the one open PR named in the handoff. No repository-wide PR scan performed | `Verified` |

**Detail on the first row (the only one with same-surface evidence).** Item #35 moves
`nodeLinker: hoisted` out of `.npmrc` and into `pnpm-workspace.yaml`, deleting `.npmrc`
(`docs/specs/developments/20260801232851_35-pnpm-hoisted-layout-ci-bundle-check/2_35-…_implementation-plan.md`,
lines 141 and 212). The **declaration site** changes; the **effective value** (`hoisted`) does
not. This plan is written to be correct under either layout because every dependency it needs is
declared in `packages/bank-scraper/package.json` (Decision 2), so neither the pre-#35 nor the
post-#35 layout changes a single plan statement. Result is `Verified`, not `Conflict`: shared
keywords about pnpm layout are not conflict evidence when no plan statement depends on the
declaration site.

**Residual mechanical risk (not a conflict).** Both #6 and #35 regenerate `pnpm-lock.yaml`. That
is a textual merge collision, not a contradictory operational assumption. Handling is recorded in
Documented Deviation D1 and in Implementation Order Step 1.

---

## Documented Deviations

These are places where this plan knowingly departs from a literal reading of the spec or a
normative document. Each is declared here so a reviewer sees it stated rather than discovers it.

| # | Deviation | Why | Where it lands |
| --- | --- | --- | --- |
| **D1** | AC33 says "every change this item makes is inside `packages/bank-scraper/`". This plan also regenerates `pnpm-lock.yaml` at the repository root. | AC33's exclusion list names *configuration*: the package-manager configuration, the CI workflows, the lint configuration and the repository-architecture document. `pnpm-lock.yaml` is a **generated artifact**, and CI runs `pnpm install --frozen-lockfile` (V8), so any dependency added to the package's own `package.json` — which AC33 permits — makes regenerating it mandatory, not optional. `.npmrc`, `pnpm-workspace.yaml`, the root `package.json`, `.github/workflows/**` and the root `eslint.config.mjs` are **not** touched. | Implementation Order Step 1 |
| **D2** | `docs/best-practices/stack/bank-scraper.md` shows bank configs at `packages/bank-scraper/configs/cl/<bank>/`. This plan puts them at `packages/bank-scraper/src/configs/cl/banco-de-chile/`. | `packages/bank-scraper/tsconfig.json` sets `"rootDir": "src"` and `"include": ["src"]` (V2). A `configs/` directory outside `src/` would be invisible to `tsc` and to the package's own build. The containment property AC27 actually cares about — one directory per bank, nothing bank-specific outside it — is preserved exactly. | Documentation Updates: `docs/best-practices/stack/bank-scraper.md` |
| **D3** | The committed HTML fixtures are **hand-authored from the selector contracts encoded in the ported scripts**, not captured from a live Banco de Chile session. | Nobody can commit a captured page without first having a real session, and the spec forbids committing anything real. Authoring from the selectors is the only path available to an implementation agent. The honest cost is that a fixture can agree with the script and still disagree with the bank. | `fixtures/README.md` records the provenance verbatim; Risk R1; follow-up F3 |
| **D4** | The source's `utils/format/format.utils.ts` is **not ported at all**; `@finanzas/shared-utils` replaces it. Its docblocks are not copied either. | AC29 requires the shared utilities rather than a second copy. Separately: that file's docblock contains a **check-digit-valid RUT** as an example value. Porting the file, or even its comments, would commit a real-looking RUT to this repository. The specific digits are deliberately not reproduced in this plan. | Implementation Order Step 6; `source-rut-scan.test.ts` exists precisely to catch this class of mistake |

---

## Escalation Check — is there any point where data leaves the device?

**No, and none is introduced.** Stated explicitly because it is the product's defining
constraint:

- The only network egress in this item is the hidden WebView loading `https://login.portales.bancochile.cl`
  and the pages that host navigates to within that origin. Every other origin is blocked before
  navigation (Decision 4).
- No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon` appears in
  any file this item adds, in TypeScript **or** inside an injected script string. This is
  enforced two ways because the two halves need different tools: ESLint `no-restricted-globals`
  for the TypeScript, and `no-network-egress.test.ts` scanning the **generated script strings**
  for the same tokens, because ESLint cannot see inside a template literal.
- No analytics, no crash reporting, no remote logging, no export, no exchange-rate lookup.
  Foreign-currency movements are reported in their own currency precisely so that no rate has to
  be fetched (spec Conflict 4).
- The package declares no HTTP client and bans importing one (`axios`, `node-fetch`, `undici`).

If any later change to this design were to require a server, it is a blocking escalation, not a
design problem to route around.

---

## Layer-by-Layer Changes

### Database / Data Layer

- [ ] **None.** This item writes nothing to SQLite and imports no SQL library. `drizzle-orm`,
      `expo-sqlite`, `better-sqlite3` and friends are banned by
      `packages/bank-scraper/eslint.config.mjs` (Decision 12). Mapping a `ScrapeResult` onto
      `user_financial_products` / `transactions` is item #10.

### Backend / API

- [ ] **None — there is no backend.** See [Escalation Check](#escalation-check--is-there-any-point-where-data-leaves-the-device).

### Shared Packages / Libraries

#### `@finanzas/bank-scraper` — package configuration

- [ ] `package.json`: add `peerDependencies` (`react`, `react-native`, `react-native-webview`)
      and matching `devDependencies`, plus `jest-environment-jsdom`. Keep
      `@finanzas/shared-utils: workspace:*`. Keep `main`/`types` pointing at `src/index.ts`;
      **do not** add an `exports` map (Decision 3).
- [ ] `jest.config.js`: two Jest projects — `engine` (`testEnvironment: 'node'`) and `dom`
      (`testEnvironment: 'jsdom'`), split by the `*.dom.test.ts` filename suffix.
- [ ] `tsconfig.json`: add `"jsx": "react-jsx"` and `"lib": ["ES2022", "DOM"]` (the `.dom.test.ts`
      files need DOM lib types). The widened `lib` is why the egress bans below are not optional.
- [ ] `eslint.config.mjs`: raise `no-console` to `error` for this workspace (matching
      `packages/shared-utils`); add `no-restricted-imports` (secrets, SQL, HTTP clients,
      telemetry) and `no-restricted-globals` (`fetch`, `XMLHttpRequest`, `WebSocket`,
      `EventSource`). Root `eslint.config.mjs` is **not** modified.

#### `@finanzas/bank-scraper` — types (`src/types/`)

- [ ] `protocol.types.ts` — `ScraperEventType`, `ScraperStepId`, `VALID_STEP_TRANSITIONS`,
      `FailureReasonCode`, `ReadOutcome`, `NON_RETRYABLE_ERROR_CODES`, `ScraperRequestRejection`.
- [ ] `scrape-result.types.ts` — `ScrapedProduct`, `ScrapedMovement`, `ProductReadFailure`,
      `ScrapeResult`, `ScraperTrace`, `ProductType`, `MovementDirection`.
- [ ] `bank-config.types.ts` — `BankConfig`, `ScriptConfig`, `BankNormalizer`, `WebViewPort`.

#### `@finanzas/bank-scraper` — security perimeter (`src/security/`)

- [ ] `origin-allowlist.ts` — `isAllowedOrigin`, `assertCredentialEntryAllowed`.
- [ ] `credential-holder.ts` — `CredentialHolder` (`consume`, `clear`, `isCleared`).
- [ ] `redaction.ts` — `TraceRedactor` (`redactTrace`, `redactErrorPayload`), `FORBIDDEN_TRACE_KEYS`.
- [ ] `js-string-literal.ts` — `toJsStringLiteral`.

#### `@finanzas/bank-scraper` — engine (`src/engine/`)

- [ ] `scrape-session.ts` — `ScrapeSession`: `start`, `cancel`, `isFinalized`, `finalize`,
      `deriveOutcome`, the read deadline.
- [ ] `message-handler.service.ts` — inbound message routing, redaction, finalized-guard.
- [ ] `state-manager.service.ts` — step machine, monotonic progress, partial-data merge.
- [ ] `webview-driver.service.ts` — navigation, injection, the three origin gates, teardown.
- [ ] `product-shape.ts` — `assertReportedProductShape`, `assertReportedMovementShape`
      (forbidden-key guards, see Decision 8).

#### `@finanzas/bank-scraper` — country-level parsing (`src/parsing/`)

- [ ] `amount.ts` — `parseMinorUnits(text, currencyCode)`, `CURRENCY_MINOR_UNIT_EXPONENTS`,
      `AmountParseError`. Integer-string arithmetic only; no `parseFloat`, ever.
- [ ] `date.ts` — `parseBankDateLocal(text)` → `DateLocal`, via `@finanzas/shared-utils`'s
      `toDateLocal`. No `Date`, no `toISOString`, no timezone.

These two are **country conventions, not bank knowledge** — "dots for thousands, comma for
decimals, `DD/MM/YYYY`" is how every Chilean bank writes money and dates. AC27 is about Banco de
Chile's *address, page addresses, selectors and parsing rules*; those all stay in the bank
directory. This boundary is stated here because it is the one place a reviewer could reasonably
read AC27 differently.

#### `@finanzas/bank-scraper` — injected-script helpers (`src/scripts/`)

- [ ] `script-utils.ts` — `commonHelperFunctions`, `generateExecutableStepFunction`,
      `generateWaitForElementHelperFunctions`, `generateInstanceIdHelperFunction`. Bank-agnostic.

#### `@finanzas/bank-scraper` — Banco de Chile (`src/configs/cl/banco-de-chile/`)

- [ ] `banco-de-chile.config.ts` — id `banco-de-chile`, URL, `allowedOrigins`,
      `credentialEntryOrigin`, credential fields (using `formatRut` / `isValidRut`), script map.
- [ ] `banco-de-chile.normalizer.ts` — `mapProductKind`, `mapMovementDirection`,
      `mapMovementExtras`. All Spanish-facing mapping lives here.
- [ ] `banco-de-chile.login.script.ts`
- [ ] `banco-de-chile.home.script.ts`
- [ ] `banco-de-chile.account-transactions.script.ts`
- [ ] `banco-de-chile.credit-card-details.script.ts`
- [ ] `fixtures/*.html` + `fixtures/README.md`

#### `@finanzas/bank-scraper` — registry (`src/configs/`)

- [ ] `index.ts` — `BANK_CONFIGS: Record<string, BankConfig[]>`, keyed `'cl'`.
- [ ] `cl/index.ts` — `CL_BANKS = [BANCO_DE_CHILE_CONFIG]`. Exactly one entry (AC28).

#### `@finanzas/bank-scraper` — React adapter (`src/component/`)

- [ ] `bank-scraper.component.tsx` — the hidden `<WebView>` and the `WebViewPort` implementation.
- [ ] `index.ts` — component-only barrel, **not** re-exported from `src/index.ts` (Decision 3).

#### `@finanzas/bank-scraper` — test infrastructure

- [ ] `src/testing/fixture-scan.ts`, `synthetic-allowlist.ts`, `prohibited-name-tokens.ts`
- [ ] `src/test-utils/fake-webview-port.ts`, `load-fixture.ts`

### Frontend / UI

- [ ] **None.** This item renders nothing a person sees. The hidden `<WebView>` is a headless
      driver with no visible surface and no copy. No route, no screen state, no i18n key
      (V10). `apps/mobile` is **not** modified — its existing
      `src/__tests__/workspace-wiring.test.ts` must keep passing unchanged (V6), which is a
      verification step, not an edit.

### Infrastructure / Configuration

- [ ] `pnpm-lock.yaml` regenerated (Documented Deviation D1). No other repository-level file.

### Executable workflow shell snippets

Not applicable — this plan adds no executable shell guidance to a framework-owned surface. The
commands in the Implementation Order and the runbook are `pnpm` / `git` invocations run by a
human or agent, not committed shell scripts.

---

## Architecture and Decisions

### Decision 1 — In-page scripts traverse the DOM; the RN side parses everything

The source parses amounts and dates **inside the page**, with `parseIntAmount` /
`parseFloatAmount` / `formatDate` helpers embedded in the injected script string. That is where
its two worst defects live: `parseFloatAmount` produces a float, and `formatDate` builds a
`Date` in the device's local zone and calls `toISOString()` — the exact "transaction shows up in
the wrong month" failure in the repository's troubleshooting table.

This port moves the boundary. The injected script posts **raw strings and structural facts**;
`packages/bank-scraper/src/parsing/` turns them into values.

| Runs in the page | Runs on the React Native side |
| --- | --- |
| Selector matching, waiting, clicking, pagination | Amount → minor-unit integer (`parseMinorUnits`) |
| Reading `textContent` / `innerHTML` of a cell | `DD/MM/YYYY` → `DateLocal` (`parseBankDateLocal`) |
| SHA-256 of the raw account identifier (Decision 6) | Bank wording → `ProductType` (`mapProductKind`) |
| Masking the identifier to its last four digits | Column → `debit` / `credit` (`mapMovementDirection`) |
| Reporting the bank's own stated movement count | Count reconciliation (AC12), shape guards, assembly |

Why it matters here specifically: the parsing rules are the part that must be provable, and a
plain TypeScript function is provable in a millisecond with no jsdom, no fixture and no
`new Function`. It also removes every float from the in-page code, which is otherwise
unreachable by ESLint.

### Decision 2 — Every dependency is declared, none is assumed hoisted

V7 shows the root `node_modules` currently holds dev tooling only, so `react-native-webview`,
`react`, `react-native`, `jsdom` and `jest-environment-jsdom` are not resolvable from this
package today. `packages/bank-scraper/package.json` therefore declares:

```jsonc
// Illustrative — adapt versions during implementation to match apps/mobile's pinned versions.
{
  "peerDependencies": {
    "react": ">=19.1.0",
    "react-native": ">=0.81.0",
    "react-native-webview": ">=13.0.0"
  },
  "devDependencies": {
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-native-webview": "^13.16.0",
    "@types/react": "~19.1.0",
    "jest-environment-jsdom": "^29.7.0"
  }
}
```

`react` and `react-native` versions **must match** the versions `apps/mobile/package.json`
already pins (`react 19.1.0`, `react-native 0.81.5`) so pnpm resolves one copy. The
`react-native-webview` version is the one thing not already pinned anywhere in this repository;
Step 1 selects it and records the resolved version in the PR description.

`react-native-webview` becomes an **unmet peer dependency of `apps/mobile`**, which does not
declare it. That is a warning under pnpm's default `strict-peer-dependencies=false`, not an
error, and nothing in `apps/mobile` imports the component yet (V6). Adding it to
`apps/mobile/package.json` is out of scope by AC33 and is recorded as follow-up F1 for the
connect-flow item. Step 1's verification explicitly checks that `pnpm install --frozen-lockfile`
and `pnpm test` still succeed with the unmet peer.

### Decision 3 — The barrel stays headless; the component is a deep import

`apps/mobile/src/__tests__/workspace-wiring.test.ts` imports from `@finanzas/bank-scraper`
today (V6). If `src/index.ts` re-exported the React component, that test would begin resolving
`react-native-webview`, which `apps/mobile` does not have installed — turning a merged,
passing test red.

So:

- `src/index.ts` exports `PACKAGE_NAME`, the types, the protocol enums, the engine, the registry,
  the parsing helpers and the security helpers. **It imports nothing from `react`,
  `react-native` or `react-native-webview`.**
- The component lives at `src/component/` and is reachable as
  `@finanzas/bank-scraper/src/component`. No `exports` map is added: the package has none today,
  so subpath resolution is unrestricted, and adding one risks changing how Metro and `jest-expo`
  resolve the existing barrel for zero benefit at this stage. The connect-flow item may add one
  when it first imports the component (follow-up F1).
- A test asserts the constraint rather than trusting it:
  `src/index.barrel-purity.test.ts` reads `src/index.ts` and every module it transitively
  re-exports and asserts none of them contains an import of `react`, `react-native` or
  `react-native-webview`.

### Decision 4 — Exact origin allowlist, checked at three independent points

*(Spec Business Rule 5, AC16. This is carried-forward non-negotiable 1.)*

**The allowlist.** `BankConfig` gains two fields, both in the bank's own directory:

```ts
// Illustrative — adapt during implementation.
allowedOrigins: ['https://login.portales.bancochile.cl'] as const,
credentialEntryOrigin: 'https://login.portales.bancochile.cl',
```

**The comparison.** `isAllowedOrigin(url, allowedOrigins)` in `src/security/origin-allowlist.ts`:

```ts
// Illustrative — adapt during implementation.
export function isAllowedOrigin(url: string, allowedOrigins: readonly string[]): boolean {
  let candidate: URL;
  try {
    candidate = new URL(url);
  } catch {
    return false; // unparseable is never allowed
  }
  if (candidate.protocol !== 'https:') return false;
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === candidate.origin;
    } catch {
      return false;
    }
  });
}
```

Comparing `URL.origin` — never `hostname.endsWith(...)`, never `url.includes(...)` — is what
makes the check exact. `URL.origin` lower-cases the host, normalizes the default port, and
**drops userinfo**, so `https://login.portales.bancochile.cl@evil.example/` yields origin
`https://evil.example` and is rejected. Suffix lookalikes
(`https://login.portales.bancochile.cl.evil.example`) and sibling subdomains
(`https://portales.bancochile.cl`) are rejected for the same reason. Punycode/IDN homographs
are rejected because `URL` normalizes to the ASCII form and the ASCII form does not match.

**The three checkpoints.** Each closes a gap the others cannot:

1. **Navigation gate** — `onShouldStartLoadWithRequest` on the `<WebView>` returns `false` for
   any request whose URL fails `isAllowedOrigin`, blocking the navigation before a byte is
   fetched. `about:blank` is the single exception, allowed only as the bootstrap source before
   the first real navigation; it is never a credential-entry origin.
2. **Injection gate** — `WebViewDriverService.injectFor(url)` re-checks the **load-end URL**
   before injecting *any* script. This is the checkpoint that catches server-side redirects,
   which `onShouldStartLoadWithRequest` does not reliably fire for on Android. Whatever the
   redirect chain did, the URL the page actually settled on is the one checked.
3. **In-page gate** — the login script's own first statement is
   `if (window.location.origin !== <literal from config>) { post ERROR origin_blocked; return; }`,
   before either input is touched. Injection is asynchronous (the source even injects some
   scripts behind a `setTimeout` delay); the page can navigate between checkpoint 2 and the
   script actually running. Checkpoint 3 is the only one that observes the origin at the instant
   the credential would be typed.

`originWhitelist={['https://login.portales.bancochile.cl']}` is also set on the `<WebView>`, as
defence in depth only. It is a react-native-webview link-handling filter, not the gate.

**What happens on a violation.** Never silently continue, never `parse_failed`:

| Condition | Outcome | Reason code |
| --- | --- | --- |
| Violation after the login step completed (`sessionEstablished === true`) | read ends | `session_closed` |
| Violation before the login step completed | read ends | `network` |

In both cases: no credential is entered, the read terminates through the single `finalize()`
path (so the credential is cleared and the session torn down), and a trace entry
`origin_blocked` is recorded carrying **`blockedOrigin` and `expectedOrigin` only** — never the
full URL, whose path and query string can carry session-identifying material.

**How this check is proven to fire, and proven not to over-fire.**

| Direction | Evidence |
| --- | --- |
| Fires on a real violation (automated) | `origin-allowlist.test.ts`: a table of rejected inputs — suffix lookalike, sibling subdomain, userinfo trick, `http://` downgrade, IDN homograph, unparseable string. `webview-driver.service.test.ts`: driving the session with a `FakeWebViewPort` whose load-end URL is the suffix lookalike asserts (a) `injectJavaScript` was never called with the login script, (b) `outcome === 'failed'` with `reasonCode === 'network'`, (c) `credentials.isCleared() === true` |
| Fires on a real violation (planted-defect proof, recorded in the PR) | Start clean (`pnpm --filter @finanzas/bank-scraper test` green, `git diff --stat` empty). Replace the `URL.origin` comparison in `src/security/origin-allowlist.ts` with `candidate.hostname.endsWith(new URL(allowed).hostname)` — a plausible bug, not a strawman. Re-run: the suffix-lookalike cases in `origin-allowlist.test.ts` and the credential-gate case in `webview-driver.service.test.ts` must fail, and the PR records the failing test names and the file/line of the edit. `git checkout -- src/security/origin-allowlist.ts`; re-run green; `git diff --stat` prints nothing |
| Does not over-fire | The same test file asserts the **allowed** cases pass: `https://login.portales.bancochile.cl/login`, `.../login?next=%2Fhome`, `https://LOGIN.PORTALES.BANCOCHILE.CL/login`, and `https://login.portales.bancochile.cl:443/login`. `scrape-session.test.ts`'s AC1 happy-path drives a full read entirely through allowed URLs and asserts `outcome === 'complete'` with at least one product and its movements — a gate that blocked everything would fail it |

### Decision 5 — Credential ownership, one holder, one clear

*(Spec Business Rules 1-4 and 6, AC2-AC4. This is carried-forward non-negotiable 2.)*

**Who reads secure store: not this package.** The connect flow (a separate item) reads
`expo-secure-store` and calls `session.start({ countryCode, bankId, credentials })`.
`packages/bank-scraper` never imports `expo-secure-store` — banned in the package's own ESLint
config (Decision 12) and asserted by `src/security/no-secure-store.test.ts`, which scans every
`.ts`/`.tsx` file under `src/` for the module specifier.

**Where it lives, and for how long.** Exactly one object holds the plaintext, for exactly the
duration of one read:

```ts
// Illustrative — adapt during implementation.
export class CredentialHolder {
  #fields: Record<string, string> | null;
  constructor(fields: Readonly<Record<string, string>>) { this.#fields = { ...fields }; }
  consume<T>(fn: (fields: Readonly<Record<string, string>>) => T): T {
    if (this.#fields === null) throw new CredentialsClearedError();
    return fn(this.#fields);
  }
  clear(): void {
    if (this.#fields !== null) {
      for (const key of Object.keys(this.#fields)) this.#fields[key] = '';
      this.#fields = null;
    }
  }
  isCleared(): boolean { return this.#fields === null; }
}
```

The holder is a private field of `ScrapeSession`. It is never assigned to a React component's
props, state or ref; never placed in Context; never put in a Query cache; never assigned to
module scope. `#` private fields are used specifically so nothing outside the class can reach the
values, including via `Object.keys` or a spread.

**An honest statement about clearing.** JavaScript strings are immutable, so `clear()` **cannot**
overwrite the bytes of the string the caller passed in. What it guarantees is precise and
testable: the holder drops every reference, so the strings become unreachable and GC-eligible,
and every subsequent `consume()` throws `CredentialsClearedError`. Claiming byte-level zeroing
would be false, and this plan does not claim it. The clearing of the caller's *own* copy is the
connect flow's obligation (spec Business Rule 1), not this package's.

**Does it cross the bridge, and can it be logged?** Yes it crosses — typing into the bank's form
is the entire purpose — and no, it cannot be logged. Four controls:

1. **Escaping, not interpolation.** The source writes `rutInput.value = '${rut}';`, which breaks
   on an apostrophe and is a script-injection vector. This port builds the literal with
   `toJsStringLiteral(value)` = `JSON.stringify(value)` with U+2028/U+2029 replaced by their
   escapes. That satisfies AC4 for quotes, backslashes, newlines and Unicode line separators,
   and makes a credential value structurally incapable of changing what executes.
2. **The generated string is never returned, stored or traced.**
   `WebViewDriverService.injectLoginScript()` builds the string **inside**
   `credentials.consume(...)` and hands it straight to `port.injectJavaScript(...)` in the same
   expression; the method returns `void`. The trace for that injection records
   `{ scriptKey: 'login' }` and nothing else. `ScraperTrace` has no `scriptSource` field at the
   type level, so recording one is a compile error, and `FORBIDDEN_TRACE_KEYS` drops it at
   runtime if it ever arrives from the page.
3. **The bank's error text never comes back.** The source posts the bank's own error sentence
   with `invalid_credentials`. Bank error banners can echo what was typed. This port's login
   script posts `{ code: 'invalid_credentials' }` with **no message field at all** (spec Use
   Case 3, AC14) — the echo channel is removed rather than filtered.
4. **Value-scanning redaction as defence in depth.** `TraceRedactor` holds a reference to the
   **same** `CredentialHolder` — not a second copy — and scans every outbound trace and error
   payload for the current credential values before it becomes text. One `clear()` therefore
   disarms both the holder and the redactor's scanning input simultaneously; after `clear()` the
   redactor falls back to key-based redaction only, which is safe because no read is in flight.

**What clears it, and exactly when.** One code path, `ScrapeSession.finalize(outcome)`, ordered:

```text
finalize(outcome):
  if (this.#finalized) return;      // idempotency mechanism: a boolean checked-and-set first
  this.#finalized = true;
  clearTimeout(this.#deadlineTimer);
  this.#credentials.clear();        // ALWAYS before teardown (spec Cancellation)
  this.#driver.teardown();          // stopLoading + navigate to about:blank + unmount flag
  this.#emitResult(outcome);
```

Every terminal path — `complete`, `partial`, `failed`, `cancelled`, deadline expiry, and the
origin-gate violations of Decision 4 — reaches `finalize()` and no other. The ordering
(clear-then-teardown) is the spec's Cancellation requirement stated as code, and
`scrape-session.test.ts` asserts the order by recording a call log from the fake port and
asserting `credentials.clear` precedes `port.stopLoading`.

**The named test that proves it: `src/security/credential-leak.test.ts`** (AC2, spec Business
Rule 4). It drives a full read against the committed fixtures with sentinel credentials:

- `rut: 'ZZSENTINELRUTZZ'`
- `password: 'ZZSENTINELPASSZZ'`
- a second parameterised run with `password: 'ZZ"\\\'<>&\u2028ZZ'` (AC4's punctuation case)

then asserts the sentinels appear in **none** of: `JSON.stringify(result)`,
`JSON.stringify(result.traces)`, `JSON.stringify(result.readFailure)`,
`JSON.stringify(result.productFailures)`, or any argument captured by spies installed on
`console.log`, `console.warn`, `console.error`, `console.info` and `console.debug`.

| Direction | Evidence |
| --- | --- |
| Fires on a real violation (planted-defect proof, recorded in the PR) | Clean and green; `git diff --stat` empty. Add `sendTrace({ logGroup: LOG_GROUP, message: 'rut=' + ${toJsStringLiteral(rut)} });` to the login-script generator in `banco-de-chile.login.script.ts` — a realistic debugging mistake, not a strawman. Re-run: `credential-leak.test.ts` fails, and its failure message names the offending trace index and which sentinel matched. Record the failing test name and the file/line of the edit in the PR. `git checkout --` the file; re-run green; `git diff --stat` prints nothing |
| Does not over-fire (this is the important half) | A check that blanked every trace would pass the leak test trivially and be useless. The same test therefore also asserts the read produced **real** diagnostics: `result.traces.length >= 10`; a trace whose `message` is exactly `'Step completed'` for `stepName: 'submit-form'` is present; a trace reporting the product count is present; and the masked identifier `'••••1111'` appears in the trace stream. The AC1 happy-path assertions in `scrape-session.test.ts` run against the same fixtures and require a non-empty result |

### Decision 6 — Opaque product instance identity, never a list position

*(Spec Business Rule 15, Conflict 1, AC24. This is carried-forward non-negotiable 4.)*

**The identity.** `ScrapedProduct.instanceId` is a lowercase hex SHA-256 digest, truncated to 32
hex characters, computed **inside the page**:

```text
instanceId = sha256hex('finanzas.product.v1' + '|' + bankId + '|' + kindKey + '|' + rawIdentifier)
             .slice(0, 32)
```

- `PRODUCT_ID_DOMAIN_SEPARATOR = 'finanzas.product.v1'` — a committed, non-secret constant whose
  only job is domain separation, so a future identity scheme can be versioned without colliding.
- `rawIdentifier` is the account number, digits only, for an account; and
  `brand + '|' + category + '|' + last4` for a card, because the last four digits are all Banco
  de Chile's product list exposes for a card.
- `kindKey` is the bank's own kind token (`cuenta-corriente`, `cuenta-vista`, `cuenta-fan`,
  `tarjeta-credito`), so two products of different kinds can never collide.

**Why it is computed in the page and not on the RN side.** Business Rule 15 and spec Decision 10 say
the raw account number must never appear in a result, a diagnostic, or anything handed
downstream. Hashing on the RN side would require the raw number to cross the bridge first. The
page has `crypto.subtle.digest('SHA-256', …)` available because the bank origin is HTTPS and
therefore a secure context. **If `crypto.subtle` is unavailable, the product's extraction fails
with `parse_failed` for that product** — it never falls back to the raw number and never falls
back to an index.

**An honest statement about what the hash buys.** For an **account**, the hash is what keeps the
8-9 digit account number from ever leaving the page — a real and meaningful property. For a
**card**, the input is `brand|category|last4`, all three of which the result already reports as
display fields; the hash buys **stability and uniformity**, not secrecy, and this plan does not
claim otherwise. Nor does it claim brute-force resistance: a fixed-salt SHA-256 over an 8-digit
number is enumerable by anyone who already holds the database. The property being bought is *the
raw number is never stored, displayed, or transmitted* — not *the number is cryptographically
hidden from an attacker who has the database*.

**Never a list position — enforced, not merely intended.** The source stores
`metadata.elementIdex` / `metadata.elementIndex` on each product and posts the whole product
object across the bridge. Three changes:

1. The click index stays a **page-local** variable
   (`window.globalVariables.products[i].__clickIndex`) and is never part of a posted payload.
2. The in-page `toReportedProduct(p)` function builds the outgoing object from an explicit
   allow-list of keys, so adding a field to the internal object cannot leak it by accident.
3. `assertReportedProductShape()` on the RN side (`src/engine/product-shape.ts`) rejects any
   inbound product carrying a key in
   `FORBIDDEN_PRODUCT_KEYS = ['elementIndex', 'elementIdex', '__clickIndex', 'accountNumber', 'rawIdentifier', 'index', 'position']`,
   and rejects any product whose `instanceId` is not 32 lowercase hex characters. A rejected
   product yields `parse_failed` for that product, not a silently degraded one.

**Movements carry position — explicitly scoped to one read.** Business Rule 14 needs a
same-read tie-breaker for two identical same-day movements. The field is named
`positionInReadSnapshot` rather than `index` or `position` so it cannot be misread as stable, its
doc comment states that a reordered page, an inserted movement or a pagination change can all
change it between reads, and Conflict 2's constraint on item #10 is restated there.

**Evidence.**

| Direction | Evidence |
| --- | --- |
| Fires on a real violation | `product-shape.test.ts` asserts a payload containing `elementIndex` is rejected and names the offending key; a payload whose `instanceId` is `'0'` or a raw account number is rejected. Planted-defect proof in the PR: add `elementIndex: index` to `toReportedProduct` in `banco-de-chile.home.script.ts`; `home.script.dom.test.ts` and `scrape-session.test.ts` must fail; revert; `git diff --stat` empty |
| Does not over-fire | `product-shape.test.ts` asserts a clean **in-page payload** with every legitimate field is **accepted**. Note the two-stage naming, which is deliberate and not a contradiction: the payload the page posts carries `kindKey` (the bank's own token) and `balanceText` (a raw string), and the RN-side assembler turns those into the result's `kind` (an enumerated `ProductType`) and `balanceMinorUnits` (an integer) — see Decision 7's `ScrapedProduct`. `instanceId`, `displayName`, `maskedIdentifier` and `currencyCode` carry the same name at both stages. `home.script.dom.test.ts` (AC24) runs the home routine twice against the byte-identical fixture and asserts the two accounts of the same kind get **two different** `instanceId` values and that each is **identical** across the two runs |

### Decision 7 — The result shape, and how the outcome is derived

*(Spec "What a read reports", Business Rules 13-14, 16, 19 and 31, Conflict 2, AC13, AC17,
AC21-AC23, AC25. The movement half is designed for, not implemented by, item #10.)*

**The result.** One object per read, emitted exactly once by `finalize()`:

```ts
// Illustrative — adapt during implementation.
export type ReadOutcome = 'complete' | 'partial' | 'failed' | 'cancelled';
export type FailureReasonCode =
  | 'invalid_credentials' | 'session_closed' | 'network' | 'parse_failed';

export interface ProductReadFailure {
  productInstanceId: string;        // which product; never populated for a read-level failure
  reasonCode: FailureReasonCode;
  attempts: number;
}

export interface ScrapeResult {
  outcome: ReadOutcome;
  countryCode: string;              // 'cl'
  bankId: string;                   // 'banco-de-chile'
  products: ScrapedProduct[];
  movements: ScrapedMovement[];
  readFailure: { reasonCode: FailureReasonCode } | null;  // read-level; names no product
  productFailures: ProductReadFailure[];                  // product-scoped
  skippedProductKinds: string[];    // Business Rule 16's diagnostic, e.g. ['linea-de-credito']
  traces: ScraperTrace[];           // already redacted
}
```

`readFailure` carries **no product** on purpose: a read-level failure — most notably
`invalid_credentials` — happens before any product is discovered, so there is none to name
(AC14). Product-scoped failures live in `productFailures` and each names its product (AC13).

**The product.**

```ts
// Illustrative — adapt during implementation.
export interface ScrapedProduct {
  instanceId: string;               // Decision 6: opaque, stable, 32 lowercase hex chars
  kind: ProductType;                // 'checking' | 'sight' | 'credit_card' (enumerated only)
  displayName: string;              // the bank's own words, verbatim
  currencyCode: string;             // 'CLP' for every Banco de Chile MVP product
  maskedIdentifier: string;         // '••••1111' — the only identifier a screen or trace may show
  balanceMinorUnits: number;        // integer
  creditLimitMinorUnits?: number;   // cards only
  availableCreditMinorUnits?: number; // cards only
  cardBrand?: string;               // cards only
  cardCategory?: string;            // cards only
  cardLast4?: string;               // cards only
}
```

There is deliberately **no** raw account number field and **no** index field anywhere in this
shape (Decision 6).

**Outcome derivation — one function, `deriveOutcome()` in `scrape-session.ts`**, evaluated in
this order so the branches cannot overlap:

| # | Condition | Outcome |
| --- | --- | --- |
| 1 | `#cancelled` is set | `cancelled` — regardless of anything gathered or failed |
| 2 | `readFailure !== null` or `productFailures.length > 0`, **and** `products.length === 0 && movements.length === 0` | `failed` |
| 3 | `readFailure !== null` or `productFailures.length > 0`, and something was gathered | `partial` |
| 4 | otherwise | `complete` |

`skippedProductKinds` is **not** consulted by any branch. That is the scoped-completeness
contract of Business Rule 16 stated as code: a product kind outside the enumerated set is a known
MVP limitation, named in the trail, and does not by itself stop a clean read being `complete`
(AC25). `scrape-session.test.ts` asserts all four branches plus the mixed-kind case.

**The movement — the shape item #10 needs** (spec Business Rules 13-14, Conflict 2, AC21-AC23):

```ts
// Illustrative — adapt during implementation.
export interface ScrapedMovement {
  productInstanceId: string;        // → user_financial_product_id
  dateLocal: string;                // 'YYYY-MM-DD' → date_local
  amountMinorUnits: number;         // positive safe integer → amount
  direction: 'debit' | 'credit';    // → type
  currencyCode: string;             // 'CLP' | 'USD' → currency_code
  rawDescription: string;           // verbatim from the bank → raw_description
  bankSuppliedId: string | null;    // → external_id; ALWAYS null for Banco de Chile
  positionInReadSnapshot: number;   // same-read tie-breaker ONLY — never a cross-read identity
  extras: Readonly<Record<string, string | number | boolean>>;
}
```

The first six fields are exactly the inputs `docs/project/4-database-model.md:247` names for
`dedup_hash = sha256(user_financial_product_id, date_local, amount, raw_description)` plus the
two the model stores alongside. `bankSuppliedId` is `null` for every Banco de Chile movement
because the bank supplies no identifier (spec Conflict 2, AC23) — the scraper does **not**
manufacture one from the movement's own content and pass it off as the bank's.

`extras` keys are stable identifiers, never the bank's Spanish column headings (spec Decision
11): `movementKind`, `installments`, `city`, `country`, `originalCurrencyCode`,
`originalAmountMinorUnits`, `billed`.

### Decision 8 — Bounded retries, and the one thing that is never retried

*(Spec Business Rules 21-22 and 32, AC19. Spec Decision 16's number is set here.)*

| Constant | Value | Scope | Backoff |
| --- | --- | --- | --- |
| `MAX_STEP_ATTEMPTS` | `3` | one page-level step | constant `STEP_RETRY_DELAY_MS = 1000` |
| `MAX_ELEMENT_ATTEMPTS` | `10` | waiting for one element | constant `ELEMENT_RETRY_DELAY_MS = 200` |
| `MAX_SUBMIT_ATTEMPTS` | `1` | the login form submit | none — see below |
| `READ_DEADLINE_MS` | `240_000` | the whole read | n/a |

**Backoff is constant, not exponential, and that is deliberate.** The failure being retried is
"the bank's Angular view has not rendered this element yet", which resolves in hundreds of
milliseconds or not at all. Exponential backoff would triple the worst case for a failure mode
that does not benefit from waiting longer. The values are the proven source implementation's
defaults, which Business Rule 32 names explicitly. Worst case per page-level step: 3 × (step time
+ 1 s). Worst case per element wait: 2 s.

**`MAX_SUBMIT_ATTEMPTS = 1` fixes a real defect in the source.** The source wraps
`fill-rut-input`, `fill-password-input` and `submit-form` in the generic three-attempt wrapper,
which means a flaky submit clicks "Ingresar" up to three times. That is precisely the repeated
sign-in attempt Business Rule 22 forbids because it locks the person's real bank account. In this
port, the credential-entry and submit steps run with `maxRetries: 1`.

**`invalid_credentials` is not retried at all.** Mechanism: `NON_RETRYABLE_ERROR_CODES =
['invalid_credentials']`; `MessageHandlerService` routes any inbound `ERROR` whose code is in
that set straight to `ScrapeSession.finalize('failed')` without re-invoking the step and without
consulting any attempt budget. This is stronger than "subject to the same cap".

**The overall deadline.** `READ_DEADLINE_MS = 240_000` (4 minutes) — one `setTimeout` created in
`start()` and cleared as the first action of `finalize()`. Basis: the source's observed cost is
roughly 20-30 s per product (calendar navigation plus up to two months of ten-row pages); a
person with four products lands near 2 minutes, so 4 minutes leaves headroom for a slow
connection while keeping the syncing screen bounded. On expiry, `finalize()` runs with outcome
`partial` if anything was gathered and `failed` otherwise, and the reason is
`#lastAttemptedStepFailureReason` — `network` while navigating or loading, `parse_failed` while
parsing — as Business Rule 32 requires. **Spec Decision 16 requests human confirmation of this
number**; it is set here so implementation is unblocked, and it is a single named constant so
changing it is a one-line edit.

**Evidence.**

| Direction | Evidence |
| --- | --- |
| Fires | `scrape-session.test.ts` with Jest fake timers: a step that never succeeds produces exactly `MAX_STEP_ATTEMPTS` attempts and then a failure, and the trace stream records `attempts: 3` (AC19). A read that never completes finalizes at exactly `READ_DEADLINE_MS`. `login.script.dom.test.ts` against `login-invalid-credentials.html` asserts the submit button was clicked exactly **once** and the outcome is `invalid_credentials` (AC14) |
| Does not over-fire | The same suite asserts a step that succeeds on the first attempt records `attempts: 1` and triggers **no** wait, and that the AC1 happy path finalizes well inside the deadline with `outcome === 'complete'` — a retry bound that fired on everything would break both |

### Decision 9 — Cancellation is an outcome, not a failure

*(Spec Cancellation section, Decision 9, AC3.)*

`ScrapeSession.cancel()` is public alongside `start()`. It sets `#cancelled = true`, then calls
`finalize('cancelled')`, whose ordering (clear credentials → tear down browser) is Decision 5's.

- **Interrupts mid-navigation and mid-injection.** `teardown()` calls `port.stopLoading()` and
  navigates the WebView to `about:blank`, destroying the page's JavaScript context. An injected
  script already running cannot be killed from React Native — this plan does not pretend
  otherwise — but its context is destroyed and anything it posts is discarded.
- **Discards late responses.** `MessageHandlerService.handleMessage` returns immediately when
  `session.isFinalized()`. Late messages are dropped and **not** traced, so a page that keeps
  posting after a stop cannot grow the trace array without bound.
- **`cancelled` is never a failure.** The result carries whatever products and movements were
  gathered — the same shape a `partial` result carries — with `readFailure === null` and
  `productFailures === []`. It never populates anything that maps to `last_error_code`.

`scrape-session.test.ts` asserts: cancelling mid-`get-transactions-start` yields
`outcome === 'cancelled'`; the already-gathered products and movements are present;
`readFailure` is `null`; `credentials.isCleared()` is `true`; the recorded call order has
`credentials.clear` before `port.stopLoading`; and a message injected into the handler *after*
cancellation changes nothing about the emitted result.

### Decision 10 — Money is integer-only, including the foreign-currency path

*(Spec Business Rules 9 and 12, AC7, AC9, AC10. This is the carried-forward foreign-currency item.)*

`parseMinorUnits(text, currencyCode)` in `src/parsing/amount.ts`:

1. Strip currency symbols and codes (`$`, `US$`, `USD`, `CLP`), all Unicode whitespace including
   U+00A0 and U+2009, and the `+`/`−`/`-` sign characters. Keep digits, `.` and `,`.
2. Split on the **last** `,` — Chilean convention: `.` groups thousands, `,` introduces decimals.
   Banco de Chile presents US dollars in that same Chilean style (`US$ 1.234,56`), not the
   English decimal-point style. Remove every `.` from the integer part.
3. Look up `CURRENCY_MINOR_UNIT_EXPONENTS = { CLP: 0, USD: 2 }`. An unknown currency code throws
   `AmountParseError('unknown_currency')`.
4. If the fraction part has **more digits than the exponent allows**, throw
   `AmountParseError('fraction_exceeds_currency_exponent')`. Business Rule 12 is explicit: an
   amount that would need rounding to reach a whole minor unit is a defect. For CLP (exponent 0)
   this means any nonzero decimal digit is a defect; an all-zero fraction (`$1.234,00`) is
   accepted and dropped, because banks do print it.
5. `minorUnits = Number(integerDigits) * 10 ** exponent + Number(fractionDigits.padEnd(exponent, '0'))`,
   computed from **digit strings**, never from a float. Throw if the result is not
   `Number.isSafeInteger`.
6. Return a **positive** integer. Direction is `mapMovementDirection(outgoingText, incomingText)`
   — read from which column the bank put the amount in, per movement, never assumed from the
   product kind. This replaces the source's negative amounts and its blanket "every account
   movement is one direction, every card movement is the other", which is wrong for refunds and
   card payments (spec Decision 2).

**`parseFloat` is banned, and the ban is checked where ESLint cannot look.** ESLint
`no-restricted-globals` covers the TypeScript. The injected scripts are *strings*, invisible to
ESLint, so `src/scripts/no-float-parsing.test.ts` generates every script from every registered
config and asserts none of the resulting sources matches `/parseFloat|Number\.parseFloat|toFixed/`.

Foreign-currency movements are reported in their own currency with **no conversion and no
invented peso amount** (spec Conflict 4). Where the bank shows a separate origin-currency column,
that value lands in `extras.originalCurrencyCode` / `extras.originalAmountMinorUnits`, parsed by
the same function.

**Evidence.**

| Direction | Evidence |
| --- | --- |
| Fires | `amount.test.ts` asserts `parseMinorUnits('$1.234,50', 'CLP')` **throws** `fraction_exceeds_currency_exponent`, and that `'US$ 1.234,567'` throws for `USD`. `no-float-parsing.test.ts` planted-defect proof in the PR: add `parseFloat(x)` to `script-utils.ts`'s helper block; the test must fail naming the script key; revert; `git diff --stat` empty |
| Does not over-fire | `amount.test.ts` asserts the real vectors pass: `'$1.234.567'` → `1234567`; `'$1.234,00'` → `1234`; `'US$ 1.234,56'` → `123456` (USD cents); `'$0'` → `0`; `'&nbsp;$ 12.000&nbsp;'` → `12000`. A parser that rejected everything would fail all four reading-routine tests |

### Decision 11 — Dates never touch `Date`, and never touch the device timezone

*(Spec Business Rule 11, spec Decision 3, AC8.)*

In the page: `'01/03/2026'` → `'2026-03-01'` by pure string manipulation (split on `/`,
zero-pad, reorder). No `new Date`, no `toISOString`.

On the RN side: `parseBankDateLocal(text)` re-validates the result with `isValidDateLocal` and
`toDateLocal` from `@finanzas/shared-utils`, which reject a non-calendar day (`31/02/2026`) with
a `RangeError`. A rejected date yields `parse_failed` for that product rather than a silently
wrong movement.

This replaces the source's `formatDate`, which did
`new Date(+year, +month - 1, +day).toISOString()` — a local-zone construction rendered as UTC,
which is exactly the "transaction shows up in the wrong month" entry in the repository's own
troubleshooting table.

**Evidence.** `date.test.ts` runs the whole vector table, and the package's `test` script is
also invoked under `TZ=Pacific/Kiritimati` (UTC+14) and `TZ=Pacific/Niue` (UTC−11) in the runbook
and in Implementation Order Step 12; `'01/03/2026'` must be `'2026-03-01'` under all three
(AC8). Fires: change the in-page helper to build a `Date` and the two shifted-timezone runs
fail while the default run still passes — which is precisely why both shifted runs are required
and a single default run is not sufficient evidence.

### Decision 12 — The package's own lint fence

`packages/bank-scraper/eslint.config.mjs` (inside the owned directory; the root config is not
touched):

- `no-console: 'error'` for `**/*.{ts,tsx}` — raised from the root's `'warn'`, matching
  `packages/shared-utils`. In this package a stray `console.log` is a credential-leak vector, not
  a style issue.
- `no-restricted-imports`: `expo-secure-store`, `expo-sqlite`, `drizzle-orm`, `drizzle-orm/*`,
  `better-sqlite3`, `axios`, `node-fetch`, `undici`, `@react-native-async-storage/async-storage`,
  `expo-file-system`, `@sentry/*`, `@amplitude/*`, `**/apps/**`, and any relative path escaping
  the package (`../../*`) — the last one enforces AGENTS.md non-negotiable 9.
- `no-restricted-globals`: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`. Needed because
  `tsconfig.json` gains `"lib": ["ES2022", "DOM"]` for the jsdom tests, which would otherwise
  make these type-available in engine code.

### Decision 13 — The user-agent override is kept, and why that is not bot evasion

The source sets a fixed iPhone Safari user agent. Business Rule 28 forbids working around a
bank's defences, so this needs a stated position rather than a silent copy.

**Kept, with this rationale**: the override selects the bank's **mobile page layout**, which is
the layout every selector in the ported reading routines — and therefore every committed
fixture — was written against. Dropping it would change the DOM the scripts see and break the
port for no security benefit. It defeats no CAPTCHA, no bot detection and no rate limit; it does
not claim a different browser engine than the one actually running on iOS.

Two related settings are **changed** from the source because they are real risks:

- `webviewDebuggingEnabled` is set to `__DEV__` only. In the source it is unconditionally `true`,
  which lets Safari or Chrome DevTools attach to a WebView that is holding a credential in a form
  field.
- `incognito`, `cacheEnabled: false`, `sharedCookiesEnabled: false`, `thirdPartyCookiesEnabled:
  false` are set so nothing from the session persists (spec Business Rule 7, AC32).

This decision is flagged for human confirmation alongside spec Decision 16's deadline.

**Unverified claim, flagged per `REVIEW.md`**: `react-native-webview` is not installed in this
repository yet (V7), so the exact prop names `onShouldStartLoadWithRequest`, `originWhitelist`,
`incognito`, `cacheEnabled`, `sharedCookiesEnabled`, `thirdPartyCookiesEnabled` and
`webviewDebuggingEnabled` **cannot be verified against an installed copy at plan time**. The
implementer must confirm each against the version resolved in Step 1 before wiring the component,
and adjust names if the pinned major differs. This does not affect the engine or any test, all of
which run against `WebViewPort`, not against `react-native-webview`.

---

### Decision 14 — The `WebViewPort` seam

```ts
// Illustrative — adapt during implementation.
export interface WebViewPort {
  navigateTo(url: string): void;
  injectJavaScript(source: string): void;
  stopLoading(): void;
  getCurrentUrl(): string | null;
}
```

`bank-scraper.component.tsx` implements it over the `WebView` ref and the component's own
`sourceUri` state. Engine tests use `src/test-utils/fake-webview-port.ts`, which records every
call and lets a test feed `onLoadEnd` / `onMessage` synchronously. This is how AC1, AC13-AC16,
AC19-AC22 and AC25 are asserted with no phone, no simulator and no network (AC30).

`navigateTo(url)` sets the component's `sourceUri` state so `<WebView source={{ uri }}>`
navigates. The source instead did `injectJavaScript("window.location.href = '<url>'")`, which
interpolates a URL into executable JavaScript and cannot run before a page exists. Removing it
removes an injection vector and makes the first navigation work from `about:blank`.

### Decision 15 — The step machine, and why progress can never go backwards

*(Spec Business Rule 23, "Read step" transitions, AC20.)*

`StateManagerService.updateState` is the **only** writer of `stepId` and `progress`, and it
enforces two guarantees mechanically rather than by convention:

1. **Progress is monotonic**: `nextProgress = Math.max(this.#progress, incoming.progress)`. A
   payload reporting a lower number cannot lower it. The source has no such clamp, and its
   credit-card routine posts a hardcoded `0.9` after the account routine may already have passed
   it — a visible backwards jump on the syncing screen.
2. **Steps only advance**: `VALID_STEP_TRANSITIONS` encodes
   `load-start → login-start → get-products-start → get-transactions-start → ready`. A payload
   naming an earlier step is **dropped** — the state is left unchanged and a
   `rejected_backwards_step` trace is recorded, so a stale in-flight message from a previous
   page cannot rewind the screen. A payload naming the same step is accepted (the
   `get-transactions-start` step legitimately reports many times, once per product).

A failure can end the read from any step and is not itself a step (spec "Read step"): the error
path goes through `finalize()`, never through a transition.

`state-manager.service.test.ts` feeds a deliberately out-of-order sequence — including a
`0.9`-then-`0.75` pair and a `get-products-start` arriving after `get-transactions-start` — and
asserts the emitted progress sequence is non-decreasing, the emitted step sequence is a prefix of
the valid order, and the rejected payload produced a trace rather than silence. It also asserts
the **legitimate** sequence passes through untouched, so a clamp that froze progress entirely
would fail.

---

## Concurrency Safety Checklist

This plan **is** concurrent-event-source: `onMessage`, `onLoadStart`, `onLoadEnd` and `onError`
can all fire from the WebView; a `setTimeout` drives the credit-card script's injection delay;
another drives the read deadline; `cancel()` can arrive from the UI thread at any moment; and the
in-page scripts post asynchronously. They share the session state, the partial data, the trace
array, the executed-scripts map and the credential holder.

| Item | Design decision |
| --- | --- |
| **Shared mutable state guards** | All session state lives behind `ScrapeSession` private (`#`) fields and is mutated only through `StateManagerService.updateState` and `MessageHandlerService`. React Native's JavaScript runtime is single-threaded, so no lock is needed and none is invented; what is needed is **ordering**, which is provided by every mutation entering through one of those two methods. Nothing mutates `partialData` in place: `mergePartialData` returns a new object |
| **Re-entrancy / in-flight tracking** | A second message can arrive before an earlier handler's async continuation resumes. `MessageHandlerService.handleMessage` is **synchronous end to end** — it parses, redacts, routes and returns, with no `await` — so it cannot interleave with itself. The only async work is script injection, which is fire-and-forget. `WebViewDriverService.#executedScripts` tracks single-execution scripts by key so a re-fired `onLoadEnd` for the same URL cannot inject twice |
| **Event deduplication** | `onLoadEnd` fires repeatedly for a single-page Angular app as the hash route changes. `WebViewDriverService.#pageLoadedState` (`{ url, loaded }`) drops a duplicate `onLoadEnd` for a URL already marked loaded — ported from the source, which needed it for exactly this reason. Script keys marked `singleExecution` are additionally guarded by `#executedScripts`. Inbound `STATE_CHANGE` payloads are merged by `instanceId` (products) and by `(productInstanceId, positionInReadSnapshot)` (movements), so a re-posted page of results updates rather than duplicates |
| **Listener and resource cleanup** | `finalize()` is the single teardown path: it clears the deadline timer, clears the injection-delay timer (tracked in `#pendingInjectionTimer` rather than an anonymous `setTimeout`, which is a change from the source), clears the credentials, calls `port.stopLoading()` and navigates to `about:blank`. The React component clears the same timers in a `useEffect` cleanup so an unmount mid-read cannot leave a timer holding a closure over the session. In-flight injected scripts cannot be cancelled from React Native; their context is destroyed by the `about:blank` navigation and their late messages are dropped |
| **Race conditions at initialization** | The WebView's initial `source` is `about:blank`, and `start()` is what sets the real URL. A message arriving before `start()` (the page has none to send, but a stale one could) is dropped because `#config` is `undefined` and `MessageHandlerService` returns early, recording a `message_before_start` trace |
| **Race conditions at teardown** | `MessageHandlerService.handleMessage` returns immediately when `session.isFinalized()`. `finalize()`'s `#finalized` boolean is checked-and-set as its first statement, so two terminal conditions racing (deadline expiry and a `READY` message in the same tick) produce exactly one result emission. Late messages are dropped without tracing, bounding trace growth after the read has ended |
| **Error propagation across async boundaries** | The in-page step wrapper catches per-step errors, retries, and on exhaustion posts an `ERROR` event — errors never vanish into an unhandled rejection inside the page. On the React Native side, `handleMessage` wraps parsing in `try`/`catch` and converts a malformed message into a `parse_failed` trace plus a product-scoped failure rather than throwing into the WebView callback, where React Native would swallow it. The `.then()` tails on the source's injected IIFEs gain `.catch()` tails that post an `ERROR` — the source has `.then()` only, so a rejection there is currently silent |

**New patterns for this codebase.** Nothing else in this repository drives an external event
source. The `WebViewPort` seam (Decision 14) is introduced specifically so this concurrency can
be exercised deterministically under Jest fake timers rather than only on a device.

---

## Testing Strategy

**Test types**: Unit (Jest, `node` environment) for the engine, security perimeter and parsers;
Unit (Jest, `jsdom` environment) for the four reading routines against committed HTML fixtures;
command-line smoke runbook. No device E2E — the spec puts it out of scope and assigns it to the
connect flow's runbook.

**Command**: `pnpm --filter @finanzas/bank-scraper test`, which runs as part of `pnpm test` on
every pull request (AC30, V8).

### Scenario-to-criterion map

| # | Scenario | Test file | AC |
| --- | --- | --- | --- |
| 1 | A full read against the fixtures reaches `ready` with ≥1 product and its movements | `engine/scrape-session.test.ts` | AC1 |
| 2 | Sentinel credentials appear in no trace, result, failure or console call; diagnostics are still substantive | `security/credential-leak.test.ts` | AC2 |
| 3 | Credentials cleared on success, failure and cancellation; clear precedes teardown; `cancelled` carries gathered data; the package never reads secure store and never writes SQLite | `engine/scrape-session.test.ts`, `security/credential-holder.test.ts`, `security/no-secure-store.test.ts` | AC3 |
| 4 | A password of quotes, backslashes, angle brackets and U+2028 reaches the form unchanged and alters nothing | `security/js-string-literal.test.ts`, `configs/cl/banco-de-chile/banco-de-chile.login.script.dom.test.ts` | AC4 |
| 5 | Four per-class fixture sanitization checks, each with a planted-violation and a no-over-fire case | `testing/fixture-sanitization.test.ts` | AC5 |
| 6 | Each of the four reading routines runs against a recorded page and asserts what it produces | the four `*.script.dom.test.ts` files | AC6 |
| 7 | Chilean thousands separators and currency symbols → whole pesos; no decimal survives | `parsing/amount.test.ts` | AC7 |
| 8 | `01/03/2026` → `2026-03-01`, unchanged under `TZ` east and west of Santiago | `parsing/date.test.ts` (+ shifted-`TZ` runs) | AC8 |
| 9 | Every amount positive; direction from the column, including for card movements | `parsing/amount.test.ts`, `banco-de-chile.normalizer.test.ts`, `…credit-card-details.script.dom.test.ts` | AC9 |
| 10 | Second-currency card movements reported in that currency, exact minor units, no conversion | `parsing/amount.test.ts`, `…credit-card-details.script.dom.test.ts` | AC10 |
| 11 | A product the bank says has no movements → success with zero movements | `…account-transactions.script.dom.test.ts` (`account-transactions-empty.html`) | AC11 |
| 12 | Stated count > parsed rows → `parse_failed` for that product, not empty success | `…account-transactions.script.dom.test.ts` (`account-transactions-count-mismatch.html`) | AC12 |
| 13 | Products succeed, one product's movements fail → `partial`, data retained, reason + product named | `engine/scrape-session.test.ts` | AC13 |
| 14 | Rejected sign-in → `invalid_credentials`, nothing gathered, submit clicked once, no bank text attached | `…login.script.dom.test.ts`, `engine/scrape-session.test.ts` | AC14 |
| 15 | `network` / `session_closed` / `parse_failed` each asserted separately | `engine/scrape-session.test.ts` | AC15 |
| 16 | Allowed origin permitted; off-origin redirect rejected; lookalike host rejected | `security/origin-allowlist.test.ts`, `engine/webview-driver.service.test.ts` | AC16 |
| 17 | Every started-read failure is one of exactly four codes (Decision 7) | `types` exhaustiveness + `engine/scrape-session.test.ts` | AC17 |
| 18 | Unknown bank/country refused before navigation, distinguishable from the four reasons | `configs/registry.test.ts`, `engine/scrape-session.test.ts` | AC18 |
| 19 | Bounded retries with waits; attempt counts in the trail; deadline honoured | `engine/scrape-session.test.ts` (fake timers) | AC19 |
| 20 | Steps announced in order; progress never decreases (Decision 15) | `engine/state-manager.service.test.ts` | AC20 |
| 21 | Two reads of the same fixtures describe every movement identically | `engine/scrape-session.test.ts` | AC21 |
| 22 | Two same-day, same-amount, same-description movements stay two, distinguishable | `…account-transactions.script.dom.test.ts` (`account-transactions-duplicate-rows.html`) | AC22 |
| 23 | No movement carries a `bankSuppliedId` the bank did not supply | `engine/product-shape.test.ts`, all four routine tests | AC23 |
| 24 | Two accounts of the same kind → two identities, each stable across two reads, neither the raw number | `…home.script.dom.test.ts` | AC24 |
| 25 | Enumerated kinds/directions only; unsupported kind → no product + a diagnostic + still `complete` | `…home.script.dom.test.ts` (`home-unsupported-kind.html`), `banco-de-chile.normalizer.test.ts` | AC25 |
| 26 | Codes not sentences; extras keyed by stable identifiers; bank text preserved verbatim | `banco-de-chile.normalizer.test.ts`, `…credit-card-details.script.dom.test.ts` | AC26 |
| 27 | No Banco de Chile knowledge outside its own directory | `testing/bank-containment.test.ts` | AC27 |
| 28 | No Falabella / Pelotillehue material; exactly one bank for `cl` | `testing/bank-containment.test.ts`, `configs/registry.test.ts` | AC28 |
| 29 | RUT handling via `@finanzas/shared-utils`; no call site logs, caches or retains a RUT | `security/credential-leak.test.ts`, `testing/source-rut-scan.test.ts` | AC29 |
| 30 | Whole suite runs with no phone, simulator or network, in `pnpm test` | CI (V8); no test imports `react-native-webview` | AC30 |
| 31 | No request to any non-bank server, no analytics, no export, no page HTML written to disk | `scripts/no-network-egress.test.ts`, ESLint fence | AC31 |
| 32 | Nothing from a session carried into a later read | `engine/webview-driver.service.test.ts` (teardown asserts `#executedScripts` and `#pageLoadedState` are reset); `incognito` on the component | AC32 |
| 33 | Every change inside `packages/bank-scraper/` except the regenerated lockfile | `git diff --name-only origin/develop...HEAD` in Step 13 | AC33 |
| 34 | The barrel stays free of React / React Native / WebView imports | `index.barrel-purity.test.ts` | V6 constraint, Decision 3 |

### Parser-risk addendum

This plan **is** parser-risk: it adds structured-text parsing over amounts, dates and bank HTML,
plus four regex-based scanners over committed files.

**Edge-case enumeration — `parseMinorUnits` (`parsing/amount.test.ts`)**

| # | Input | Currency | Expectation |
| --- | --- | --- | --- |
| A1 | `$1.234.567` | CLP | `1234567` |
| A2 | `$0` | CLP | `0` |
| A3 | `1.234` | CLP | `1234` (bare, no symbol) |
| A4 | `$1.234,00` | CLP | `1234` (all-zero fraction accepted and dropped) |
| A5 | `$1.234,50` | CLP | throws `fraction_exceeds_currency_exponent` |
| A6 | `US$ 1.234,56` | USD | `123456` |
| A7 | `USD 0,07` | USD | `7` |
| A8 | `US$ 1.234,5` | USD | `12345` (single decimal digit padded, exact) |
| A9 | `US$ 1.234,567` | USD | throws `fraction_exceeds_currency_exponent` |
| A10 | `$\u00a012.000\u2009` | CLP | `12000` (NBSP + thin space stripped) |
| A11 | `-$1.234` / `−$1.234` (U+2212) | CLP | `1234` — sign is stripped; direction is the column's job |
| A12 | `` (empty) and `   ` | CLP | throws `empty_amount` |
| A13 | `Saldo no disponible` | CLP | throws `no_digits` (negative lookalike: text that is not an amount) |
| A14 | `$1.2.3` | CLP | throws `malformed_grouping` (dots not in 3-digit groups) |
| A15 | `$1,234.56` (English convention) | CLP | throws — `.56` is not a Chilean fraction and `,234` is not Chilean grouping |
| A16 | `$9.007.199.254.740.993` | CLP | throws `not_safe_integer` |
| A17 | `$1.234` appearing twice in one cell (`$1.234 $5.678`) | CLP | throws `multiple_amounts` — the caller must pass one cell's single amount |
| A18 | `€1.234` | EUR | throws `unknown_currency` |

**Edge-case enumeration — `parseBankDateLocal` (`parsing/date.test.ts`)**

| # | Input | Expectation |
| --- | --- | --- |
| D1 | `01/03/2026` | `2026-03-01` |
| D2 | `1/3/2026` | `2026-03-01` (single-digit day/month zero-padded) |
| D3 | `31/12/2025` | `2025-12-31` |
| D4 | `29/02/2024` | `2024-02-29` (leap year) |
| D5 | `29/02/2025` | throws — not a calendar day (`toDateLocal` `RangeError`) |
| D6 | `31/04/2026` | throws — April has 30 days |
| D7 | `2026-03-01` | throws — already ISO, not the bank's format (negative lookalike) |
| D8 | `03/01/2026` | `2026-01-03` — proves `DD/MM`, not `MM/DD` |
| D9 | `01/03/26` | throws — two-digit year is not accepted rather than guessed |
| D10 | ` 01/03/2026 ` | `2026-03-01` (surrounding whitespace tolerated) |
| D11 | `01/03/2026 14:32` | throws `unexpected_trailing_content` |

Each row above is one `it(...)` case in the named file — 18 amount cases and 11 date cases, 29
automated tests, one per enumerated edge case.

**Edge-case enumeration — the four fixture scanners (`testing/fixture-scan.ts`)**

| Detector | Positive (must flag) | Negative lookalike (must not flag) | Multiple-on-one-line |
| --- | --- | --- | --- |
| `findRutViolations` | a check-digit-valid RUT in dotted form; the same in bare `NNNNNNNN-D` form; one with a `K` check digit | a check-digit-**invalid** RUT (what a scrubbed fixture should contain); a date `01/03/2026`; an amount `1.234.567`; a phone `+56 9 1234 5678` | two RUT-shaped tokens on one line are reported as two violations, each with its own byte offset |
| `findNameViolations` | a token from `prohibited-name-tokens.ts` (common Chilean surnames/given names), matched whole-word, case- and accent-insensitively | the synthetic names in `synthetic-allowlist.ts`; the bank's own product wording (`Cuenta Corriente`, `Tarjeta de Crédito`); merchant descriptions in movement rows | each occurrence is reported separately |
| `findAmountViolations` | any Chilean-formatted amount failing `isSyntheticAmount` (rule: the value divided by 1000 must have all-identical decimal digits, or the value is `0`, or the fraction is all zeros) | `$1.111.000`, `$222.000`, `$33.000`, `$0`, `US$ 1.111,00` — the constructed fixture amounts | multiple amounts in one `<td>` row are each checked |
| `findAccountNumberViolations` | any 7-20 digit run failing `isSyntheticAccountNumber` (rule: all digits identical, or explicitly allow-listed) | `00000000123` and `1111` in the allowlist; a `DD/MM/YYYY` date; a four-digit year; a CSS pixel value | multiple runs on one line each reported |

Violation messages report the **detector name, the byte offset and the class** — never the
matched text. Reporting a leaked RUT in a test failure message would print it into CI logs.

**Suppression semantics.** No inline suppression directive is introduced; there is no
`fixture-scan-disable` comment and none will be honoured. The only way to exempt a value is to
add it to the explicit, reviewed allowlist in `src/testing/synthetic-allowlist.ts`, which is a
committed source file and therefore appears in the PR diff. That file is itself excluded from the
scan (it necessarily names the allow-listed values), and that exclusion is the single, named
exception. `testing/fixture-sanitization.test.ts` asserts the exclusion list has exactly one
entry, so widening it is a visible test change rather than a quiet config edit.

### Bank containment and residue

`testing/bank-containment.test.ts` is the **residual verification mechanism** for AC27 and AC28 —
a committed test, not a grep run once at review time:

1. Walk every committed file under `packages/bank-scraper/` (excluding `node_modules`, `dist`).
2. Assert that every file matching `/bancochile|banco[-_ ]?de[-_ ]?chile|portales\.bancochile/i`
   is either under `src/configs/cl/banco-de-chile/`, or is one of exactly two registry files
   (`src/configs/index.ts`, `src/configs/cl/index.ts`) where the only matching lines are the
   import and the array entry.
3. Assert that **zero** files match `/falabella|pelotillehue/i` (AC28).
4. Assert `CL_BANKS.length === 1` and `CL_BANKS[0].id === 'banco-de-chile'`.

**Fires**: planted-defect proof in the PR — put a Banco de Chile selector string into
`src/engine/webview-driver.service.ts`; the test fails naming that file; revert; `git diff
--stat` empty. **Does not over-fire**: the two registry files pass today with their legitimate
import and registration lines, and every other engine, parsing and security file passes
untouched.

---

## Seed Data

No database seed data — this item writes nothing to SQLite. The equivalent fixed inputs are the
committed HTML fixtures and the credential sentinels.

| Entity | Values / Scenario | File |
| --- | --- | --- |
| Login page (clean) | RUT input `#ppriv_per-login-click-input-rut`, password input `#ppriv_per-login-click-input-password`, submit `#ppriv_per-login-click-ingresar-login` | `src/configs/cl/banco-de-chile/fixtures/login.html` |
| Login page (rejected) | The same form plus a visible `[role="alert"]` carrying a rejection sentence, so the routine's detection path is exercised **and** the "no bank text attached" assertion has something real to not attach | `fixtures/login-invalid-credentials.html` |
| Product list | Two `Cuenta Corriente` cards (different synthetic account numbers — AC24), one `Cuenta Vista`, one `Cuenta FAN`, one `Línea de Crédito` (must be skipped, spec Decision 15), and a `.card-products` section with two `.link-card` credit cards | `fixtures/home.html` |
| Product list (unsupported kind) | The above plus one product whose wording maps to no enumerated type — proves AC25's mixed case still yields `complete` | `fixtures/home-unsupported-kind.html` |
| Account movements | `fenix-movimientos-cuenta` table, a `mat-paginator-label` stating `1 – 10 de 12`, two pages, both an outgoing-column and an incoming-column row | `fixtures/account-transactions.html` |
| Account movements (empty) | `.alert-warning` "sin movimientos", no paginator — AC11 | `fixtures/account-transactions-empty.html` |
| Account movements (count mismatch) | Paginator states `de 12`; only 3 rows present — AC12 | `fixtures/account-transactions-count-mismatch.html` |
| Account movements (duplicates) | Two rows with identical date, amount and description — AC22 | `fixtures/account-transactions-duplicate-rows.html` |
| Credit-card details | `bch-summary` national section with balance and cupo, an unbilled `.bch-table` and a billed one with a `Cuotas` column | `fixtures/credit-card-details.html` |
| Credit-card details (international) | The `.mat-tab-label` international tab with a >7-column table, `Monto Moneda Origen` and USD amounts written `US$ 1.111,00` — AC10 | `fixtures/credit-card-details-international.html` |
| Fixture provenance | Records that these are hand-authored from the selector contracts, never captured from a live session (Documented Deviation D3), and the rules an author must follow for synthetic RUTs, names, amounts and account numbers | `fixtures/README.md` |
| Credential sentinels | `ZZSENTINELRUTZZ` / `ZZSENTINELPASSZZ`, plus the punctuation password `ZZ"\\'<>&\u2028ZZ` | `src/test-utils/sentinels.ts` |
| Synthetic allowlist | Allowed synthetic RUTs, names, amounts and account numbers, each with a comment saying why | `src/testing/synthetic-allowlist.ts` |
| Prohibited name tokens | ~60 common Chilean surnames and given names used as the name tripwire | `src/testing/prohibited-name-tokens.ts` |

Every amount that appears in a fixture must satisfy `isSyntheticAmount`, and every account number
`isSyntheticAccountNumber` — the fixtures are written to pass their own scanners, which is what
makes the "does not over-fire" half of AC5 meaningful.

---

## Documentation Updates

To be executed by the developer during implementation, not now.

- [ ] `docs/best-practices/stack/bank-scraper.md` — update the config path to
      `packages/bank-scraper/src/configs/cl/<bank>/` (Documented Deviation D2); replace the
      `start(countryCode, bankId, credentials)` sketch with the `ScrapeSession`
      `start` / `cancel` API; document the origin allowlist and its three checkpoints; document
      the `complete` / `partial` / `failed` / `cancelled` outcome and the `ScrapeResult` shape;
      replace "Tests assert that no trace or error carries a credential value" with the named
      test file; add the four per-class fixture checks and the bounded-retry / deadline
      constants; note that `*.test.js` is now `*.test.ts` and `*.dom.test.ts`.
- [ ] `docs/project/3-software-architecture.md` — Testing Strategy table: the scraper row's
      location is `packages/bank-scraper/src/**/*.test.ts` (and `*.dom.test.ts` for jsdom), not
      `**/*.test.js`. Security Model table: the "Network" row's "restricted to the target bank's
      origin" gains the mechanism (exact `URL.origin` allowlist, three checkpoints). Decision 2's
      API signature is updated to match.
- [ ] `docs/project/4-database-model.md` — **not updated by this item.** Spec Conflict 1 assigns
      the `external_id` correction to the database or sync item. Recorded as follow-up F2 so it
      is not lost.
- [ ] `docs/project/2-repo-architecture.md` — **not updated.** AC33 forbids it, and nothing in
      it becomes wrong: it names the package and its consumers, not its internal layout.
- [ ] `AGENTS.md` / `CLAUDE.md` — **no change needed.** The bank-scraper description, the
      `pnpm --filter @finanzas/bank-scraper test` command and the two scraper troubleshooting
      rows all remain accurate.

---

## Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Hand-authored fixtures (D3) agree with the ported scripts but disagree with the live bank, so the suite is green while a real sync fails | High | High | `fixtures/README.md` states the provenance so nobody mistakes green tests for live-site proof; the fixtures are authored **from the source implementation's selectors**, which are known to have worked against the live site; follow-up F3 replaces them with scrubbed captures at the first real sync; the connect-flow item's runbook is where a live read is first exercised |
| R2 | A credential reaches a trace through a path the leak test does not drive | Medium | Critical | Four independent controls, not one (Decision 5): type-level absence of a `scriptSource` field, `FORBIDDEN_TRACE_KEYS`, removal of the bank's error text from the payload entirely, and value-scanning redaction. `no-console: 'error'` for the workspace. The leak test drives the **full** read, not a unit |
| R3 | `react-native-webview`'s prop names differ from those assumed in Decision 13 | Medium | Low | Flagged as unverified per `REVIEW.md`; confined to `bank-scraper.component.tsx`; every test runs against `WebViewPort`, so a prop rename costs one file, not the suite |
| R4 | `crypto.subtle` unavailable in the WebView, so no product gets an `instanceId` | Low | High | Explicit `parse_failed` for that product rather than a raw-number or index fallback (Decision 6); the failure is visible in the trail on the first real sync rather than silently producing unstable identities |
| R5 | Lockfile collision with item #35 in the same batch | Medium | Low | Mechanical, not semantic (Cross-Cutting Check). Resolution is `git checkout --theirs pnpm-lock.yaml` from the newer base, re-run `pnpm install`, commit the regenerated file — recorded in Implementation Order Step 1 |
| R6 | The four-minute deadline is wrong for a slow connection with many products | Medium | Medium | Single named constant `READ_DEADLINE_MS`; spec Decision 16 already requests human confirmation; expiry produces `partial` with whatever was gathered, not a total loss |
| R7 | The `home` routine's page-by-page navigation (click product → read → `history.back()`) is fragile and the source has no bound on it | Medium | Medium | The read deadline bounds it globally; each step is bounded individually; a product whose page never loads becomes a product-scoped `parse_failed` and the read moves on (spec Business Rule 31) |

---

## Follow-ups (not in this item)

| # | Follow-up | Owner |
| --- | --- | --- |
| F1 | `apps/mobile` adds `react-native-webview` to its dependencies and imports the component; optionally add an `exports` map to `packages/bank-scraper/package.json` at that point | The connect-flow item |
| F2 | Point `user_financial_products.external_id` at the scraper's opaque `instanceId` rather than the product kind (spec Conflict 1) | Item #3 or #10 |
| F3 | Replace the hand-authored fixtures with scrubbed captures from a real session | First contributor with a Banco de Chile account |
| F4 | Add the `invalid_credentials` / `session_closed` / `network` / `parse_failed` copy keys to `apps/mobile/src/i18n/` (V10 — they do not exist yet) | The item that first renders a sync failure |
| F5 | Report the línea de crédito as its own product if the product owner wants it on the bank detail screen (spec Decision 15) | Product decision |

---

## Implementation Order

1. **Package configuration.** Update `packages/bank-scraper/package.json` (Decision 2),
   `jest.config.js` (two projects), `tsconfig.json` (`jsx`, `lib`) and `eslint.config.mjs`
   (Decision 12). Run `pnpm install` from the repository root and commit the regenerated
   `pnpm-lock.yaml` (Documented Deviation D1). Record the resolved `react-native-webview` version
   in the PR description.
   *Verify*: `pnpm install --frozen-lockfile` succeeds from a clean `node_modules`;
   `pnpm --filter @finanzas/bank-scraper test` still passes the existing `index.test.ts`;
   `pnpm --filter @finanzas/mobile test` still passes, confirming the unmet
   `react-native-webview` peer is a warning and not a failure.
2. **Types.** Write `src/types/protocol.types.ts`, `scrape-result.types.ts` and
   `bank-config.types.ts`. No behaviour yet.
   *Verify*: `pnpm --filter @finanzas/bank-scraper typecheck` passes.
3. **Security perimeter.** Write `origin-allowlist.ts`, `credential-holder.ts`,
   `js-string-literal.ts`, `redaction.ts` and their four test files.
   *Verify*: the four test files pass; then run the Decision 4 and Decision 5 planted-defect
   proofs and record the failing test names and file/line in the PR description.
4. **Country parsing.** Write `parsing/amount.ts` and `parsing/date.ts` with all 29 enumerated
   edge cases from the parser-risk addendum.
   *Verify*: `pnpm --filter @finanzas/bank-scraper test -- parsing` passes; then run it under
   `TZ=Pacific/Kiritimati` and `TZ=Pacific/Niue` and confirm identical results.
5. **Engine.** Write `state-manager.service.ts`, `message-handler.service.ts`,
   `webview-driver.service.ts`, `product-shape.ts` and `scrape-session.ts`, plus
   `test-utils/fake-webview-port.ts`. Write the engine tests using Jest fake timers.
   *Verify*: the engine suite passes; the concurrency assertions (finalize-once, late-message
   drop, clear-before-teardown ordering) are among them.
6. **Injected-script helpers.** Write `src/scripts/script-utils.ts`, porting the source's step
   wrapper, wait helpers and trace helper, plus the new `generateInstanceIdHelperFunction`.
   **Do not port `utils/format/format.utils.ts` or any of its docblocks** (Documented Deviation
   D4). Write `no-float-parsing.test.ts` and `no-network-egress.test.ts`.
   *Verify*: both scanner tests pass; run the Decision 10 planted-defect proof for
   `no-float-parsing.test.ts`.
7. **Fixtures.** Author the ten HTML fixtures and `fixtures/README.md` from the selector
   contracts in the source's four Banco de Chile scripts. Write
   `testing/synthetic-allowlist.ts`, `prohibited-name-tokens.ts` and `fixture-scan.ts`.
   *Verify*: `testing/fixture-sanitization.test.ts` reports zero violations across all ten
   fixtures for all four detectors, and the eight planted/negative cases in that file pass.
8. **Banco de Chile config and normalizer.** Write `banco-de-chile.config.ts` (using `formatRut`
   and `isValidRut` from `@finanzas/shared-utils`) and `banco-de-chile.normalizer.ts` with the
   product-kind table from the spec, including `Línea de Crédito` → not reported.
   *Verify*: `banco-de-chile.normalizer.test.ts` covers every row of the spec's product-type
   table plus the unsupported-kind case.
9. **The four reading routines.** Port `login`, `home`, `account-transactions` and
   `credit-card-details` in that order, each immediately followed by its `*.dom.test.ts`.
   *Verify*: each routine's test passes against its fixtures before starting the next.
10. **Registry, barrel and component.** Write `configs/cl/index.ts`, `configs/index.ts`,
    `src/index.ts` (headless, Decision 3) and `src/component/bank-scraper.component.tsx`.
    Confirm the `react-native-webview` prop names against the installed version (Decision 13,
    Risk R3).
    *Verify*: `index.barrel-purity.test.ts` and `configs/registry.test.ts` pass;
    `pnpm --filter @finanzas/mobile test` still passes unchanged (V6).
11. **Containment and residue.** Write `testing/bank-containment.test.ts` and
    `testing/source-rut-scan.test.ts`.
    *Verify*: both pass; run the containment planted-defect proof and record it in the PR.
12. **Full gate.** From the repository root run `pnpm lint`, `pnpm typecheck`, `pnpm test`, then
    `TZ=Pacific/Kiritimati pnpm --filter @finanzas/bank-scraper test` and
    `TZ=Pacific/Niue pnpm --filter @finanzas/bank-scraper test`.
    *Verify*: all five green.
13. **Documentation.** Update `docs/best-practices/stack/bank-scraper.md` and
    `docs/project/3-software-architecture.md` per the **Documentation Updates** section. Do not
    touch `docs/project/2-repo-architecture.md` or `docs/project/4-database-model.md`.
14. **CHANGELOG.** Add the entry below under `## [Unreleased]` → `### Added`, verbatim.
15. **Scope check.** Run `git diff --name-only origin/develop...HEAD` and confirm the output
    lists only paths under `packages/bank-scraper/`, the two documentation files from Step 13,
    `CHANGELOG.md`, and `pnpm-lock.yaml` — nothing else (AC33 and Documented Deviation D1).
16. **Smoke runbook.** Execute
    [`docs/testing/mobile/6-port-bank-scraper-banco-de-chile.smoke-test.md`](../../../testing/mobile/6-port-bank-scraper-banco-de-chile.smoke-test.md)
    end to end and record the result in the PR description.

**Step 14's CHANGELOG entry, verbatim:**

```markdown
- **Port the bank scraper with Banco de Chile** (#6): `@finanzas/bank-scraper` now ships the
  headless read engine (`ScrapeSession` with `start` / `cancel`, message routing, step state
  machine and WebView driver), the four Banco de Chile reading routines (sign in, product
  list, account movements, credit-card details) under
  `src/configs/cl/banco-de-chile/`, an exact bank-origin allowlist checked at three points
  before any credential is entered, a single-owner credential holder cleared before the
  browser session is torn down, a redacting diagnostic trail asserted by test, integer
  minor-unit amount parsing including foreign-currency card movements, timezone-independent
  `DD/MM/YYYY` dates, bounded retries with an overall read deadline, and
  `complete` / `partial` / `failed` / `cancelled` read outcomes carrying an opaque per-product
  identity. Banco Falabella and Banco Pelotillehue are not ported.
```

---

## Code Samples

Every code block in this plan is **illustrative** and marked as such at its point of use. It
exists to fix names, signatures and ordering so the implementation does not have to guess; it is
not production-ready code and should be adapted during implementation.
