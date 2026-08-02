import { desc, sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

/**
 * The declared shape of the local store, transcribed field for field from
 * `docs/project/4-database-model.md` (AC28). Every table, column, index and constraint here has
 * a matching row in that document; the two intentional differences (the `seed_ledger` table and
 * the `dedup_hash` input — implementation plan Decisions 10 and 14) are written back to it in the
 * same change as this item (see Documentation Updates).
 *
 * This file imports only from `drizzle-orm/sqlite-core`, which is platform-free (implementation
 * plan Decision 1). It must never import `expo-sqlite` or `better-sqlite3` directly — the two
 * concrete clients (`src/db/client.ts`, `src/db/testing/memory-db.ts`) wrap this declaration with
 * their own driver.
 *
 * No column in this file uses `real()`. Money is always `integer()`, in minor units
 * (implementation plan Decision 4, `src/db/money.ts`).
 */

// ---------------------------------------------------------------------------------------------
// users — exactly one row, created on first launch. No `national_id_value` column and no hash
// of it (Business Rules 1-2, AC5). Single-row guarantee via a unique expression index on the
// constant `1` (AC21).
// ---------------------------------------------------------------------------------------------
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    nationalIdType: text('national_id_type').notNull().default('rut'),
    countryCode: text('country_code').notNull().default('CL'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('users_single_profile_idx').on(sql`(1)`)],
);

// ---------------------------------------------------------------------------------------------
// financial_institutions — seeded catalogue of banks.
// ---------------------------------------------------------------------------------------------
export const financialInstitutions = sqliteTable(
  'financial_institutions',
  {
    id: text('id').primaryKey(),
    countryCode: text('country_code').notNull(),
    name: text('name').notNull(),
    assets: text('assets'),
    metadata: text('metadata'),
    scraperStatus: text('scraper_status').notNull(),
  },
  (t) => [index('financial_institutions_scraper_status_idx').on(t.scraperStatus)],
);

// ---------------------------------------------------------------------------------------------
// user_financial_institutions — the user's link to one institution on this device. Holds no
// secrets: `credentials_key` is the secure-store *key name*, never the credential value. No
// `auto_sync` column (Business Rule 20's disconnect guarantee, data model).
// ---------------------------------------------------------------------------------------------
export const userFinancialInstitutions = sqliteTable(
  'user_financial_institutions',
  {
    id: text('id').primaryKey(),
    financialInstitutionId: text('financial_institution_id')
      .notNull()
      .references(() => financialInstitutions.id),
    status: text('status').notNull(),
    credentialsKey: text('credentials_key').notNull(),
    syncStatus: text('sync_status').notNull(),
    lastSyncAt: text('last_sync_at'),
    lastSuccessAt: text('last_success_at'),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('user_financial_institutions_institution_unique').on(t.financialInstitutionId),
  ],
);

// ---------------------------------------------------------------------------------------------
// user_financial_products — financial products discovered by the scraper. No `balance` / `mask`
// / `credit_limit` / `available_credit` columns — they live in `metadata` as integer minor units
// (Out of Scope: "Balance, mask, credit limit and available credit as first-class fields").
// ---------------------------------------------------------------------------------------------
export const userFinancialProducts = sqliteTable(
  'user_financial_products',
  {
    id: text('id').primaryKey(),
    userFinancialInstitutionId: text('user_financial_institution_id')
      .notNull()
      .references(() => userFinancialInstitutions.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    type: text('type').notNull(),
    name: text('name').notNull(),
    currencyCode: text('currency_code').notNull().default('CLP'),
    assets: text('assets'),
    metadata: text('metadata'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('user_financial_products_institution_external_unique').on(
      t.userFinancialInstitutionId,
      t.externalId,
    ),
  ],
);

// ---------------------------------------------------------------------------------------------
// transaction_categories — follows the original domain model so names can be per-locale. No
// `is_system` flag: the undeletable set is the two ✨ Otros categories, found by slug (spec
// Conflict 1 resolution, Business Rules 17-18).
// ---------------------------------------------------------------------------------------------
export const transactionCategories = sqliteTable(
  'transaction_categories',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    income: integer('income').notNull(),
    labels: text('labels').notNull(),
    assets: text('assets'),
    userId: text('user_id').references(() => users.id),
    parentCategoryId: text('parent_category_id').references(
      (): AnySQLiteColumn => transactionCategories.id,
    ),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('transaction_categories_slug_unique').on(t.slug),
    index('transaction_categories_income_sort_order_idx').on(t.income, t.sortOrder),
  ],
);

// ---------------------------------------------------------------------------------------------
// merchants — collapses the global/per-user split (`user_id` null = seeded, set = created by the
// user).
// ---------------------------------------------------------------------------------------------
export const merchants = sqliteTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  assets: text('assets'),
  transactionCategoryId: text('transaction_category_id').references(
    () => transactionCategories.id,
  ),
  countryCode: text('country_code'),
  userId: text('user_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------------------------
// merchant_aliases — a separate table because the relationship is genuinely one-to-many and the
// UI treats it as a list (`merchant-edit/suggestions`).
// ---------------------------------------------------------------------------------------------
export const merchantAliases = sqliteTable(
  'merchant_aliases',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    rawPattern: text('raw_pattern').notNull(),
    matchType: text('match_type').notNull().default('prefix'),
    matchCount: integer('match_count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('merchant_aliases_raw_pattern_unique').on(t.rawPattern),
    index('merchant_aliases_merchant_id_idx').on(t.merchantId),
  ],
);

// ---------------------------------------------------------------------------------------------
// transactions — the core table. `dedup_hash` input is Decision 14's extended formula (adds
// `external_id` and, for manual entries, the row id) — an intentional difference from the data
// model's literal formula, reflected there in the same change (Documentation Updates).
// `included_amount` has no UI in the MVP and is always null in this item, but the column and the
// inclusion rule (`src/db/fragments.ts`) exist from day one so the rule never has to change when
// partial inclusion ships (Deferral Note 2).
// ---------------------------------------------------------------------------------------------
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    userFinancialProductId: text('user_financial_product_id')
      .notNull()
      .references(() => userFinancialProducts.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    dedupHash: text('dedup_hash').notNull(),
    amount: integer('amount').notNull(),
    type: text('type').notNull(),
    currencyCode: text('currency_code').notNull().default('CLP'),
    occurredAt: text('occurred_at').notNull(),
    dateLocal: text('date_local').notNull(),
    rawDescription: text('raw_description').notNull(),
    note: text('note'),
    merchantId: text('merchant_id').references(() => merchants.id),
    transactionCategoryId: text('transaction_category_id').references(
      () => transactionCategories.id,
    ),
    categorySource: text('category_source'),
    reviewFlag: text('review_flag'),
    excludedAt: text('excluded_at'),
    exclusionReason: text('exclusion_reason'),
    exclusionNote: text('exclusion_note'),
    includedAmount: integer('included_amount'),
    metadata: text('metadata'),
    isManual: integer('is_manual').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('transactions_product_external_unique')
      .on(t.userFinancialProductId, t.externalId)
      .where(sql`${t.externalId} is not null`),
    uniqueIndex('transactions_dedup_hash_unique').on(t.dedupHash),
    index('transactions_date_local_idx').on(desc(t.dateLocal)),
    index('transactions_category_id_idx').on(t.transactionCategoryId),
    index('transactions_merchant_id_idx').on(t.merchantId),
    // The "por categorizar" count on `home`, on every app open (AC23). The predicate must match
    // `countUncategorized`'s `WHERE` clause exactly (`src/db/repositories/transactions.ts`).
    index('transactions_uncategorized_idx')
      .on(t.transactionCategoryId)
      .where(sql`${t.transactionCategoryId} is null and ${t.excludedAt} is null`),
  ],
);

// ---------------------------------------------------------------------------------------------
// app_settings — key-value; avoids a migration per new preference. This item writes only
// `schema_version` and `first_launch_at` (Seed Data Contract → Settings keys).
// ---------------------------------------------------------------------------------------------
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// ---------------------------------------------------------------------------------------------
// user_budgets — created by the migrations, no UI in the MVP.
// ---------------------------------------------------------------------------------------------
export const userBudgets = sqliteTable('user_budgets', {
  id: text('id').primaryKey(),
  transactionCategoryId: text('transaction_category_id')
    .notNull()
    .references(() => transactionCategories.id, { onDelete: 'cascade' }),
  period: text('period').notNull(),
  amount: integer('amount').notNull(),
  currencyCode: text('currency_code').notNull().default('CLP'),
  userId: text('user_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------------------------
// user_recurring_transactions — created by the migrations, no UI in the MVP.
// ---------------------------------------------------------------------------------------------
export const userRecurringTransactions = sqliteTable('user_recurring_transactions', {
  id: text('id').primaryKey(),
  transactionCategoryId: text('transaction_category_id')
    .notNull()
    .references(() => transactionCategories.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  currencyCode: text('currency_code').notNull().default('CLP'),
  income: integer('income').notNull().default(0),
  dueDay: integer('due_day').notNull(),
  userId: text('user_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------------------------
// seed_ledger — the twelfth table (implementation plan Decision 10). Remembers, per stable seed
// key, which row the seeder created and a digest of the seed-owned values it last wrote. This is
// what lets a starter-content refresh insert a genuinely new record, correct an untouched one,
// and never overwrite an edit or resurrect a deletion (Business Rules 14-16, AC17-AC19).
// ---------------------------------------------------------------------------------------------
export const seedLedger = sqliteTable('seed_ledger', {
  seedKey: text('seed_key').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  seededHash: text('seeded_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
