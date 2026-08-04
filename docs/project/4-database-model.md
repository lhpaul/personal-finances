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
| `TransactionCategories` has no ordering and no stable identity for seeds. | Added `sort_order` (the ☰ drag handles in `settings-categories`) and `slug` (stable seed identity; also how the ✨ Otros fallback is found). "Cannot delete" is **not** every `user_id IS NULL` row — a person-created category has `user_id` set but a great many seeded categories are perfectly deletable. The undeletable set is exactly the two ✨ Otros categories, found by `slug IN ('otros-gasto', 'otros-ingreso')`, enforced by a `BEFORE DELETE` trigger (see *Deleting a category*) so a raw delete that bypasses the app is rejected too, not only an app-level guard |
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

**Item #9 is the only writer of `status`, `credentials_key` and the `idle → syncing` transition.**
Connecting a bank creates the row (`status: 'active'`, `sync_status: 'idle'`) or, if one already
exists for that institution, updates only `status` — `credentials_key`, `last_sync_at`,
`last_success_at` and the error columns survive a reconnect untouched. `credentials_key` is
deterministic (`bank_creds:<financial_institution_id>`), which is what lets a reconnect resolve
to the same secure-store entry instead of creating a second one. Item #10 owns every
`ok` / `error` transition and the last-attempt/last-success bookkeeping that follows a real sync.

**The full local wipe (item #19, "Borrar todos mis datos") derives the credential key space from
this table.** A keychain has no "list every key" API, so `collectCredentialKeys`
(`apps/mobile/src/features/settings/wipe-local-data.ts`) unions two sources: every
`credentials_key` this table holds (including `disconnected` rows — the derivation must not
filter on `status`) and `credentialsKeyFor(id)` applied to every row of `financial_institutions`
(the seeded catalogue), which sweeps an orphan key whose connection row was already deleted or
that was written by a connect attempt that crashed before its transaction committed. The wipe
deletes every derived key from `expo-secure-store` first, reads each back to confirm none
survived, and only then destroys the store **as a file** — no `DELETE` statement is issued against
this or any other table.

**No `auto_sync` column.** Syncing is implicit: an `active` connection syncs on app open when
its last successful sync is more than six hours old. The per-connection toggle has been removed
from `#screen=bank-review` so the mockups and the schema agree. If per-bank control is wanted
later it belongs here as a real column.

**Sync bookkeeping — what each exit writes (item #10).** Every exit from `syncing` writes
`last_sync_at` from the same `now` the write phase uses; only a success also advances
`last_success_at` and clears the two error columns:

| Exit | `sync_status` | `last_sync_at` | `last_success_at` | `last_error_code` / `last_error_message` |
| --- | --- | --- | --- | --- |
| Complete | `ok` | `now` | `now` | cleared to `null` |
| Failed (nothing gathered) | `error` | `now` | untouched | the read's reason + a composed `sync.errors.*` key |
| Partial (something gathered) | `error` | `now` | untouched | the read's reason + a composed `sync.errors.*` key |
| Cancelled (stopped) | `idle` | `now` | untouched | untouched |
| Crash recovery at app open | `idle` | `now` | untouched | untouched |

`last_error_message` never holds the bank's own error text or a value from the read's diagnostic
trace — it is always one of the four fixed `sync.errors.*` catalogue keys.

**Automatic-sync eligibility.** On app open, a connection syncs automatically when **all** hold:
`status = 'active'`; `sync_status != 'syncing'`; `last_error_code != 'invalid_credentials'`
(a credential rejection suspends automatic syncing until the person supplies one again);
`last_success_at` is null or more than six hours old; **and** `last_sync_at` is null or more than
six hours old — the last-*attempt* half of the interval exists so a connection that fails every
time does not read the bank on every app open. "Sincronizar ahora" is never subject to any of
this. A connection found at `sync_status = 'syncing'` with no read actually in progress (the app
was killed mid-sync) is returned to `idle` first, before this check runs.

### `user_financial_products`

Financial products discovered by the scraper. Collapses `FinancialProduct` +
`UserFinancialProduct`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `user_financial_institution_id` | `TEXT NOT NULL REFERENCES user_financial_institutions(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT NOT NULL` | The scraper's opaque **per-instance identity** (`ScrapedProduct.instanceId`, item #10) — a 32-hex-character value computed in-page, never the product kind and never a raw account/card number. Two accounts of the same kind are two products, each recognised across reads by this value |
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
| `user_id` | `TEXT REFERENCES users(id)` | Null = seeded (starter content); set = created by the person. **Not** a deletability flag by itself |
| `parent_category_id` | `TEXT REFERENCES transaction_categories(id)` | Reserved for subcategories; unused in MVP |
| `sort_order` | `INTEGER NOT NULL` | Drag handles in `settings-categories`. A real column because it is an `ORDER BY` |
| `created_at` | `TEXT NOT NULL` | |

**Deleting a category.** Every category except the two ✨ Otros (`slug IN ('otros-gasto',
'otros-ingreso')`) can be deleted, seeded or person-created alike. Deleting a category is a
transaction that, in one commit: re-parents its movements to the ✨ Otros of the same direction
(`income`), clears `transaction_category_id`/`transaction_category_id` references on any
`merchants` row that pointed at it, and deletes its `user_budgets` and
`user_recurring_transactions` rows — it deletes no merchant and no movement. The two ✨ Otros
categories cannot be deleted at all: the app-level guard checks the slug, and a first-migration
`BEFORE DELETE` trigger raises `ABORT` for the same two slugs, so a raw `DELETE` that bypasses the
app is rejected by the store itself, not only by the caller that is expected to check first.

### `merchants`

Follows the original model.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `name` | `TEXT NOT NULL` | Display name — "MercadoLibre Chile" |
| `assets` | `TEXT` (JSON) | Logo / icon URLs |
| `transaction_category_id` | `TEXT REFERENCES transaction_categories(id)` | Default category applied to future movements (`merchant-edit`) |
| `country_code` | `TEXT` | **Null = international.** `CL` for Chilean-only merchants |
| `user_id` | `TEXT REFERENCES users(id)` | Null = seeded; set = created by the user. `merchant-edit`'s `saveMerchantProfile` sets it to the single local `users` row's id the first time a person renames a seed-owned merchant or changes its default category — an already-set value is never overwritten. Future auto-categorization from a merchant with `user_id` set reads as `category_source = 'rule'` rather than `'auto'` |
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
| `match_count` | `INTEGER NOT NULL DEFAULT 0` | "12 movimientos" in `merchant-edit/suggestions`. **Recomputed, never incremented**: on every `merchant-edit` load and inside every alias-grouping write, `recountMerchantAliases` re-derives every alias's count from `transactions` by resolving each of the merchant's movements through `resolveMerchant`'s total order, so a deleted, re-linked or re-pointed movement never leaves a stale count behind. Not seed-owned — a catalogue refresh never resets it |

Unique: `(raw_pattern)`. Indexed on `(merchant_id)`.

### `transactions`

The core table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `user_financial_product_id` | `TEXT NOT NULL REFERENCES user_financial_products(id) ON DELETE CASCADE` | |
| `external_id` | `TEXT` | Gap #1 — the bank's id |
| `dedup_hash` | `TEXT NOT NULL` | `sha256('v2', user_financial_product_id, date_local, String(amount), direction, raw_description, external_id ?? '', String(occurrenceIndex), is_manual ? id : '')` — fallback identity (item #10's `v2` input) |
| `amount` | `INTEGER NOT NULL` | Minor units, **always positive**. Direction comes from `type` |
| `type` | `TEXT NOT NULL` | `debit` \| `credit` — the scraper's vocabulary |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `occurred_at` | `TEXT NOT NULL` | ISO-8601 UTC |
| `date_local` | `TEXT NOT NULL` | `YYYY-MM-DD` — month grouping in `transactions` |
| `raw_description` | `TEXT NOT NULL` | Gap #6 — immutable, from the bank |
| `note` | `TEXT` | Gap #6 — user-editable |
| `merchant_id` | `TEXT REFERENCES merchants(id)` | Resolved counterparty |
| `transaction_category_id` | `TEXT REFERENCES transaction_categories(id)` | Null = "Necesita categorización" |
| `category_source` | `TEXT` | Gap #4 — `auto` \| `user` \| `rule` — the categorization flow (#13) writes `user` only |
| `review_flag` | `TEXT` | Gap #5 — `review_later` \| `uncertain` — written by the categorization flow (#13) |
| `excluded_at` | `TEXT` | Gap #2 — non-null = out of every total and chart — written by the categorization flow (#13) |
| `exclusion_reason` | `TEXT` | `personal_transfer` \| `shared_expense` \| `not_relevant` \| `cash_withdrawal` \| `other` — written by the categorization flow (#13) |
| `exclusion_note` | `TEXT` | Free text, optional for every reason (not only `other` — the categorization flow's spec Conflict 3 resolves the mockup's own drawn note field over this cell's earlier phrasing) — written by the categorization flow (#13) |
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

`dedup_hash`'s input folds in `external_id` (and, for a manual entry, the row's own `id`) rather
than stopping at `(user_financial_product_id, date_local, amount, raw_description)` alone. Those
four fields by themselves reject a second genuinely-distinct movement that happens to share a
product, day, amount and description — two identical coffees on the same day, each with its own
bank identifier, would otherwise collide. For a bank that supplies no identifier, and for a
non-manual row, the formula reduces exactly to the four-field version, so the fallback route's
meaning is unchanged; for a bank that does supply one, identity is the identifier and the
fingerprint stops colliding.

**Item #10 extends the input with two more facts**, because Banco de Chile supplies no bank
identifier at all, so in practice every one of its movements is recognised by the fallback route
above: `direction` (a charge and its identically-described refund on the same day for the same
amount must never collide) and `occurrenceIndex` (the index of a row within its group of
otherwise-identical rows *in one read*, derived from a stable identity tuple — never from the
read's listing position — so N indistinguishable movements in one read produce N distinct hashes
and stay N on a repeat, independent of reordering). The leading `'v2'` tag exists so a future
identity scheme can be introduced without ever colliding with a stored `v2` value; a `v1`-shaped
hash computed before item #10 shipped is never recomputed — nothing had shipped to a device yet.

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

**Value shapes** (issue #8's implementation plan Decision 8 — recorded here so item #18, the
first writer of the reminder keys, inherits the contract instead of re-deciding it):

| Key | Value shape | Read behaviour when absent or malformed |
|-----|-------------|------------------------------------------|
| `onboarding_completed` | `true` (boolean JSON) | Treated as `false` (first launch) |
| `reminder_enabled` | boolean | Treated as `false` — the reminder row is not rendered |
| `reminder_time` | `"HH:mm"`, 24-hour, zero-padded | The reminder row renders with title only |
| `reminder_days` | array of ISO weekday integers, `1` = Monday … `7` = Sunday | The reminder row renders with title only |
| `first_launch_at` | ISO instant string, written once by `ensureFirstLaunchAt` on a fresh install | `readFirstLaunchAt` returns `undefined` for anything that is not a non-empty string |

`first_launch_at` is not internal bookkeeping only — `settings-account` (item #19) surfaces it as
"Usando la app desde `<mes año>`", so a *new* store (after the full local wipe, or a fresh install)
genuinely shows the current month rather than a stale one, because bootstrap re-writes this key
the moment the file is recreated.

`apps/mobile/src/db/repositories/settings.ts`'s `isOnboardingCompleted`, `markOnboardingCompleted`,
`readReminderSettings` and `readFirstLaunchAt` are the sanctioned accessors for these keys; no
caller reads `app_settings` directly for them.

### `user_budgets`

Created by the migrations, **no UI in the MVP**. Neither table has any seed data, so a later
column correction is an additive change on empty tables.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `transaction_category_id` | `TEXT NOT NULL REFERENCES transaction_categories(id) ON DELETE CASCADE` | |
| `period` | `TEXT NOT NULL` | e.g. `2026-01` (calendar month) |
| `amount` | `INTEGER NOT NULL` | Minor units |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `user_id` | `TEXT REFERENCES users(id)` | |
| `created_at` | `TEXT NOT NULL` | |
| `updated_at` | `TEXT NOT NULL` | |

### `user_recurring_transactions`

Created by the migrations, **no UI in the MVP**.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | |
| `transaction_category_id` | `TEXT NOT NULL REFERENCES transaction_categories(id) ON DELETE CASCADE` | |
| `description` | `TEXT NOT NULL` | |
| `amount` | `INTEGER NOT NULL` | Minor units |
| `currency_code` | `TEXT NOT NULL DEFAULT 'CLP'` | |
| `income` | `INTEGER NOT NULL DEFAULT 0` | 0 = expense, 1 = income |
| `due_day` | `INTEGER NOT NULL` | Day of the month |
| `user_id` | `TEXT REFERENCES users(id)` | |
| `created_at` | `TEXT NOT NULL` | |
| `updated_at` | `TEXT NOT NULL` | |

### `seed_ledger`

Records what starter content each seed run has written, per stable seed key — the mechanism
behind the *Seed Data* refresh guarantee below. `user_id IS NULL` alone cannot distinguish "never
seeded on this device" from "starter row the person deleted"; the ledger can.

| Column | Type | Notes |
|--------|------|-------|
| `seed_key` | `TEXT PK` | `financial_institution:banco-de-chile`, `transaction_category:comida`, `merchant:lider`, `merchant_alias:lider:LIDER` |
| `entity_type` | `TEXT NOT NULL` | `financial_institution` \| `transaction_category` \| `merchant` \| `merchant_alias` |
| `entity_id` | `TEXT NOT NULL` | The primary key of the row this seed created |
| `seeded_hash` | `TEXT NOT NULL` | Digest of the seed-owned field values as last written |
| `created_at` | `TEXT NOT NULL` | |
| `updated_at` | `TEXT NOT NULL` | |

The whole seed run is one transaction. Per seed record, on every run:

1. **No ledger row** → never applied on this device → insert the entity row and the ledger row.
   Covers both a fresh install and a later app version adding a new starter record.
2. **Ledger row exists, entity row missing** → the person deleted it → do nothing. The ledger row
   stays, so no later run resurrects it.
3. **Ledger row exists, entity row present, current seed-owned values hash equal to
   `seeded_hash`** → untouched by the person → update it to the current catalogue values and
   refresh `seeded_hash`. This is what lets a corrected label reach existing users.
4. **Ledger row exists, entity row present, hash differs** → the person edited it → do nothing,
   and do not refresh `seeded_hash`.

Rows the person created are never read by the seeder at all — it only ever touches ids it finds
in its own ledger. `user_id` is never written by a seed. A transaction category's `income`
(direction) column is deliberately excluded from the update statement in case 3, so no catalogue
change can ever flip an existing category's direction.

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
`app_settings.schema_version` records the applied version — the count of applied journal entries,
written only after `migrate()` succeeds.

```bash
pnpm --filter @finanzas/mobile db:generate   # generate a Drizzle migration
pnpm --filter @finanzas/mobile db:check      # apply migrations to a fixture DB, in four modes
pnpm --filter @finanzas/mobile db:seed       # regenerate the bundled seed fixture, deterministically
```

Because the database is on-device, **a bad migration is unrecoverable for that user**. Every
migration must be additive (new tables, new nullable columns) and covered by a test that opens
a seeded fixture DB from the previous version. There is no "reset production" command.

`db:check` is a custom CLI (not `drizzle-kit check` alone, which only validates journal
integrity) that runs four modes, in order, failing on the first failure:

1. **Journal integrity** — shells out to `drizzle-kit check`, catching snapshot-version drift,
   malformed snapshots and parent-snapshot-id collisions.
2. **History vs. declared shape** — applies the full migration history to an empty store,
   introspects it, and compares the result against the newest snapshot; then proves there is no
   pending `drizzle-kit generate` diff by running it into a scratch copy of the migration folder.
3. **Additive-only** — walks every consecutive pair of committed snapshots and mechanically
   rejects a non-additive change (a removed table or column, a type change, a column made
   mandatory, a new mandatory column on an existing table even with a default, a tightened
   uniqueness or check constraint, a foreign key added to an existing table, or a mandatory
   column losing its default). A new table, a new nullable column, and a new or removed
   non-unique index are all explicitly allowed.
4. **Preservation** — loads a committed store snapshot, takes a census, re-applies the (already
   applied, so idempotent) migration history, re-censuses, and asserts nothing pre-existing was
   lost or altered.

`PRAGMA foreign_keys = ON` is set on every connection the app or the test tier opens. SQLite
disables foreign-key enforcement by default; without this pragma, every `ON DELETE CASCADE` named
on this page — the connection → products → movements cascade, the merchant → aliases cascade, the
category → budgets/recurring-transactions cascade — is decorative and would pass in review and
fail on a device.

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

Every seed is recorded in `seed_ledger` (see that table's own section, above) and re-running the
seed on a later app version follows its four-case algorithm: a genuinely new starter record is
always inserted; a starter row the person deleted is never resurrected; a starter row the person
edited is never overwritten; a starter row nobody has touched is corrected to the current
catalogue values. This is a stronger guarantee than "keyed by slug/id" alone — a plain
upsert-by-slug would silently resurrect a row the person deliberately deleted, and would silently
overwrite a row the person edited.

`db:seed` (`pnpm --filter @finanzas/mobile db:seed`) rebuilds the committed store snapshot used by
`db:check`'s preservation mode and by the smoke runbook: it runs the normal bootstrap path (so it
carries all starter content) plus a representative set of person-owned data, then dumps the result
as deterministic, dependency-ordered SQL text. Running it twice with no source change produces a
byte-identical file.

## Open questions

Tracked in [`design/mockups/mobile/INVENTORY.md`](../../design/mockups/mobile/INVENTORY.md):
whether the community-merchant layer implies a server later, which would make the collapsed
`merchants` table a migration target.

**Resolved:** partial inclusion is **out of the MVP**. `included_amount` still ships as a
column and the inclusion rule still reads `COALESCE(included_amount, amount)` — the column is
simply always null, so the day the feature lands nothing about the rule or the aggregates has
to change. `#screen=categorize&state=advanced` stays drawn, flagged `mvp: false`.
