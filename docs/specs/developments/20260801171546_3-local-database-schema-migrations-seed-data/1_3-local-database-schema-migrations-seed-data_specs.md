# Local Database: Schema, Migrations and Seed Data — Spec

**Depends on**: 1-bootstrap-monorepo-expo-app

---

## Overview

Finanzas keeps everything it knows about a person's money on their own phone. There is no
server, so the phone's local database is not a cache of somewhere else — it *is* the product's
memory. This item creates that memory: the shape of everything the app stores, the mechanism
that carries a person's existing data forward when the app is updated, and the starter content
(banks, categories, merchants) that makes the first session useful instead of empty.

Nothing in this item is visible on screen. Its value is that every later item — connecting a
bank, syncing, categorizing, the dashboard — has one agreed place to read and write, one
agreed definition of which movements count toward a total, and a way to change the stored shape
later without destroying what a person has already accumulated. Because the database lives on
the device and there is no backup and no "reset production", a mistake here cannot be repaired
after release. That is why this item is specified rather than routed straight to a plan.

---

## Normative reference

[`docs/project/4-database-model.md`](../../../project/4-database-model.md) is the **normative,
field-level contract** for what is stored: every table, every field, its type, whether it may be
empty, its default, and how records reference each other. That document was revised after the
work item brief was written and takes precedence over the brief.

This spec does not restate that contract, because two copies of a schema drift. It defines the
product behaviour around it: what must be true of stored data, what must survive an update,
what ships as starter content, and how each of those is verified. Where the two documents give
different answers, the disagreement is recorded under
[Documented Conflicts](#documented-conflicts) rather than silently reconciled.

---

## Use Cases

### Use Case 1: A person opens the app for the first time on a new phone

**Actor**: The app, acting for the user.
**Preconditions**: The app has been installed and never launched on this device. No local data
exists.

**Steps**:

1. The person taps the app icon.
2. The app prepares its local storage before showing the first screen.
3. The app records that this is the first launch, and which version of the stored shape it
   created.
4. The app loads the starter content: the bank list the person will choose from, the default
   spending and income categories, and a starter set of well-known Chilean merchants.
5. The app continues into onboarding.

**Postconditions**: Local storage exists and holds every kind of record the product uses, the
single local profile has been created, the starter content is present, and the version of the
stored shape is recorded. No screen has shown an error and no set-up step was asked of the
person.

**Information shown**:

- Nothing from this item. The person sees the normal first onboarding screen; preparation is
  silent.

**Actions available**:

- None specific to this item.

**Considerations**:

- Preparation is all-or-nothing. If any part of it fails, the app must not start with half the
  starter content present, because a later run would then have to distinguish "missing because
  it failed" from "missing because the person removed it".
- Preparation must complete quickly enough that it is not perceived as a launch delay. The
  starter content is small and bundled with the app; nothing is downloaded.
- No bank credential and no national ID exist yet at this point, and none is created by this
  item under any circumstance.

---

### Use Case 2: A person opens the app after an update that changes what the app stores

**Actor**: The app, acting for the user.
**Preconditions**: The person has used the app, has connected a bank, and has categorized,
excluded, noted and partially included movements. A newer app version is installed, and it
stores something the previous version did not.

**Steps**:

1. The person opens the updated app.
2. The app compares the recorded version of the stored shape against the version this build
   expects.
3. The app applies each pending change to the stored shape, in order.
4. The app records the new version.
5. The app refreshes the starter content, then continues to the normal entry screen.

**Postconditions**: Every record the person had before the update is still there and unchanged
in every field the person owns. New kinds of record are available but empty. The recorded
version matches the version this build expects.

**Information shown**:

- Nothing. A successful update is invisible.

**Actions available**:

- None specific to this item.

**Considerations**:

- This is the highest-risk path in the entire product. The database is on the person's phone,
  there is no backup, and there is no way to re-run a corrected update against data that has
  already been damaged. Every change to the stored shape must therefore be **additive**, and
  must be proven against a stored-shape snapshot from the previous version before it ships
  (Use Case 5).
- If applying a change fails, the app must not silently continue against a half-changed store,
  and must not delete the store to recover. Failure is surfaced, and the recorded version stays
  at the last version that fully applied.
- Refreshing the starter content on update must not undo the person's own edits, must not bring
  back starter content they removed, and must not touch anything they created (Use Case 4).

---

### Use Case 3: The app stores the same bank movement twice

**Actor**: The app, acting for the user, during any sync after the first.
**Preconditions**: A bank connection exists and at least one movement from it is already
stored. The person has since categorized that movement, written a note on it, and excluded a
different one.

**Steps**:

1. The app reads movements from the bank and asks local storage to store them.
2. Local storage recognises the movements it already holds — by the identifier the bank gave
   them, or, when the bank gave none, by a fingerprint of what the movement actually says.
3. For a movement it already holds, local storage refreshes only what the bank owns and leaves
   untouched everything the person decided.
4. For a movement it has never seen, local storage adds it, uncategorized.

**Postconditions**: The number of stored movements grew by exactly the number of genuinely new
movements. Every category, note, exclusion, exclusion reason, exclusion note, review flag,
partial inclusion and manual-entry marker the person had set is exactly as they left it.

**Information shown**:

- Nothing from this item. What the sync screens show is defined by the sync item.

**Actions available**:

- None specific to this item.

**Considerations**:

- Both recognition routes must hold at once: a bank that supplies identifiers and a bank that
  does not must each be safe from duplicates.
- A movement that the bank re-states with a different amount or description is a different
  movement by fingerprint. That is accepted: banks do not silently rewrite settled movements,
  and treating a rewrite as new is safer than overwriting a movement the person already
  classified.
- Nothing in this item performs a sync. This item defines the storage guarantee that the sync
  item relies on, and proves it against recorded bank responses.

---

### Use Case 4: A person deletes one of their spending categories

**Actor**: The person, from the categories screen (built by a later item).
**Preconditions**: At least one movement is filed under the category being deleted.

**Steps**:

1. The person chooses to delete a category.
2. The app moves every movement filed under it to the fallback category for the same direction
   — the ✨ Otros expense category for a spending category, the ✨ Otros income category for an
   income one — found by the fallback category's stable identifier, not by its name.
3. The app removes the category.

**Postconditions**: No movement was deleted and no movement was left without a category that it
previously had. The two ✨ Otros categories still exist. If the deleted category was starter
content, a later app update does not bring it back.

**Information shown**:

- The confirmation the mockups already declare, naming how many movements will move and where
  (`#screen=settings-categories&state=delete-confirm`). The wording belongs to the categories
  item; this item only guarantees the outcome it promises.

**Actions available**:

- Cancel, leaving everything unchanged.

**Considerations**:

- The two ✨ Otros categories can never be deleted, because they are the destination of this
  rule.
- Move-then-delete is one indivisible operation. A failure part-way must leave the category and
  its movements exactly as they were.
- Anything else that pointed at the deleted category is handled explicitly rather than left
  dangling: a merchant whose default category was the deleted one simply stops having a default,
  and any budget or recurring-transaction record for it is removed with it (neither has any UI
  in the MVP, so neither can hold data a person would miss).

---

### Use Case 5: A contributor changes what the app stores and proves the change is safe

**Actor**: Contributor (human developer or implementation agent).
**Preconditions**: The workspace is set up and the verification commands pass.

**Steps**:

1. The contributor changes the declared shape of stored data.
2. The contributor runs the generate command, which produces the change set that carries an
   existing store from the previous shape to the new one.
3. The contributor runs the check command, which applies the full change history to an empty
   store and then applies the pending change set to every committed snapshot of a previously
   released store.
4. The contributor commits a snapshot of a store at the new version, so the next change has
   something to be checked against.
5. The contributor opens a pull request; the same check runs automatically.

**Postconditions**: The change is either proven to preserve every existing record and every
person-owned value, or the check fails and names what would be lost.

**Information shown**:

- On failure: which snapshot, which kind of record, and which value would be lost or altered.

**Actions available**:

- Re-run the check after correcting the change.

**Considerations**:

- A change that removes a kind of record, removes or renames a field, changes a field's type, or
  makes an existing field mandatory must fail the check. Those are the changes that destroy
  data in the field.
- This is the first version of the stored shape, so there is no earlier release to upgrade from
  yet. The check still runs from day one: it proves the full history applies cleanly to an empty
  store, proves that re-applying it to an already-current snapshot changes and loses nothing,
  and establishes the snapshot and the harness that every later change is measured against. See
  [Deferral Note 1](#deferral-note-1--upgrade-checking-before-a-second-version-exists-resolved).

---

### Use Case 6: A contributor writes a screen that shows a total

**Actor**: Contributor building any later feature that sums, counts or charts money.
**Preconditions**: Movements are stored, some excluded, some partially included.

**Steps**:

1. The contributor needs "how much did I spend in this category this month".
2. The contributor uses the shared definition of which movements count and at what value,
   rather than writing that condition again.
3. The contributor's total agrees with every other total in the app.

**Postconditions**: Two screens that ask the same money question give the same answer.

**Information shown**:

- Nothing from this item.

**Actions available**:

- None specific to this item.

**Considerations**:

- The rule is: a movement counts when it has not been excluded, and it counts at its partial
  amount when the person set one, otherwise at its full amount.
- There is exactly one definition of that rule in the codebase. Restating it anywhere else is a
  review blocker, not a style preference — the failure it causes (the home screen and the
  dashboard disagreeing) is one a person notices immediately and cannot explain.

---

## Business Rules

1. **No credential is ever stored.** No stored record holds a national ID (RUT), a bank
   password, a security answer, a session token, or any other credential — not in a field, not
   inside shape-varying data, not in a stored error message, not in starter content, not in a
   test snapshot. A bank connection stores only the *name of the key* under which the operating
   system's secure store holds the credentials; the values themselves exist only in the
   scraper's memory during a sync.
2. **There is no field for the national ID and no hashed stand-in for it.** Hashing was
   considered and rejected: the space of valid Chilean RUTs is small and its check digit is
   derivable, so an unsalted hash is reversible, and a salted one needs a secret that would have
   to live in the secure store anyway. See the `users` section of the data model.
3. **Money is stored as whole minor units, always.** Every amount — including amounts inside
   shape-varying data such as a product's balance or credit limit — is a whole number of the
   currency's minor unit. For CLP that unit is the peso. No stored value that represents money
   may be a fractional or floating-point number anywhere in the store.
4. **Amounts are stored unsigned; direction comes from the movement type.** A movement's amount
   is always positive; whether it is money in or money out is read from the bank's debit/credit
   classification together with the category's direction.
5. **Bank movements are never deleted.** They are excluded from analysis with a reason, and a
   free-text explanation when the reason is "Otro". No operation in the product deletes a
   movement except the person wiping all local data.
6. **A movement counts toward totals and charts when it has not been excluded, at its partial
   amount when one is set and its full amount otherwise.** This rule exists in exactly one place
   and every aggregate reads through it. A second implementation of it is a review blocker.
7. **Storing a movement is idempotent.** A movement already held is recognised by the bank's
   identifier for it, and by a content fingerprint when the bank supplies no identifier. Both
   routes are enforced by the store itself, not only by the code that calls it.
8. **Re-storing a movement never overwrites what the person decided.** Category, how the
   category was arrived at, note, review flag, exclusion state, exclusion reason, exclusion
   note, partial inclusion and the manual-entry marker are person-owned. Only bank-owned values
   may be refreshed on a re-store.
9. **Every change to the stored shape is additive.** New kinds of record, new optional fields,
   new lookups. Never a removal, a rename, a type change, or a new mandatory field on an
   existing kind of record. A change that violates this fails the check command rather than
   shipping.
10. **Every change to the stored shape ships with proof.** The change set is applied to a
    committed snapshot of a store at the previous version and every record and every
    person-owned value is asserted to survive unchanged. A change set without that proof does
    not ship.
11. **The applied version of the stored shape is recorded in the store itself**, under the
    settings key `schema_version`, and is updated only after the corresponding change has fully
    applied.
12. **A failed change to the stored shape never destroys the store.** The app does not delete,
    recreate or partially leave the store to recover. It surfaces the failure and leaves the
    recorded version at the last version that fully applied.
13. **Starter content is identified by stable identifiers, not by names.** Banks by their
    institution identifier, categories by their slug, merchants and their aliases by their
    identifier and pattern. Renaming displayed text never creates a duplicate.
14. **Refreshing starter content never touches anything the person created.** Records the person
    added are invisible to the starter-content refresh.
15. **Refreshing starter content never overwrites a person's edit to a starter record, and never
    brings back a starter record they removed.** A later app version may add new starter
    records; it may not resurrect or overwrite.
16. **Applying starter content is all-or-nothing.** A failed run leaves the store exactly as it
    was, so the next launch retries from a known state.
17. **The two ✨ Otros categories can never be deleted**, in either direction. They are the
    destination of the category-deletion rule and the app's fallback identity.
18. **Deleting a category re-parents its movements to the ✨ Otros of the same direction**,
    located by that category's stable slug (`otros-gasto` for spending, `otros-ingreso` for
    income) and never by its displayed name. The move and the deletion are one indivisible
    operation. Deleting a category never deletes a movement.
19. **A category's displayed name is resolved by locale**: the device's full locale tag first,
    then its language, then Spanish. Every starter category carries a Spanish name and an
    English name.
20. **Disconnecting a bank is not deleting it.** Disconnecting marks the connection and removes
    the credentials from the secure store; the connection record, its products and every
    movement already downloaded stay, exactly as the mockups promise
    (`#screen=settings-banks&state=disconnect-confirm`). The cascade that removes a connection's
    products and movements exists only for the full local-data wipe.
21. **Removing a merchant never removes a movement.** Its aliases go with it; movements that
    pointed at it keep everything else and simply stop naming a merchant.
22. **Anything the app filters, sorts, groups or counts on is a first-class field.**
    Shape-varying data is for values that differ per row type or per locale and are only ever
    read to render one row. Promoting such a value to a first-class field later is an additive
    change; demoting one is not.
23. **The store is the app's only persistent memory, and only one module may speak to it.**
    All stored-data access lives under the app's database module; no screen, feature hook or
    shared package issues a query or imports the query builder directly.
24. **The person's own data never leaves the device.** Nothing in this item introduces a network
    call, an export, a remote backup or a crash/analytics payload containing stored data.

---

## Stored-Data Guarantees

Field-level detail is normative in
[`docs/project/4-database-model.md`](../../../project/4-database-model.md). The table below
states the guarantees that must hold as *behaviour*, so each is testable without reading the
schema.

### Identity and uniqueness

| Guarantee | Why it matters |
| --- | --- |
| A person can hold at most one connection to any given bank. | The product's RUT and credential model assumes one connection per bank per device. |
| Within a connection, a bank product appears at most once per bank-supplied product identifier. | Re-reading a bank must not double the person's accounts. |
| A category's slug is unique across the whole store, spending and income together. | The slug is how the ✨ Otros fallback and every starter refresh find their record. |
| A merchant alias pattern is unique across the whole store. | One raw bank string can resolve to only one merchant, or resolution is ambiguous. |
| A movement appears at most once per (product, bank-supplied movement identifier) when the bank supplies one. | Re-sync idempotency, primary route. |
| A movement appears at most once per content fingerprint, always. | Re-sync idempotency, fallback route for banks that supply no identifier. |
| Exactly one local profile record exists. | There is no sign-in; the profile is the device. |

### Deletion behaviour

| Operation | Guaranteed effect |
| --- | --- |
| Disconnect a bank | Nothing is deleted. The connection is marked and its credentials are removed from the secure store. |
| Remove a connection record (full local wipe only) | Its products and their movements go with it. |
| Delete a category | Its movements move to the ✨ Otros of the same direction. No movement is deleted. A merchant default pointing at it is cleared; budget and recurring records for it are removed. |
| Delete a merchant | Its aliases go with it. Its movements survive and stop naming a merchant. |
| Delete a movement | Does not exist as a product operation. Exclusion is the only removal from analysis. |

### Questions the store must be able to answer efficiently

Each of these runs on a screen the person opens constantly, so the store must support it without
reading every movement:

| Question | Screen |
| --- | --- |
| How many movements still need a category (excluding ones already excluded)? | `home`, on every app open |
| What are this month's movements, newest first? | `transactions` |
| What is the total for this category over this period? | `dashboard` |
| Which movements belong to this merchant? | `merchant-edit` |
| Which banks can be connected right now? | `bank-picker` |
| What are my categories, in my chosen order, for this direction? | `settings-categories` |

### Money and precision

- Every money value is a whole number of minor units, in first-class fields and inside
  shape-varying data alike.
- No stored value representing money is a fractional or floating-point number anywhere.
- A partial inclusion amount is a money value and follows the same rule.

### Secrets

- No stored record holds a RUT, a password, a security answer or a token.
- A bank connection stores only the secure-store key name.
- A stored bank error message is a bank-facing diagnostic; it never carries credential material.
- Starter content and every committed snapshot used for checking are free of real credentials
  and real national IDs.

---

## Statuses / Enum Values

This item introduces no UI. Display labels are recorded here where the mockups already declare
them, so later items do not invent divergent copy; where the mockups declare none, the label is
owned by the item that first surfaces the value.

### Bank availability (`financial_institutions.scraper_status`)

| Code value | Display label | Description |
| --- | --- | --- |
| `available` | Disponible | The scraper supports this bank today. Only Banco de Chile in the MVP. |
| `coming_soon` | Próximamente | Listed in the picker but not selectable. |

### Connection state (`user_financial_institutions.status`)

| Code value | Display label | Description |
| --- | --- | --- |
| `active` | (no label; the connection is simply listed) | The connection syncs. |
| `inactive` | No label in the MVP — not reachable | Reserved for a future per-bank pause. |
| `disconnected` | Desconectado | Credentials removed; downloaded movements stay. |

**Valid transitions**: `active` → `disconnected` when the person disconnects the bank;
`disconnected` → `active` when they reconnect it. `inactive` is not reachable in the MVP.

### Sync state (`user_financial_institutions.sync_status`)

| Code value | Display label | Description |
| --- | --- | --- |
| `idle` | (not surfaced) | No sync has run in this app session. |
| `syncing` | Sincronizando… | A sync is in progress. |
| `ok` | Sincronizado hace … | The last attempt succeeded. |
| `error` | Error de sincronización | The last attempt failed; the last successful time is shown separately. |

**Valid transitions**: `idle` → `syncing`; `syncing` → `ok` or `error`; `ok` / `error` →
`syncing` on the next attempt.

### Sync failure reason (`user_financial_institutions.last_error_code`)

| Code value | Display label | Description |
| --- | --- | --- |
| `invalid_credentials` | Owned by the sync item | The bank rejected the credentials. |
| `session_closed` | Owned by the sync item | The bank ended the session mid-read. |
| `network` | Owned by the sync item | The bank site was unreachable. |
| `parse_failed` | Owned by the sync item | The bank's page did not match what the scraper expects. |

### Bank product type (`user_financial_products.type`)

| Code value | Display label | Description |
| --- | --- | --- |
| `checking` | Cuenta corriente | |
| `sight` | Cuenta vista | |
| `savings` | Cuenta de ahorro | |
| `credit_card` | Tarjeta de crédito | Carries cupo and disponible in shape-varying data. |
| `credit_line` | Línea de crédito | Carries cupo and disponible in shape-varying data. |

### Movement direction (`transactions.type`)

| Code value | Display label | Description |
| --- | --- | --- |
| `debit` | Never shown raw; the UI derives "Gasto" | Money out, as the bank classifies it. |
| `credit` | Never shown raw; the UI derives "Ingreso" | Money in, as the bank classifies it. |

### How a category was arrived at (`transactions.category_source`)

| Code value | Display label | Description |
| --- | --- | --- |
| `auto` | Categoría sugerida automáticamente | Suggested by the app; not confirmed by the person. |
| `user` | (shown as a confirmed category) | The person chose it. |
| `rule` | Owned by the merchant item | Applied from a merchant's default category. |

**Valid transitions**: `auto` or `rule` → `user` when the person confirms or changes the
category. `user` is never downgraded automatically.

### Review flag (`transactions.review_flag`)

| Code value | Display label | Description |
| --- | --- | --- |
| `review_later` | Revisar más tarde | Deliberately postponed. |
| `uncertain` | No recuerdo | The person does not remember what the movement was. |
| (unset) | (no badge) | Nothing pending. |

### Exclusion reason (`transactions.exclusion_reason`)

| Code value | Display label | Description |
| --- | --- | --- |
| `personal_transfer` | Transferencia personal | Moving own money between own accounts. |
| `shared_expense` | Involucra a más personas | Paid for others; often paired with a partial inclusion instead. |
| `not_relevant` | Gasto no relevante | Not part of what the person wants to track. |
| `cash_withdrawal` | Retiro de efectivo | Counted where the cash is actually spent, not at the ATM. |
| `other` | Otro | Requires the free-text explanation. |

---

## Seed Data Contract

Starter content ships inside the app, is applied on first launch, and is refreshed on update
under Business Rules 13–16.

### Banks

Six banks, matching the `bank-picker` mockup. Each carries its display name, its brand colour
and short name as presentational data, and its logo reference.

| Identifier | Name | Availability | Short name | Brand colour |
| --- | --- | --- | --- | --- |
| `banco-de-chile` | Banco de Chile | Disponible | BCH | `#003da5` |
| `santander` | Banco Santander | Próximamente | SAN | `#ec0000` |
| `bci` | Banco BCI | Próximamente | BCI | `#00396a` |
| `banco-estado` | BancoEstado | Próximamente | EST | `#e30613` |
| `falabella` | Banco Falabella | Próximamente | FAL | `#78b833` |
| `itau` | Banco Itaú | Próximamente | ITA | `#1b3a6b` |

- All six are Chilean (`CL`).
- `banco-de-chile` must match the identifier the scraper package uses for the bank, because the
  connection flow passes it straight through.
- Only `banco-de-chile` is `available`; the other five are `coming_soon` and are not selectable.

### Categories

Sixteen starter categories, taken from the `categoryIcons` block of
[`design/tokens.json`](../../../../design/tokens.json), which is the single source for the
emoji. All sixteen are starter content (no owner), each carries a Spanish and an English name,
and each has an explicit display order within its direction, following the order the tokens file
declares.

Spending (order 1–10):

| Slug | Spanish name | English name | Emoji |
| --- | --- | --- | --- |
| `comida` | Comida | Food | 🍔 |
| `supermercado` | Supermercado | Groceries | 🛒 |
| `transporte` | Transporte | Transport | 🚗 |
| `compras` | Compras | Shopping | 📦 |
| `entretenimiento` | Entretenimiento | Entertainment | 🎬 |
| `servicios` | Servicios | Utilities | ⚡ |
| `salud` | Salud | Health | 💊 |
| `educacion` | Educación | Education | 🎓 |
| `hogar` | Hogar | Home | 🏠 |
| `otros-gasto` | Otros | Other | ✨ |

Income (order 1–6):

| Slug | Spanish name | English name | Emoji |
| --- | --- | --- | --- |
| `sueldo` | Sueldo | Salary | 💼 |
| `freelance` | Freelance | Freelance | 💻 |
| `ingresos-extra` | Ingresos extra | Extra income | 💰 |
| `inversiones` | Inversiones | Investments | 📈 |
| `bonos` | Bonos | Bonuses | 🎊 |
| `otros-ingreso` | Otros | Other | ✨ |

- The tokens file names the fallback category `otros` in both directions. Because slugs are
  unique across the whole store, the two are seeded as `otros-gasto` and `otros-ingreso`. Both
  display as "Otros"; the direction tabs keep them unambiguous. The other fourteen slugs are
  already distinct across directions and are seeded unchanged.
- The tokens file also defines an `uncategorized` glyph (❓). That is the UI's marker for a
  movement with no category at all — it is **not** seeded as a category.
- Display order is per direction, because the categories screen shows spending and income in
  separate tabs.

### Merchants

A starter list of well-known Chilean merchants so the first categorization session already has
suggestions. At minimum: Líder, Jumbo, Uber, Copec and Netflix.

- Each starter merchant carries at least one alias pattern drawn from how these merchants
  actually appear on a Chilean bank statement.
- Each carries a default category, referencing a starter category by slug.
- Chilean chains are marked `CL`; international ones carry no country, per the data model.
- All are starter content (no owner) and are subject to Business Rules 13–16.

### Settings keys

This item creates the settings store and writes two keys: the applied version of the stored
shape (`schema_version`) and the first-launch timestamp (`first_launch_at`). The remaining MVP
keys named in the data model — `onboarding_completed`, `reminder_enabled`, `reminder_time`,
`reminder_days`, `last_categorization_session_at` — are written by the items that own those
features; this item only guarantees the store exists and holds arbitrary keys without a change
to the stored shape.

---

## Operational Visibility

- **Applied version**: the version of the stored shape is readable from the store itself and is
  the single answer to "what shape is this person's data in".
- **Update failure**: a failed change to the stored shape is surfaced rather than swallowed, and
  is attributable to the specific change that failed. The store is never deleted to recover, and
  the recorded version stays at the last fully applied version.
- **Local reset (development only)**: `Ajustes → Acerca de → Reset local database` exists in
  development builds only and never in a store build.
- **No credential in any diagnostic**: nothing this item stores or emits — including a stored
  bank error message — carries credential material. Logging of stored data must not be able to
  print a credential, because none is stored.
- **No telemetry**: this item introduces no analytics, crash reporting or remote logging. The
  person's data does not leave the device.

---

## Acceptance Criteria

- [ ] **AC1.** On a device with no prior data, launching the app creates every kind of record the
      product uses and applies all starter content, with no set-up step asked of the person and
      no visible error.
- [ ] **AC2.** After that first launch, the six banks of the
      [Seed Data Contract](#banks) are present with exactly one marked available
      (`banco-de-chile`), the sixteen starter categories are present with the slugs listed under
      [Categories](#categories), and the starter merchants are present, each with at least one
      alias and a default category.
- [ ] **AC3.** The `uncategorized` glyph from the design tokens is not present as a category
      record.
- [ ] **AC4.** No stored value that represents money is fractional or floating-point anywhere,
      including inside shape-varying data. A record whose shape-varying data carries a balance
      or credit limit stores it as a whole number of minor units.
- [ ] **AC5.** No stored record, no piece of starter content and no committed snapshot contains a
      national ID, a password, a security answer or a token. A bank connection holds only the
      name of the secure-store key.
- [ ] **AC6.** Storing the same recorded bank response twice leaves the stored movement count
      unchanged, both for a response that carries bank-supplied movement identifiers and for one
      that does not.
- [ ] **AC7.** Storing a bank response again over movements the person has categorized, noted,
      flagged for review, excluded with a reason and note, and partially included leaves every
      one of those person-owned values exactly as the person set them, while bank-owned values
      are refreshed.
- [ ] **AC8.** Deleting a spending category moves every movement filed under it to the category
      with slug `otros-gasto`; deleting an income category moves them to `otros-ingreso`. No
      movement is deleted, and the operation either completes fully or leaves everything
      unchanged.
- [ ] **AC9.** Neither ✨ Otros category can be deleted, in either direction.
- [ ] **AC10.** Deleting a category clears the default category of any merchant that pointed at
      it, and removes any budget or recurring record that pointed at it. No merchant and no
      movement is deleted.
- [ ] **AC11.** A category's displayed name resolves to the name for the device's full locale
      tag when present, otherwise for its language, otherwise Spanish. On a device set to an
      unsupported locale, every starter category shows its Spanish name; on an English device,
      its English name.
- [ ] **AC12.** The check command applies the full change history to an empty store and the
      result matches the declared shape exactly, with no pending difference.
- [ ] **AC13.** The check command applies the pending change set to every committed snapshot of a
      previously released store and asserts that no record is lost and no person-owned value is
      altered. With only one version released, it asserts the same against a snapshot at the
      current version and that re-application changes nothing.
- [ ] **AC14.** A deliberate non-additive change — removing a kind of record, removing or
      renaming a field, changing a field's type, or making an existing field mandatory — makes
      the check command fail and names what would be lost. Reverting it makes the check pass.
- [ ] **AC15.** The applied version of the stored shape is recorded under `schema_version` and,
      after a fresh install, equals the version this build expects.
- [ ] **AC16.** If applying a change to the stored shape fails, the store is not deleted or
      recreated, the recorded version stays at the last fully applied version, and the failure is
      surfaced rather than swallowed.
- [ ] **AC17.** Re-running the starter content over a store where the person has renamed a
      starter category, changed its emoji, reordered it, deleted a starter merchant and created
      their own category and merchant leaves all of those exactly as the person left them: no
      overwrite, no resurrection, no duplicate.
- [ ] **AC18.** Re-running the starter content when a new starter record has been added in a
      later app version inserts that record and nothing else.
- [ ] **AC19.** A failed starter-content run leaves the store exactly as it was before the run.
- [ ] **AC20.** The shared definition of which movements count and at what value exists in
      exactly one place, and every aggregate in this item reads through it. A search of the
      codebase finds no second statement of the exclusion or partial-inclusion condition.
- [ ] **AC21.** Every guarantee under
      [Identity and uniqueness](#identity-and-uniqueness) is enforced by the store itself: a
      direct attempt to create the duplicate is rejected even when the calling code omits its own
      check.
- [ ] **AC22.** Every guarantee under [Deletion behaviour](#deletion-behaviour) holds, including
      that disconnecting a bank deletes nothing and that removing a merchant leaves its movements
      in place.
- [ ] **AC23.** Every question under
      [Questions the store must be able to answer efficiently](#questions-the-store-must-be-able-to-answer-efficiently)
      is answerable without reading every stored movement.
- [ ] **AC24.** The test suite for this item runs entirely against an in-memory store, needs no
      simulator and no device, and runs as part of the repository's existing test command on
      every pull request.
- [ ] **AC25.** The generate command and the check command are available on the mobile workspace
      and are documented in the repository's command list.
- [ ] **AC26.** No screen, feature hook or shared package outside the app's database module
      issues a query or imports the query builder.
- [ ] **AC27.** This item introduces no network call, no export, no remote backup and no
      analytics or crash-reporting payload.
- [ ] **AC28.** The declared shape matches
      [`docs/project/4-database-model.md`](../../../project/4-database-model.md) record for
      record and field for field — including which fields are optional, which are references,
      which references are named after the record they point at, and which values live in
      shape-varying data. Any intentional difference is reflected in that document within the
      same change, so the two never disagree.

---

## Out of Scope (MVP)

- **Any UI.** No screen, sheet, list or setting is built here. The categories screen, the
  exclusion sheet, the bank picker and the dashboard are separate items; this item only makes
  their data possible.
- **Budgets and recurring transactions beyond their stored shape.** Both exist as records so the
  shape does not churn later. No screen, no rule, no calculation and no starter content for
  either.
- **Bank syncing and the scraper.** No sync runs here. This item defines and proves the storage
  guarantees the sync item depends on, using recorded bank responses.
- **Credential capture and secure storage.** Writing, reading and clearing bank credentials is a
  separate item. This item guarantees only that nothing about them is ever stored here.
- **Merchant resolution and category suggestion.** The alias records and the merchant default
  category exist; the matching and suggestion logic is a later item in the pure-rules package.
- **Automatic syncing on app open.** The product rule is that an active connection syncs when
  its last successful sync is over six hours old. There is no stored on/off switch for it and
  none is added; the stored shape supports the rule without pre-empting it, and a future per-bank
  control would be an additive change.
- **A "system category" marker.** Whether a category is starter content is already answered by
  it having no owner, and the fallback pair is found by slug. No extra flag is introduced.
- **Balance, mask, credit limit and available credit as first-class fields.** They vary by
  product type and are only ever read to render one row, so they stay in shape-varying data —
  still as whole minor units. A future "patrimonio total" would promote balance, which is an
  additive change.
- **A person's identity.** No sign-in, no account, no session, no authorization. The single
  local profile keeps a reserved, unused email field only so a future sync has an anchor.
- **Encryption of the store at rest.** The OS sandbox plus the device passcode is the MVP
  boundary; SQLCipher is tracked separately in the backlog.
- **Multi-currency.** The currency is a plain code, `CLP` in the MVP. No currency lookup, no
  conversion, no second currency.
- **Subcategories and Persons.** The parent-category reference exists and is unused; person
  records are not created at all.
- **Export, backup and multi-device sync.**
- **Device end-to-end coverage** for this item. Its verification is entirely in the automated
  test suite.

---

## Documented Conflicts

### Conflict 1 — which categories a person may delete

- [`docs/project/4-database-model.md`](../../../project/4-database-model.md) states that a
  category with no owner is a *system* category and that system categories cannot be deleted.
  Read literally, all sixteen starter categories are undeletable.
- The mockups show the opposite: `#screen=settings-categories&state=delete-confirm` deletes
  "🍔 Comida" — a starter category — and moves its five movements to ✨ Otros. Only ✨ Otros is
  labelled "no se puede eliminar".

**Resolution taken in this spec**: the undeletable set is the two ✨ Otros categories. Every
other category, starter or person-created, may be deleted and its movements re-parent (Business
Rules 17 and 18). This matches the mockups, matches the delete-confirm flow the acceptance
criteria in the work item already assume, and keeps the data model's actual mechanism — the
fallback is found by slug, ownership marks starter content — intact.

**Consequence this spec absorbs**: because a starter category can be removed, a later
starter-content refresh must not bring it back. That is Business Rule 15, and it is the reason
that rule exists at all.

**Human confirmation requested**: yes. If the product owner intends all sixteen starter
categories to be permanent, Business Rules 15, 17 and 18 and AC8, AC9 and AC17 change, and
`docs/project/4-database-model.md` should be amended either way so the two documents stop
disagreeing.

### Conflict 2 — none found between the work item brief and the data model

The brief and the data model agree on the excluded fields (no national ID, no auto-sync switch,
no system flag, no balance column), on the starter content, and on the acceptance criteria. The
brief is the older document; where it is less specific, the data model has been followed.

---

## Decision Log

Decisions taken while writing this spec without a synchronous human, resolved from the ground
truth documents. Each is listed so the product owner can revisit it.

| # | Decision | Basis | Confirmation requested |
| --- | --- | --- | --- |
| 1 | The two ✨ Otros categories are the only undeletable ones. | Mockup `delete-confirm` deletes a starter category; see [Conflict 1](#conflict-1--which-categories-a-person-may-delete). | Yes |
| 2 | A starter-content refresh never overwrites a person's edit and never resurrects a starter record they removed. | Follows from Decision 1 plus the editable name/emoji in `settings-categories`. The brief only said "refreshes seeded rows without touching user-created ones", which does not cover an edited or deleted starter row. | Yes — it implies the stored shape must be able to tell an edited or removed starter record apart, which the plan must provision for now rather than add later. |
| 3 | All sixteen starter categories carry both a Spanish and an English name. | The data model says "`es` (and `en` where known)"; the architecture doc makes `es` primary and `en` the fallback for all copy. Seeding Spanish only would make the locale-resolution acceptance criterion vacuous. | Yes — the MVP UI is Spanish-only, so English category names are only reachable on an English device. |
| 4 | Locale resolution is full tag, then language, then Spanish. | The data model says "reads the device locale and falls back to `es`" without defining the middle step; `es-CL` must not miss an `es` name. | No |
| 5 | Deleting a category clears a merchant's default category and removes budget and recurring records for it. | The domain rule covers movements only. Neither budgets nor recurring transactions have any UI in the MVP, so neither can hold data a person would miss; leaving a merchant with a dangling default would silently re-apply a deleted category. | Yes |
| 6 | Disconnecting a bank never deletes the connection record. | Required to reconcile the cascade in the data model with the mockup promise "Tus movimientos ya descargados se mantienen". | No |
| 7 | A movement the bank re-states with a changed amount or description is treated as a new movement when the bank supplies no identifier. | The alternative — overwriting by partial match — risks destroying a person's categorization, which is worse than a visible duplicate they can exclude. | Yes |
| 8 | The check command runs in two modes from day one, and a snapshot at version 1 is committed by this item. | Makes the brief's upgrade criterion exercisable before a second version exists; see [Deferral Note 1](#deferral-note-1--upgrade-checking-before-a-second-version-exists-resolved). | No |
| 9 | Bank identifiers for the five unavailable banks are provisional. | Only `banco-de-chile` must match the scraper today. The other five are display-only until their scrapers exist, and correcting one before it ships is an additive change. | No |
| 10 | Starter merchants are specified as a minimum set plus required properties, not as a fixed list. | The brief says "a starter list … (Líder, Jumbo, Uber, Copec, Netflix…)" with an explicit ellipsis. Fixing the exact list in the spec would make every future addition a spec change. | No |

---

## Brief Objective List

Discrete requirement bullets from work item #3, cross-checked against
[`docs/project/4-database-model.md`](../../../project/4-database-model.md).

1. A stored shape covering every kind of record in the data model — the profile, the bank
   catalogue, bank connections, bank products, categories, merchants, merchant aliases,
   movements, settings — plus budgets and recurring transactions as records with no UI.
2. References between records named after the record they point at.
3. Shape-varying data (assets, metadata, per-locale labels) where fields differ per row type or
   per locale; anything queried, sorted or filtered stays a first-class field.
4. Uniqueness and lookup support exactly as specified, including the one for movements that
   still need a category and are not excluded.
5. One shared definition of the inclusion rule — which movements count and at what value.
6. A mechanism that carries an existing store forward on app launch, recording the applied
   version under `schema_version`.
7. Starter content: banks (Banco de Chile available, five coming soon), the sixteen categories
   from the design tokens with Spanish names, and a starter Chilean merchant and alias list,
   keyed by stable identifier so re-running refreshes starter records without touching
   person-created ones.
8. A generate command and a check command on the mobile workspace.
9. Excluded from the stored shape: any national ID value or hash of it; any automatic-sync
   switch; any system-category flag; any balance, mask, credit limit or available credit as a
   first-class field.
10. Acceptance criteria from the brief: fresh install creates the shape and applies all starter
    content; amounts are whole minor units with nothing fractional anywhere including inside
    shape-varying data; the check command upgrades a snapshot from the previous version without
    data loss; the data tests run against an in-memory store in CI; deleting a category
    re-parents its movements to the ✨ Otros of the same direction found by slug; a category's
    displayed name resolves by device locale falling back to Spanish; no stored value is a RUT, a
    password or any other credential.

---

## Coverage Matrix

| Brief objective | Coverage |
| --- | --- |
| 1. Every kind of record, plus budgets and recurring with no UI | AC1, AC2, AC28; Business Rule 22; Out of Scope (budgets/recurring beyond their shape) |
| 2. References named after the record they point at | AC28 — a naming convention owned by the data model, which AC28 makes the declared shape conform to; Stored-Data Guarantees → Deletion behaviour |
| 3. Shape-varying data vs first-class fields | AC4, AC23, AC28; Business Rules 3, 22 |
| 4. Uniqueness and lookup support, including the "needs a category and not excluded" one | AC21, AC23, AC28; Stored-Data Guarantees → Identity and uniqueness, Questions the store must answer |
| 5. One shared definition of the inclusion rule | AC20; Business Rule 6; Use Case 6 |
| 6. Carry an existing store forward on launch; record the applied version | AC12, AC13, AC15, AC16; Business Rules 9–12; Use Case 2 |
| 7. Starter content, keyed by stable identifier, refreshing without touching person-created rows | AC2, AC3, AC17, AC18, AC19; Business Rules 13–16; Seed Data Contract |
| 8. Generate and check commands | AC25; Use Case 5 |
| 9a. No national ID value or hash | AC5; Business Rules 1, 2; Out of Scope |
| 9b. No automatic-sync switch | Out of Scope (automatic syncing) |
| 9c. No system-category flag | Out of Scope (system category marker); Business Rule 13 |
| 9d. No balance / mask / credit limit / available credit as first-class fields | AC4; Out of Scope (balance et al.); Business Rule 22 |
| 10a. Fresh install creates the shape and applies all starter content | AC1, AC2 |
| 10b. Whole minor units; nothing fractional anywhere, including inside shape-varying data | AC4; Business Rules 3, 4 |
| 10c. The check command upgrades a snapshot from the previous version without data loss | AC13, AC14; [Deferral Note 1](#deferral-note-1--upgrade-checking-before-a-second-version-exists-resolved) |
| 10d. Data tests run against an in-memory store in CI | AC24 |
| 10e. Deleting a category re-parents its movements to the ✨ Otros of the same direction, by slug | AC8, AC9, AC10; Business Rules 17, 18; Use Case 4 |
| 10f. Displayed name resolves by device locale, falling back to Spanish | AC11; Business Rule 19; Decisions 3 and 4 |
| 10g. No stored value is a RUT, a password or any other credential | AC5; Business Rules 1, 2; Stored-Data Guarantees → Secrets |
| Idempotent re-sync (data model gap 1; product non-negotiable 4) | AC6, AC7; Business Rules 7, 8; Use Case 3 |
| Additive-only changes to the stored shape (product non-negotiable 5) | AC14, AC16; Business Rules 9, 10, 12 |

---

## Deferral Notes

### Deferral Note 1 — Upgrade checking before a second version exists (RESOLVED)

**Objective wording**: "`db:check` applies migrations to a fixture DB from the previous version
without data loss" (work item #3, acceptance criteria).

**Rationale**: this item creates the *first* version of the stored shape. There is no previous
released version to upgrade from, so read literally the criterion cannot be exercised until a
second version exists — which would leave the single riskiest property of the product unproven
for however long that takes.

**Resolution**: the criterion is kept and split into what is provable now and what it becomes
later. From day one the check command (a) applies the full change history to an empty store and
asserts the result matches the declared shape with no pending difference, (b) applies the change
set to a committed snapshot of a store at the current version — containing starter content plus
representative person-owned data — and asserts that re-application loses nothing and alters
nothing, and (c) fails on any non-additive change. This item also commits the version-1 snapshot
and the comparison harness, so the second version's change set has a genuine previous-version
store to upgrade. See AC12, AC13 and AC14. **Human confirmation requested**: no — this
strengthens the criterion rather than narrowing it.

### Deferral Note 2 — Whether partial inclusion ships in the MVP

**Objective wording**: carried from the open questions of
[`docs/project/4-database-model.md`](../../../project/4-database-model.md): "whether partial
inclusion (#3) ships in the MVP".

**Rationale**: this is a UI question — whether the `categorize/advanced` sheet is built — not a
storage question. The stored shape carries a partial-inclusion amount either way, and the shared
inclusion rule already honours it. Leaving it out of the stored shape now would make adding it
later a change to the meaning of every historical total.

**Resolution**: the partial-inclusion amount and the inclusion rule that honours it are in scope
for this item; whether any screen lets a person set one is deferred to the categorization item.
This item's tests set it directly. **Human confirmation requested**: no — the deferral is of the
UI, which this item never had.

### Deferral Note 3 — The community merchant layer

**Objective wording**: carried from the same open questions: "whether the community-merchant
layer implies a server later — which would make the collapsed `merchants` table a migration
target".

**Rationale**: the community-suggestion layer shown in `merchant-edit` needs a server, and this
product has none. The data model already decided to collapse global and per-person merchants
into one kind of record distinguished by ownership.

**Resolution**: out of scope. Merchants are one kind of record, marked as starter content or
person-created. If a server ever ships, adding a community layer is an additive change: new
records referencing the existing merchant, not a reshaping of it. Recorded here so the decision
is not rediscovered. **Human confirmation requested**: no.
