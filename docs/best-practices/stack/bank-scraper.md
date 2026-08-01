# Bank scraper

`@finanzas/bank-scraper` drives a hidden WebView through a bank's own online-banking site and
reports back products and movements. It is the riskiest code in the repo: it depends on HTML
we do not control and it is the only module that ever touches a credential.

Ported from `bank-scrapper-app/apps/native/src/components/bank-scrapper/`.

## How it works

1. `BankScraperRef.start(countryCode, bankId, credentials)` loads the bank URL in a hidden
   `<WebView>`.
2. **Scripts** are injected at matching URL paths. A script is a function that takes input and
   returns a JavaScript **string** to run inside the page.
3. Scripts talk back via `window.ReactNativeWebView.postMessage()` using `ScraperEventType`
   (`STATE_CHANGE`, `ERROR`, `TRACE`, `ADD_SCRIPT`, `RUN_NEXT_SCRIPT`, `WAIT_AND_RETRY`).
4. `MessageHandlerService` routes messages; `StateManagerService` advances
   `LOAD_START → LOGIN_START → GET_PRODUCTS_START → GET_TRANSACTIONS_START → READY` and merges
   partial data.

## Credentials

The only module allowed to hold them, only in memory, only for one run.

- Read from `expo-secure-store` immediately before `start()`, pass by argument, never store on
  a component, in Context, in Query cache, or in module scope.
- **Redact before any trace.** The trace logger strips known secret keys before serializing.
  Adding a `console.log(credentials)` — even temporarily — is the one mistake that breaks the
  product's core promise.
- Never include a credential in an `ERROR` payload. Error codes are enumerated
  (`invalid_credentials`, `session_closed`, `network`, `parse_failed`); the message is safe text.
- Tests assert that no trace or error carries a credential value. That test is not optional.

## Adding or repairing a bank

Everything bank-specific stays in one directory:

```
packages/bank-scraper/configs/cl/<bank-name>/
├── <bank>.config.ts               # BankConfig: id, name, url, credential fields, script map
├── <bank>.login.script.ts
├── <bank>.home.script.ts
├── <bank>.account-transactions.script.ts
└── *.test.js                      # jsdom tests against captured HTML fixtures
```

Then register in `configs/cl/index.ts` and `configs/index.ts`. No file outside that directory
changes. App code that reaches into a bank's DOM is a design failure, not a shortcut.

## Testing

Bank HTML is unversioned and will break without warning, so tests are the early-warning system.

- Capture real HTML into a fixture (**scrubbed of personal data** — RUT, names, balances,
  account numbers replaced with synthetic values).
- Unit-test each script generator against the fixture in jsdom: does the selector still match,
  does the parser produce the expected `Product[]` / `Transaction[]`.
- Test the parsers on the ugly cases: amounts with thousands separators, negative/positive
  conventions, dates in `DD/MM/YYYY`, credit-card movements in a second currency, empty
  statements, and a session that dies mid-scrape.
- Never commit an unscrubbed fixture. Review checks this.

## Resilience

- Every step is retryable. `WAIT_AND_RETRY` exists because bank sites are slow, not because
  something is wrong — do not convert timeouts into hard failures.
- Partial results are useful: if products succeed and transactions fail, persist the products
  and surface `bank-syncing/error`. Do not discard a partial scrape.
- Report progress. `bank-syncing` has four states (`login`, `products`, `transactions`,
  `error`) and each maps to a `ScraperStepId`. A silent spinner is a UX failure on the app's
  most anxious screen.
- Assume selectors break. When a parse yields zero rows where rows were expected, raise
  `parse_failed` rather than writing an empty result — an empty sync that overwrites nothing is
  fine, but silently reporting "0 movimientos" as success is not.

## Never

- Never scrape anything the user did not connect.
- Never navigate the WebView to a non-bank origin.
- Never persist page HTML to disk outside a scrubbed test fixture.
- Never bypass a bank's bot detection or CAPTCHA. If a bank blocks automation, that bank is
  unsupported — surface it and stop.
