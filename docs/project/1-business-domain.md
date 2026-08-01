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
| **The app itself** | Runs the scraper, resolves merchants, suggests categories and schedules reminders. Has no server-side counterpart in the MVP |

## Core Entities

### Bank connection
A link between the user and one financial institution on this device. Owns the sync lifecycle
(`idle → syncing → ok | error`) and points to the keychain entry holding the credentials. It
never stores the credentials themselves.

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
One merchant folds many raw strings (`MERPAGO*MERCADOLIBRE`, `ML CHILE SPA`) and carries a
default category applied to future movements.

### Transaction category
The user's spending taxonomy, split into expense and income. Seeded with a Chilean-flavored
default set; fully editable. One system category per direction (✨ Otros) acts as the fallback
and cannot be deleted.

## Business Rules

0. **There is no password.** Sign-in is an email address plus a one-time code.
   The only secret the product ever handles is the user's *bank* credential, and that never
   leaves the device.
1. **Credentials never leave the device.** They are written to `expo-secure-store` and read
   only by the scraper. They are never logged, never serialized into the database, and never
   sent over the network to anything but the bank's own site.
2. **One RUT per user.** From the second bank connection onward the RUT field is pre-filled and
   read-only. All connections belong to the same person.
3. **Bank data is never deleted, only excluded.** A user can exclude a movement from analysis
   (with a reason) but the record stays. "Eliminar" does not exist as a concept for scraped
   movements.
4. **A transaction counts toward totals and charts when `excluded_at IS NULL`**, at
   `COALESCE(included_amount, amount)`. This rule is implemented once and every aggregate reads
   through it.
5. **Re-syncing is idempotent.** A movement already stored must never be inserted twice —
   identified by the bank's id, or by a content hash when the bank provides none.
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
- Multi-device sync, and the community-sourced merchant suggestions that would require it
- Recurring-transaction detection, and Persons (transfers between known people)
