import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';

import type { Assets, CategoryLabels } from '../json';
import { parseAssets, parseCategoryLabels } from '../json';
import type { SupportedLocale } from '../labels';
import { resolveLabel } from '../labels';
import { merchants, transactionCategories, transactions, userBudgets, userRecurringTransactions } from '../schema';
import type { AppDatabase, Category } from '../types';

/**
 * `transaction_categories` repository (implementation plan Layer-by-Layer, spec Business Rules
 * 13, 17-19, AC8-AC11, AC29).
 *
 * The two ✨ Otros categories (`otros-gasto`, `otros-ingreso`) are the app's fallback identity
 * and can never be deleted (Business Rule 17) — enforced here by slug, and backstopped at the
 * store level by the `protect_otros_categories` trigger appended to the first migration
 * (Decision 16, AC9) for any raw `DELETE` that bypasses this repository.
 */

const OTROS_EXPENSE_SLUG = 'otros-gasto';
const OTROS_INCOME_SLUG = 'otros-ingreso';

interface TransactionCategoryRow {
  id: string;
  slug: string;
  income: number;
  labels: string;
  assets: string | null;
  sortOrder: number;
}

function mapCategoryRow(row: TransactionCategoryRow, locale: SupportedLocale): Category {
  const labels = parseCategoryLabels(row.labels);
  const assets = parseAssets(row.assets);
  return {
    id: row.id,
    slug: row.slug,
    income: row.income === 1,
    name: resolveLabel(labels, locale),
    emoji: assets.emoji,
    sortOrder: row.sortOrder,
  };
}

/**
 * The settings hub's "Categorías" subtitle figure (implementation plan for issue #19, Decision
 * 15) — one grouped `count(*) … group by income`, not two `listCategories(...).length` calls,
 * which would each read the full table into JS and reduce it there (`sqlite-drizzle.md`'s
 * "aggregate in SQL" rule). The seed guarantees both directions are always non-empty, so no
 * fallback copy is needed for either count.
 */
export function countCategoriesByDirection(db: AppDatabase): { expense: number; income: number } {
  const rows = db
    .select({ income: transactionCategories.income, count: sql<number>`count(*)` })
    .from(transactionCategories)
    .groupBy(transactionCategories.income)
    .all() as { income: number; count: number }[];

  const expenseRow = rows.find((row) => row.income === 0);
  const incomeRow = rows.find((row) => row.income === 1);
  return { expense: expenseRow?.count ?? 0, income: incomeRow?.count ?? 0 };
}

/** Spec "What are my categories, in my chosen order, for this direction?" — backed by the
 * `transaction_categories_income_sort_order_idx` composite index. */
export function listCategories(
  db: AppDatabase,
  params: { income: 0 | 1; locale: SupportedLocale },
): Category[] {
  const rows = db
    .select()
    .from(transactionCategories)
    .where(eq(transactionCategories.income, params.income))
    .orderBy(asc(transactionCategories.sortOrder))
    .all() as TransactionCategoryRow[];
  return rows.map((row) => mapCategoryRow(row, params.locale));
}

/**
 * The categorization flow's chip-ordering data source (#13 implementation plan Decision 6, spec
 * A7, AC8). Orders by how often the person has actually used each category of the given
 * direction — every movement carrying it, excluded ones included (Assumption P3) — ties broken
 * by `sortOrder`. `excludeCategoryId` lets a caller drop a category (typically the one already
 * shown as the suggestion) from the result; `readStageData` does not pass it, because the
 * suggestion differs per movement in the batch and the exclusion is applied once, per movement,
 * by the pure `buildCategoryChoices` instead.
 */
export function listMostUsedCategories(
  db: AppDatabase,
  params: {
    income: 0 | 1;
    excludeCategoryId?: string | null;
    limit: number;
    locale: SupportedLocale;
  },
): Category[] {
  const rows = db
    .select({
      id: transactionCategories.id,
      slug: transactionCategories.slug,
      income: transactionCategories.income,
      labels: transactionCategories.labels,
      assets: transactionCategories.assets,
      sortOrder: transactionCategories.sortOrder,
    })
    .from(transactions)
    .innerJoin(transactionCategories, eq(transactions.transactionCategoryId, transactionCategories.id))
    .where(
      and(
        eq(transactionCategories.income, params.income),
        params.excludeCategoryId != null ? ne(transactionCategories.id, params.excludeCategoryId) : undefined,
      ),
    )
    .groupBy(transactionCategories.id)
    .orderBy(desc(sql`count(${transactions.id})`), asc(transactionCategories.sortOrder))
    .limit(params.limit)
    .all() as TransactionCategoryRow[];
  return rows.map((row) => mapCategoryRow(row, params.locale));
}

export function getCategory(db: AppDatabase, id: string, locale: SupportedLocale): Category | undefined {
  const row = db
    .select()
    .from(transactionCategories)
    .where(eq(transactionCategories.id, id))
    .get() as TransactionCategoryRow | undefined;
  return row ? mapCategoryRow(row, locale) : undefined;
}

/**
 * The base writable shape for a category. `income` is set once, at creation
 * (`createCategory`) — every later edit goes through `UpdateCategoryInput`, which structurally
 * omits it (spec Seed Data Contract's "a category's direction never changes after it is
 * created", AC29).
 */
export interface CategoryWritable {
  slug: string;
  income: 0 | 1;
  labels: CategoryLabels;
  assets?: Assets;
  sortOrder: number;
}

/** `Omit<CategoryWritable, 'income'>` — passing `income` here is a compile error, and
 * `updateCategory` additionally strips it at runtime if a caller bypasses the type (AC29). */
export type UpdateCategoryInput = Omit<CategoryWritable, 'income'>;

export function createCategory(
  db: AppDatabase,
  input: CategoryWritable,
  ports: { newId: () => string; now: () => string },
  userId: string | null = null,
): Category {
  const id = ports.newId();
  const now = ports.now();
  db.insert(transactionCategories)
    .values({
      id,
      slug: input.slug,
      income: input.income,
      labels: JSON.stringify(input.labels),
      assets: input.assets ? JSON.stringify(input.assets) : null,
      userId,
      parentCategoryId: null,
      sortOrder: input.sortOrder,
      createdAt: now,
    })
    .run();
  // `es`/`en` locale is irrelevant to the caller here (creation returns the raw values it just
  // wrote); `es` is used only because `resolveLabel` requires a locale argument.
  return getCategory(db, id, 'es') as Category;
}

/**
 * Updates the writable fields of a category, **never** its `income` direction. `income` is
 * stripped from the built `UPDATE` statement's `set` object unconditionally — even if a caller
 * spreads `{ income: 1 }` into `input` via `as any`, bypassing the type system — so there is no
 * repository call shape that can change an existing category's direction (AC29).
 */
export function updateCategory(db: AppDatabase, id: string, input: UpdateCategoryInput): void {
  // `income` is deliberately destructured out and discarded, never read again — this is the
  // runtime half of the AC29 guarantee; the type omission (`UpdateCategoryInput`) is the other.
  const { slug, labels, assets, sortOrder } = input as UpdateCategoryInput & { income?: unknown };
  db.update(transactionCategories)
    .set({
      slug,
      labels: JSON.stringify(labels),
      assets: assets ? JSON.stringify(assets) : null,
      sortOrder,
    })
    .where(eq(transactionCategories.id, id))
    .run();
}

/**
 * Deletes a category, re-parenting its movements to the ✨ Otros of the same direction (found by
 * stable slug, never by displayed name — Business Rule 18), clearing any merchant default that
 * pointed at it, and removing its budget/recurring rows. Never deletes a movement or a merchant.
 * The two ✨ Otros categories refuse deletion by slug (Business Rule 17, AC9) — the repository
 * guard here, plus the `protect_otros_categories` trigger for a raw `DELETE` that bypasses it.
 * The whole operation is one transaction (AC8): a forced mid-transaction failure leaves the store
 * exactly as it was.
 */
export function deleteCategory(db: AppDatabase, categoryId: string): void {
  db.transaction((tx: AppDatabase) => {
    const category = tx
      .select()
      .from(transactionCategories)
      .where(eq(transactionCategories.id, categoryId))
      .get() as TransactionCategoryRow | undefined;
    if (!category) {
      throw new Error(`Category '${categoryId}' does not exist`);
    }
    if (category.slug === OTROS_EXPENSE_SLUG || category.slug === OTROS_INCOME_SLUG) {
      throw new Error(`Category '${category.slug}' is a ✨ Otros fallback category and cannot be deleted`);
    }

    const fallbackSlug = category.income === 1 ? OTROS_INCOME_SLUG : OTROS_EXPENSE_SLUG;
    const fallback = tx
      .select()
      .from(transactionCategories)
      .where(eq(transactionCategories.slug, fallbackSlug))
      .get() as TransactionCategoryRow | undefined;
    if (!fallback) {
      throw new Error(`Fallback category '${fallbackSlug}' is missing — cannot delete '${categoryId}'`);
    }

    tx.update(transactions)
      .set({ transactionCategoryId: fallback.id })
      .where(eq(transactions.transactionCategoryId, categoryId))
      .run();
    tx.update(merchants)
      .set({ transactionCategoryId: null })
      .where(eq(merchants.transactionCategoryId, categoryId))
      .run();
    tx.delete(userBudgets).where(eq(userBudgets.transactionCategoryId, categoryId)).run();
    tx.delete(userRecurringTransactions)
      .where(eq(userRecurringTransactions.transactionCategoryId, categoryId))
      .run();
    tx.delete(transactionCategories).where(eq(transactionCategories.id, categoryId)).run();
  });
}
