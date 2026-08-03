# Banco de Chile fixtures — provenance

**These fixtures are hand-authored from the selector contracts encoded in this bank's ported
reading routines. None of them was captured from a live Banco de Chile session.**

Nobody can commit a captured page without first having a real session, and the spec forbids
committing anything real (spec Business Rule 26, AC5). Authoring from the selectors — the class
names, tag names and DOM structure each `*.script.ts` file in this directory queries — is the only
path available to an implementation agent with no bank account. That is Documented Deviation D3 in
the implementation plan.

**The honest cost**: a fixture can agree with the script that reads it and still disagree with the
bank's real page. Green tests here prove the reading routines correctly parse the DOM shape the
fixtures describe; they do not prove the bank's site still has that shape. Follow-up F3 in the
implementation plan replaces these with scrubbed real captures the first time a contributor with a
Banco de Chile account repairs this bank.

## Rules every fixture in this directory follows

Enforced automatically by `testing/fixture-sanitization.test.ts` (spec Business Rule 26, AC5),
not by review alone — see the "Rules an author must follow" table below and
`src/testing/fixture-scan.ts` for the exact checks.

| Class | Rule |
| --- | --- |
| RUT | Every RUT-shaped string must be **check-digit invalid**. A scrubbed fixture's RUT never validates. This item's fixtures don't display a RUT anywhere at all — the bank's product/movement pages don't show one — so this class has no positive instances, only the detector's own tests. |
| Name | No real person's name, and no token from `src/testing/prohibited-name-tokens.ts`, appears anywhere. These fixtures don't display an account holder's name either. |
| Amount | Every amount is synthetic: zero, an exact multiple of 1000, or its thousands-quotient has all-identical decimal digits (`$1.111.000`, `$222.000`, `$33.000`, `$0`, `US$ 1.111,00`). |
| Account / card number | Every digit run of 7-20 characters is either all-identical digits (`11111111`) or on the explicit `src/testing/synthetic-allowlist.ts` allowlist. Card last-4 values (`1111`, `2222`) are below the 7-digit floor the detector checks, so they need no special treatment. |

## Fixture-to-routine map

| Fixture | Routine | What it exercises |
| --- | --- | --- |
| `login.html` | `banco-de-chile.login.script.ts` | AC1, AC4, AC6: filling the RUT/password inputs unchanged and clicking submit once, with no rejection banner present. |
| `login-invalid-credentials.html` | `banco-de-chile.login.script.ts` | AC14: a visible `[role="alert"]` rejection banner produces `invalid_credentials` with no bank text attached, submit clicked exactly once. |
| `home.html` | `banco-de-chile.home.script.ts` | AC1, AC6, AC24, AC25: two `Cuenta Corriente` accounts (different account numbers) get two different, individually stable instance identities; a `Línea de Crédito` product is discovered (not filtered in-page) for the normalizer to skip; two credit cards are discovered. |
| `home-unsupported-kind.html` | `banco-de-chile.home.script.ts` | AC25: a product whose wording maps to no enumerated type is discovered and later skipped by the normalizer, without preventing a `complete` outcome for the supported ones. |
| `account-transactions.html` | `banco-de-chile.account-transactions.script.ts` | AC1, AC6: pagination across two pages, one outgoing-column row and one incoming-column row. |
| `account-transactions-empty.html` | `banco-de-chile.account-transactions.script.ts` | AC11: a product with no movements in the window is a successful read of zero movements. |
| `account-transactions-count-mismatch.html` | `banco-de-chile.account-transactions.script.ts` | AC12: the paginator states more movements than are present, producing `parse_failed` for that product rather than an empty success. |
| `account-transactions-duplicate-rows.html` | `banco-de-chile.account-transactions.script.ts` | AC22: two rows with identical date, amount and description are reported as two movements, distinguishable by position. |
| `account-transactions-detail-row.html` | `banco-de-chile.account-transactions.script.ts` | The paired-row shape the live Angular Material table uses: a movement row followed by a differently-shaped detail/expansion row, which the structural row filter skips instead of misreading. |
| `account-transactions-unparsable-label.html` | `banco-de-chile.account-transactions.script.ts` | A paginator label present but with no parseable stated total — normalized to `null` (not `NaN`) so the AC12 stated-count check stays active, and the read still succeeds with the row actually present. |
| `credit-card-details.html` | `banco-de-chile.credit-card-details.script.ts` | AC1, AC6, AC9: the national balance/cupo summary and the card header; an unbilled and a billed movement, direction read from the populated column. |
| `credit-card-details-international.html` | `banco-de-chile.credit-card-details.script.ts` | AC10: an international (more-than-7-column) table reports its movement in USD, unconverted, with no peso amount invented. |

## Two documented simplifications from the source implementation

These are recorded in the reading routines' own doc comments too; noted here because they shape
what a fixture in this directory needs to contain.

- **`account-transactions.html`'s second page is not present in the fixture's static markup.**
  `banco-de-chile.account-transactions.script.dom.test.ts` simulates it by swapping the table body
  when the next-page button is clicked, because a `<script>` tag assigned via `element.innerHTML`
  does not execute (WHATWG DOM behavior, reproduced in jsdom) — a fixture cannot self-paginate.
- **The calendar-month-selection UI is not reproduced.** The source drives the bank's calendar
  widget to select the requested history window before reading a table; these fixtures represent
  whatever table is already on the page, which is what the pagination, empty-statement and
  stated-count-vs-parsed-count acceptance criteria actually test.
