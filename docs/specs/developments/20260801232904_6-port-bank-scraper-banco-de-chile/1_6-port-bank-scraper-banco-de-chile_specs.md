# Bank Scraper: Banco de Chile — Spec

**Depends on**: 1-bootstrap-monorepo-expo-app, 4-shared-utils-clp-dates-rut

---

## Overview

Finanzas exists because a person can see their bank movements without giving their banking
password to anyone. This item builds the part that makes that true: the on-device scraper that
signs into Banco de Chile's own website inside a hidden browser on the person's phone, reads
the products they hold and the movements on them, and hands that back to the app. It is the
only part of the product that ever touches a bank credential, and the only part that depends on
HTML written by someone else.

A working version of this scraper already exists outside the repository, where Banco de Chile is
implemented and proven against the live site. This item ports it: the reading engine, the
step-by-step progress protocol, and the four Banco de Chile reading routines (sign in, read the
product list, read an account's movements, read a card's movements). Two other banks that exist
in the source are dropped — the MVP ships one bank.

Nothing here is a screen. The connect-a-bank flow, the syncing screen and the storing of what
is read are separate items. What this item delivers is a capability with a hard promise around
it: the person's RUT and password exist only in this scraper's memory, only while one read is
running, and appear in nothing it writes down, reports or hands to anyone — proven by tests
that fail if that ever stops being true.

---

## Normative references

These documents are the ground truth this spec builds on and does not restate:

- [`docs/best-practices/stack/bank-scraper.md`](../../../best-practices/stack/bank-scraper.md)
  — how the scraper works, how credentials are handled, how a bank is added or repaired, and how
  it is tested. Normative for the conventions this item must follow.
- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) — what the app
  eventually stores, including the enumerated product types, movement direction and sync failure
  reasons this item must report in. Normative for those value sets.
- [`docs/project/3-software-architecture.md`](../../../project/3-software-architecture.md),
  decision 2 — the scraper is a package with a headless entry point and a hidden browser, not a
  screen; everything bank-specific lives in one directory per bank.
- [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md) — the entities
  (connection, product, movement) and the rules this item must not break.

Where this spec and one of those documents disagree, the disagreement is recorded under
[Documented Conflicts](#documented-conflicts) rather than silently reconciled.

**Source material**: the working implementation lives outside the repository at
`bank-scrapper-app/apps/native/src/components/bank-scrapper/`, which is local and ignored by
version control. It is a reference to read and port from, never a dependency to add to the
workspace, and none of its Falabella or Pelotillehue material is carried across.

**Vocabulary**: this spec says **reading routine** for what
[`bank-scraper.md`](../../../best-practices/stack/bank-scraper.md) calls a bank's injected script
generator, and **recorded page** for what it calls a captured HTML fixture. The two names describe
the same things; the implementation plan uses the best-practices vocabulary.

---

## Use Cases

### Use Case 1: A person connects Banco de Chile for the first time

**Actor**: The person, through the connect-a-bank flow (built by a separate item); the scraper
does the work on their behalf.
**Preconditions**: The person has chosen Banco de Chile and entered their RUT and password. The
credentials have been written to the device's secure store by the connect flow, which holds them
encrypted at rest (`expo-secure-store`'s own guarantee). The device has network access.

**Steps**:

1. The connect flow reads the credentials out of the secure store and asks the scraper to read
   Banco de Chile, in Chile, with those credentials and a requested history window.
2. The scraper opens the bank's own sign-in page in a hidden browser and signs in as the person.
3. The scraper reports that it is signing in, then that it is reading products, then that it is
   downloading movements — so the syncing screen can show which step is happening rather than a
   featureless spinner.
4. The scraper reads every product the person holds at that bank: their accounts and their credit
   cards, with the balance of each and, for cards, the cupo and how much of it is available.
5. For each product in turn, the scraper opens that product and reads its movements over the
   requested history window, following the bank's own pagination until every page has been read.
6. When every product has been read, the scraper reports completion and hands back everything it
   gathered.

**Postconditions**: The caller holds one result containing every product found and every
movement read, with each movement attached to the product it belongs to. The credentials are no
longer held anywhere by the scraper. The bank session and everything the hidden browser
accumulated during it are gone.

**Information shown**:

- Nothing directly. The scraper renders no visible interface. What it reports — the current
  step, how far along it is, and the outcome — is what the syncing screen renders
  (`#screen=bank-syncing`, states `login`, `products`, `transactions`, `error`).

**Actions available**:

- None from this item. Whether the person can cancel, and what the screen offers on failure,
  belong to the connect flow.

**Considerations**:

- The bank's site is slow and re-renders as it loads. Waiting and retrying is the normal case,
  not an error; a step that has not succeeded yet must be retried before it is called a failure.
- A person with no movements in the requested window is a success with zero movements, not a
  failure. A page that says nothing was found is a different thing from a page the scraper could
  not read.
- The RUT is credential material exactly as the password is. It is not stored anywhere by this
  item, does not appear in anything the scraper reports, and is not kept after the read ends.
- The credentials exist as plaintext in exactly two places for exactly the lifetime of one read:
  the connect flow's own memory, from the moment it reads them out of the secure store until it
  hands them to the scraper, and the scraper's own memory, from the moment it receives them until
  the read ends. Both the connect flow and the scraper clear their plaintext copy after the read
  ends — on success, on failure, and on cancellation alike (Business Rule 1). Neither ever writes
  the plaintext value anywhere else. The secure store itself holds only the encrypted copy, and is
  read again, not reused from memory, on the next sync.

---

### Use Case 2: The app re-reads Banco de Chile on a later sync

**Actor**: The app, acting for the person, on a sync after the first.
**Preconditions**: A Banco de Chile connection exists with credentials in the secure store.
Movements from an earlier read are already stored, and the person has categorized, noted and
excluded some of them.

**Steps**:

1. The app reads the credentials out of the secure store and asks the scraper to read the bank
   again.
2. The scraper signs in, reads the products, and reads each product's movements over the
   requested window — the same work as the first read.
3. The scraper hands back everything it read, including movements the app has seen before.

**Postconditions**: The result describes the same movements the same way it did last time, so
that the storing item can recognise what it already holds instead of adding it again.

**Information shown**:

- Nothing from this item.

**Actions available**:

- None from this item.

**Considerations**:

- The scraper does not know and does not care what is already stored. Recognising a repeat is the
  storing item's job (item #10). The scraper's obligation is that the same movement, read twice,
  is described identically both times — the same calendar day, the same amount, the same
  description, the same product, the same position in the bank's own listing.
- Two genuinely different movements that happen to share a day, an amount and a description are
  two movements. The scraper must not fold them into one, and must give the storing item enough to
  tell them apart. See [Conflict 2](#conflict-2--what-identifies-a-movement).
- A movement the bank re-states differently between reads (a description that gains a merchant
  name once it settles) is described as the bank states it now. Deciding whether that is the same
  movement is not this item's decision.

---

### Use Case 3: The bank rejects the person's credentials

**Actor**: The person, through the connect flow.
**Preconditions**: The person has entered a RUT and password. At least one of them is wrong, or
the bank has locked the login.

**Steps**:

1. The scraper signs in as in Use Case 1.
2. The bank's page comes back with a rejection.
3. The scraper stops, reports that the credentials were rejected, and ends the session.

**Postconditions**: The caller knows the read failed and why, in a form it can turn into copy.
No products and no movements were read. The credentials are no longer held by the scraper.

**Information shown**:

- Nothing directly. The connect flow shows `#screen=bank-credentials&state=error`.

**Actions available**:

- None from this item. Re-entering the credentials is the connect flow's affordance.

**Considerations**:

- What the scraper reports is a stable reason code, never a sentence. The wording the person sees
  is written once, in the app's Spanish catalogue, by the item that renders it.
- Whatever the bank's own error text said, it is not passed through as the reported reason and
  is not attached to the failure, because bank error text can echo back what was typed.
- A rejected sign-in is the one failure where retrying automatically is wrong: repeated attempts
  lock the person's real bank account.

---

### Use Case 4: The bank changes its site and the scraper stops matching it

**Actor**: The app, during any read.
**Preconditions**: The person is connected. Banco de Chile has changed the markup of one of its
pages since the scraper was last repaired.

**Steps**:

1. The scraper signs in and reads the product list successfully.
2. The scraper opens the first account and cannot find the movements it expects, or finds none
   where the bank's own page says there are some.
3. The scraper retries the step, waiting between attempts, and still cannot read it.
4. The scraper records that this product's movements could not be read, and carries on to the next
   product.
5. When every product has been attempted, the scraper reports a result that contains the products
   it read, the movements it managed to read, and the reason the rest failed.

**Postconditions**: The caller holds real, usable data plus an explicit statement of what was
missed. Nothing that was successfully read is discarded because something else failed.

**Information shown**:

- Nothing directly. The connect flow and `#screen=bank-review&state=error` decide what to show.

**Actions available**:

- None from this item.

**Considerations**:

- This is the expected failure of this item over time, not an edge case. Bank markup is not
  versioned and changes without notice.
- Reading zero movements where the bank's own page states a count is a failure, not an empty
  result. Reporting "0 movimientos" as a success would silently erase a month of a person's
  spending from every total.
- If the failure is that the bank ended the session — it signed the person out mid-read, or
  navigated the browser somewhere that is not the bank — that is a different reason from markup
  that no longer matches, and the scraper must say which.
- Not every failure permits moving on to the next product (Business Rule 31). A failure scoped to
  the product being read — the page not matching, or fewer movements parsed than the bank's own
  page states — is retried, then recorded, and the read continues to the next product, as this use
  case describes. A failure that is not scoped to one product — the bank ending the session, or the
  bank's site becoming unreachable — ends the read for every product not yet attempted; the
  products and movements already gathered before that point are still returned, reported as a
  partial result (Business Rule 19), not discarded because the rest could not be read.

---

### Use Case 5: A contributor repairs Banco de Chile after the bank changes its site

**Actor**: Contributor (human developer or implementation agent).
**Preconditions**: A read is failing against the live site. The workspace is set up and the test
command runs.

**Steps**:

1. The contributor runs this package's tests and sees which reading routine no longer matches
   its recorded page.
2. The contributor captures the bank's current page, removes every piece of the person's real
   information from it, and commits it as the new recorded page.
3. The contributor updates the reading routine for that page until its test passes again.
4. The contributor runs the full test suite and opens a pull request.

**Postconditions**: The repair touches only that bank's own directory. No app code, no shared
code and no other bank changed. The tests fail before the repair and pass after it.

**Information shown**:

- On a failing test: which reading routine, which page, and what it expected to find.

**Actions available**:

- Re-run the tests after correcting the routine.

**Considerations**:

- The recorded page is committed to the repository, so it must never contain a real RUT, a real
  name, a real balance or a real account number. This is checked automatically, not by memory.
- A repair that needs a change outside that bank's directory means the containment rule has been
  broken somewhere and is a design failure to fix, not a shortcut to take.
- The tests run in a plain page-parsing environment, with no phone, no simulator and no network,
  so a broken bank is discovered by the test suite before it is discovered by a person.

---

### Use Case 6: A contributor confirms nothing outside the bank's own directory knows about the bank

**Actor**: Contributor building any later feature that consumes what the scraper produces.
**Preconditions**: The scraper is implemented and its tests pass.

**Steps**:

1. The contributor needs the person's products and movements from Banco de Chile.
2. The contributor asks the scraper, in the terms this spec defines, and receives products and
   movements described the same way any bank's would be.
3. The contributor writes no selector, no bank URL and no bank-specific parsing anywhere.

**Postconditions**: Adding, repairing or removing a bank later is a change confined to one
directory. The app's own code is unaffected by any of it.

**Information shown**:

- Nothing from this item.

**Actions available**:

- None from this item.

**Considerations**:

- The scraper reports products and movements in the product's own shared vocabulary — the same
  product types and the same movement direction the rest of the app already uses — not in Banco
  de Chile's.
- The scraper never reports copy of its own. Every value it hands over that a person will
  eventually read as a label — a reason, a kind, a direction — is a stable code, resolved to
  Spanish by the app's catalogue. Text the bank itself supplies — a movement's description, a
  product's display name — is data the scraper passes through unchanged, not a label it invents;
  it is shown to the person exactly as the bank wrote it (Business Rule 17).

---

## Business Rules

1. **The scraper is the only part of the product that holds a bank credential, and it holds it
   only in memory, only for one read.** The credentials are handed to it when a read starts and
   are gone when that read ends — whether it succeeded, failed, or was stopped. They are never
   written to the local database, never kept beyond the read, and never held anywhere that
   outlives it. Before the read starts, the same credentials exist as plaintext only in the
   calling connect-flow code's memory, for only as long as it takes to read them out of the
   secure store (where they are held encrypted) and hand them to the scraper; the connect flow
   clears its own plaintext copy once that handoff is made, exactly as the scraper clears its
   copy once the read ends.
2. **The RUT is credential material.** Every rule in this section that applies to the password
   applies to the RUT identically. Nothing in this item stores a RUT, reports a RUT, or keeps one
   after a read.
3. **No credential value appears in anything the scraper writes down or hands over.** Not in a
   diagnostic trace, not in a failure report, not in a console line, and not in any recorded or
   reported copy of the instructions the scraper sends into the bank's page — those instructions
   carry the credential while they are running and must never be captured anywhere. Removal of
   credential values happens before anything is turned into text, not after.
4. **This is proven by test, not by inspection.** The test suite drives a full read with
   recognisable credential values and asserts that neither value, in any form the scraper could
   produce, appears in any trace, any failure report or any console output. A change that
   reintroduces a credential into a diagnostic fails the suite.
5. **A credential is typed into the bank's own page and nowhere else, checked against an exact
   allowlist, not a description of what the page looks like.** For Banco de Chile the allowlist
   is the single HTTPS origin `https://login.portales.bancochile.cl` — the sign-in host the proven
   source implementation already uses, and the only host its reading routines' page paths resolve
   against. Before either credential field is filled, the scraper checks the browser's current URL
   against that allowlist: the scheme must be `https`, the host must match that origin exactly —
   no other subdomain of `bancochile.cl`, and no lookalike host that merely contains or resembles
   `bancochile` — and the page must not be the result of a redirect that left that origin. If the
   check fails for any reason, no credential is entered and the read stops: as `session_closed` if
   it happens after a session was established, or as the appropriate read-level failure if it
   happens before one was.
6. **A credential value never changes what the scraper does.** A password or RUT containing
   quotes, backslashes or any other punctuation reaches the bank's form exactly as the person
   typed it, and cannot alter the instructions the scraper is running.
7. **Nothing from the bank session outlives the read.** No page content is written to disk, no
   cookie or browser storage from the session is kept for a later read, and no bank page is
   retained anywhere except as a deliberately scrubbed recorded page in the test suite.
8. **The scraper talks to the bank and to nothing else.** It makes no request to any server
   belonging to this product — there is none — and sends no credential, product or movement
   anywhere other than the bank's own site.
9. **Money is reported as whole minor units of its own currency, always positive.** For Chilean
   pesos the minor unit is the peso; a fractional or floating-point amount anywhere in a reported
   result is a defect. Whether money moved in or out is reported separately as the movement's
   direction, never as a negative amount.
10. **Whether a movement is money in or money out is read from the bank's own presentation of
    it** — which column the bank put the amount in — not assumed from the kind of product it
    came from.
11. **A movement's date is the calendar day the bank stated**, read from the bank's `DD/MM/YYYY`
    presentation, and it is that day regardless of the device's time zone. Any instant reported
    alongside it is derived from that calendar day through the shared date helpers, never the
    reverse.
12. **Amounts are parsed for Chilean presentation**: thousands separated by dots, no decimals in
    pesos, currency symbols and stray whitespace stripped. A peso amount that parses to something
    with a decimal part is a defect, not a rounding question. **A foreign-currency card movement
    (AC10) is parsed with the same separator convention** — thousands separated by dots, decimals
    separated by a comma, currency symbols and codes (`US$`, `USD`) and stray whitespace stripped —
    because Banco de Chile presents its one supported foreign currency, US dollars, in that same
    Chilean style, unlike the decimal-point convention English-language sites use. The parsed
    decimal value is then converted to whole minor units of that currency by its own exponent (2
    for US dollars) — multiplying by the matching power of ten. Because the bank never states more
    decimal digits than the currency's exponent allows, this conversion is always exact: a foreign
    amount that would need rounding to reach a whole minor unit is a defect, exactly as a peso
    amount with a decimal part is.
13. **The scraper reports a bank-supplied identity for a movement only when the bank actually
    supplies one.** It never manufactures one out of the movement's own content and presents it as
    if the bank had given it. When the bank supplies none, the scraper reports the facts the
    storing item needs to recognise a repeat: the product, the calendar day, the amount, the
    direction and the description exactly as the bank wrote it.
14. **Two movements the bank lists separately are reported separately.** Identical day, amount and
    description do not make them one movement, and the scraper also reports each movement's
    position within the bank's own listing so they can be told apart within that one read. That
    position is a same-read disambiguator only — reported from a single snapshot of the bank's
    listing taken during this read. It carries no promise of stability across two separate reads
    (a reordered page, an inserted movement, or a pagination change can all change it), and must
    never be treated as a cross-read identity ([Conflict 2](#conflict-2--what-identifies-a-movement)).
15. **A product is reported with a stable identity of its own, separate from what kind of product
    it is, and that identity is opaque.** It is never the bank's own raw account or card number —
    it is derived from the bank's identifier (for example, by a one-way hash) so it stays stable
    across reads of the same product without being, or being reversible to, the number it is
    derived from. The raw account or card number never appears in a result, a diagnostic, or
    anything handed downstream to persistence (Decision 10). Two accounts of the same kind are two
    products, and each is recognisable as the same product on the next read by this opaque
    identity — the separately reported masked identifier (last four digits) is what a screen or a
    trace is allowed to display; the opaque identity itself is never shown to a person.
16. **Products and movements are reported in the product's shared vocabulary.** Product kind is
    one of the enumerated product types; movement direction is the enumerated debit/credit pair.
    Bank-specific wording is translated into those. A product whose kind the scraper cannot place
    in that set is not reported as a product at all, and is recorded in the diagnostic trail so it
    can be added deliberately; no new kind is invented. **This is a scoped, not an unscoped,
    completeness contract**: `complete` means every product of a *supported* kind was read, and
    every one of those products' movements was read — not that nothing on the bank's page was
    skipped. A product kind outside the enumerated set is a known, expected MVP limitation, named
    in the diagnostic trail, and does not by itself turn a read that otherwise finished cleanly
    into a `partial` or `failed` one ([Read outcome](#read-outcome)).
17. **The scraper never produces copy of its own.** Every reason, kind and direction it reports is
    a stable code, resolved to Spanish elsewhere by the app's catalogue — never a sentence the
    scraper wrote itself. Extra bank-specific details it passes through are keyed by stable
    identifiers, not by the Spanish words the bank's table happened to use. **This does not apply
    to text the bank itself supplies as data**: a movement's description and a product's display
    name are the bank's own words, not the scraper's, and are preserved verbatim and shown to the
    person exactly as the bank wrote them ("Per movement" and "Per product" tables) — the scraper
    does not translate, summarize or interpret that text, it only refuses to invent sentences of
    its own alongside it.
18. **Failure is reported as one of four reasons**: the credentials were rejected, the bank ended
    the session, the bank could not be reached, or the bank's page did not match what the scraper
    expects. These are exactly the reasons a connection can record, and the scraper introduces no
    fifth one.
19. **A read that gathered something reports what it gathered.** Products read successfully and
    movements read successfully are always in the result, even when a later step failed. Failure
    is reported alongside the data, never instead of it.
20. **Reading zero movements is only a success when the bank said there were none.** If the bank's
    own page states a count and the scraper parses fewer than that, the read of that product failed
    and says so.
21. **Every step is retried before it is called a failure.** Slowness is the normal condition of
    the bank's site. A step that could not complete is attempted again, with a wait between
    attempts, before any failure is reported.
22. **A rejected sign-in is never retried automatically.** Repeating it risks locking the person's
    real bank account.
23. **Progress is always reported.** The scraper announces each step it enters — signing in,
    reading products, downloading movements — and its progress never goes backwards. A read that
    leaves the caller with nothing to show is a defect.
24. **Everything Banco de Chile-specific lives in one directory.** Its address, its sign-in form,
    its page addresses, its selectors and its parsing all live under that bank's own directory.
    No file outside it contains knowledge of Banco de Chile, and no code outside this package
    reaches into a bank's page.
25. **Every reading routine is tested against a recorded page.** Each routine that finds or parses
    something on a bank page has a test that runs it against a captured page and asserts what it
    produces.
26. **No recorded page contains anyone's real information.** Every RUT, name, balance and account
    number in a committed page is synthetic. This is enforced by four deterministic tests, one per
    class — RUT, name, balance, account number — each proven by planting a synthetic violation of
    that class and asserting the test catches it, not by review alone.
27. **The scraper refuses work it does not support.** Asked to read a bank or a country it has no
    configuration for, it refuses before opening anything, without navigating and without touching
    the credentials. That refusal is a rejected request, not one of the four sync failure reasons.
28. **The scraper never works around a bank's defences.** No CAPTCHA solving, no bot-detection
    evasion. If Banco de Chile blocks automation, the read fails and says so.
29. **The scraper reads. It never moves money.** No transfer, no payment, no change to anything in
    the person's bank account is ever initiated.
30. **The scraper reads only what the person connected.** It reads the one bank the caller named,
    and within it only the products that bank lists for that person. It never visits another
    institution, another person's data, or any part of the bank's site outside the pages its
    reading routines declare.
31. **A product-local failure does not stop the read; a read-level failure does.** Once sign-in
    has succeeded, a failure while reading one product's movements — the bank's page not matching
    what the scraper expects, or the bank stating more movements than the scraper could parse — is
    scoped to that product: it is retried, recorded as that product's failure reason once retries
    are exhausted, and the read moves on to the next product. A failure that is not scoped to one
    product — the bank ending the session, or the bank's site becoming unreachable — ends the read
    for every product not yet attempted; whatever was already gathered before that point is still
    returned, reported as a partial result (Business Rule 19), never discarded.
32. **Every retried step is bounded, so a stalled page cannot hold credentials or browser
    resources indefinitely.** A step's own attempts are capped and timed — the proven source
    implementation's defaults are 3 attempts with a 1-second wait between them for a page-level
    step, and 10 attempts with a 200-millisecond wait for waiting on a single element — after which
    that step is a failure. Independently, the read as a whole has a fixed overall deadline
    (Decision 16); a read not finished by then ends as a failure using whichever reason its
    last-attempted step would have reported, rather than continuing to wait past it.
    `invalid_credentials` is retried zero times regardless of any of these budgets, per Business
    Rule 22 — it is non-retryable outright, not merely subject to the same caps as everything else.

---

## What a read reports

The scraper hands back one result per read. This section states, in product terms, what that
result must be able to answer. Field names, types and file layout are the implementation plan's
decision; the facts below are not.

### Per product

| Fact | Why it is needed |
| --- | --- |
| A stable, opaque identity for this product within this bank — never the raw account or card number | So the same account is recognised as the same account on the next read, without exposing or persisting the raw identifier it is derived from (Business Rule 15). |
| What kind of product it is, from the enumerated product types | Drives how it is displayed and how movements are filtered. |
| A display name for it | Shown wherever the product is named. |
| Its currency | `CLP` for every Banco de Chile product in the MVP. |
| Its balance, in whole minor units | Shown on the bank detail screen. |
| For a card: its cupo and its available cupo, in whole minor units | Shown on the bank detail screen. |
| For a card: its brand, its kind and its last four digits | Distinguishes two cards in the same list. |
| A masked form of its identifier suitable for display | So no screen and no trace has to handle the unmasked one. |

### Per movement

| Fact | Why it is needed |
| --- | --- |
| Which product it belongs to | Movements are always attached to a product. |
| The calendar day the bank stated, as a plain date | Groups movements by month without a time-zone question (Business Rule 11). |
| Its amount, as a positive whole number of minor units | The product's money rule (Business Rule 9). |
| Its direction — money in or money out | Replaces the sign the bank shows (Business Rule 10). |
| Its currency | `CLP`, or the foreign currency for an international card movement. |
| The description exactly as the bank wrote it | The person sees it verbatim, and merchant resolution reads it. |
| A bank-supplied identity, when and only when the bank supplies one | Lets the storing item recognise a repeat by identity (Business Rule 13). |
| Its position within the bank's own listing for that product and day, valid only within this one read's snapshot | Lets the storing item tell two identical movements apart within this read (Business Rule 14) — not a cross-read identity. |
| Bank-specific extras, keyed by stable identifiers | Cuotas, movement kind, city, country, foreign-currency original amount, and whether a card movement is billed or not yet billed. |

### Per read

| Fact | Why it is needed |
| --- | --- |
| The step the read is currently in, and its progress | Drives the syncing screen (Business Rule 23). |
| Everything read so far, at every step | Makes a partial result possible (Business Rule 19). |
| Whether the read completed fully, completed partially, or failed before gathering anything | Decides what the connection records. |
| For a failure: which of the four reasons, and — only when the failure is scoped to a product rather than to the read itself — which product it happened on | Decides the copy shown and whether a repair is needed. A read-level failure (Business Rule 31), most notably `invalid_credentials`, happens before any product is discovered and reports no product at all — there is none to name. |
| The diagnostic trail of the read, with credentials already removed | Makes a broken bank diagnosable (Business Rules 3 and 4). |

---

## Statuses / Enum Values

This item renders nothing. The Spanish labels below are recorded as the **proposed copy** for the
screens that will render these values, so later items do not invent divergent wording; the
catalogue entry and its final wording are owned by the item that first renders it. The scraper
itself emits only the code values (Business Rule 17).

### Read step

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `load-start` | (not surfaced) | The hidden browser is opening the bank's site. |
| `login-start` | Iniciando sesión | Signing in as the person. Maps to `#screen=bank-syncing&state=login`. |
| `get-products-start` | Leyendo productos | Reading the list of accounts and cards. Maps to `state=products`. |
| `get-transactions-start` | Descargando movimientos | Reading each product's movements. Maps to `state=transactions`. |
| `ready` | (the screen advances) | Every product has been attempted and the result is final. |

**Valid transitions**: `load-start` → `login-start` → `get-products-start` →
`get-transactions-start` → `ready`. A read never moves backwards through these, and a failure can
end a read from any of them. `#screen=bank-syncing&state=error` is reached from any step by a
reported failure, not by a step of its own.

### Read outcome

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `complete` | (the screen advances) | Every product of a *supported* kind was read and every one of those products' movements was read (Business Rule 16). A product kind outside the enumerated set is a known MVP limitation, named in the diagnostic trail, and does not by itself prevent `complete`. |
| `partial` | Sincronización incompleta | At least one product was read, and at least one product's movements were not — or a read-level failure ended the read after some products had already been read. The result carries both. |
| `failed` | Error de conexión | Nothing usable was gathered. |
| `cancelled` | (the screen leaves the flow) | The caller stopped the read before it finished. See [Cancellation](#cancellation). Carries whatever was already gathered, exactly as `partial` does, but is never a failure reason and never populates `last_error_code`. |

### Failure reason

The set is exactly the set a connection can record
([`4-database-model.md`](../../../project/4-database-model.md), `last_error_code`). Copy is owned
by the item that renders it.

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `invalid_credentials` | Revisa tus datos | The bank rejected the RUT or the password. Never retried automatically. |
| `session_closed` | La sesión con el banco se cerró | The bank signed the person out mid-read, or navigated the browser off the bank's own site. |
| `network` | No pudimos conectarnos al banco | The bank's site could not be reached or never finished loading. |
| `parse_failed` | El banco cambió su sitio | The bank's page did not match what the scraper expects, or the scraper parsed fewer movements than the bank's own page stated. |

### Product type

Reported using the enumerated types the data model already defines. The Banco de Chile mapping:

| Bank's own wording | Reported type | Proposed display label |
| --- | --- | --- |
| Cuenta Corriente | `checking` | Cuenta corriente |
| Cuenta Vista | `sight` | Cuenta vista |
| Cuenta FAN | `sight` | Cuenta vista |
| Tarjeta de crédito | `credit_card` | Tarjeta de crédito |
| Línea de Crédito | not reported in the MVP — see Decision 15 | Línea de crédito |
| Anything else | not reported as a product | — |

The enumerated type `credit_line` stays reserved for when the línea de crédito is reported. A
product kind outside this table is skipped and named in the diagnostic trail (Business Rule 16).

### Movement direction

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `debit` | Never shown raw; the UI derives "Gasto" | Money out, as the bank presented it. |
| `credit` | Never shown raw; the UI derives "Ingreso" | Money in, as the bank presented it. |

---

## Cancellation

A read can be stopped while it is in progress — the person navigates away from the syncing
screen, or the app decides to give up. This section is the read-level contract for that; the
stop mechanism's exact shape (a function, a signal, a promise) is the implementation plan's
decision.

- **The caller can ask an in-flight read to stop at any time**, from any read step ([Read
  step](#read-step)), including mid-navigation and mid-injection — before a reading routine's
  script has finished posting back a state change. The scraper does not wait for that step to
  finish on its own: it interrupts the in-flight navigation or script execution and discards any
  response that arrives from it after the stop was requested.
- **Credential release happens before or atomically with tearing down the browser session — never
  after.** The order is: clear the credentials held in memory, then tear down the WebView and the
  bank session — or clear and tear down as one inseparable step. A stop request never leaves a
  credential in memory while the browser session is still being unwound.
- **A stopped read reports the outcome `cancelled`**, a fourth value alongside `complete`,
  `partial` and `failed` ([Read outcome](#read-outcome)). It carries whatever products and
  movements had already been gathered before the stop arrived — the same shape a `partial`
  result's data is in — but is never one of the four failure reasons and never populates
  `last_error_code`: stopping a read is the caller's choice, not the bank failing.
- **Everything Business Rule 1 promises about a read's end applies identically to a stopped
  read**: the credentials are gone, and the bank session and everything the hidden browser
  accumulated during it are gone, whether the read completed, failed, or was stopped.

---

## Operational Visibility

- **Progress**: every step the scraper enters is announced to the caller, along with how far
  through the read it is, so the syncing screen always has something true to show. Progress never
  decreases and only reaches its maximum when the read is final.
- **Diagnostic trail**: the scraper keeps a running trail of what it did — which page it was on,
  which step it attempted, how many attempts a step needed, how many products and movements it
  found — and hands that trail over with a failure so a broken bank can be diagnosed. Every entry
  passes through redaction before it becomes text.
- **What the trail must never contain**: a RUT, a password, an unmasked account number, or the
  text of the instructions sent into the page while those instructions carry a credential.
- **Console output**: the scraper writes nothing to a console in a release build. Diagnostic output
  in development goes through the same redacting path as everything else, never directly.
- **No telemetry**: this item introduces no analytics, no crash reporting and no remote logging.
  Nothing about the read leaves the device.
- **Test-suite visibility**: a bank whose site has changed is surfaced by this package's tests
  failing, which is the intended early warning, before a person's sync fails.

---

## Acceptance Criteria

- [ ] **AC1.** Asking the scraper for Banco de Chile in Chile with valid credentials drives a
      complete read: it signs in, reports each step in order, and finishes with a result
      containing at least one product and the movements belonging to it.
- [ ] **AC2.** Driving a full read with recognisable credential values produces no trace entry, no
      failure report, no returned value and no console output containing either value, in any
      form — including inside the instructions the scraper sends into the page, wherever those are
      recorded. This is asserted by an automated test that fails if a credential is reintroduced
      into any diagnostic.
- [ ] **AC3.** The scraper holds no credential after a read ends, in success, in failure, or when
      the caller stops the read. Nothing this item produces is written to the local database. A
      read the caller stops reports the outcome `cancelled`, carrying whatever was already
      gathered before the stop, and credential release happens before or atomically with
      tearing down the browser session (see [Cancellation](#cancellation)).
- [ ] **AC4.** A credential value containing quotes, backslashes and other punctuation reaches the
      bank's form unchanged and does not alter what the scraper executes.
- [ ] **AC5.** No committed recorded page contains a valid real-looking RUT, a real person's name,
      a real balance or a real account number. This is enforced by four deterministic automated
      checks, one per prohibited class — a RUT-shaped identifier, a real-looking name, a
      real-looking balance, and a real-looking account number, each outside its own synthetic
      allowlist — and each check is proven by planting a synthetic violation of that specific
      class into a fixture and asserting the check catches it, not merely that a fixture looks
      clean.
- [ ] **AC6.** Every reading routine for Banco de Chile — sign in, product list, account movements,
      card movements — has a test that runs it against a recorded page and asserts what it finds
      and what it produces.
- [ ] **AC7.** Amounts written the Chilean way, with dots as thousands separators and a currency
      symbol, are read as whole numbers of pesos. No reported peso amount has a decimal part.
- [ ] **AC8.** A movement the bank dates `01/03/2026` is reported on calendar day `2026-03-01`,
      and stays that day when the test runs under a device time zone east and west of Santiago.
- [ ] **AC9.** Every reported amount is a positive whole number, and whether money moved in or out
      is reported as the movement's direction, taken from the column the bank put the amount in —
      including for a card movement, which is not assumed to be one direction.
- [ ] **AC10.** A card statement containing movements in a second currency reports those movements
      in that currency, as whole minor units of that currency, with no conversion applied and no
      peso amount invented for them. Amounts are parsed with the Chilean separator convention
      (dots for thousands, comma for decimals) and converted to that currency's own minor-unit
      exponent exactly, with no rounding loss (Business Rule 12).
- [ ] **AC11.** A recorded page for a product with no movements in the window, where the bank's
      own page says so, produces a successful read of that product with zero movements and no
      failure.
- [ ] **AC12.** A recorded page whose own stated movement count is higher than the number of rows
      the scraper can parse produces a `parse_failed` result for that product, not an empty
      success.
- [ ] **AC13.** A read where the product list succeeds and one product's movements fail returns
      the products, returns the movements that were read, reports the outcome as partial, and
      names the failure reason and the product it happened on. Nothing already gathered is
      discarded.
- [ ] **AC14.** A read where the bank rejects the sign-in reports `invalid_credentials`, gathers
      nothing, does not retry the sign-in, and does not attach the bank's own error text to the
      failure. Because this is a read-level failure that happens before any product is discovered,
      the result reports no product for it — there is none to name.
- [ ] **AC15.** A read where the bank's site never finishes loading reports `network`; a read where
      the browser ends up on a page that is not the bank's own site, or the bank signs the person
      out mid-read, reports `session_closed`; a read where a page loads but does not match reports
      `parse_failed`. Each is asserted separately.
- [ ] **AC16.** No credential is entered into a form on a page outside the bank's exact allowlisted
      origin (Business Rule 5); the read stops instead. This is asserted for three cases: the
      bank's own allowlisted origin (allowed), a redirect that lands the browser off that origin
      partway through the sign-in navigation (rejected), and a lookalike hostname that is not on
      the allowlist (rejected). A read visits only the bank the caller named and only the page
      addresses that bank's reading routines declare.
- [ ] **AC17.** Every failure of a started read is reported as one of the four enumerated reasons.
      No fifth reason exists in that set. The refusal in AC18 is not a read failure and is reported
      separately.
- [ ] **AC18.** Asking the scraper for a bank or a country it has no configuration for is refused
      before anything is opened: no navigation happens, and the refusal is distinguishable from the
      four sync failure reasons.
- [ ] **AC19.** A step that does not succeed at first is retried with a wait between attempts
      before any failure is reported, and the number of attempts is visible in the diagnostic
      trail. Retries are bounded: no step retries beyond its fixed maximum attempts, and no read
      continues past its overall deadline (Business Rule 32). `invalid_credentials` is asserted
      separately as never retried, at all (AC14).
- [ ] **AC20.** The scraper announces every step it enters, in order, and its reported progress
      never decreases across a read.
- [ ] **AC21.** Reading the same recorded pages twice produces two results that describe every
      movement identically — same product, same calendar day, same amount, same direction, same
      description, same position in the bank's listing. This is about a fixed, byte-identical
      fixture, not a live site that can reorder between reads — position's stability here does not
      extend to two reads of the live site ([Conflict 2](#conflict-2--what-identifies-a-movement)).
- [ ] **AC22.** Two movements the bank lists separately with the same day, amount and description
      are reported as two movements, distinguishable by their position in the bank's listing.
- [ ] **AC23.** No movement carries a bank-supplied identity that the bank did not actually supply.
- [ ] **AC24.** Two accounts of the same kind in the same bank are reported as two products with
      different identities, and each keeps that identity across two reads of the same recorded
      pages. Neither identity is the raw account or card number: only the opaque instance identity
      and the separately masked display form appear in the result (Business Rule 15).
- [ ] **AC25.** Every product is reported with one of the enumerated product types, and every
      movement with one of the enumerated directions. A recorded page containing a product kind
      outside that set yields no product for it and a diagnostic entry naming it, and never a
      product carrying an invented kind. A recorded page that mixes a supported and an unsupported
      product kind still yields a `complete` outcome for the supported ones, per the scoped
      completeness contract in Business Rule 16.
- [ ] **AC26.** Nothing the scraper produces itself is a user-facing sentence: reasons, kinds and
      directions are stable codes, and bank-specific extras are keyed by stable identifiers rather
      than the bank's Spanish column headings. This does not apply to bank-supplied text passed
      through as data — a movement's description, a product's display name — which is preserved
      verbatim and is shown to the person (Business Rule 17).
- [ ] **AC27.** All Banco de Chile knowledge — its address, page addresses, selectors and parsing —
      lives under that bank's own directory. A search of the rest of the repository finds no Banco
      de Chile selector, address or parsing rule, and no code outside this package reaches into a
      bank page.
- [ ] **AC28.** No material for Banco Falabella or Banco Pelotillehue exists in this package, and
      the scraper offers exactly one bank for Chile.
- [ ] **AC29.** Chilean RUT handling in this package is done with the shared utilities rather than
      a second copy, and no call site of theirs logs, caches or retains a RUT.
- [ ] **AC30.** This package's tests run with no phone, no simulator and no network, as part of the
      repository's existing test command, on every pull request.
- [ ] **AC31.** This item introduces no request to any server other than the bank's own site, no
      analytics, no crash reporting and no export. No bank page content is written to disk outside
      a committed recorded page.
- [ ] **AC32.** Nothing from a bank session — cookie, browser storage or cached page — is carried
      into a later read.
- [ ] **AC33.** Every change this item makes is inside `packages/bank-scraper/`. It does not modify
      the workspace's package-manager configuration, its continuous-integration workflows, its
      lint configuration or the repository-architecture document.

---

## Out of Scope (MVP)

- **Every screen.** The bank picker, the credentials form, the syncing screen, the bank detail
  screen and the reconnection flow are separate items. This item renders nothing a person sees.
- **Storing anything.** Nothing read here is written to the local database. Mapping a result onto
  stored products and movements, and recognising repeats, is the sync item (#10).
- **Reading or writing the secure store.** The credentials are handed to the scraper by its caller.
  Capturing them, storing them and clearing them belong to the connect flow.
- **Deciding when to sync.** The rule about an active connection syncing when its last success is
  over six hours old belongs to the app; the scraper runs when it is asked to.
- **Banks other than Banco de Chile.** Falabella and Pelotillehue are not ported. Adding a second
  bank later is a contained change under Business Rule 24, not a change to this item.
- **The línea de crédito as a product of its own.** Its movements already appear on the cuenta
  corriente it is attached to, so reporting it separately would double-count them. The enumerated
  product type stays reserved — see Decision 15.
- **Foreign-currency conversion.** Movements in a second currency are reported as the bank stated
  them, in that currency. No exchange rate is fetched, applied or stored — there is no server to
  fetch one from.
- **Merchant resolution and category suggestion.** The scraper reports the bank's description
  verbatim; interpreting it belongs to the pure-rules package.
- **Automatic repair of a changed bank site.** When a page stops matching, the scraper fails
  loudly and a contributor repairs it. Nothing adapts by itself.
- **Working around bot detection or CAPTCHA.** Explicitly excluded by Business Rule 28. A bank
  that blocks automation is an unsupported bank.
- **Any server-side component.** There is none in this product, and nothing in this item needs
  one. A design that required one would contradict the product and would be escalated rather than
  built.
- **Device end-to-end coverage.** This item is verified entirely by tests against recorded pages.
  The device flow that exercises a real sync belongs to the connect flow's runbook.

---

## Documented Conflicts

### Conflict 1 — what identifies a product

- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) says a stored
  product's external identifier is "the scraper's `Product.financialProductId`", and makes that
  identifier unique within a connection.
- In the source implementation, that value classifies *what kind of product it is*
  (`cuenta-corriente`, `cuenta-vista`, `tarjeta-credito-…`), which is the same for every account
  of that kind. A person with two cuentas corrientes would have both collapse onto one stored
  product.

**Resolution taken in this spec**: the scraper reports two separate facts — a stable identity for
the product instance, and the kind of product it is (Business Rules 15 and 16). The instance
identity is what recognises a product across reads; the kind is what the app displays and filters
on. The instance identity is opaque (Business Rule 15) rather than the raw account or card
number, so it is safe to persist and to compare across reads without exposing or reconstructing
the number it is derived from.

**Consequence this spec absorbs**: whoever amends the data model should point the stored external
identifier at the instance identity rather than the product kind. That edit belongs to the
database or sync item, not to this one, which owns only `packages/bank-scraper/`.

**Human confirmation requested**: yes.

### Conflict 2 — what identifies a movement

- [`docs/project/4-database-model.md`](../../../project/4-database-model.md), gap #1, says "the
  scraper already emits a per-bank `Transaction.id`" and treats it as the primary way to recognise
  a repeat, with a content fingerprint as the fallback.
- In the source implementation, that identifier is *composed from* the movement's own product,
  date, description and amount — the same ingredients as the fallback fingerprint. It is not
  something Banco de Chile supplies. Two effects follow: the primary and fallback routes are the
  same route wearing two hats, and two genuinely distinct movements on the same day for the same
  amount with the same description collapse into one, both while reading and once stored.

**Resolution taken in this spec**: the scraper reports a bank-supplied identity only when the bank
genuinely supplies one — which Banco de Chile does not today — and instead reports the facts the
storing item needs to recognise a repeat: the product, the calendar day, the amount in minor
units, the direction, and the description exactly as the bank wrote it (Business Rule 13). Because
none of those five facts is guaranteed unique among a day's movements, the scraper also reports
each movement's position within the bank's own listing (Business Rule 14) — but only as a
disambiguator within that single read's snapshot of the listing. A reordered page, a movement the
bank inserts earlier on a later read, or a change in pagination can all change a position between
two separate reads of the live site, so position carries no promise of stability across reads and
must never be used as part of a cross-read identity.

**Consequence this spec absorbs**: the storing item (#10) computes its fingerprint from the five
stable facts above, using position only to break a tie within one read's results — never across
two reads. This item's obligation is only to make that distinction available within one read, not
to make position itself stable over time. Two identical same-day movements collapsing into one
within a single read is a real, everyday possibility — two coffees at the same café — so the
information has to exist for #10 to be able to solve that specific case; two reads of the live
site producing a different position for the same movement is a different, expected situation #10
must tolerate, not an error.

**Human confirmation requested**: yes.

### Conflict 3 — the bank's identifier

- The source implementation identifies the bank as `bancochile`.
- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) seeds the bank as
  `banco-de-chile` and states the seeded identifier must match the one the scraper uses, because
  the connect flow passes it straight through. Work item #6's own acceptance criteria also say
  `banco-de-chile`.

**Resolution taken in this spec**: `banco-de-chile`. The source's identifier is a porting detail
to correct, not a contract to preserve.

**Human confirmation requested**: no.

### Conflict 4 — a second currency in a CLP-only MVP

- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) makes the currency a
  plain code defaulting to `CLP` and defers multi-currency entirely.
- Banco de Chile's card statements contain international movements presented in a foreign
  currency, and work item #6 explicitly requires the parsers to cover them.

**Resolution taken in this spec**: the scraper reports foreign-currency movements as the bank
stated them — in that currency, as whole minor units of that currency — and converts nothing
(Business Rule 9, AC10). Whether the sync item stores them, ignores them or surfaces them
separately is that item's decision; discarding them here would hide movements the person actually
made, and converting them would require an exchange rate this product has no way to obtain.

**Human confirmation requested**: yes.

---

## Decision Log

Decisions taken while writing this spec, resolved from the ground-truth documents and the source
implementation. Each is listed so the product owner can revisit it.

| # | Decision | Basis | Confirmation requested |
| --- | --- | --- | --- |
| 1 | The bank is identified as `banco-de-chile`. | [Conflict 3](#conflict-3--the-banks-identifier). | No |
| 2 | Amounts are reported unsigned, with direction taken from the column the bank used, replacing the source's negative amounts and its blanket direction per product kind. | The data model stores amounts positive with direction separate; the source marks every account movement as one direction and every card movement as the other, which is wrong for refunds and payments. | No |
| 3 | The calendar day is the primary date; any instant is derived from it through the shared date helpers. | The source builds an instant from the bank's `DD/MM/YYYY` in the device's local zone, which puts a movement in the wrong month for a device east or west of Santiago — the exact failure already listed in the repository's troubleshooting table. | No |
| 4 | The history window is a parameter of the read, defaulting to the current month plus one prior month. | The source already takes a prior-month count with that default. How deep the first sync goes is a product choice owned by the connect and sync items. | Yes — the onboarding depth is a product decision, not a scraper default. |
| 5 | Cuenta FAN is reported as a `sight` account. | It is Banco de Chile's youth variant of a cuenta vista, and the enumerated types have no separate kind for it. | Yes |
| 6 | Foreign-currency card movements are reported in their own currency, unconverted. | [Conflict 4](#conflict-4--a-second-currency-in-a-clp-only-mvp). | Yes |
| 7 | No manufactured bank identity for movements; position within the bank's listing is reported instead. | [Conflict 2](#conflict-2--what-identifies-a-movement). | Yes |
| 8 | An unsupported bank or country is refused as an invalid request, not reported as one of the four failure reasons. | The four reasons are exactly what a connection can record. Inventing a fifth would either change the data model or persist a value the screens cannot render. The bank picker only offers available banks, so this is a programming error, not a person-facing outcome. | No |
| 9 | The scraper must be stoppable, and stopping it releases the credentials and ends the session. See [Cancellation](#cancellation) for the outcome, cleanup ordering and mid-navigation/mid-injection behavior. | Business Rule 1 needs an end to "for one read". The source has no such affordance, so a person who leaves the syncing screen leaves a session and a credential in memory. | No |
| 10 | Diagnostic entries mask account identifiers as well as credentials. | The source traces whole product payloads, including full account numbers, and the diagnostic trail travels with a failure that the connection may record. | No |
| 11 | Bank-specific extras are keyed by stable identifiers rather than the bank's Spanish column headings. | The source uses keys like `Tipo de Movimiento`, which are the bank's display copy and change when the bank rewords a column. Business Rule 17. | No |
| 12 | Falabella and Pelotillehue are not ported at all, rather than ported and disabled. | Work item #6 says the MVP ships one bank; unported code is code that cannot rot, and their recorded pages would have to be scrubbed and maintained for no shipped value. | No |
| 13 | The result carries an explicit outcome — complete, partial or failed — rather than leaving the caller to infer it from the presence of an error. | The source reports either completion or failure and returns early on failure, discarding the partial data it had already merged. Work item #6 requires a partial scrape to report partial data. | No |
| 14 | Parsing zero rows where the bank states a count is a failure of that product's read. | [`bank-scraper.md`](../../../best-practices/stack/bank-scraper.md) requires it, and the bank's own paginator already states the count the source reads. | No |
| 15 | The línea de crédito is not reported as a product in the MVP. | The source implementation deliberately skips it: at Banco de Chile the line is a facility attached to a cuenta corriente, and its movements already appear on that account, so reporting it as a second product would double-count them. The enumerated type stays reserved. | Yes — if the product owner wants the line shown with its own cupo on the bank detail screen, this becomes a fifth reading routine and an addition to the product-type mapping. |
| 16 | The whole read has a fixed overall deadline, in addition to each step's own retry bound, so a stalled page cannot hold the browser and credentials open indefinitely (Business Rule 32). | The source implementation bounds individual steps (3 attempts / 1-second wait for a page-level step, 10 attempts / 200-millisecond wait for a single element) but has no ceiling on the read as a whole. | Yes — the exact deadline trades a slower connection's chance of succeeding against how long a person watches the syncing screen; the implementation plan sets the number within this bound. |

---

## Brief Objective List

Discrete requirement bullets from work item #6, plus the constraints supplied with it.

1. Port the reading engine into `packages/bank-scraper`: the component, the message-routing
   service, the state-management service, the browser-driving service, and the event and step
   protocol that ties them together.
2. Port the Banco de Chile configuration and its four reading routines: sign in, product list,
   account movements, card movements.
3. Drop Banco Falabella and Banco Pelotillehue — the MVP ships one bank.
4. A redacting diagnostic logger: credentials are stripped before anything is turned into text.
5. Page-parsing tests for every reading routine, against scrubbed recorded pages.
6. Acceptance: a read of Banco de Chile with valid credentials completes with products and
   movements.
7. Acceptance: credentials appear in no trace, no failure report and no log line — asserted by
   test.
8. Acceptance: recorded pages contain no real RUT, name, balance or account number.
9. Acceptance: parsers cover thousands separators, `DD/MM/YYYY` dates, card movements and empty
   statements.
10. Acceptance: a partial read — products succeed, movements fail — reports partial data, not
    failure.
11. Depends on the monorepo bootstrap (#1) and the shared utilities (#4), consumed by package
    name with no cross-package relative imports.
12. Credentials, including the RUT, live only in the secure store and only in the scraper's memory
    for one read; never in the database, a log, an error payload or a trace.
13. Money is whole minor units; parsers handle thousands separators and `DD/MM/YYYY`; a decimal in
    a peso amount is a defect.
14. Bank-specific selectors live only under the bank's own directory; app code never reaches into
    a bank page.
15. The result must let the future sync engine (#10) recognise repeats: a stable per-movement
    identity where the bank gives one, and enough detail to fingerprint a movement where it does
    not.
16. Stable codes only — the four failure reasons — never user-facing copy.
17. There is no backend. Anything requiring a server contradicts the product and is escalated,
    not designed around.
18. This item owns `packages/bank-scraper/` only, and does not touch the package-manager
    configuration, the CI workflows, the lint configuration or the repository-architecture
    document (confirmed decision on issue #6, orthogonal to item #35).

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. Port the reading engine and its step protocol | AC1, AC19, AC20; [Read step](#read-step); Use Case 1 |
| 2. Port Banco de Chile and its four reading routines | AC1, AC6, AC27; Use Case 1 |
| 3. Drop Falabella and Pelotillehue | AC28; Decision 12; Out of Scope (banks other than Banco de Chile) |
| 4. Redacting diagnostic logger | AC2; Business Rules 3, 4; Operational Visibility |
| 5. Page-parsing tests for every reading routine | AC6, AC30; Business Rule 25; Use Case 5 |
| 6. A read completes with products and movements | AC1 |
| 7. Credentials in no trace, failure report or log line, asserted by test | AC2, AC3; Business Rules 3, 4 |
| 8. Recorded pages contain no real personal information | AC5; Business Rule 26; Use Case 5 |
| 9. Parsers cover separators, `DD/MM/YYYY`, card movements and empty statements | AC7, AC8, AC9, AC10, AC11 |
| 10. A partial read reports partial data | AC13; Business Rule 19; Decision 13; Use Case 4 |
| 11. Depends on #1 and #4, consumed by package name | AC29; Depends-on line; Business Rule 24 |
| 12. Credentials, including the RUT, only in memory for one read | AC2, AC3, AC16, AC32; Business Rules 1, 2, 5, 7; Decision 9; [Cancellation](#cancellation) |
| 13. Whole minor units; Chilean amount and date parsing | AC7, AC8, AC9; Business Rules 9, 11, 12 |
| 14. Bank knowledge confined to the bank's own directory | AC27; Business Rule 24; Use Case 6 |
| 15. Enough identity for the sync engine to recognise repeats | AC21, AC22, AC23, AC24; Business Rules 13, 14, 15; [Conflicts 1 and 2](#documented-conflicts) |
| 16. Stable codes, never user-facing copy | AC17, AC26; Business Rules 17, 18; [Statuses / Enum Values](#statuses--enum-values) |
| 17. No server-side component | AC31; Business Rule 8; Out of Scope (any server-side component); [Escalation check](#escalation-check) |
| 18. Owns `packages/bank-scraper/` only | AC33; Out of Scope |

---

## Escalation check

Protocol and product constraint both require that any design needing a server be escalated rather
than worked around. Every requirement in this spec is satisfied on the device: the hidden browser
talks only to Banco de Chile's own site, parsing happens in the app process, the tests run against
committed recorded pages, and the only secret involved is handed over by the caller from the
device's own secure store. **No part of this item requires a server-side component, and none is
introduced.** The one place a server would be tempting — converting a foreign-currency card
movement into pesos — is explicitly declined in [Conflict 4](#conflict-4--a-second-currency-in-a-clp-only-mvp)
and left to the sync item rather than solved with an exchange-rate service.

---

## Deferral Notes

### Deferral Note 1 — How much history the first sync reads

**Objective wording**: work item #6 requires a read to reach completion "with products and
movements", without stating how far back.

**Rationale**: how many months a first connection downloads is a product decision about what the
person sees on their first dashboard, not a property of the scraper. The scraper already accepts a
window as a parameter, and reading more months is slower and more fragile.

**Resolution**: the window stays a parameter of the read, defaulting to the current month plus one
prior month (Decision 4). The onboarding and sync items choose what to ask for. **Human
confirmation requested**: yes — the default is inherited from the source implementation, not
chosen by the product owner.

### Deferral Note 2 — Storing what is read

**Objective wording**: work item #6's requirement that the result let the future sync engine
recognise repeats.

**Rationale**: mapping a result onto stored products and movements, and doing it idempotently,
is item #10. Building any of it here would put the same logic in two places.

**Resolution**: out of scope for this item, which is responsible only for reporting facts that are
stable across reads and sufficient to fingerprint a movement (Business Rules 13–15, AC21–AC24).
The two identity problems this uncovered are recorded as
[Conflicts 1 and 2](#documented-conflicts) so #10 inherits them stated rather than hidden.
**Human confirmation requested**: no for the deferral itself; yes for the two conflicts, as noted
there.

### Deferral Note 3 — Foreign-currency card movements in a CLP-only product

**Objective wording**: work item #6 requires the parsers to cover "credit-card movements" and the
best-practices document names "credit-card movements in a second currency" among the ugly cases
that must be tested.

**Rationale**: the MVP is a single-currency product with no way to obtain an exchange rate and no
screen designed for a second currency.

**Resolution**: the scraper parses and reports them faithfully in their own currency and converts
nothing (AC10). What the app does with them is deferred to the sync item. **Human confirmation
requested**: yes — see [Conflict 4](#conflict-4--a-second-currency-in-a-clp-only-mvp).

### Deferral Note 4 — Adding a second bank

**Objective wording**: work item #6's instruction to drop Falabella and Pelotillehue because "the
MVP ships one bank".

**Rationale**: the value of dropping them is that the shipped surface is one bank; the value of
the architecture is that adding another later is contained.

**Resolution**: neither bank is ported. The containment that makes a future bank cheap is a
requirement of this item and is verified now (Business Rule 24, AC27, Use Case 6), rather than
deferred with the banks themselves. **Human confirmation requested**: no.
