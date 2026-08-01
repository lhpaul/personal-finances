# Database Model

Local-first SQLite schema for **Finanzas**. Validated against the 36 mockup screens in
[`design/mockups/mobile/`](../../design/mockups/mobile/) and the original domain model
(`Domain Models - Domain Model.jpg`, in the idea vault).

---

## Overview

| Decision | Value |
|----------|-------|
| Engine | **SQLite** via `expo-sqlite` (device-local, no server) |
| Access layer | **Drizzle ORM** + `drizzle-kit` migrations bundled in the app |
| Hosting | None. The database file lives in the app sandbox |
| Multi-tenancy | None. Single local profile, one row in `users`. No account, no sign-in |
| Secrets | **Never in SQLite.** Bank credentials live in `expo-secure-store` (iOS Keychain / Android Keystore) |
| Money | Integer **minor units** (CLP has no cents → store pesos as integers). Never floats |
| Dates | ISO-8601 `TEXT` in UTC; a `date_local` `TEXT` (`YYYY-MM-DD`) column carries the bank's calendar day for grouping |

The original domain model was designed for a server-side relational database. It survives the
port largely intact — the entities and relationships are right. The gaps below are all about
things the UI does that the model never described.

---

## Validation verdict

**The original model covers roughly 70% of what the MVP screens need.** Nine gaps are blocking,
and five entities are correct but out of MVP scope.

### Blocking gaps

| # | Gap | Where the UI needs it | Resolution |
|---|-----|----------------------|------------|
| 1 | **No re-sync identity.** Nothing stops a movement being inserted twice on every scrape. | Every sync after the first (`bank-syncing`) | `transactions.external_id` + `UNIQUE(account_id, external_id)`. The scraper already emits a per-bank `Transaction.id`. Fallback `dedup_hash` when a bank gives no id |
| 2 | **No exclusion model.** The model can only null a category. | `categorize/exclude-sheet`, `transaction-detail/excluded`, the "Mostrar excluidas" filter | `transactions.excluded_at`, `exclusion_reason`, `exclusion_note` |
| 3 | **No partial inclusion.** | `categorize/advanced` — "compartido con otras personas", 50% / monto | `transactions.included_amount` (null = full) |
| 4 | **No categorization provenance.** The UI distinguishes *sugerida automáticamente* from *confirmada por ti*. | `transaction-detail/categorized` ("Categoría sugerida automáticamente"), the suggestion chip in `categorize` | `transactions.category_source` (`auto` \| `user` \| `rule`) |
| 5 | **No "review later" state.** | `categorize/not-sure` — "Revisar más tarde", "No recuerdo" | `transactions.review_flag` (`review_later` \| `uncertain` \| null) |
| 6 | **User note vs bank description conflated.** The model has one `description`. | `transaction-detail` shows the raw bank string **and** an editable "Nota" | `raw_description` (immutable, from the bank) + `note` (user) |
| 7 | **No merchant alias mapping.** The model has `Merchants` but no way to fold `MERPAGO*MERCADOLIBRE` and `ML CHILE SPA` into one merchant. | `merchant-edit/suggestions` — "Posibles nombres legales (4)" | `merchant_aliases(merchant_id, raw_pattern)` |
| 8 | **No sync history.** Only `last_sync_at` + `sync_status`. | `bank-review/error` — "Última sincronización **exitosa**: ayer 21:14" plus an error message | `last_success_at`, `last_error_code`, `last_error_message` on `bank_connections` |
| 9 | **No reminder settings, no onboarding state.** | `notifications-schedule`, `settings-notifications`, the challenge hero on `home` | `app_settings` key-value table |

### Non-blocking findings

| Finding | Decision |
|---------|----------|
| `Transactions.related_entity_type` / `related_entity_id` is polymorphic (merchant \| person). | **Replaced** by an explicit nullable `merchant_id` FK. Merchant is the only counterparty the MVP resolves, and polymorphic FKs cannot be enforced in SQLite. A `person_id` column is added when Persons ships |
| `FinancialProduct` (catalog) vs `UserFinancialProduct` (instance) is a two-table split. | **Collapsed into `accounts`.** A scraped product *is* discovered per user; there is no upstream catalog to join against. The split earns its keep only with a server |
| `FinancialInstitutions` vs `UserFinancialInstitutions`. | **Kept split** as `financial_institutions` (seeded catalog) + `bank_connections` (this device's link). The catalog is genuinely shared, versionable data |
| `Merchants` (global) vs `UserMerchants` (per-user override). | **Collapsed into `merchants`** with `is_user_defined`. The community-suggestion layer shown in `merchant-edit` needs a server and is deferred |
| `currency_code` FKs to a `currencies` table absent from the diagram. | **Kept as a plain `TEXT` code**, `'CLP'` for the MVP. No lookup table until a second currency exists |
| `TransactionCategories` has no ordering and no "cannot delete" marker. | Added `sort_order` (the ☰ drag handles in `settings-categories`) and `is_system` (the ✨ Otros fallback) |
| `Transactions.type` is `debit`/`credit` (bank vocabulary). | **Kept** — it is what the scraper emits. The UI's income/expense reads from the category's `is_income` together with `type` |
| `AuthenticationMethods` is a separate table. | **Dropped.** The MVP has no sign-in at all, so there is nothing to model. `users.email` is kept nullable for when identity ships with sync |

### Correct but out of MVP scope

`user_budgets`, `user_recurring_transactions`, `persons` / `user_persons`, and the
community-merchant layer. `user_budgets` and `user_recurring_transactions` ship as **tables
with no UI** so the schema does not churn later; Persons is not created at all.

---

## Schema Overview

```
financial_institutions 1──N bank_connections 1──N accounts 1──N transactions
                                                                    │
                                    transaction_categories 1──N ────┤
                                                                    │
                            merchants 1──N ───────────────────────--┤
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
The row exists so a future server sync has an anchor, and so the RUT is stored once:
`bank-credentials/rut-locked` requires every connection to share one RUT.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID, generated locally on first launch |
| `email` | `TEXT` | **Nullable and unused in the MVP.** Reserved for when sign-in ships with sync |
| `first_name` | `TEXT` | Not collected; reserved |
| `last_name` | `TEXT` | Not collected; reserved |
| `national_id_type` | `TEXT NOT NULL DEFAULT 'rut'` | |
| `national_id_value` | `TEXT` | RUT, normalized without dots, check digit included |
| `country_code` | `TEXT NOT NULL DEFAULT 'CL'` | |
| `created_at` | `TEXT NOT NULL` | |

### `financial_institutions`

Seeded catalog.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | `banco-de-chile` — matches the scraper's `bankId` |
| `country_code` | `TEXT NOT NULL` | `CL` |
| `name` | `TEXT NOT NULL` | |
| `short_name` | `TEXT NOT NULL` | `BCH` — the badge in `bank-picker` |
| `brand_color` | `TEXT NOT NULL` | `#003da5` |
| `scraper_status` | `TEXT NOT NULL` | `available` \| `coming_soon` — drives the "Próximamente" rows |

### `bank_connections`

One per institution linked on this device. **Holds no secrets** — only the keychain key.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `institution_id` | `TEXT NOT NULL REFERENCES financial_institutions(id)` | |
| `status` | `TEXT NOT NULL` | `active` \| `inactive` \| `disconnected` |
| `credentials_key` | `TEXT NOT NULL` | `expo-secure-store` key, e.g. `bank_creds:banco-de-chile`. **The value never touches SQLite** |
| `sync_status` | `TEXT NOT NULL` | `idle` \| `syncing` \| `ok` \| `error` |
| `last_sync_at` | `TEXT` | Any attempt |
| `last_success_at` | `TEXT` | Gap #8 — `bank-review` shows this separately |
| `last_error_code` | `TEXT` | `invalid_credentials` \| `session_closed` \| `network` \| `parse_failed` |
| `last_error_message` | `TEXT` | Shown in `bank-review/error` |
| `auto_sync` | `INTEGER NOT NULL DEFAULT 1` | The toggle in `bank-review` |
| `created_at` | `TEXT NOT NULL` | |

Unique: `(institution_id)` — one connection per bank.

### `accounts`

Financial products discovered by the scraper. Collapses `FinancialProduct` + `UserFinancialProduct`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `connection_id` | `TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT NOT NULL` | The scraper's `Product.financialProductId` |
| `type` | `TEXT NOT NULL` | `checking` \| `sight` \| `savings` \| `credit_card` \| `credit_line` |
| `name` | `TEXT NOT NULL` | "Cuenta corriente" |
| `mask` | `TEXT` | `4821` — rendered as `••4821` |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `balance` | `INTEGER` | Minor units. Null when the bank does not expose it |
| `credit_limit` | `INTEGER` | `bank-review` shows "cupo $2.500.000" |
| `available_credit` | `INTEGER` | |
| `metadata` | `TEXT` | JSON escape hatch for bank-specific fields |
| `updated_at` | `TEXT NOT NULL` | |

Unique: `(connection_id, external_id)`.

### `transaction_categories`

Seeded from `design/tokens.json → categoryIcons`; users may add their own.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | |
| `icon` | `TEXT NOT NULL` | Emoji |
| `is_income` | `INTEGER NOT NULL` | 0 = expense, 1 = income. Drives the tabs in `settings-categories` |
| `is_system` | `INTEGER NOT NULL DEFAULT 0` | The ✨ Otros fallback — cannot be deleted; receives orphans on delete |
| `sort_order` | `INTEGER NOT NULL` | Drag handles in `settings-categories` |
| `parent_id` | `TEXT REFERENCES transaction_categories(id)` | Reserved for subcategories; unused in MVP |
| `created_at` | `TEXT NOT NULL` | |

### `merchants`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | Display name — "MercadoLibre Chile" |
| `category_id` | `TEXT REFERENCES transaction_categories(id)` | Default category applied to future transactions (`merchant-edit`) |
| `is_user_defined` | `INTEGER NOT NULL DEFAULT 0` | 0 = from the seeded Chilean merchant list |
| `created_at` | `TEXT NOT NULL` | |

### `merchant_aliases`

Gap #7. Maps raw bank strings onto one merchant.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `merchant_id` | `TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE` | |
| `raw_pattern` | `TEXT NOT NULL` | Normalized prefix, e.g. `MERCADOLIBRE COMPRA` |
| `match_type` | `TEXT NOT NULL DEFAULT 'prefix'` | `prefix` \| `contains` \| `exact` |
| `match_count` | `INTEGER NOT NULL DEFAULT 0` | "12 movimientos" in `merchant-edit/suggestions` |

Unique: `(raw_pattern)`.

### `transactions`

The core table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `account_id` | `TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT` | Gap #1 — the bank's id |
| `dedup_hash` | `TEXT NOT NULL` | `sha256(account_id, date_local, amount, raw_description)` — fallback identity |
| `amount` | `INTEGER NOT NULL` | Minor units, **always positive**. Direction comes from `type` |
| `type` | `TEXT NOT NULL` | `debit` \| `credit` — the scraper's vocabulary |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `occurred_at` | `TEXT NOT NULL` | ISO-8601 UTC |
| `date_local` | `TEXT NOT NULL` | `YYYY-MM-DD` — month grouping in `transactions` |
| `raw_description` | `TEXT NOT NULL` | Gap #6 — immutable, from the bank |
| `note` | `TEXT` | Gap #6 — user-editable |
| `merchant_id` | `TEXT REFERENCES merchants(id)` | Resolved counterparty |
| `category_id` | `TEXT REFERENCES transaction_categories(id)` | Null = "Necesita categorización" |
| `category_source` | `TEXT` | Gap #4 — `auto` \| `user` \| `rule` |
| `review_flag` | `TEXT` | Gap #5 — `review_later` \| `uncertain` |
| `excluded_at` | `TEXT` | Gap #2 — non-null = out of every total and chart |
| `exclusion_reason` | `TEXT` | `personal_transfer` \| `shared_expense` \| `not_relevant` \| `cash_withdrawal` \| `other` |
| `exclusion_note` | `TEXT` | Free text when reason = `other` |
| `included_amount` | `INTEGER` | Gap #3 — null = the full amount counts |
| `is_manual` | `INTEGER NOT NULL DEFAULT 0` | Added by hand, not scraped |
| `created_at` | `TEXT NOT NULL` | |
| `updated_at` | `TEXT NOT NULL` | |

Unique: `(account_id, external_id)` where `external_id IS NOT NULL`; `(dedup_hash)`.
Indexes: `(date_local DESC)`, `(category_id)`, `(merchant_id)`, plus a partial index on
`category_id IS NULL AND excluded_at IS NULL` — the "por categorizar" count on `home` runs on
every app open.

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
(`period`, `amount`, `category_id`, plus `is_income` / `description` / `due_day` for recurring).

---

## Migrations

Drizzle migrations bundled with the app, run on first launch after an update.
`app_settings.schema_version` records the applied version.

```bash
pnpm --filter @finanzas/mobile db:generate   # generate a migration from the schema
pnpm --filter @finanzas/mobile db:check      # verify migrations apply to a fixture DB
```

Because the database is on-device, **a bad migration is unrecoverable for that user**. Every
migration must be additive (new tables, new nullable columns) and covered by a test that opens
a seeded fixture DB from the previous version. There is no "reset production" command.

Local reset during development: delete and reinstall the app, or run the in-app
`Ajustes → Acerca de → Reset local database` action available in dev builds only.

## Seed Data

Shipped with the app, applied on first launch:

1. `financial_institutions` — Banco de Chile (`available`), plus Santander, BCI, BancoEstado,
   Falabella and Itaú as `coming_soon` (the `bank-picker` list).
2. `transaction_categories` — 10 expense + 6 income from `design/tokens.json → categoryIcons`,
   with ✨ Otros flagged `is_system` in each direction.
3. `merchants` + `merchant_aliases` — a starter list of common Chilean merchants
   (Líder, Jumbo, Uber, Copec, Netflix…) so the first categorization session already has
   suggestions.

```bash
pnpm --filter @finanzas/mobile db:seed       # regenerate the bundled seed fixtures
```

## Open questions

Tracked in [`design/mockups/mobile/INVENTORY.md`](../../design/mockups/mobile/INVENTORY.md):
whether partial inclusion (#3) ships in the MVP, and whether the community-merchant layer
implies a server later — which would make the collapsed `merchants` table a migration target.
