# Connect a Bank: Picker, Credentials and Secure Storage — Spec

**Depends on**: 2-theme-design-system-primitives, 3-local-database-schema-migrations-seed-data,
6-port-bank-scraper-banco-de-chile

---

## Overview

This is the moment the product either keeps its promise or breaks it. A person picks their bank,
types the RUT and the internet password they use with that bank, and hands them to an app —
which is exactly what everyone has been told never to do. The whole point of Finanzas is that
this time the secret does not go anywhere: it is written to the phone's own encrypted store,
read only by the on-device scraper, and never seen by a server, a database table, a log line or
an error message.

This item builds the flow that surrounds that moment: the screen that explains what is about to
happen, the picker that lists the banks the app can read, the credential form with its
validation and its rejection state, and the success screen that confirms what was connected. It
also creates and maintains the *bank connection* — the record that says "this person has a link
to this bank on this device" and that holds a pointer to the secret without ever holding the
secret.

What happens *after* the credentials are handed over — driving the scraper, showing progress,
and storing the products and movements it reads — belongs to the adjacent items. This item's
last act is to start that sync and get out of the way, and its first act after the sync is to
show what came back.

---

## Normative references

These documents are the ground truth this spec builds on and does not restate. Where two of them
disagree, the disagreement is recorded in the [Decision Log](#decision-log) rather than silently
reconciled.

- [`docs/project/1-business-domain.md`](../../../project/1-business-domain.md) — the entities and
  the business rules `BR0`–`BR8`. Normative for what may exist and what may never happen.
  `BR0` (no account, no sign-in), `BR1` (credentials never leave the device) and `BR2` (one RUT
  per person) are the three this item lives or dies by.
- [`design/mockups/mobile/BEHAVIOR.md`](../../../../design/mockups/mobile/BEHAVIOR.md), sections
  `connect-bank-intro`, `bank-picker`, `bank-credentials`, `bank-connected` (and `bank-syncing`
  for the handoff) — the behavior contract: when each state applies, what each action does, and
  what data each screen lives on. Normative for behavior.
- [`design/mockups/mobile/index.html`](../../../../design/mockups/mobile/index.html) and
  [`design/mockups/mobile/mockup-manifest.js`](../../../../design/mockups/mobile/mockup-manifest.js)
  — the visual contract: the screens, their declared states, their routes and their Spanish copy.
  Normative for layout, states and user-visible strings.
- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) — normative for the
  enumerated values a connection can carry, and for the reasoning behind the single most
  surprising rule in this spec: **the RUT is not stored in the database at all**, because it is
  credential material and already lives in secure storage next to the password.
- [`docs/project/3-software-architecture.md`](../../../project/3-software-architecture.md) —
  the scraper is a package with a headless entry point, not a screen; there is no backend.
- The spec for work item #6,
  [`1_6-port-bank-scraper-banco-de-chile_specs.md`](../20260801232904_6-port-bank-scraper-banco-de-chile/1_6-port-bank-scraper-banco-de-chile_specs.md)
  — normative for what the connect flow must hand the scraper, and for the guarantee that both
  sides clear their plaintext copy of the credentials when a read ends.

**How this spec was written.** This repository deliberately replaces the spec-stage interview
with written contracts: `BEHAVIOR.md` states that "the spec stage cites this document instead of
asking", and that a behavioral question it does not answer is a gap in *that* document, fixed by
a pull request against it. Every product question in this item was resolved from the documents
above. Claims that `BEHAVIOR.md` marks 🟡 *proposed* are used here and are listed, one by one, in
[Assumptions](#assumptions). The two questions the contracts genuinely do not answer are in
[Open Questions](#open-questions), each with a reversible default so that neither blocks the
item.

**Vocabulary.** This spec says **connection** for what the domain document calls a *bank
connection* and the data model calls the user's link to an institution; **institution** or
**bank** for an entry in the catalog of banks; **product** for what the UI calls *producto
financiero* (an account or a card); and **secure store** for the device's encrypted credential
storage. **Person** and **user** mean the same actor — there is only one, and there is no
sign-in.

**No URL-serialized state.** This spec introduces no query parameters, path parameters or hash
fragments. The routes it uses are fixed by the mockup manifest and carry no parameters:
`/(onboarding)/connect-bank`, `/(onboarding)/bank-picker`, `/(onboarding)/bank-credentials` and
`/(onboarding)/bank-connected`. The credential screen is always scoped to exactly one chosen
institution, and the flow always knows where it was entered from (Business Rule 24); *how* those
two facts travel between screens is an implementation-plan decision, not a product one.

---

## Use Cases

### Use Case 1: A person connects their first bank

**Actor**: The person, on their own device.
**Preconditions**: The app has been installed and opened. No connection exists yet, and the
secure store holds no credentials. The device has network access. The bank catalog is present
(it ships with the app).

**Steps**:

1. The person reaches the connect-a-bank introduction at the end of the onboarding carousel.
   They read the security promise, and may open the "¿Cómo funciona la conexión segura?"
   accordion to see the three-step explanation of what the app is about to do.
2. They tap the single call to action and arrive at the bank picker.
3. The picker lists every bank in the catalog: the ones the app can read today, marked available,
   and the ones it cannot read yet, marked as coming soon. In the MVP exactly one bank — Banco de
   Chile — is available.
4. The person taps Banco de Chile and arrives at the credential form, which is titled with that
   bank's name and repeats the promise that what they type stays on the phone.
5. They type their RUT and their internet password. The connect button stays inert until the RUT
   is a real RUT (its check digit included) and the password field is not empty.
6. They tap connect. The app writes both values into the device's secure store under an entry
   belonging to this bank, records a connection for this bank pointing at that entry, and moves
   the person to the syncing screen, which starts the read.
7. The sync succeeds. The person lands on the connected screen, which names the bank and states
   how many products and how many movements were found.
8. They tap the primary action and continue with onboarding.

**Postconditions**: The secure store holds the RUT and password for this bank. A connection
exists for this bank, recording that it is connected, when it last synced, and that the last
sync succeeded. Nothing anywhere holds the password or the RUT outside the secure store. The
person can reach the rest of the app.

**Information shown**:

- On the introduction: the security promise, and — when the accordion is open — the three steps
  of how the connection works.
- On the picker: every bank in the catalog, each with its name, its brand mark and either the
  availability badge or the coming-soon note; plus a standing note that the MVP supports Banco de
  Chile and that more banks will follow with the same on-device mechanism.
- On the credential form: the chosen bank's name and brand mark, the reassurance that the data is
  encrypted and stays on this phone, a RUT field with the Chilean format as its placeholder, and
  a password field whose content is always masked.
- On the connected screen: one row per connected bank with its name and a count of products and
  movements discovered.

**Actions available**:

- Open and close the security accordion; start the connection.
- Search the bank list; select an available bank; go back.
- Type a RUT and a password; connect; cancel back to the picker.
- Add another bank; finish and continue.

**Considerations**:

- The password is never rendered as readable text, at any point, in any state. No reveal control
  is drawn, so none exists (Business Rule 6).
- The credentials are written to the secure store *before* the sync starts, not after it
  succeeds. This is what makes a retry possible without asking the person to type them again, and
  it is what the syncing screen's own failure copy already promises ("Tus credenciales siguen
  guardadas en el dispositivo").
- A person who has already connected this same bank does not create a second connection; see
  Use Case 7.

---

### Use Case 2: A person looks for a bank that is not available yet

**Actor**: The person, on the bank picker.
**Preconditions**: The picker is showing the full list.

**Steps**:

1. The person sees their bank in the list with the coming-soon note under its name.
2. They tap it.
3. Nothing happens. The row is not selectable and leads nowhere.

**Postconditions**: The person is still on the picker. No connection was created and nothing was
written to the secure store.

**Information shown**:

- The bank's name and brand mark, and the coming-soon note in place of the availability badge.
- The standing note explaining that the MVP supports Banco de Chile and that more banks arrive
  through the same on-device mechanism.

**Actions available**:

- Keep looking, search, or go back.

**Considerations**:

- Whether unavailable banks should be listed at all is an open product decision in the behavior
  contract (`D4`). This item implements the reversible default: **exactly as the picker draws
  them** — visible, below the available banks, with the coming-soon note, and not selectable
  (Decision 1).
- "Not selectable" must be true for assistive technology as well as for touch: a row that
  announces itself as a button and then does nothing is worse than a row that announces it is
  unavailable (Business Rule 7).

---

### Use Case 3: A person searches the bank list

**Actor**: The person, on the bank picker.
**Preconditions**: The picker is showing the full list.

**Steps**:

1. The person types into the search field.
2. The list narrows to the banks whose name matches what they typed, and the section heading is
   replaced by a count of results.
3. If nothing matches, the list is replaced by the empty state: an explanation that the bank was
   not found and an invitation to check the name.

**Postconditions**: None. Searching changes nothing but what is displayed.

**Information shown**:

- While there are matches: the matching banks, in the same order and with the same availability
  treatment as the full list, under a heading stating how many results there are.
- While there are none: the not-found heading and its explanatory line.

**Actions available**:

- Change the search text; clear it and return to the full list; select an available match.

**Considerations**:

- The search covers the whole catalog, available banks and coming-soon banks alike. The mockup's
  worked example ("chi" → one result) is consistent with this: no coming-soon bank's name
  contains that fragment.
- Matching is on the bank's name, and must be forgiving of accents and letter case — a person
  typing "itau" must find "Banco Itaú" (Business Rule 8).
- The empty state draws a "Sugerir un banco" control. There is no backend for a suggestion to
  reach and the mockup gives the control no destination, so it is deferred; see
  [Open Question 1](#open-questions) and [Deferral Note 1](#deferral-notes).

---

### Use Case 4: The bank rejects the person's credentials

**Actor**: The person, returning from a failed sync.
**Preconditions**: The person entered a RUT and a password and tapped connect. The sync failed
because the bank refused the sign-in.

**Steps**:

1. The syncing screen reports the failure and offers to try again.
2. The person chooses to try again with different credentials and is returned to the credential
   form for the same bank.
3. The form is shown in its rejected state: the fields carry the values that were used, the
   password stays masked, and a message under the password says the bank rejected these
   credentials and invites them to check the password and try again.
4. The person corrects the password and taps connect again.
5. The corrected credentials replace the stored ones for that bank, and the sync starts again.

**Postconditions**: The secure store holds exactly one credential entry for this bank, containing
the most recent values. The connection still exists and still records that its last attempt
failed, until the next attempt changes that.

**Information shown**:

- The same form as before, plus the rejection message.

**Actions available**:

- Correct the fields and connect again; cancel back to the picker.

**Considerations**:

- The rejection message says only that the bank rejected the credentials. It never echoes,
  quotes, partially masks or hints at what was typed, and it never surfaces the bank's own error
  text or any technical failure detail (Business Rules 1 and 4).
- A rejected sign-in does not delete the stored credentials and does not delete the connection.
  The mockup's failure copy promises the credentials are still on the device, and a retry that
  did not have to re-ask for the RUT depends on it.
- The form cannot distinguish a wrong password from a wrong RUT; the bank does not say. The
  single message covers both, which is also why the RUT stays editable in this state on a first
  connection.

---

### Use Case 5: A person connects a second bank

**Actor**: The person, after at least one bank is already connected.
**Preconditions**: At least one credential entry exists in the secure store, holding the RUT used
for the first connection.

**Steps**:

1. From the connected screen (or from the connected-banks list in settings), the person chooses
   to add another bank and arrives at the picker.
2. They select an available bank.
3. The credential form opens with the RUT already filled in and locked, showing a note that all
   of their banks must belong to the same RUT. Only the password field is editable.
4. They type the password for that bank and connect.
5. The sync runs and the connected screen now lists both banks, each with its own counts.

**Postconditions**: One credential entry exists per connected bank, each holding the same RUT and
that bank's own password. One connection exists per bank.

**Information shown**:

- The same form as a first connection, with the RUT rendered as locked and the same-RUT note
  under it.
- On success, the connected screen in its multiple-banks form: the heading is pluralized and one
  row is shown per connection.

**Actions available**:

- Type the password; connect; cancel. The RUT cannot be edited or cleared.

**Considerations**:

- This is `BR2` made concrete: one person, one RUT, many banks. The lock is the enforcement — the
  app never compares two RUTs, because a second one can never be entered (Business Rule 13).
- The locked value is read from the stored credentials, not from the database, because the RUT is
  not in the database at all (Business Rules 2 and 13).
- In the MVP only one bank is available, so a second connection is reachable in a normal build
  only after a second bank ships. The state is still built and still verifiable — see
  Acceptance Criterion 18 for how it is tested without a second real bank.

---

### Use Case 6: A person leaves the credential form without connecting

**Actor**: The person, on the credential form.
**Preconditions**: They have opened the form, and may have typed something.

**Steps**:

1. The person taps cancel, or goes back.
2. They return to the picker.

**Postconditions**: Nothing was written to the secure store. No connection was created or
modified. Whatever they typed is gone from the app's memory.

**Information shown**:

- The picker, as before.

**Actions available**:

- Pick a different bank, or leave the flow the way they came in.

**Considerations**:

- Leaving the form must not leave a half-typed password behind — not in a saved form state, not
  in a navigation cache, not restored when the screen is opened again (Business Rule 5). Coming
  back to the form is coming back to an empty form, except for a locked RUT, which is read from
  the secure store rather than remembered.

---

### Use Case 7: A person re-connects a bank they already have

**Actor**: The person, from the picker.
**Preconditions**: A connection already exists for the bank they select.

**Steps**:

1. The person selects that bank in the picker.
2. The credential form opens for it, with the RUT locked, exactly as for any bank after the
   first.
3. They enter the password and connect.
4. The stored credentials for that bank are replaced, the existing connection is reused, and the
   sync runs again.

**Postconditions**: Still one connection for that bank and still one credential entry for it.
Nothing was duplicated. Products and movements previously stored for that connection are
untouched by this item.

**Information shown**:

- The credential form, as in Use Case 5.

**Actions available**:

- The same as any connection attempt.

**Considerations**:

- One connection per bank is an invariant of the data model, not a convenience: two connections
  to the same bank would mean two credential entries and two candidate sources for the same
  products (Business Rule 14).
- Re-connecting is how a person recovers from a changed bank password. Repairing a connection
  from the settings surfaces is item #20's; this item only guarantees that the same flow, run
  again, repairs rather than duplicates.
- The mockup wires the bank detail screen's "Actualizar credenciales" action straight to this
  credential form. That path arrives with a credential entry already present, so it arrives with
  the RUT locked and only the password to retype — which is exactly what item #20's own
  acceptance criterion asks for ("credential update re-runs the sync without re-entering the
  RUT"). This item owes that behavior; the button that reaches it is item #20's.

---

## Business Rules

### Credentials and secrecy

1. The RUT and the password are written to exactly one place: the device's secure store, in an
   entry that belongs to a single bank. They are never written to the database, never written to
   a log or diagnostic trail, never included in an error message or failure payload, and never
   sent anywhere except to the bank's own site by the scraper (`BR1`).
2. The RUT is credential material, exactly as the password is. Every rule in this section that
   applies to the password applies to the RUT with no exception (data model,
   *There is no `national_id_value` column*).
3. The connection record holds a pointer to the credential entry and nothing else about it. A
   reader of the database learns which banks a person connected and never learns who they are or
   how to sign in as them.
4. No user-facing message, anywhere in this flow, contains any part of what the person typed —
   not the password, not the RUT, not a masked or truncated form of either.
5. The plaintext values exist in the app's own memory only from the moment they are typed until
   they have been written to the secure store and handed to the sync, and are cleared when the
   attempt ends — on success, on failure, and on abandonment alike.
6. The app never reads the credential entry except to start a sync or to pre-fill the locked RUT
   field. No screen displays a stored password, and no field renders a typed password as readable
   text: the password is masked in every state, and no reveal control is drawn, so none exists.

### The picker

7. Only banks the app can actually read are selectable. A bank that is not available yet is
   inert: tapping it does nothing, and assistive technology is told it is unavailable rather than
   being offered a button that leads nowhere.
8. Bank search matches on the bank's name and ignores letter case and accents.
9. The catalog of banks is data the app ships with, not a list written into a screen. Adding a
   bank, or making one available, must not require changing this flow.
10. Every bank shown in the picker comes from the catalog, in a stable order: the available banks
    first, then the ones that are coming soon.

### The credential form

11. The connect action is unavailable until the RUT is valid — including its check digit — and
    the password field is non-empty. Validity is decided by the shared RUT validation the app
    already owns, so that this screen and every other RUT surface agree.
12. A RUT is accepted however the person types it — with or without dots, with or without the
    dash, in upper or lower case for the `K` check digit — and is always shown back to them in
    the canonical Chilean form, `12.345.678-9`. That is a rule about what the person sees; which
    form is handed to the scraper is a matter for the implementation plan and the bank's own
    sign-in form, not a product decision.
13. From the moment any credential entry exists, the RUT field is pre-filled from it and cannot
    be edited (`BR2`). It becomes editable again only if no credential entry exists at all.
14. Connecting a bank that already has a connection updates that connection and replaces its
    stored credentials. It never creates a second connection or a second credential entry for the
    same bank.
15. A rejected sign-in leaves both the connection and the stored credentials in place.

### The connection

16. A connection is created the moment the person confirms their credentials, before the sync
    runs — not when the sync succeeds. A bank whose first sync failed is a connection in a failed
    state, not an absence.
17. A connection's sync state moves `idle → syncing → ok` on a successful read and
    `idle → syncing → error` on a failed one, and returns to `syncing` on every retry. The values
    are the ones fixed by the data model; this item sets them and the syncing screen (#11) and
    the settings surfaces (#20) render them.
18. A connection records when it last attempted a sync and when it last succeeded, as two
    separate facts, so a failing connection can still say when it was last correct.
19. A connection is never silently discarded. Removing one is disconnection, which is an explicit
    action on a settings screen owned by another item, and which keeps the movements already
    downloaded.

### The flow

20. Every screen in this flow implements every state its manifest entry declares, and takes its
    Spanish copy from the mockup (non-negotiables 6 and 8). No user-facing string is written
    inline in a screen.
21. There is no sign-in, no account, and no server call anywhere in this flow (`BR0`). The only
    network traffic this item causes is the scraper's traffic to the bank's own site, and this
    item does not make it directly.
22. Confirming the credentials always leads to the syncing screen. This flow has no way of
    reaching the connected screen except through a completed sync.
23. The connected screen shows one row per connection that has completed a sync, with the number
    of products and the number of movements found. The counts are facts produced by the sync
    (#10), rendered here.
24. The flow can be entered from onboarding or from the connected-banks list in settings, and
    leaving it — by finishing or by backing out — returns the person to where they entered it.
25. Nothing in this flow is blocked on the person having categorized, named or decided anything.
    It asks for a bank and a credential, and nothing else.

---

## UX Rules

The mockup is the contract; this section states what each declared state means and when it
applies. Copy is quoted from the mockup because it is the product's own wording, and because the
privacy copy *is* the promise.

### `connect-bank-intro` — `#screen=connect-bank-intro`

| State | When it applies | What it shows |
| --- | --- | --- |
| `default` | On arrival | Eyebrow "Primer paso", heading "Conecta tu banco", the lead paragraph, the "Máxima seguridad garantizada" card with "Almacenamiento local seguro", the collapsed accordion, and the call to action "Conectar con mi banco" |
| `how-it-works` | The person taps the accordion "¿Cómo funciona la conexión segura?" | Everything in `default`, plus the three numbered steps, with the chevron flipped |

- The accordion is local state, not navigation: opening it does not change screen and going back
  from this screen goes back in onboarding, never merely closes the accordion.
- The three steps are the product's own explanation of the architecture and must be rendered
  verbatim from the mockup: the bank's site is opened inside the app on the phone; the
  credentials are typed into that form and kept encrypted in the device keychain; the products
  and movements are read and stored locally, and none of it passes through a server of ours.
- There is exactly one forward action. No skip or "later" control is drawn — see
  [Open Question 2](#open-questions).

### `bank-picker` — `#screen=bank-picker`

| State | When it applies | What it shows |
| --- | --- | --- |
| `list` | On arrival, and whenever the search field is empty | The search field with the placeholder "Buscar banco…", the heading "Bancos disponibles en Chile", the available banks, then the coming-soon banks, then the standing note about the MVP supporting Banco de Chile |
| `search` | The search field has text and at least one bank matches | The search field with the typed text, a heading stating the number of results, the matching banks with the same treatment as in `list`, and the same standing note |
| `no-results` | The search field has text and no bank matches | The search field with the typed text, and the empty state: "No encontramos ese banco" with "Revisa el nombre o cuéntanos cuál necesitas para priorizarlo." The standing note is not shown |

- An available bank's row carries its brand mark, its name, the line "Cuentas, tarjetas y líneas"
  and the badge "Disponible". Tapping it opens the credential form for that bank.
- A coming-soon bank's row carries its brand mark, its name and the line "Próximamente" in place
  of the badge, is drawn as the mockup draws it, and does nothing when tapped.
- The results heading is a count and must agree with what is listed: singular for one result,
  plural otherwise.
- The back control returns to wherever the flow was entered from (Business Rule 24).

### `bank-credentials` — `#screen=bank-credentials`

| State | When it applies | What it shows |
| --- | --- | --- |
| `empty` | On arrival with no RUT available to pre-fill | Both fields empty with their placeholders, and the connect action visibly inert |
| `filled` | Both fields satisfy Business Rule 11 | The typed RUT, the masked password, and the connect action active |
| `error` | The person returned here after the bank refused the sign-in | The values that were used, the password still masked and marked as being in error, and the message "El banco rechazó estas credenciales. Revisa tu clave e inténtalo de nuevo." under the password field |
| `rut-locked` | Any credential entry already exists | The RUT pre-filled and locked, with the note "Todos tus bancos deben estar a nombre del mismo RUT.", and only the password editable |

- The screen is titled with the chosen bank's name and repeats it with its brand mark, above the
  line "Ingresa tus credenciales de banca en línea".
- The privacy note is always visible, in every state: "Estos datos se cifran y se guardan solo en
  este teléfono. No se envían a ningún servidor."
- The password field is masked in every state. There is no reveal control.
- `rut-locked` composes with `filled` and with `error`: a second bank whose password is rejected
  shows the rejection message *and* the locked RUT.
- An invalid or incomplete RUT is communicated by the connect action staying inert. No inline
  validation message is drawn, so none is added (Decision 4).
- The secondary action is "Cancelar" and returns to the picker without writing anything.

### `bank-connected` — `#screen=bank-connected`

| State | When it applies | What it shows |
| --- | --- | --- |
| `single` | Exactly one connection has completed a sync | The heading "¡Banco conectado!", the congratulation line, one bank row with its counts and a success mark |
| `multiple` | More than one connection has completed a sync | The heading "¡Bancos conectados!" and one row per connection, each with its own counts |

- Each row states the number of products and the number of movements found for that connection,
  in that order, in the mockup's form ("3 productos · 57 movimientos"), with correct singular and
  plural forms.
- The two actions are "Agregar otro banco", which returns to the picker, and "Estoy listo", which
  continues the onboarding.
- Only the difference between one connection and several changes between the two states. Neither
  state shows anything about categorization, balances or amounts.

---

## Statuses / Enum Values

### Bank availability, in the catalog

| Code value | Display label | Description |
| --- | --- | --- |
| `available` | Disponible | The app can read this bank today. Selectable in the picker. In the MVP, Banco de Chile only |
| `coming_soon` | Próximamente | The bank is listed so people can see it is planned, and cannot be selected |

**Valid transitions**: none at runtime. Availability is a property of the shipped catalog and
changes only when a new version of the app ships with a new bank.

### Connection state

The values are fixed by the data model. This item is the only place that creates a connection,
and it sets the values marked below; the rest are set by the adjacent items.

No screen in this item renders a label for a connection's own state: the connected screen shows a
success mark, not a word. The display column therefore records only the wording the mockups
actually draw, on the screens that draw it. Where a value has no drawn label, none is invented
here — naming it is part of the item that first shows it.

| Code value | Display label | Description |
| --- | --- | --- |
| `active` | Not drawn — the connected screen and the connected-banks list show a success mark | The connection is in use and will sync. **Set by this item** when a connection is created or re-connected |
| `inactive` | Not drawn — no screen in the MVP produces or renders this value | The connection exists but is not syncing. Not set by this item |
| `disconnected` | Not drawn as a state label; the action that produces it is "Desconectar" (#20) | The person removed the connection: its credentials were deleted and its movements kept. Not set by this item; owned by #20 |

**Valid transitions**: `active → inactive` and `active → disconnected` on an explicit action in
settings (#20). This item only ever produces `active`, including when re-connecting a bank that
was previously disconnected.

### Sync state of a connection

| Code value | Display label | Description |
| --- | --- | --- |
| `idle` | Not drawn — a connection is only briefly in this state before its first read | Created but never read. **Set by this item** the moment the connection is created |
| `syncing` | Not drawn as a badge; the syncing screen (#11) shows per-step wording instead | A read is in progress. **Set by this item** when the sync is started |
| `ok` | "Al día" on the bank detail screen (#20); a success mark on the connected screen | The last read succeeded. Set by the sync engine (#10) |
| `error` | "Error" on the bank detail screen (#20) | The last read failed. Set by the sync engine (#10) |

**Valid transitions**:

- `idle → syncing` when the person confirms their credentials and this item starts the read.
- `syncing → ok` when the read completes.
- `syncing → error` when the read fails.
- `ok → syncing` and `error → syncing` on any retry or later sync.

---

## Acceptance Criteria

Each criterion is verifiable by a person following the smoke test on a dev build, or by an
automated test where it concerns something that cannot be seen on screen.

### The promise

- [ ] AC1 — After connecting a bank successfully, a dump of the entire local database contains no
      occurrence of the password and no occurrence of the RUT, in any column, in any form.
- [ ] AC2 — After a full connect-and-sync run with diagnostics at their most verbose, no log line,
      diagnostic entry or recorded error contains the password or the RUT, or any substring of
      either.
- [ ] AC3 — After a *failed* connect attempt (bank rejects the credentials), AC1 and AC2 still
      hold, and the error surfaced to the person contains neither value.
- [ ] AC4 — The credential entry written to the secure store is scoped to the chosen bank, and
      connecting a second bank creates a second entry rather than overwriting the first.
- [ ] AC5 — Cancelling or backing out of the credential form after typing a password writes
      nothing: no credential entry appears and no connection is created.
- [ ] AC6 — Re-opening the credential form after abandoning it shows an empty password field; the
      previous input is not restored.

### The picker

- [ ] AC7 — The picker lists every bank in the shipped catalog, available banks first, and shows
      Banco de Chile with the "Disponible" badge.
- [ ] AC8 — Every bank that is not available shows "Próximamente" in place of the badge, and
      tapping it neither navigates nor changes anything.
- [ ] AC9 — A screen reader announces a coming-soon row as unavailable rather than as an
      actionable button.
- [ ] AC10 — Typing text that matches at least one bank narrows the list to the matches and
      replaces the section heading with a result count that agrees with the number of rows shown.
- [ ] AC11 — Search matches ignoring case and accents: typing `itau` finds "Banco Itaú".
- [ ] AC12 — Typing text that matches nothing shows the not-found state with its heading and
      explanatory line; clearing the search restores the full list.

### The credential form

- [ ] AC13 — With an empty form the connect action is inert; it becomes active only once the RUT
      is valid — check digit included — and the password is non-empty.
- [ ] AC14 — A RUT with a wrong check digit never enables the connect action, and a RUT typed
      without dots or dash (`123456789`) is accepted and displayed as `12.345.678-9`.
- [ ] AC15 — The password is masked in every state of the screen, and there is no control anywhere
      in the flow that reveals it.
- [ ] AC16 — When the bank rejects the credentials, returning to the form shows the rejection
      message under the password field, and that message names neither the RUT nor the password
      and carries no technical failure detail.
- [ ] AC17 — Correcting the password and connecting again replaces the stored credentials for that
      bank; the secure store still holds exactly one entry for it.
- [ ] AC18 — With a credential entry already present, the form opens with the RUT filled and
      locked and the same-RUT note visible, and the RUT cannot be edited, cleared or replaced by
      any interaction. (Verifiable in the MVP by seeding a credential entry in a dev build and
      re-entering the flow, since only one bank is available.)

### The connection

- [ ] AC19 — Confirming credentials creates exactly one connection for that bank, and the
      connection holds a reference to the credential entry and no credential value.
- [ ] AC20 — Selecting a bank that already has a connection and connecting again leaves exactly
      one connection for that bank.
- [ ] AC21 — A connection whose first sync failed still exists afterwards, recording that its last
      attempt failed, and its stored credentials are still present.
- [ ] AC22 — A connection records its last attempt and its last success as two separate facts:
      after a success followed by a failure, the last-success time is still the earlier one.

### The flow

- [ ] AC23 — Confirming credentials always lands on the syncing screen; the connected screen is
      unreachable except through a completed sync.
- [ ] AC24 — After one successful connection the connected screen shows the single-bank heading
      and one row with the counts of products and movements actually stored by the sync.
- [ ] AC25 — With more than one connected bank the connected screen shows the pluralized heading
      and one row per connection.
- [ ] AC26 — "Agregar otro banco" returns to the picker; "Estoy listo" continues onboarding.
- [ ] AC27 — Entering the flow from the connected-banks list in settings and backing out returns
      to settings, not into onboarding.
- [ ] AC28 — Every state declared in the manifest for the four screens of this item renders:
      `connect-bank-intro` (`default`, `how-it-works`), `bank-picker` (`list`, `search`,
      `no-results`), `bank-credentials` (`empty`, `filled`, `error`, `rut-locked`) and
      `bank-connected` (`single`, `multiple`).
- [ ] AC29 — No user-facing string in these screens is written inline; every one resolves through
      the Spanish catalogue and matches the mockup's wording.
- [ ] AC30 — Open `design/mockups/mobile/index.html` and compare each state side by side with the
      built screen before marking this item done.

---

## Out of Scope (MVP)

- **Storing what the scraper reads.** Mapping products and movements onto the database,
  idempotently, and the bookkeeping of sync results, is item #10. This item starts the sync and
  reads the resulting counts.
- **The syncing progress screen.** `#screen=bank-syncing`, its four states, its progress reporting
  and its retry and "choose another bank" recovery paths are item #11. This item is the screen
  before it and the screen after it.
- **Driving the bank's website.** Signing in, reading products, reading movements and everything
  bank-specific is item #6.
- **The onboarding frame around this flow.** The intro screen, the value carousel and the ready
  screen are item #8.
- **Notifications.** The screen that follows "Estoy listo" is item #18.
- **Managing connections after they exist.** The connected-banks list, the per-bank review screen,
  manual re-sync, credential update from settings and disconnection are item #20. This item
  guarantees only that re-running its own flow repairs rather than duplicates.
- **Banks other than Banco de Chile.** They are listed as coming soon and are not selectable.
- **Sign-in, accounts and identity.** There is none (`BR0`). The `auth` and `verify-code` screens
  stay flagged out of the MVP.
- **Any server-side component**, including anything that would send a credential, a suggestion, a
  crash report or a movement off the device.
- **The "Sugerir un banco" control** in the picker's empty state — see
  [Deferral Note 1](#deferral-notes).
- **A skip or "connect later" path** out of the connect-a-bank introduction — see
  [Deferral Note 2](#deferral-notes).
- **Showing or re-reading a stored credential to the person.** No screen displays a stored
  password, and there is no biometric re-authentication in front of this flow; neither is drawn.
- **More than one RUT.** Joint accounts are read as one person's accounts, per the domain
  document.

---

## Assumptions

`BEHAVIOR.md` marks a claim 🟡 when it was inferred from the mockups and has not been validated by
the product owner. A spec may build on those claims provided it lists them. These are the ones
this spec relies on; each one is small, and each one is reversible in the direction the mockup
already points.

1. **The introduction's call to action leads to the picker** (`connect-bank-intro`, 🟡). The
   mockup wires it that way and there is no other forward path drawn.
2. **The connected screen's actions lead where the mockup wires them** (`bank-connected`, 🟡):
   continue goes to the notifications step, and "Agregar otro banco" goes back to the picker with
   the RUT locked on the credential screen.
3. **A failed sync can return the person to the credential form when the failure was an
   authentication failure** (`bank-syncing`, 🟡). This is what makes the form's `error` state
   reachable at all; the syncing screen's own behavior is item #11's.
4. **Disconnecting a bank deletes its credential entry and keeps its movements**
   (`settings-banks`, 🟡). This spec depends on it only for one edge: if every connection is
   disconnected, no credential entry remains, so the RUT field becomes editable again for the
   next connection (Business Rule 13).
5. **The app opens on onboarding only until a profile exists** (`onboarding-intro`, 🟡). This
   spec relies on it only to say that the flow is entered from onboarding the first time and from
   settings afterwards.

Two further assumptions are this spec's own, derived rather than quoted, and are recorded with
their reasoning in the [Decision Log](#decision-log): that the RUT lock is triggered by the
existence of any stored credential rather than by counting connections (Decision 3), and that an
invalid RUT is communicated only by the inert connect action (Decision 4).

---

## Decision Log

Decisions taken while writing this spec, resolved from the documents in
[Normative references](#normative-references). Each is listed so the product owner can revisit
it.

| # | Decision | Basis | Confirmation requested |
| --- | --- | --- | --- |
| 1 | Banks that are not available yet are listed, below the available ones, with the "Próximamente" note, and are not selectable. | `BEHAVIOR.md` decision `D4` is open; the reversible default chosen for this item is "exactly as the picker draws them", and the picker draws them visible and without a destination. Work item #9 also states that only available banks are selectable. | Yes — `D4` is still owned by the product owner. Hiding them later is a change to one list filter and no change to this spec's rules. |
| 2 | Credentials are written to the secure store before the sync starts, and survive a failed sync. | The syncing screen's own failure copy promises the credentials are still on the device, and the retry path must not re-ask for them. Work item #11 requires that retry reuse stored credentials without asking again. | No |
| 3 | The RUT field is locked whenever *any* credential entry exists, rather than when a connection count exceeds one. | `BR2` says "from the second connection onward", but the RUT lives only in secure storage (data model), so the presence of a stored entry is the fact the screen can actually observe. It also gives the right behavior after every connection has been disconnected: the RUT is gone, so it is asked for again. | Yes — only for the disconnect-everything edge, which depends on Assumption 4. |
| 4 | An invalid RUT is communicated by the connect action staying inert; no inline validation message is shown. | The mockup declares four states for the form and none of them is an invalid-RUT state, and the repository's rule is that what is not drawn does not exist. Work item #9 asks only that the RUT be validated before the button enables. | Yes — a silent disabled button is a known usability risk; adding a hint would require new copy and a fifth state in the mockup. |
| 5 | A RUT is accepted in any of its written forms and displayed canonically as `12.345.678-9`. | The shared utilities already normalize, validate and format RUTs, and the mockup's placeholder is the canonical form. Rejecting an unformatted RUT would be a validation failure the person cannot see the cause of. | No |
| 6 | Connecting a bank that already has a connection updates it rather than creating a second one. | The data model allows one connection per institution, and two credential entries for one bank would make the source of a product ambiguous. | No |
| 7 | The connection is created before the first sync, so a bank whose first sync failed is a connection in a failed state. | The connection is what points at the credential entry; without it, a failed first sync would leave a credential in the store that nothing refers to. Item #10 records sync outcomes on an existing connection. | No |
| 8 | The connected screen's counts are rendered from what the sync actually stored, not from what the scraper reported. | The counts are the person's evidence that the connection worked. Reporting what was read but not stored would be a number they can never reconcile with the transactions list. | No |
| 9 | The flow returns to wherever it was entered from, rather than always to onboarding. | The flow is reachable from the connected-banks list in settings (item #20 depends on this item for exactly that), and an add-a-bank action that dumps the person back into onboarding would be a defect. | No |
| 10 | Bank search matches names ignoring case and accents. | The catalog contains "Banco Itaú" and "BancoEstado"; a Chilean phone keyboard makes the accent optional in practice, and an accent-sensitive search would make a listed bank unfindable. | No |
| 11 | The three-step "¿Cómo funciona?" explanation is rendered verbatim from the mockup. | `BEHAVIOR.md` states that this copy is the product's central promise (`BR1`) and that the exact text comes from the mockup. | No |

---

## Brief Objective List

Discrete requirement bullets from work item #9, plus the constraints supplied with it.

1. Build `connect-bank-intro`, including the security-explanation accordion.
2. Build `bank-picker` reading the shipped catalog of institutions; only available banks are
   selectable.
3. Build `bank-credentials`: RUT and password, validation, the rejection state, and the
   RUT-locked state from the second connection onward.
4. Write the credentials to the device's secure store, in an entry scoped to the chosen bank.
5. Create the connection record, holding only the pointer to that entry.
6. Build `bank-connected` for one bank and for several.
7. Acceptance: no credential is written to the database, logged, or held after the sync completes.
8. Acceptance: from the second bank onward the RUT field is pre-filled and read-only.
9. Acceptance: the RUT is validated before the connect action becomes available.
10. Acceptance: every state listed for the four screens renders.
11. Acceptance: compare against `design/mockups/mobile/index.html` side by side before marking
    done.
12. Depends on the theme and primitives (#2), the local database and its seed catalog (#3), and
    the ported scraper (#6).
13. MVP scope constraint: Banco de Chile only; the out-of-MVP areas stay in the mockups.
14. Scope constraint supplied with the dispatch: this item covers the connection UI flow, RUT
    validation through the shared utilities, credential writing to the secure store, the
    connection lifecycle and the handoff into sync — and does **not** cover the sync persistence
    engine (#10) or the syncing progress screen (#11).

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. `connect-bank-intro` with its accordion | AC28, AC29; [UX Rules](#ux-rules) (`connect-bank-intro`); Business Rule 20; Decision 11; Use Case 1 |
| 2. `bank-picker` from the catalog, only available banks selectable | AC7, AC8, AC9, AC10, AC11, AC12; Business Rules 7, 8, 9, 10; Decision 1; Use Cases 2 and 3 |
| 3. `bank-credentials` with validation, rejection and RUT lock | AC13, AC14, AC15, AC16, AC18; Business Rules 11, 12, 13; Decisions 3, 4, 5; Use Cases 1, 4 and 5 |
| 4. Credentials written only to the secure store, scoped per bank | AC1, AC2, AC3, AC4, AC5, AC17; Business Rules 1, 2, 4, 5, 6; Decision 2 |
| 5. The connection record holds only the pointer | AC19; Business Rules 3, 16; Decision 7 |
| 6. `bank-connected` for one bank and for several | AC24, AC25, AC26; [UX Rules](#ux-rules) (`bank-connected`); Business Rule 23; Decision 8 |
| 7. No credential in the database, in a log, or held afterwards | AC1, AC2, AC3, AC6; Business Rules 1, 2, 4, 5 |
| 8. RUT pre-filled and read-only from the second bank | AC18; Business Rule 13; Decision 3; Use Case 5 |
| 9. RUT validated before the connect action enables | AC13, AC14; Business Rules 11, 12; Decisions 4, 5 |
| 10. Every listed state renders | AC28; [UX Rules](#ux-rules) |
| 11. Side-by-side comparison against the mockup | AC30 |
| 12. Depends on #2, #3 and #6 | Depends-on line; [Normative references](#normative-references); Business Rule 9 (catalog is seeded data) |
| 13. Banco de Chile only | AC7, AC8; Out of Scope (banks other than Banco de Chile); Decision 1 |
| 14. Dispatch scope boundary: no sync engine, no syncing screen | AC23; Business Rules 17, 22, 23; Out of Scope (items #10 and #11); [Deferral Note 3](#deferral-notes) |

Every objective is mapped. Nothing from the brief is silently dropped.

---

## Escalation check

The product constraint is that anything requiring a server is escalated rather than designed
around. Everything in this item happens on the device: the bank catalog ships with the app, the
credential goes into the phone's own encrypted store, the connection lives in local storage, and
the only network traffic caused by this flow is the scraper's traffic to the bank's own site.

**One requirement in the mockup does need something that does not exist**: the "Sugerir un banco"
control in the picker's empty state has no destination that is compatible with having no backend.
It is not designed around, not silently dropped, and not given an invented destination — it is
recorded as [Open Question 1](#open-questions), deferred in
[Deferral Note 1](#deferral-notes), and listed under [Out of Scope](#out-of-scope-mvp). No other
part of this item requires a server-side component, and none is introduced.

---

## Deferral Notes

### Deferral Note 1 — The "Sugerir un banco" control

**Objective wording**: work item #9 requires that "every listed state renders", and the
`no-results` state of the picker draws a "Sugerir un banco" button.

**Rationale**: a suggestion has to reach someone. There is no backend to receive it, the mockup
gives the control no destination, and `BEHAVIOR.md` does not describe it. Every way of making it
work invents product surface that nobody has decided on: an address to mail, a form to open, a
store review prompt to hijack. A button that is drawn and does nothing is worse than one that is
not there, and inventing a destination is worse than both.

**Resolution**: the `no-results` state is built and renders its heading and explanatory copy
(AC12). The control itself is not built in this item. It becomes buildable the moment the product
owner names a destination. **Human confirmation requested**: yes.

### Deferral Note 2 — A "connect later" path out of the introduction

**Objective wording**: work item #9 owns `connect-bank-intro`; `BEHAVIOR.md` leaves open whether
a person can postpone connecting and enter an empty app, and notes that the manifest's flow
suggests they cannot. Work item #8 separately mentions a skip path in the onboarding carousel.

**Rationale**: the introduction draws exactly one action, and the repository's rule is that what
is not drawn does not exist. An app with no connection has no movements, so an empty-app path
would need empty states and a way back into this flow that nothing has designed yet. The skip
mentioned by item #8 is a skip *within the carousel*, which lands on this introduction — it is
not a skip past the connection.

**Resolution**: this item builds one forward action out of the introduction and no postpone path.
**Human confirmation requested**: yes — see [Open Question 2](#open-questions).

### Deferral Note 3 — Everything the sync does with what it reads

**Objective wording**: work item #9's requirement that no credential is "held after the sync
completes", and its scope statement that the flow hands off into sync.

**Rationale**: driving the scraper (#6), showing progress (#11) and storing products and
movements idempotently (#10) are three separate items with their own briefs. Building any of it
here would put the same logic in two places.

**Resolution**: this item starts the sync, and the guarantees that survive it are stated as this
item's rules — the credentials stay in the secure store and nowhere else (Business Rules 1 and
5), the connection's states are the ones the sync moves it through (Business Rule 17), and the
counts shown afterwards are the ones the sync stored (Decision 8). Everything else is deferred to
those items. **Human confirmation requested**: no.

---

## Open Questions

These two are the questions the written contracts do not answer. Neither blocks this item: each
has a recorded reversible default, and each is small enough to add later without reworking
anything in this spec.

1. **Where should "Sugerir un banco" lead?** The picker's empty state draws the control, and there
   is no backend for a suggestion to reach. Default until answered: the state renders its copy and
   the control is not built ([Deferral Note 1](#deferral-notes)).
2. **May a person postpone connecting a bank and enter the app empty?** `BEHAVIOR.md` records this
   as unresolved for `connect-bank-intro` and observes that the manifest's flow suggests not.
   Default until answered: no postpone path is built ([Deferral Note 2](#deferral-notes)).
