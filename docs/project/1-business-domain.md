# Business Domain

## Overview

**Finanzas** is a personal-finance app for people living in Chile. It reads a user's bank
movements, helps them categorize those movements in short sessions a few days a week, and
shows where their money actually goes.

The differentiator is **privacy by architecture**: bank credentials are entered, encrypted and
used entirely on the user's phone. Scraping runs in a hidden WebView on the device. No server
of ours ever sees a credential or a movement.

The engagement model is deliberately low-pressure: 1–3 minute sessions, a few days per week,
framed as small challenges with immediate positive feedback rather than a daily chore.

## Actors

| Actor | Description |
|-------|-------------|
| **User** | A person in Chile with at least one bank account. Owns the device, the credentials and the data |
| **Bank web app** | The bank's own online-banking site, driven by the on-device scraper. External, unversioned, and free to change without notice |
| **The app itself** | Runs the scraper, resolves merchants, suggests categories and schedules reminders. Has no server-side counterpart, and no user account |

## Core Entities

### Bank connection
A link between the user and one financial institution on this device. Owns the sync lifecycle
(`idle → syncing → ok | error`) and points to the keychain entry holding the credentials. It
never stores the credentials themselves. Disconnecting (settings, item #20) removes the keychain
entry and marks the connection `disconnected`; it is a status transition, never a row deletion —
the products and movements it owns are retained, coherent with BR3 (see the data model's
`user_financial_institutions` section for why deleting the row is not an option).

### Account
A financial product discovered by the scraper inside a connection: cuenta corriente, cuenta
vista, cuenta de ahorro, tarjeta de crédito, línea de crédito. Carries balance and, for credit
products, cupo and disponible.

### Transaction
One movement read from an account. Immutable in what the bank said (`raw_description`,
`amount`, `type`, date); mutable in what the user decides (category, note, exclusion, partial
inclusion). This split is the heart of the model — see [4-database-model.md](4-database-model.md).

### Merchant
The counterparty behind a transaction, resolved from the raw bank description through aliases.
One merchant folds many raw strings (`MERCADOLIBRE COMPRA`, `MERPAGO*MERCADOLIBRE`) and carries a
default category applied to future movements. `#screen=merchant-edit` (#14) is where a person
acts on this: renaming the merchant, folding an on-device-detected raw string into it — a
suggestion derived from the person's own movements, never a community source (there is no
backend) — and setting the default category. Setting the default never rewrites a category the
person already confirmed on a past movement; it only takes effect the next time a movement
resolves to this merchant.

### Transaction category
The user's spending taxonomy, split into expense and income. Seeded with a Chilean-flavored
default set; fully editable. One system category per direction (✨ Otros) acts as the fallback
and cannot be deleted.

## Business Rules

0. **There is no account and no sign-in.** The profile *is* the device. A local-first app with
   no server has nothing to authenticate against, and a code emailed by a client that also
   verifies it would be theatre. The only secret the product handles is the user's *bank*
   credential, and that never leaves the device. Sign-in screens exist in the mockups
   (`mvp: false`) for when multi-device sync makes identity mean something.
1. **Credentials never leave the device.** They are written to `expo-secure-store` and read
   only by the scraper. They are never logged, never serialized into the database, and never
   sent over the network to anything but the bank's own site.
2. **One RUT per user.** From the second bank connection onward the RUT field is pre-filled and
   read-only. All connections belong to the same person.
3. **Bank data is never deleted, only excluded.** A user can exclude a movement from analysis
   (with a reason) but the record stays. "Eliminar" does not exist as a concept for scraped
   movements. Re-including a movement (transaction detail, item #16) clears `excluded_at`,
   `exclusion_reason` and `exclusion_note` and returns it to every total and chart — still an
   `UPDATE`, never a delete. This governs the lifecycle of a movement *inside a living profile* —
   it does not describe the full local wipe (settings' "Borrar todos mis datos", item #19): that
   operation does not delete a row, it destroys the profile itself by deleting the SQLite file and
   every `expo-secure-store` credential key. No code path in the wipe issues a `DELETE` against
   any table, so this rule and the wipe never collide — they govern different objects.
4. **A transaction counts toward totals and charts when `excluded_at IS NULL`**, at
   `COALESCE(included_amount, amount)`. This rule is implemented once per layer — the SQL fragment
   in `apps/mobile/src/db/fragments.ts` for set-based queries, and `isIncludedInAnalysis` /
   `effectiveAmount` / `contributedAmount` in `@finanzas/shared-domain`'s `inclusion.ts` for
   in-memory plain objects — and every aggregate reads through one of the two.
5. **Re-syncing is idempotent.** A movement already stored must never be inserted twice —
   identified by the bank's id, or by a content hash when the bank provides none. Two identity
   guarantees hold on top of that (item #10): **direction is part of a movement's identity** — a
   charge and its identically-described refund on the same day for the same amount are two
   movements, never one overwriting the other — and **N indistinguishable movements reported in
   one read stay N** after a repeat sync, independent of the order the bank lists them in (a
   movement's position in a read's listing is never part of its cross-read identity).
6. **Categorization is never mandatory.** Every categorization screen offers "omitir",
   "revisar más tarde" and "no estoy seguro". The app nags gently through reminders, never by
   blocking.
7. **Deleting a category re-parents its transactions to ✨ Otros.** Never orphans, never
   cascades to transactions.
8. **Amounts are integers in minor units.** CLP has no cents; storing pesos as integers avoids
   float drift in every aggregate.

## Glossary

| Term | Meaning |
|------|---------|
| **RUT** | Rol Único Tributario — the Chilean national ID. Format `12.345.678-9`, includes a check digit |
| **Scraper** | The on-device WebView automation that logs into the bank site and reads products and movements |
| **Producto financiero** | The Chilean banking term for an account or card. "Producto" in the UI, `account` in code |
| **Cupo** | Credit limit on a card or credit line |
| **Excluir** | Remove a movement from analysis without deleting it |
| **Desafío / Etapa** | A short guided session (categorize N movements). The engagement unit |
| **Comercio** | Merchant |
| **Movimiento** | Transaction, in user-facing copy |

## Out of Scope

Explicitly **not** in the product, MVP or otherwise:

- Moving money. The app never initiates a payment, transfer or trade. It reads only
- Personalized investment or tax advice
- Sharing finances between people (a joint account is read as one user's account)

Not in the **MVP**, but in the product vision — present in the mockups, flagged `mvp: false`:

- **Presupuestos** and **Planificación de vida**
- **Beneficios / Descuentos** and a Premium tier
- Banks other than **Banco de Chile**
- User accounts and sign-in — `auth` and `verify-code` are drawn but flagged `mvp: false`;
  they ship with sync
- Multi-device sync, and the community-sourced merchant suggestions that would require it
- Recurring-transaction detection, and Persons (transfers between known people)
