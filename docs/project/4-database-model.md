# Database Model

Local-first SQLite schema for **Finanzas**. Validated against the 36 mockup screens in
[`design/mockups/mobile/`](../../design/mockups/mobile/) and the original domain model
(`Domain Models - Domain Model.jpg`, in the idea vault).

**Naming follows the original domain model.** Where an earlier draft of this document invented
names (`bank_connections`, `accounts`), the original entity names are used instead, and foreign
keys are named after the table they reference.

---

## Overview

| Decision | Value |
|----------|-------|
| Engine | **SQLite** via `expo-sqlite` (device-local, no server) |
| Access layer | **Drizzle ORM** + `drizzle-kit` migrations bundled in the app |
| Hosting | None. The database file lives in the app sandbox |
| Multi-tenancy | None. Single local profile, one row in `users`. No account, no sign-in |
| Secrets | **Never in SQLite.** Bank credentials *and the RUT* live in `expo-secure-store` (iOS Keychain / Android Keystore) |
| Money | Integer **minor units** (CLP has no cents → store pesos as integers). Never floats |
| Dates | ISO-8601 `TEXT` in UTC; a `date_local` `TEXT` (`YYYY-MM-DD`) column carries the bank's calendar day for grouping |
| Shape-varying data | JSON `TEXT` columns (`assets`, `metadata`, `labels`) where fields differ per row type or per locale. Anything the app **queries, sorts or filters on** stays a real column |

The original domain model was designed for a server-side relational database. It survives the
port largely intact — the entities and relationships are right. The gaps below are all about
things the UI does that the model never described.

---

## Validation verdict

**The original model covers roughly 70% of what the MVP screens need.** Eight gaps are blocking,
and five entities are correct but out of MVP scope.

### Blocking gaps

| # | Gap | Where the UI needs it | Resolution |
|---|-----|----------------------|------------|
| 1 | **No re-sync identity.** Nothing stops a movement being inserted twice on every scrape. | Every sync after the first (`bank-syncing`) | `transactions.external_id` + `UNIQUE(user_financial_product_id, external_id)`. The scraper already emits a per-bank `Transaction.id`. Fallback `dedup_hash` when a bank gives no id |
| 2 | **No exclusion model.** The model can only null a category. | `categorize/exclude-sheet`, `transaction-detail/excluded`, the "Mostrar excluidas" filter | `transactions.excluded_at`, `exclusion_reason`, `exclusion_note` |
| 4 | **No categorization provenance.** The UI distinguishes *sugerida automáticamente* from *confirmada por ti*. | `transaction-detail/categorized` ("Categoría sugerida automáticamente"), the suggestion chip in `categorize` | `transactions.category_source` (`auto` \| `user` \| `rule`) |
| 5 | **No "review later" state.** | `categorize/not-sure` — "Revisar más tarde", "No recuerdo" | `transactions.review_flag` (`review_later` \| `uncertain` \| null) |
| 6 | **User note vs bank description conflated.** The model has one `description`. | `transaction-detail` shows the raw bank string **and** an editable "Nota" | `raw_description` (immutable, from the bank) + `note` (user) |
| 7 | **No way to resolve a merchant from a bank description.** `Merchants` exists, but nothing folds `MERPAGO*MERCADOLIBRE` and `ML CHILE SPA` into one merchant. | `merchant-edit/suggestions` — "Posibles nombres legales (4)", each with its own movement count | `merchant_aliases(merchant_id, raw_pattern, match_type, match_count)` |
| 8 | **No sync history.** Only `last_sync_at` + `sync_status`. | `bank-review/error` — "Última sincronización **exitosa**: ayer 21:14" plus an error message | `last_success_at`, `last_error_code`, `last_error_message` on `user_financial_institutions` |
| 9 | **No reminder settings, no onboarding state.** | `notifications-schedule`, `settings-notifications`, the challenge hero on `home` | `app_settings` key-value table |

### Non-blocking findings

| Finding | Decision |
|---------|----------|
| `Transactions.related_entity_type` / `related_entity_id` is polymorphic (merchant \| person). | **Replaced** by an explicit nullable `merchant_id` FK. Merchant is the only counterparty the MVP resolves, and polymorphic FKs cannot be enforced in SQLite. A `person_id` column is added when Persons ships |
| `FinancialProduct` (catalog) vs `UserFinancialProduct` (instance) is a two-table split. | **Collapsed into `user_financial_products`.** A scraped product *is* discovered per user; there is no upstream catalog to join against. The split earns its keep only with a server |
| `FinancialInstitutions` vs `UserFinancialInstitutions`. | **Kept split**, with the original names. The institution catalog is genuinely shared, versionable, seedable data; the user's link to it is not |
| `Merchants` (global) vs `UserMerchants` (per-user override). | **Collapsed into `merchants`**, distinguished by `user_id` — null = seeded, set = created by the user. Same pattern as `transaction_categories`. The community-suggestion layer shown in `merchant-edit` needs a server and is deferred |
| `currency_code` FKs to a `currencies` table absent from the diagram. | **Kept as a plain `TEXT` code**, `'CLP'` for the MVP. No lookup table until a second currency exists |
| `TransactionCategories` has no ordering and no stable identity for seeds. | Added `sort_order` (the ☰ drag handles in `settings-categories`) and `slug` (stable seed identity; also how the ✨ Otros fallback is found). "Cannot delete" is `user_id IS NULL`, so no extra flag is needed |
| `Transactions.type` is `debit`/`credit` (bank vocabulary). | **Kept** — it is what the scraper emits. The UI's income/expense reads from the category's `income` together with `type` |
| `AuthenticationMethods` is a separate table. | **Dropped.** The MVP has no sign-in at all, so there is nothing to model. `users.email` is kept nullable for when identity ships with sync |
| Storing the RUT in the database. | **Not stored at all.** See [`users`](#users) — the RUT is credential material and belongs in `expo-secure-store` |

### Correct but out of MVP scope

`user_budgets`, `user_recurring_transactions`, `persons` / `user_persons`, the
community-merchant layer, and **partial inclusion**. `user_budgets` and `user_recurring_transactions` ship as **tables
with no UI** so the schema does not churn later; Persons is not created at all.

---

## Schema Overview

```
financial_institutions 1──N user_financial_institutions 1──N user_financial_products
                                                                        │
                                                                        │ 1──N
                                                                        ▼
                                    transaction_categories 1──N   transactions
                                              │                         ▲
                                              │                         │
                                    merchants ┴──────────────────────N──┘
                                        │
                                        └──N merchant_aliases

users 1──1 app_settings                                  (single local profile)
transaction_categories 1──N user_budgets                 [no UI in MVP]
transaction_categories 1──N user_recurring_transactions  [no UI in MVP]
```

---

## Tables

### `users`

Exactly one row, created on first launch. There is no sign-in — the profile *is* the device.
The row exists so a future server sync has an anchor.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID, generated locally on first launch |
| `email` | `TEXT` | **Nullable and unused in the MVP.** Reserved for when sign-in ships with sync |
| `first_name` | `TEXT` | Not collected; reserved |
| `last_name` | `TEXT` | Not collected; reserved |
| `national_id_type` | `TEXT NOT NULL DEFAULT 'rut'` | |
| `country_code` | `TEXT NOT NULL DEFAULT 'CL'` | |
| `created_at` | `TEXT NOT NULL` | |

**There is no `national_id_value` column. The RUT is not stored in SQLite at all.**

The goal — no real identifiers in the database — is right. Hashing was considered and rejected
as the way to reach it: there are roughly 30 million valid Chilean RUTs and the check digit is
derivable, so an unsalted hash is one rainbow table away from plaintext. It would look like
protection without being any. A salted hash works, but the salt has to live in the keychain —
at which point the RUT may as well live there too.

So it does. The RUT is *credential material*: it is half of what logs into the bank, and it is
already written to `expo-secure-store` with the password. A second copy in SQLite is a second
thing to protect for no gain.

Consequences, all satisfied by secure storage:

- `bank-credentials/rut-locked` pre-fills and locks the RUT from the second connection onward —
  read from the first connection's keychain entry.
- `settings-account` displays the RUT — same source.
- "All connections share one RUT" is checked against that same stored value.

### `financial_institutions`

Seeded catalog of banks.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | `banco-de-chile` — matches the scraper's `bankId` |
| `country_code` | `TEXT NOT NULL` | `CL` |
| `name` | `TEXT NOT NULL` | "Banco de Chile" |
| `assets` | `TEXT` (JSON) | Key → asset URL: `{"logo":"…","icon":"…","card_background":"…"}`. Bundled assets use an `asset://` scheme, remote ones an https URL |
| `metadata` | `TEXT` (JSON) | Everything presentational or bank-specific that is never queried: `{"short_name":"BCH","brand_color":"#003da5","support_url":"…"}` |
| `scraper_status` | `TEXT NOT NULL` | `available` \| `coming_soon` — **stays a real column** because `bank-picker` filters on it |

### `user_financial_institutions`

The user's link to one institution on this device. **Holds no secrets** — only the keychain key.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `financial_institution_id` | `TEXT NOT NULL REFERENCES financial_institutions(id)` | |
| `status` | `TEXT NOT NULL` | `active` \| `inactive` \| `disconnected` |
| `credentials_key` | `TEXT NOT NULL` | `expo-secure-store` key, e.g. `bank_creds:banco-de-chile`. **The value never touches SQLite** |
| `sync_status` | `TEXT NOT NULL` | `idle` \| `syncing` \| `ok` \| `error` |
| `last_sync_at` | `TEXT` | Any attempt |
| `last_success_at` | `TEXT` | Gap #8 — `bank-review` shows this separately |
| `last_error_code` | `TEXT` | `invalid_credentials` \| `session_closed` \| `network` \| `parse_failed` |
| `last_error_message` | `TEXT` | Shown in `bank-review/error` |
| `created_at` | `TEXT NOT NULL` | |

Unique: `(financial_institution_id)` — one connection per bank.

**No `auto_sync` column.** Syncing is implicit: an `active` connection syncs on app open when
its last successful sync is more than six hours old. The per-connection toggle has been removed
from `#screen=bank-review` so the mockups and the schema agree. If per-bank control is wanted
later it belongs here as a real column.

### `user_financial_products`

Financial products discovered by the scraper. Collapses `FinancialProduct` +
`UserFinancialProduct`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `user_financial_institution_id` | `TEXT NOT NULL REFERENCES user_financial_institutions(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT NOT NULL` | The scraper's `Product.financialProductId` |
| `type` | `TEXT NOT NULL` | `checking` \| `sight` \| `savings` \| `credit_card` \| `credit_line`. **A real column** — the transaction filter groups by it |
| `name` | `TEXT NOT NULL` | "Cuenta corriente" |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `assets` | `TEXT` (JSON) | Optional per-product imagery |
| `metadata` | `TEXT` (JSON) | Everything that varies by product type: `{"balance":1842300,"mask":"4821","credit_limit":2500000,"available_credit":2088000}`. Amounts inside JSON are still integer minor units |
| `updated_at` | `TEXT NOT NULL` | |

Unique: `(user_financial_institution_id, external_id)`.

> Balance and cupo living in `metadata` means they cannot be summed or sorted in SQL. That is
> acceptable today — `bank-review` reads them one product at a time and no screen aggregates
> balances. A future "patrimonio total" would need `balance` promoted to a column.

### `transaction_categories`

Follows the original model, so names can be per-locale.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `slug` | `TEXT NOT NULL UNIQUE` | `comida`, `otros-gasto`, `otros-ingreso`. Stable identity across seed updates, and how the ✨ Otros fallback is found |
| `income` | `INTEGER NOT NULL` | 0 = expense, 1 = income. Drives the tabs in `settings-categories` |
| `labels` | `TEXT NOT NULL` (JSON) | Name per locale: `{"es":"Comida","en":"Food"}`, seeded from `tokens.json → categoryLabels`. The app reads the device locale and falls back to `es` |
| `assets` | `TEXT` (JSON) | `{"emoji":"🍔"}` from `tokens.json → categoryIcons`; an icon URL can join it without a migration |
| `user_id` | `TEXT REFERENCES users(id)` | **Null = system category.** System categories cannot be deleted; the ✨ Otros pair are system |
| `parent_category_id` | `TEXT REFERENCES transaction_categories(id)` | Reserved for subcategories; unused in MVP |
| `sort_order` | `INTEGER NOT NULL` | Drag handles in `settings-categories`. A real column because it is an `ORDER BY` |
| `created_at` | `TEXT NOT NULL` | |

### `merchants`

Follows the original model.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | Display name — "MercadoLibre Chile" |
| `assets` | `TEXT` (JSON) | Logo / icon URLs |
| `transaction_category_id` | `TEXT REFERENCES transaction_categories(id)` | Default category applied to future movements (`merchant-edit`) |
| `country_code` | `TEXT` | **Null = international.** `CL` for Chilean-only merchants |
| `user_id` | `TEXT REFERENCES users(id)` | Null = seeded; set = created by the user |
| `created_at` | `TEXT NOT NULL` | |

### `merchant_aliases`

Gap #7 — how a merchant is found from what the bank actually wrote.

This is a separate table rather than a field on `merchants` because the relationship is
genuinely one-to-many *and the UI treats it as a list*: `merchant-edit/suggestions` shows
"Posibles nombres legales (4)" with a **per-alias movement count** and a per-alias action.
A JSON array on `merchants` could not be indexed, counted or updated row by row.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `merchant_id` | `TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE` | |
| `raw_pattern` | `TEXT NOT NULL` | Normalized fragment of the bank description, e.g. `MERCADOLIBRE COMPRA` |
| `match_type` | `TEXT NOT NULL DEFAULT 'prefix'` | `prefix` \| `contains` \| `exact` |
| `match_count` | `INTEGER NOT NULL DEFAULT 0` | "12 movimientos" in `merchant-edit/suggestions` |

Unique: `(raw_pattern)`. Indexed on `(merchant_id)`.

### `transactions`

The core table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `user_financial_product_id` | `TEXT NOT NULL REFERENCES user_financial_products(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT` | Gap #1 — the bank's id |
| `dedup_hash` | `TEXT NOT NULL` | `sha256(user_financial_product_id, date_local, amount, raw_description)` — fallback identity |
| `amount` | `INTEGER NOT NULL` | Minor units, **always positive**. Direction comes from `type` |
| `type` | `TEXT NOT NULL` | `debit` \| `credit` — the scraper's vocabulary |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `occurred_at` | `TEXT NOT NULL` | ISO-8601 UTC |
| `date_local` | `TEXT NOT NULL` | `YYYY-MM-DD` — month grouping in `transactions` |
| `raw_description` | `TEXT NOT NULL` | Gap #6 — immutable, from the bank |
| `note` | `TEXT` | Gap #6 — user-editable |
| `merchant_id` | `TEXT REFERENCES merchants(id)` | Resolved counterparty |
| `transaction_category_id` | `TEXT REFERENCES transaction_categories(id)` | Null = "Necesita categorización" |
| `category_source` | `TEXT` | Gap #4 — `auto` \| `user` \| `rule` |
| `review_flag` | `TEXT` | Gap #5 — `review_later` \| `uncertain` |
| `excluded_at` | `TEXT` | Gap #2 — non-null = out of every total and chart |
| `exclusion_reason` | `TEXT` | `personal_transfer` \| `shared_expense` \| `not_relevant` \| `cash_withdrawal` \| `other` |
| `exclusion_note` | `TEXT` | Free text when reason = `other` |
| `included_amount` | `INTEGER` | **No UI in the MVP** — always null. Kept as a column so the inclusion rule below never has to change when partial inclusion ships |
| `metadata` | `TEXT` (JSON) | Bank-specific extras the scraper returns |
| `is_manual` | `INTEGER NOT NULL DEFAULT 0` | Added by hand, not scraped |
| `created_at` | `TEXT NOT NULL` | |
| `updated_at` | `TEXT NOT NULL` | |

Unique: `(user_financial_product_id, external_id)` where `external_id IS NOT NULL`;
`(dedup_hash)`.
Indexes: `(date_local DESC)`, `(transaction_category_id)`, `(merchant_id)`, plus a partial
index on `transaction_category_id IS NULL AND excluded_at IS NULL` — the "por categorizar"
count on `home` runs on every app open.

**Analysis rule (single source of truth):** a transaction counts toward totals and charts when
`excluded_at IS NULL`, at `COALESCE(included_amount, amount)`.

### `app_settings`

Gap #9. Key-value; avoids a migration per new preference.

| Column | Type |
|--------|------|
| `key` | `TEXT PK` |
| `value` | `TEXT NOT NULL` (JSON) |

MVP keys: `onboarding_completed`, `reminder_enabled`, `reminder_time`, `reminder_days`,
`last_categorization_session_at`, `schema_version`, `first_launch_at`.

### `user_budgets`, `user_recurring_transactions`

Created by the migrations, **no UI in the MVP**. Columns follow the original domain model
(`period`, `amount`, `transaction_category_id`, plus `income` / `description` / `due_day` for
recurring).

---

## JSON columns: when to use one

`assets`, `metadata` and `labels` exist because those fields differ per row type or per locale.
The rule for deciding:

| The app… | Then |
|----------|------|
| filters, sorts, joins or aggregates on it | **Real column** — `scraper_status`, `type`, `sort_order`, `date_local`, `amount` |
| only reads it to render one row | JSON is fine — `balance`, `mask`, `credit_limit`, `brand_color`, `short_name` |
| needs it per locale | `labels` JSON |
| needs a URL to an image | `assets` JSON |

Promoting a JSON field to a real column later is an additive migration, so this is a cheap
decision to revisit. Demoting a column is not.

---

## Migrations

Drizzle migrations bundled with the app, run on first launch after an update.
`app_settings.schema_version` records the applied version.

```bash
pnpm --filter @finanzas/mobile db:generate   # generate a Drizzle migration
pnpm --filter @finanzas/mobile db:check      # apply migrations to a fixture DB
```

Because the database is on-device, **a bad migration is unrecoverable for that user**. Every
migration must be additive (new tables, new nullable columns) and covered by a test that opens
a seeded fixture DB from the previous version. There is no "reset production" command.

Local reset during development: delete and reinstall the app, or run the in-app
`Ajustes → Acerca de → Reset local database` action available in dev builds only.

## Seed Data

Shipped with the app, applied on first launch:

1. `financial_institutions` — Banco de Chile (`available`), plus Santander, BCI, BancoEstado,
   Falabella and Itaú as `coming_soon` (the `bank-picker` list), each with `assets` and
   `metadata` populated.
2. `transaction_categories` — 10 expense + 6 income, `user_id` null, seeded from
   **`design/tokens.json`**: the emoji from `categoryIcons` into `assets`, and the names from
   **`categoryLabels`** into `labels`, which carries both `es` and `en` for all 16. Both files
   are keyed by the same slug, and ✨ Otros appears in each direction.
3. `merchants` + `merchant_aliases` — a starter list of common Chilean merchants
   (Líder, Jumbo, Uber, Copec, Netflix…) so the first categorization session already has
   suggestions. `country_code` is `CL` for local chains, null for international ones.

Seeds are keyed by `slug` / `id`, so re-running them after an app update refreshes seeded rows
without touching user-created ones.

```bash
pnpm --filter @finanzas/mobile db:seed       # regenerate the bundled seed fixtures
```

## Open questions

Tracked in [`design/mockups/mobile/INVENTORY.md`](../../design/mockups/mobile/INVENTORY.md):
whether the community-merchant layer implies a server later, which would make the collapsed
`merchants` table a migration target.

**Resolved:** partial inclusion is **out of the MVP**. `included_amount` still ships as a
column and the inclusion rule still reads `COALESCE(included_amount, amount)` — the column is
simply always null, so the day the feature lands nothing about the rule or the aggregates has
to change. `#screen=categorize&state=advanced` stays drawn, flagged `mvp: false`.
