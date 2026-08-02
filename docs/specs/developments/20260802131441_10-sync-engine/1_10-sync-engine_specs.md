# Sync Engine: Idempotent Persistence of Products and Movements — Spec

**Depends on**: 3-local-database-schema-migrations-seed-data, 5-shared-domain-rules-matching-aggregates, 6-port-bank-scraper-banco-de-chile

---

## Overview

The scraper reads the same bank pages every time it runs. This item is the part of the app that
turns what it read into what the person keeps: it stores the products the bank showed and the
movements on them, and it does so in a way that reading the same pages a second time changes
nothing. It also keeps each bank connection's own record of how the last sync went — whether it
is running, when it last attempted, when it last succeeded, and why it last failed.

The hard promise is that a sync is safe to repeat. A person can hit "Sincronizar ahora" as often
as they like, retry after an error, or reopen the app an hour later, and their movement list will
not grow duplicates, their categories will not be reset, their notes will not be lost and their
exclusions will not come back. That promise is what makes the retry button in the mockups safe to
draw at all.

This item renders nothing. The syncing screen, the bank detail screen and the connect flow are
separate items; this one is the engine underneath them and the record they read from.

---

## Normative references

These documents are the ground truth this spec builds on and does not restate:

- [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md) — the entities
  (connection, product, movement, merchant, category) and the rules this item must not break,
  in particular the never-delete rule, the inclusion rule, the idempotent re-sync rule and the
  integer-money rule.
- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) — what a connection,
  a product and a movement record, which parts of a movement belong to the bank and which belong
  to the person, and the automatic-sync interval. Normative for those value sets and for the
  absence of a per-connection automatic-sync toggle.
- [`design/mockups/mobile/BEHAVIOR.md`](../../../../design/mockups/mobile/BEHAVIOR.md), sections
  `bank-syncing`, `bank-review` and `settings-banks` — the connection lifecycle this engine must
  drive and the facts those screens read back.
- [`Bank Scraper: Banco de Chile — Spec`](../20260801232904_6-port-bank-scraper-banco-de-chile/1_6-port-bank-scraper-banco-de-chile_specs.md)
  and its
  [implementation plan](../20260801232904_6-port-bank-scraper-banco-de-chile/2_6-port-bank-scraper-banco-de-chile_implementation-plan.md)
  — what a read reports, the read outcomes, the four failure reasons, and the two conflicts that
  item deliberately handed to this one.

Where this spec and one of those documents disagree, the disagreement is recorded under
[Documented Conflicts](#documented-conflicts) rather than silently reconciled.

**Vocabulary**: a **read** is one run of the scraper, in the sense used by item #6. A **sync** is
the whole cycle this item owns — start the read, store what it reported, and update the
connection's record. A **connection** is the person's link to one bank on this device. A
**product** is a producto financiero discovered inside a connection. A **movement** is a
movimiento on a product. The **person's decision layer** is the part of a movement the person
owns: its category, how that category was decided, its note, its review flag, its exclusion with
reason and note, its partial-inclusion amount, and its merchant.

**Stated dependency**: item #6 is in flight on another lane. This spec is written against the
contracted result its merged implementation plan describes — the per-product opaque instance
identity, the per-movement facts, the read outcomes and the four failure reasons. If that contract
changes before this item is planned, this spec is revisited rather than worked around.

---

## Use Cases

### Use Case 1: A first sync stores what the bank showed

**Actor**: The person, through the connect flow, and the app on their behalf.
**Preconditions**: A connection to Banco de Chile exists on this device and points at the
credential the person just entered. Nothing has been stored for it yet.

**Steps**:

1. The person finishes entering their credentials and the connect flow asks for a sync.
2. The connection is marked as syncing.
3. The scraper reads the bank: it signs in, lists the products, and reads each product's
   movements.
4. The read finishes having read every supported product and every one of their movements.
5. The app stores each product it did not already have, and each movement it did not already
   have.
6. For every movement stored for the first time, the app tries to recognise the merchant from the
   description the bank wrote, and — when that merchant carries a default category — records that
   category as a suggestion rather than as the person's own decision.
7. The connection records that the sync succeeded, at what time, and clears any previous failure.

**Postconditions**: Every supported product the bank listed is stored under the connection, with
its kind, name, currency, balance and — for a card — its cupo and available cupo. Every movement
the read reported is stored against its product, with the amount as a whole positive number of
minor units and the direction the bank presented. The connection's state is `ok`.

**Information shown**: none by this item. The sync reports back to its caller what it changed —
how many products were discovered, how many were refreshed, how many movements were stored for
the first time and how many were already known — so the screens that come later can say
"3 productos" and "42 movimientos nuevos" without counting rows themselves.

**Actions available**: the caller can stop the read while it is running (Use Case 5).

**Considerations**:

- A product kind the scraper does not support is not reported at all, so nothing is stored for it.
  That does not make the sync anything other than a success.
- A movement whose amount is not a whole positive number of minor units is a defect, not a value
  to round. See Business Rule 12.

---

### Use Case 2: A later sync re-reads the same pages

**Actor**: The app, on app open, or the person through "Sincronizar ahora".
**Preconditions**: The connection is active and has already synced at least once. The person has
since categorized some movements, written a note on one, and excluded another with a reason.

**Steps**:

1. The sync starts, exactly as in Use Case 1.
2. The scraper reads the bank again. Its window overlaps what was already stored, so most of what
   it reports is already known.
3. For every product the read reports, the app recognises the one it already stored by the
   product's stable identity, and refreshes what the bank says about it — balance, cupo,
   available cupo, name, kind, masked identifier.
4. For every movement the read reports, the app recognises the one it already stored and refreshes
   only what the bank said about it. Everything the person decided is left exactly as they left
   it.
5. Movements the read reports that were not already stored are stored, and are enriched with a
   merchant and a suggested category exactly as in Use Case 1.
6. The connection records the successful sync.

**Postconditions**: The number of stored movements grew by exactly the number of genuinely new
ones. The categorized movements keep their categories and the way those categories were decided.
The noted movement keeps its note. The excluded movement is still excluded, with the same reason.
No movement was deleted.

**Information shown**: the same change summary as Use Case 1; on a re-read of unchanged pages it
reports nothing stored for the first time.

**Actions available**: as Use Case 1.

**Considerations**:

- The bank sometimes restates a movement's description between reads — a pending charge that
  gains a merchant name once it settles. The app recognises that as a different movement, because
  the description is one of the facts it recognises a movement by, and stores it as a new one.
  This is accepted for the MVP; see [Deferral Note 2](#deferral-note-2--a-movement-the-bank-restates-between-reads).
- A product the read no longer lists — a card the person closed — is left alone, with all its
  movements. Nothing about a bank read ever deletes stored data.
- A movement already stored is never re-examined for a merchant or a category, even if it has
  none. See Business Rule 18.

---

### Use Case 3: The sync fails before it reads anything

**Actor**: The app or the person, as in Use Case 2.
**Preconditions**: The connection has synced successfully before, so products and movements are
already stored. The person has since changed their internet banking password.

**Steps**:

1. The sync starts and the connection is marked as syncing.
2. The scraper signs in and the bank rejects the credentials. The read ends having gathered
   nothing.
3. The app stores no product and no movement.
4. The connection records the attempt, records that the failure reason was a credential
   rejection, keeps the time of the last successful sync untouched, and moves to the error state.

**Postconditions**: Everything stored before the failed sync is byte-for-byte what it was. The
connection is in the error state and knows both when it last succeeded and why it last failed.

**Information shown**: none by this item. The bank detail screen reads the connection's record to
show "Última sincronización exitosa: ayer 21:14" alongside the failure.

**Actions available**: retrying is always allowed and always safe. Retrying after a credential
rejection goes through re-entering the credential.

**Considerations**:

- The recorded failure never contains anything the person typed, and never the bank's own error
  text. See Business Rules 2 and 3.
- After a credential rejection, the app stops syncing that connection automatically until the
  person supplies a credential again. See Business Rule 23.

---

### Use Case 4: The sync reads some products and fails on others

**Actor**: The app or the person.
**Preconditions**: The connection has two accounts and a card. The bank's card statement page has
changed and the scraper cannot parse it.

**Steps**:

1. The sync starts as usual.
2. The scraper reads both accounts and their movements, fails to read the card's movements, and
   reports what it gathered together with the failure and which product it happened on.
3. The app stores every product the read reported and every movement it reported — the two
   accounts' movements are stored, exactly as in Use Case 1.
4. The connection records the attempt and the parsing failure, and does **not** advance its last
   successful sync.
5. The connection moves to the error state.

**Postconditions**: The person keeps the movements that were successfully read; nothing is thrown
away because part of the read failed. The connection shows an error the person can act on, and a
retry re-reads everything without duplicating what was just stored.

**Information shown**: the change summary reports what was stored, and the connection's record
carries the failure reason.

**Actions available**: retry.

**Considerations**:

- A partially successful sync is recorded as an error, not as a success, because something the
  person expected to be read was not read and the bank detail screen has no third state to show
  it in. See [Decision 4](#decision-log).

---

### Use Case 5: The person stops a sync that is running

**Actor**: The person, by leaving the syncing screen, or the app by giving up.
**Preconditions**: A sync is running.

**Steps**:

1. The read is stopped. It reports whatever it had gathered so far, and reports that it was
   stopped rather than that it failed.
2. The app stores what was gathered, exactly as it would have stored it otherwise.
3. The connection records the attempt, records **no** failure reason, does not advance its last
   successful sync, and returns to the idle state.

**Postconditions**: Nothing is lost, nothing is duplicated, and the connection does not show an
error the person did not cause. The next sync picks up from there.

**Information shown**: none.

**Actions available**: syncing again, at any time.

**Considerations**:

- Whether a read may keep running once the person leaves the syncing screen is an open question
  on the screen behaviour contract (`D3`) and belongs to the screen item. This item only
  guarantees that a stopped read's partial results are stored safely and that the connection does
  not stay stuck.

---

### Use Case 6: The app opens and a connection is stale

**Actor**: The app, on open.
**Preconditions**: The person has at least one active connection. More than six hours have passed
since its last successful sync, and its last attempt was not a credential rejection.

**Steps**:

1. The app opens.
2. For each active connection, the app checks how long ago it last synced successfully and how
   long ago it last attempted.
3. Where the interval has passed, the app starts a sync for that connection, which then behaves
   exactly as Use Case 2.

**Postconditions**: The person's data is refreshed without them asking. A connection that is not
stale is not read, so opening the app twice in a minute reads the bank once.

**Information shown**: none by this item.

**Actions available**: none; this is automatic.

**Considerations**:

- A connection that is not active — disconnected, or inactive — is never synced automatically.
- A connection whose stored state says a sync is running, when no sync is actually running (the
  app was killed mid-sync), is returned to idle first and is then eligible like any other. See
  Business Rule 25.
- "Sincronizar ahora" is never subject to the interval. The interval governs only automatic
  syncing.

---

## Business Rules

### What is stored, and from where

1. **This engine stores only what a read reported.** It never contacts a bank, never opens a
   browser and never parses a bank page itself. Its input is one read's result and the connection
   it belongs to.
2. **No credential ever reaches this engine.** It is never handed a RUT or a password, never
   reads the secure store, and has no code path that could write one down. The connection it
   updates holds only the *name* of the secure-store entry, never its value.
3. **Nothing this engine records ever contains what the person typed, or the bank's own error
   text.** A recorded failure is one of the four stable failure reasons plus a message the app
   itself composes. The read's diagnostic trail is never stored in the database and never leaves
   the device.
4. **There is no server in this path.** Nothing read, stored or recorded is sent anywhere. A
   design that needed one would be escalated, not routed around.

### Recognising a product

5. **A product is recognised across reads by the stable, opaque identity the read reports for
   it** — not by what kind of product it is, and never by the bank's raw account or card number,
   which a read does not report at all. Two accounts of the same kind are two products.
6. **What the bank says about a product is refreshed on every sync**: its kind, its name, its
   currency, its balance, its masked identifier and, for a card, its cupo, its available cupo,
   its brand and its last four digits. Nothing about a product is the person's to decide in the
   MVP, so refreshing all of it overwrites no decision.
7. **A product is never deleted by a sync.** A product a later read does not list keeps its row
   and keeps every movement attached to it.
8. **A product whose reported identity has never been seen under that connection is a new
   product**, even if a product of the same kind and name already exists there.

### Recognising a movement

9. **A movement already stored is never stored twice.** Where the bank supplies its own identity
   for a movement, that identity — within its product — is what recognises it. Where the bank
   supplies none, and Banco de Chile supplies none today, the movement is recognised by the facts
   the bank always states: its product, its calendar day, its amount, its direction and its
   description exactly as written.
10. **Two movements the bank lists separately that are indistinguishable by those facts are two
    movements** — two identical coffees on the same day are two movements, not one. After a sync,
    the number of stored movements in such a group is the larger of what was already stored and
    what this read listed: never fewer, because nothing is deleted, and never the sum, because
    that would duplicate.
11. **A movement's position in the bank's listing is never part of its identity across reads.**
    It may be used to tell two otherwise-identical movements apart within a single read's results,
    and nowhere else. A read that returns the same movement at a different position than last time
    is an expected, ordinary situation, not a change and not an error.

### What a sync may write, and what it may never touch

12. **Every amount is a whole positive number of minor units, and direction carries the sign.** An
    amount that is not — a fraction, a negative, a value that is not a number — is a defect in the
    read, not a value to round or to store. The whole sync stores nothing and the connection
    records a parsing failure.
13. **The bank-stated part of a movement is refreshed on a repeat**: its amount, direction,
    currency, calendar day, description, and the bank-specific extras the read carries.
14. **The person's decision layer is never written by a repeat sync.** A movement's category, how
    that category was decided, its note, its review flag, its exclusion with reason and note, its
    partial-inclusion amount and its merchant are untouched by a sync of a movement that already
    exists — under every code path, for every read outcome, whether or not the person has actually
    set them.
15. **A movement is never deleted, and a sync never excludes one.** Exclusion is a decision the
    person makes with a reason; a sync has no reason to give.
16. **The calendar day the bank stated is authoritative.** Any instant the store needs is derived
    from that day through the shared date helpers, never from the device clock and never from the
    device's time zone, so a movement never lands in the wrong month for a person travelling.
17. **A movement is stored in the currency the read stated, unconverted.** The app never obtains
    or invents an exchange rate. A foreign-currency card movement is the person's movement and is
    kept; see [Deferral Note 3](#deferral-note-3--foreign-currency-movements-and-peso-totals).

### Merchant and category on first storage

18. **A movement is enriched once, when it is stored for the first time, and never again.** At
    that moment the app tries to recognise the merchant from the description, and — when a merchant
    is recognised and carries a default category — records that category together with how it was
    decided. A later sync never revisits a movement's merchant or category, even a movement that
    still has neither.
19. **An automatic category is always marked as a suggestion, never as the person's decision.**
    It is marked as suggested by the app when the recognised merchant is starter content, and as
    coming from the person's own merchant rule when the merchant is one they created. A sync never
    records a category as decided by the person.
20. **No recognition, no guess.** A movement whose description matches no merchant is stored with
    no merchant and no category, and counts toward "necesitan categorización".

### The sync as a whole

21. **A sync's writes are indivisible.** Everything a read reported — every product, every
    movement, and the connection's updated record — is stored together, or none of it is and the
    store is exactly as it was before. There is no state in which half a read is stored.
22. **At most one sync runs per connection at a time, and at most one read runs on the device at a
    time.** A request to sync a connection that is already syncing is refused without starting a
    second read and without disturbing the one in progress.

### The connection's record

23. **The connection carries the whole sync history the MVP keeps**: whether it is syncing now,
    when it last attempted, when it last *succeeded*, and the reason and message of its last
    failure. A failed or partial sync never advances the last-success time. A successful sync
    clears the recorded failure.
24. **Automatic syncing is implicit, per the data model: there is no per-connection toggle.** On
    app open, a connection is synced automatically when it is active, no read is running, more
    than six hours have passed since its last successful sync, more than six hours have passed
    since its last attempt, and its last failure was not a credential rejection. A credential
    rejection stops automatic syncing for that connection until the person supplies a credential
    again. "Sincronizar ahora" is never subject to any of this.
25. **A connection is never left looking as though it is syncing when it is not.** A connection
    found in the syncing state at app open, with no read in progress, is returned to idle without
    recording a failure, and is then treated like any other connection.
26. **Disconnecting a bank does not remove what it read.** A disconnected connection is not synced
    and is not read from again, and its products and movements stay exactly where they are.

---

## Statuses / Enum Values

This item renders nothing. The Spanish labels below are the **proposed copy**, taken from the
mockups where the mockup states them, so later items do not invent divergent wording; the
catalogue entry and its final wording are owned by the item that first renders them.

### Connection sync state

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `idle` | (no badge) | No sync is running and none has finished yet, or the last one was stopped by the person. |
| `syncing` | Sincronizando | A read is in progress for this connection. |
| `ok` | Al día | The last sync read everything it set out to read and stored it. |
| `error` | Error | The last sync failed outright, or read only part of what it set out to read. |

**Valid transitions**:

- `idle` → `syncing`, `ok` → `syncing`, `error` → `syncing` — a sync starts, from the connect
  flow, from "Sincronizar ahora", or automatically on app open per Business Rule 24.
- `syncing` → `ok` — the read completed fully and everything it reported was stored.
- `syncing` → `error` — the read failed before gathering anything, or gathered only part of what
  it set out to gather. What it did gather is stored either way.
- `syncing` → `idle` — the read was stopped by the person or by the app; what it gathered is
  stored and no failure is recorded.
- `syncing` → `idle` — the app reopened and found the connection recorded as syncing with no read
  in progress (Business Rule 25).

There is no transition out of `syncing` that leaves nothing recorded: every exit writes the
attempt time.

### Recorded failure reason

The set is exactly what a connection can record, and exactly what a read reports. Copy is owned by
the item that renders it; the wording below matches the proposed copy in item #6's spec.

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `invalid_credentials` | Revisa tus datos | The bank rejected the RUT or the password. Stops automatic syncing until the person supplies a credential again. |
| `session_closed` | La sesión con el banco se cerró | The bank signed the person out mid-read. |
| `network` | No pudimos conectarnos al banco | The bank's site could not be reached or never finished loading. |
| `parse_failed` | El banco cambió su sitio | The bank's page did not match what the scraper expects, or the read reported a movement this engine could not accept. |

A stopped read records no failure reason at all.

### How a movement's category was decided

| Code value | Proposed display label | Description |
| --- | --- | --- |
| `auto` | Categoría sugerida automáticamente | The app recognised a starter merchant and applied its default category when the movement was first stored. |
| `rule` | Categoría sugerida automáticamente | The app recognised a merchant the person created and applied its default category when the movement was first stored. |
| `user` | Confirmada por ti | The person chose the category. **Never written by a sync.** |

---

## Operational Visibility

- **The connection's own record is the audit trail.** Last attempt, last success, last failure
  reason and last failure message are the only sync history the MVP keeps, and they are what the
  bank detail screen reads.
- **Each sync reports a change summary to its caller**: products discovered, products refreshed,
  movements stored for the first time, movements already known, and — when the read was partial —
  which products it failed on. The summary is what the connect flow and the syncing screen use;
  it is not persisted.
- **No telemetry, no remote logging, no crash payload leaves the device.** There is no backend to
  receive one.
- **The read's diagnostic trail is available to the caller for the duration of the sync only.** It
  may be surfaced in a development build; it is never written to the database and never attached
  to the connection's recorded failure.

---

## Acceptance Criteria

- [ ] **AC1.** A recorded read reporting products and movements, applied to an empty store, stores
      every reported product under its connection and every reported movement under its product,
      with the reported amount, direction, currency, calendar day and description.
- [ ] **AC2.** Applying the *same* recorded read a second time leaves the number of stored products
      and the number of stored movements unchanged, and the change summary reports nothing stored
      for the first time.
- [ ] **AC3.** A movement the person has categorized, noted, flagged for review, excluded with a
      reason, or attached to a merchant keeps every one of those decisions, unchanged, after the
      same read is applied again.
- [ ] **AC4.** A repeat sync in which the bank restates a movement's amount, direction or calendar
      day updates those on the stored movement, while leaving the person's decision layer
      untouched.
- [ ] **AC5.** A recorded read containing two movements on the same product, day, amount, direction
      and description stores two movements; applying that read again still leaves two.
- [ ] **AC6.** A recorded read whose movements come back in a different order, or at different
      positions, than a previous read of the same pages stores no new movement.
- [ ] **AC7.** A recorded read reporting two products of the same kind under one connection stores
      two products, each recognisable as the same product when the read is applied again.
- [ ] **AC8.** A read that no longer lists a previously stored product leaves that product and all
      its movements in place.
- [ ] **AC9.** A read that fails before gathering anything stores no product and no movement; a
      store populated by an earlier successful read is unchanged in every column afterwards.
- [ ] **AC10.** After a failed read, the connection records the attempt time and the failure
      reason, leaves the last-success time at its earlier value, and is in the `error` state.
- [ ] **AC11.** After a partial read — some products read, at least one product's movements not —
      everything the read did gather is stored, the connection is in the `error` state, and the
      last-success time is not advanced.
- [ ] **AC12.** After a successful read, the connection is in the `ok` state, its last-success time
      equals its last-attempt time, and any previously recorded failure reason and message are
      cleared.
- [ ] **AC13.** After a stopped read, whatever it gathered is stored, the connection is in the
      `idle` state, no failure reason is recorded, and the last-success time is not advanced.
- [ ] **AC14.** A sync that throws partway through the storing step leaves the store exactly as it
      was before the sync began — no product, no movement and no connection field is half-written.
- [ ] **AC15.** A movement whose reported amount is not a whole positive number of minor units
      causes the sync to store nothing at all and the connection to record a parsing failure.
- [ ] **AC16.** A movement stored for the first time whose description matches a starter merchant's
      alias is stored with that merchant and, when the merchant has a default category, with that
      category marked as suggested by the app.
- [ ] **AC17.** The same movement, when the recognised merchant is one the person created, is
      stored with the category marked as coming from the person's merchant rule.
- [ ] **AC18.** A movement whose description matches no merchant is stored with no merchant and no
      category, and is counted among the movements needing categorization.
- [ ] **AC19.** A movement already stored with no merchant and no category still has neither after a
      later sync, even when a matching merchant has been created in between.
- [ ] **AC20.** A sync never writes a category marked as decided by the person: applying any
      recorded read to a store leaves the set of movements marked that way exactly as it was.
- [ ] **AC21.** A movement is never deleted and never excluded by a sync: applying any recorded read
      leaves the set of excluded movements, and the total movement count, no smaller than before.
- [ ] **AC22.** A read reporting a movement in a currency other than the peso stores it with that
      currency and its stated amount, with no conversion applied and no exchange rate consulted.
- [ ] **AC23.** A movement's stored calendar day equals the day the read stated, for a device set to
      a time zone east of Santiago and for one set west of it.
- [ ] **AC24.** On app open, a connection that is active, whose last successful sync is more than
      six hours old and whose last attempt is more than six hours old, starts a sync; one whose
      last successful sync is more recent than that does not.
- [ ] **AC25.** On app open, a connection whose last failure was a credential rejection does not
      start a sync automatically, and does start one when asked explicitly.
- [ ] **AC26.** On app open, a connection recorded as `syncing` with no read in progress is returned
      to `idle`, with no failure recorded, before the automatic-sync check runs.
- [ ] **AC27.** A connection that is disconnected or inactive is never synced automatically.
- [ ] **AC28.** Asking to sync a connection that is already syncing does not start a second read and
      does not change the connection's record.
- [ ] **AC29.** No credential value appears anywhere in the stored data or in a recorded failure
      message, asserted by a test that runs a full sync with a recognisable credential in the
      secure store and scans the whole store afterwards.
- [ ] **AC30.** A recorded failure message contains neither the bank's own error text nor any value
      taken from the read's diagnostic trail.

---

## Out of Scope (MVP)

- **Every screen.** The syncing screen, the bank detail screen, the connect flow and the
  connected-banks list are separate items. This item exposes the state they render and the sync
  they trigger, and draws nothing.
- **Syncing while the app is not in the foreground.** Background sync, push-triggered sync and
  whether a read survives the person leaving the syncing screen are all outside this item; the
  latter is an open question on the screen behaviour contract.
- **Backfilling merchants and categories onto movements already stored.** Business Rule 18 makes
  enrichment a first-storage-only step. A later "re-run suggestions" capability is its own item.
- **Converting a foreign-currency movement into pesos**, and keeping foreign-currency movements
  out of peso totals. See [Deferral Note 3](#deferral-note-3--foreign-currency-movements-and-peso-totals).
- **Deciding how much history a read covers.** The window is a parameter of the read, owned by the
  connect flow and by item #6's own deferral.
- **Sync history beyond the last attempt, last success and last failure.** No per-sync log, no list
  of past syncs, no per-product sync state.
- **Notifying the person that a sync happened or failed.** Local reminders are about
  categorization, not about syncing.
- **Manual movement entry**, and everything that follows from it. The store supports it; this
  engine does not create it.
- **Aggregating balances across products** — "patrimonio total" needs a balance that can be summed
  in the store, which the data model deliberately does not provide yet.
- **Banks other than Banco de Chile.** The engine is written against what a read reports, not
  against a bank, but only one bank is available in the MVP.
- **Retrying a failed read automatically inside one sync.** Retry bounds live in the scraper; this
  engine runs a read once per sync.

---

## Documented Conflicts

### Conflict 1 — the work item names tables that the data model renamed

- Work item #10 says to map onto `accounts` and `transactions`, to key the upsert on
  `(account_id, external_id)`, and to keep sync bookkeeping on `bank_connections` including an
  `auto_sync` flag.
- [`4-database-model.md`](../../../project/4-database-model.md) states that `bank_connections` and
  `accounts` were an earlier draft's invented names, replaced by the original domain model's
  `user_financial_institutions` and `user_financial_products`; that the movement key is
  `(user_financial_product_id, external_id)`; and that there is deliberately **no** `auto_sync`
  column, because syncing is implicit for an active connection.

**Resolution taken in this spec**: the data model wins. This spec speaks of connections and
products in domain language, keys movements on the product they belong to, and states the
automatic-sync trigger as a property of an *active* connection and its last successful sync rather
than of a toggle (Business Rule 24). The work item's wording is read as intent, not as schema.

**Human confirmation requested**: no.

### Conflict 2 — what identifies a movement, when the bank supplies no identity

- [`4-database-model.md`](../../../project/4-database-model.md), gap #1, treats the bank's own
  movement identifier as the primary way to recognise a repeat, with a content fingerprint as the
  fallback.
- Item #6 established that Banco de Chile supplies no such identifier and that the scraper will
  not manufacture one, so in practice every Banco de Chile movement is recognised by the fallback.
  Item #6 handed this item two obligations with it: recognise a movement by the product, the
  calendar day, the amount, the direction and the description; and use position within the bank's
  listing only to tell two identical movements apart *within one read*.
- The fingerprint item #3 shipped folds in the product, the calendar day, the amount, the
  description and the bank identifier — it does not carry the direction, and it has nothing that
  distinguishes two indistinguishable movements in the same read.

**Resolution taken in this spec**: this item keeps the recognition route item #3 shipped and states
the two product guarantees it must satisfy — Business Rule 9 (direction is one of the facts a
movement is recognised by) and Business Rule 10 (two indistinguishable movements in one read are
two movements, and a repeat sync does not turn them into four). How the shipped fingerprint is
extended to satisfy them, and whether anything already stored needs re-fingerprinting, is the
implementation plan's decision. Nothing has shipped to a device, so there is no stored data to
migrate.

**Human confirmation requested**: no — both guarantees are item #6's stated consequence for this
item.

### Conflict 3 — what identifies a product

- [`4-database-model.md`](../../../project/4-database-model.md) says a stored product's external
  identifier is the scraper's product identifier, and makes it unique within a connection.
- In the source implementation that value classifies *what kind* of product it is, so a person
  with two cuentas corrientes would see both collapse onto one stored product. Item #6 resolved
  this by reporting two separate facts — an opaque per-instance identity and the product kind —
  and recorded that pointing the stored identifier at the instance identity belongs to the
  database or sync item.

**Resolution taken in this spec**: this item claims that follow-up. A product is recognised by the
read's opaque instance identity (Business Rule 5); the product kind is what the app displays and
filters on. The raw account or card number is never reported and never stored.

**Human confirmation requested**: no — item #6 already resolved the product-level question and
named this item as one of the two possible owners.

### Conflict 4 — how an automatic category is marked

- Work item #10 says a merchant-resolved category is recorded with the source `auto`.
- Item #5's merged plan distinguishes `auto` (the merchant is starter content) from `rule` (the
  merchant is one the person created), because that is the only distinction the data model can
  express without a new column, and the mockups do distinguish a suggestion from a confirmation.

**Resolution taken in this spec**: follow item #5 — Business Rule 19. Both values mean "the app
suggested this"; neither is ever the person's own decision. The work item's `auto` is read as
"not `user`".

**Human confirmation requested**: no.

---

## Decision Log

Decisions taken while writing this spec, resolved from the ground-truth documents named above and
from the work item. Each is listed so the product owner can revisit it.

| # | Decision | Basis | Confirmation requested |
| --- | --- | --- | --- |
| 1 | The automatic-sync trigger is "active connection, last successful sync older than six hours", not a per-connection toggle. | [Conflict 1](#conflict-1--the-work-item-names-tables-that-the-data-model-renamed); the bank detail mockup states the rule as "si pasaron más de 6 horas desde la última vez". | No |
| 2 | Automatic syncing also requires the last *attempt* to be older than six hours, not only the last success. | Without it, a connection that fails every time would read the bank on every single app open. The mockup's "desde la última vez" does not distinguish the two. | Yes — this is the one part of the interval rule the ground-truth documents do not state outright. |
| 3 | A credential rejection stops automatic syncing for that connection until the person supplies a credential again. | Item #6's rule against repeated sign-in attempts, which lock the person's real bank account; the bank detail mockup's error state offers "Actualizar credenciales" rather than a retry. | Yes |
| 4 | A partial read puts the connection in the `error` state, and does not advance the last-success time. | The bank detail screen has exactly two states, `ok` and `error`; something the person expected to be read was not read, and the retry path is the one that helps them. | Yes — the alternative is to call a partial read a success with a warning, which the mockups have nowhere to show. |
| 5 | A stopped read stores what it gathered and returns the connection to idle, recording no failure. | Item #6 states that a stopped read carries what it gathered and is never a failure reason; storing it is safe because re-syncing is idempotent. | No |
| 6 | A connection found in the syncing state at app open, with no read running, is returned to idle. | Nothing else can clear it: the app was killed mid-sync and there is no supervisor. The alternative is a connection that shows a spinner forever. | No |
| 7 | Enrichment happens once, at first storage, and is never revisited. | The merchant and the category live in the person's decision layer, which a repeat sync must never write. Re-running recognition later would have to write into that layer to be useful. | Yes — a deliberate "re-run suggestions" action is a reasonable future item. |
| 8 | A movement whose amount is not a whole positive number of minor units fails the whole sync rather than being skipped. | The money rule is a non-negotiable, and the shipped store already rejects such an amount before writing anything. Skipping the row would silently hide a movement the person made. | No |
| 9 | Foreign-currency movements are stored, unconverted, in the currency the read stated. | Item #6 explicitly left the choice here and warned that discarding them hides movements the person made; the data model already carries a currency on every movement. | Yes — see [Deferral Note 3](#deferral-note-3--foreign-currency-movements-and-peso-totals). |
| 10 | A product a read no longer lists is left alone rather than marked closed or hidden. | Nothing in the mockups distinguishes a closed product, and the never-delete rule forbids removing it. Marking it would be a new state with no screen to show it. | Yes — if the bank detail screen should grey out a closed product, that is a small addition here and a real one there. |
| 11 | At most one read runs on the device at a time. | One hidden browser, one bank credential in memory at a time. The MVP has one bank, so this is not yet a queueing problem. | No |
| 12 | The change summary a sync returns is not persisted. | The data model keeps no per-sync record, and the screens that need the numbers have them in hand at the moment they need them. | No |

---

## Assumptions

Resolved without a human in the loop, from the documents named in
[Normative references](#normative-references). Each is stated here so it can be checked cheaply.

1. **The last-attempt half of the automatic-sync interval** (Decision 2) is derived from the intent
   of the six-hour rule rather than from its wording. If wrong, a permanently failing connection
   reads the bank on every app open.
2. **A partial read is an error, not a success** (Decision 4). Derived from the bank detail
   screen having exactly two states. If wrong, a person whose card statement is broken sees an
   error every time even though most of their data arrived.
3. **A credential rejection suspends automatic syncing** (Decision 3). Derived from item #6's
   account-locking rule and the mockup's "Actualizar credenciales" call to action rather than from
   an explicit statement about automatic syncing.
4. **Nothing about a product is the person's to decide in the MVP** (Business Rule 6). Derived from
   the data model, which gives a product no nickname, no hidden flag and no ordering the person
   controls. A product refresh therefore overwrites nothing.
5. **A stalled `syncing` state is cleared at app open** (Decision 6). No document describes what
   happens when the app is killed mid-sync; this is the only recovery point the app has.
6. **The read's diagnostic trail is never persisted.** Derived from the data model having nowhere
   to put it and from the credential rule; item #6 hands the trail to its caller without saying
   what the caller does with it.
7. **A sync stores what a stopped read gathered.** Item #6 states that a stopped read carries its
   partial results; that they are worth storing is this spec's call, justified by idempotence.
8. **The change summary's contents** (Operational Visibility) are inferred from what the
   `bank-connected` and `bank-review` screens display — a per-connection product count and a sense
   of what arrived — not from an explicit requirement.

---

## Brief Objective List

Discrete requirement bullets from work item #10, plus the constraints supplied with it.

1. Map what a read reports onto stored products and stored movements.
2. Store a movement idempotently, keyed on the bank's identity within its product, falling back to
   a content fingerprint when the bank supplies no identity.
3. Never overwrite the person's own columns on a repeat: category, how the category was decided,
   note, exclusion time, exclusion reason, partial-inclusion amount, review flag and merchant.
4. Resolve the merchant when a movement is first stored, using the shared alias matching, and
   record an automatic category.
5. Keep the connection's sync bookkeeping: its state, its last attempt, its last success, its last
   failure reason and its last failure message.
6. Run the whole sync as one indivisible write.
7. Acceptance: applying the same recorded read twice leaves the stored count unchanged.
8. Acceptance: a person's category and note survive a re-sync.
9. Acceptance: a failed run records the failure and leaves prior data intact.
10. Acceptance: automatic sync triggers when more than six hours have passed and the connection is
    eligible.
11. Depends on the local database (#3) and on the ported bank scraper (#6).
12. No screen: the syncing screen is a separate work item.
13. No credential ever reaches the persistence path.
14. Money is whole minor units of the peso.

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. Map a read onto products and movements | AC1, AC7, AC8; Business Rules 5-8, 13; Use Case 1 |
| 2. Idempotent movement storage, identity then fingerprint | AC2, AC5, AC6; Business Rules 9-11; [Conflict 2](#conflict-2--what-identifies-a-movement-when-the-bank-supplies-no-identity); Use Case 2 |
| 3. Never overwrite the person's own columns | AC3, AC4, AC19, AC20, AC21; Business Rules 14, 15, 18; Use Case 2 |
| 4. Merchant resolution and automatic category on first storage | AC16, AC17, AC18, AC19; Business Rules 18-20; [Conflict 4](#conflict-4--how-an-automatic-category-is-marked) |
| 5. Connection sync bookkeeping | AC10, AC11, AC12, AC13, AC26; Business Rules 23, 25; [Connection sync state](#connection-sync-state) |
| 6. One indivisible write per sync | AC14, AC15; Business Rules 21, 22; AC28 |
| 7. The same read applied twice leaves the count unchanged | AC2, AC5, AC6 |
| 8. Category and note survive a re-sync | AC3, AC4, AC20 |
| 9. A failed run records the failure and leaves prior data intact | AC9, AC10, AC11; Use Cases 3 and 4 |
| 10. Automatic sync after more than six hours | AC24, AC25, AC26, AC27; Business Rule 24; Use Case 6; Decisions 1-3 |
| 11. Depends on #3 and #6 | Depends-on line; [Normative references](#normative-references); Business Rule 1 |
| 12. No screen | Out of Scope (every screen); Overview |
| 13. No credential in the persistence path | AC29, AC30; Business Rules 2, 3 |
| 14. Whole minor units of the peso | AC15, AC22, AC23; Business Rules 12, 16, 17 |

---

## Escalation check

The product constraint is that nothing leaves the device and no design may require a server. Every
requirement here is satisfied locally: the input is a result the scraper produced on the device,
the output is rows in the device's own store, and the only thing the connection records is a code
and a message the app itself composes. The one place a server would be tempting — turning a
foreign-currency card movement into pesos — is declined in Business Rule 17 and deferred rather
than solved with an exchange-rate service. **No part of this item requires a server-side
component, and none is introduced.**

---

## Deferral Notes

### Deferral Note 1 — Backfilling merchants and categories

**Objective wording**: work item #10 requires "merchant resolution on insert via `shared-domain`
alias matching; auto-category with `category_source = 'auto'`".

**Rationale**: the work item scopes recognition to insertion, and Business Rule 14 forbids a repeat
sync from writing into the person's decision layer — which is where the merchant and the category
live. A movement stored before a merchant existed therefore keeps no merchant, even after the
person creates one. Making that better means deliberately re-running recognition over movements the
person has not touched, which is a different action with its own rules about what "not touched"
means.

**Resolution**: enrichment is first-storage-only (Business Rule 18, AC19). A "re-run suggestions"
capability is out of scope and is a candidate follow-up item.

**Human confirmation requested**: yes — Decision 7.

### Deferral Note 2 — A movement the bank restates between reads

**Objective wording**: work item #10 requires that "running the same fixture scrape twice leaves the
row count unchanged".

**Rationale**: that guarantee holds for identical reads, which is what the acceptance criterion
asks for. It cannot hold for a movement whose description the bank itself rewrites between reads —
a pending charge that gains a merchant name once it settles — because the description is one of the
facts the movement is recognised by, and the bank supplies no identifier that would survive the
rewrite. Recognising the two as one would require guessing which changes are restatements and which
are genuinely different movements, and guessing wrong merges two real movements into one, which the
never-delete rule forbids in spirit.

**Resolution**: the restated movement is stored as a new movement. Item #6's spec already records
the same situation from the reading side and declines to resolve it there. Not in scope for the
MVP.

**Human confirmation requested**: yes — if duplicates from restated descriptions turn out to be
common at Banco de Chile, this becomes a real problem worth its own item.

### Deferral Note 3 — Foreign-currency movements and peso totals

**Objective wording**: work item #10 requires mapping what the scraper emits onto stored movements;
item #6 explicitly left to this item whether a foreign-currency card movement is stored, ignored or
surfaced separately.

**Rationale**: discarding it hides a movement the person actually made, and converting it requires
an exchange rate this product has no way to obtain without a server. Storing it is therefore the
only option consistent with the product. But every total and chart in the MVP is a peso total, and
the inclusion rule that governs them counts a movement whenever it is not excluded — it does not
look at currency. A stored dollar movement would therefore be added to a peso total as though it
were pesos.

**Resolution**: this item stores the movement in the currency the read stated, unconverted
(Business Rule 17, AC22). Keeping non-peso movements out of peso totals belongs to the item that
owns the aggregates, and is recorded here as a cross-item obligation rather than silently absorbed.
Until it is done, the practical exposure is limited: it appears only for a person with an
international card charge on Banco de Chile.

**Human confirmation requested**: yes — Decision 9. This is the one deferral in this spec that
leaves a known wrong number on a screen if the aggregate item does not pick it up.

### Deferral Note 4 — A product that disappears from a read

**Objective wording**: work item #10 requires mapping the read's products onto stored products,
without stating what happens to one the bank stops listing.

**Rationale**: the never-delete rule and the connection-to-product-to-movement cascade together
make deleting a product unthinkable — it would take the person's movement history with it. Marking
it closed or hidden would be a new state, and no mockup draws one.

**Resolution**: the product is left exactly as it is, with its movements (Business Rule 7, AC8).

**Human confirmation requested**: yes — Decision 10, if the bank detail screen should distinguish a
product the bank no longer lists.
