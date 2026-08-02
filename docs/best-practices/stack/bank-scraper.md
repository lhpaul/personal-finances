# Bank scraper

`@finanzas/bank-scraper` drives a hidden WebView through a bank's own online-banking site and
reports back products and movements. It is the riskiest code in the repo: it depends on HTML
we do not control and it is the only module that ever touches a credential.

Ported from `bank-scrapper-app/apps/native/src/components/bank-scrapper/` (issue #6). Banco de
Chile is the only bank implemented for the MVP.

## How it works

1. `ScrapeSession` (constructed with a `BankConfig`, a `WebViewPort` and the caller's credentials)
   is the one object that owns a read end to end. `session.start()` navigates the hidden
   `<WebView>` to the bank's URL; `session.cancel()` stops it. `startBankRead(...)` (the barrel's
   convenience entry point) resolves a `{ countryCode, bankId }` pair against the registry first —
   an unsupported bank or country is refused with no `ScrapeSession` ever constructed, so no
   navigation and no credential access happen.
2. **Scripts** are injected at matching URL paths (`BankConfig.scripts`). A script is a function
   that takes input and returns a JavaScript **string** to run inside the page. Every script's
   **data-extraction** work is DOM traversal, identity hashing and masking only — it posts **raw
   structural facts** (a bank-formatted amount string, a `DD/MM/YYYY` date string); parsing into an
   integer minor-unit amount or a `DateLocal` happens only on the React Native side
   (`src/parsing/amount.ts`, `src/parsing/date.ts`). The login script is the one exception to
   "extraction only": it also enters credentials into the form and submits it — see
   [Credentials](#credentials) below. No `parseFloat`, no `Date`, no `toLocaleString` anywhere in
   an injected script — enforced by `no-float-parsing.test.ts` scanning the generated source
   strings, because ESLint cannot see inside a template literal.
3. Scripts talk back via `window.ReactNativeWebView.postMessage()` using `ScraperEventType`
   (`STATE_CHANGE`, `ERROR`, `TRACE`).
4. `MessageHandlerService` routes messages (redacting `TRACE`/`ERROR` payloads before they reach
   anything else); `StateManagerService` advances
   `load-start → login-start → get-products-start → get-transactions-start → ready`, rejecting any
   payload naming an earlier step and clamping progress so it never decreases.
5. `WebViewDriverService` owns page-lifecycle bookkeeping (duplicate-`onLoadEnd` dedup,
   single-execution scripts, the injection-delay timer) and the single teardown path
   (`stopLoading()` + navigate to `about:blank`, resetting all of the above).

## The exact-origin allowlist

A credential is typed into the bank's own page and nowhere else, checked against an exact
allowlist — `src/security/origin-allowlist.ts`'s `isAllowedOrigin` compares `URL.origin`, never a
substring or a suffix match. Three independent checkpoints, each closing a gap the others cannot:

1. **Navigation gate** — `onShouldStartLoadWithRequest` on the `<WebView>` blocks a request before
   a byte is fetched.
2. **Injection gate** — `ScrapeSession.handleLoadEnd` re-checks the load-end URL before calling
   into `WebViewDriverService` at all, catching a redirect the navigation gate does not reliably
   fire for on Android. `WebViewDriverService` itself does not re-validate the origin — it assumes
   the caller already did, by design (see its own doc comment).
3. **In-page gate** — the login script's own first statement compares `window.location.origin`
   against the bank's `credentialEntryOrigin` literal, before either credential field is touched —
   the only checkpoint that observes the origin at the instant a credential would be typed.

A violation ends the read through `ScrapeSession`'s single `finalize()` path (so the credential is
always cleared) as `session_closed` if the login step had already succeeded, or `network`
otherwise. A trace records only `blockedOrigin` / `expectedOrigin`, never the full URL, whose path
and query string can carry session-identifying material.

## Credentials

`ScrapeSession` (via `CredentialHolder`) is the only object allowed to hold them, only in memory,
only for one read.

- The caller hands credentials to `startBankRead(...)`/`ScrapeSession`'s constructor as a plain
  object — reading `expo-secure-store` is the caller's job; this package never imports it (banned
  in its own ESLint config, and asserted directly by `security/no-secure-store.test.ts`).
- `CredentialHolder` uses `#` private fields, so nothing outside the class can read the values.
  `clear()` drops every reference (JavaScript strings are immutable, so it cannot zero the bytes);
  every `consume()` after `clear()` throws `CredentialsClearedError`.
- **`TraceRedactor` scans every outbound `TRACE`/`ERROR` payload for the current credential values
  before it becomes text**, in addition to stripping a fixed set of forbidden keys
  (`FORBIDDEN_TRACE_KEYS`) unconditionally. `STATE_CHANGE` payloads (`stepId`, `progress`, and the
  bank-supplied product/movement data) are deliberately **not** value-scanned: the login script is
  the only one that ever touches a credential, so there is no legitimate path for one to reach a
  `STATE_CHANGE`, and value-scanning it would risk corrupting a real amount or the `stepId` itself
  on a coincidental short-value collision.
- A credential field is escaped into the generated script with `toJsStringLiteral` (`
  JSON.stringify` plus U+2028/U+2029 escaping) — never interpolated — so a value containing quotes,
  backslashes or Unicode line separators cannot alter what the script executes.
- The login script never receives, and never posts, the bank's own rejection text: a rejected
  sign-in posts `{ code: 'invalid_credentials' }` with no `message` field at all — the echo
  channel a credential-carrying error message could leak through is removed, not filtered.
- `ScrapeSession.finalize()` always clears the credential **before** tearing down the browser
  session, on every terminal path (`complete`, `partial`, `failed`, `cancelled`, deadline expiry,
  an origin-gate violation) — never the reverse.
- `security/credential-leak.dom.test.ts` drives a real read with sentinel credentials and asserts
  they appear in none of the result, its traces, or any console call. That test is not optional,
  and its own planted-defect proof is recorded in the PR that added it.

## Adding or repairing a bank

Everything bank-specific stays in one directory:

```
packages/bank-scraper/src/configs/cl/<bank-name>/
├── <bank>.config.ts                          # BankConfig: id, name, url, allowedOrigins,
│                                              # credentialEntryOrigin, credential fields, script map
├── <bank>.normalizer.ts                      # mapProductKind / mapMovementDirection / mapMovementExtras
├── <bank>.login.script.ts
├── <bank>.home.script.ts
├── <bank>.account-transactions.script.ts
├── <bank>.credit-card-details.script.ts
├── *.script.dom.test.ts                      # jsdom tests against the fixtures below
└── fixtures/
    ├── *.html                                # hand-authored or scrubbed captured pages
    └── README.md                             # provenance: hand-authored, or captured-and-scrubbed
```

There is no per-bank `tsconfig` — every bank's directory is compiled by the single package-root
`packages/bank-scraper/tsconfig.json` (`rootDir: "src"`, `include: ["src"]`). Register the new
config in `src/configs/cl/index.ts` and, if it is a new country, `src/configs/index.ts` — these two
registry files are the one intentional, named exception to "no file outside the bank's own
directory changes"; every other file this containment property covers stays inside
`src/configs/cl/<bank-name>/`. A committed test (`testing/bank-containment.test.ts`) asserts this,
not a one-off grep at review time — it also asserts the registry never accidentally has more than
one entry per bank id.

## Testing

Bank HTML is unversioned and will break without warning, so tests are the early-warning system.
Two Jest projects: `engine` (`testEnvironment: 'node'`, every `*.test.ts` except `*.dom.test.ts`)
for the engine, security perimeter and parsers; `dom` (`testEnvironment: 'jsdom'`, every
`*.dom.test.ts`) for the four reading routines against their fixtures.

- Capture real HTML into a fixture (**scrubbed of personal data** — RUT, names, balances, account
  numbers replaced with synthetic values) when a live session is available, or hand-author one
  from the routine's own selectors when it is not (recorded in that bank's `fixtures/README.md`
  either way).
- Unit-test each script generator against the fixture in jsdom via `test-utils/run-injected-script.ts`
  (`runInjectedScript`, which executes the generated source via indirect `eval` and awaits its own
  fire-and-forget promise chain) — the messages it posts, never a return value.
- Test the parsers on the ugly cases: amounts with thousands separators, negative/positive
  conventions, dates in `DD/MM/YYYY`, credit-card movements in a second currency, empty
  statements, and a paginator that states more rows than were parsed.
- Never commit an unscrubbed fixture. `testing/fixture-sanitization.test.ts` checks this
  automatically with four detectors (RUT, name, amount, account number), each proven by planting a
  synthetic violation and asserting the check catches it — not by review alone.
- `pnpm --filter @finanzas/bank-scraper test` also runs under `TZ=Pacific/Kiritimati` (UTC+14) and
  `TZ=Pacific/Niue` (UTC-11) as part of this item's verification: a date derived from the device's
  local zone instead of the bank's own calendar-day string would only fail under a shifted zone.

## Resilience

- Every step is retried before it is called a failure — `MAX_STEP_ATTEMPTS = 3` with a constant
  `STEP_RETRY_DELAY_MS = 1000` for a page-level step, `MAX_ELEMENT_ATTEMPTS = 10` /
  `ELEMENT_RETRY_DELAY_MS = 200` for waiting on a single element (`src/engine/constants.ts`).
  `invalid_credentials` is the one exception: it is never retried, because repeating a rejected
  sign-in risks locking the person's real bank account.
- The whole read has its own overall deadline (`READ_DEADLINE_MS = 240_000`, 4 minutes) on top of
  each step's own bound, so a stalled page cannot hold the browser or the credential open
  indefinitely. Expiry finalizes with whatever reason the last-attempted step would have reported.
- Partial results are useful: `ScrapeResult.outcome` is `'complete' | 'partial' | 'failed' |
  'cancelled'`, derived from whether anything failed and whether anything was gathered — a
  product-scoped failure (`productFailures`, naming the product) never discards products or
  movements already read; only a read-level failure with nothing gathered at all is `'failed'`.
- Report progress. `StateManagerService` is the only writer of the current step and progress; a
  payload naming an earlier step is dropped (not applied), and progress is clamped to
  `Math.max(current, incoming)` so it can never visibly go backwards.
- Assume selectors break. When a parse yields fewer rows than the bank's own paginator states,
  the routine posts `parse_failed` for that product rather than an empty result — an empty read
  where the bank's own page agrees there is nothing to read is a success, not a failure.

## Never

- Never scrape anything the user did not connect. `resolveBankConfigOrReject` refuses an
  unregistered bank/country before anything is opened.
- Never navigate the WebView to a non-bank origin — the three-checkpoint allowlist above.
- Never persist page HTML to disk outside a committed test fixture; nothing from a session
  (cookies, storage, cache) survives past the read that produced it
  (`incognito`, `cacheEnabled={false}`, `sharedCookiesEnabled={false}`,
  `thirdPartyCookiesEnabled={false}` on the WebView component).
- Never bypass a bank's bot detection or CAPTCHA. If a bank blocks automation, that bank is
  unsupported — surface it and stop.
