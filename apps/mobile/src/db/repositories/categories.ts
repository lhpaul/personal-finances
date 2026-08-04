import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';

import type { Assets, CategoryLabels } from '../json';
import { parseAssets, parseCategoryLabels } from '../json';
import type { SupportedLocale } from '../labels';
import { resolveLabel } from '../labels';
import { merchants, transactionCategories, transactions, userBudgets, userRecurringTransactions } from '../schema';
import { nextAvailableSlug, slugifyCategoryName } from '../slug';
import type { AppDatabase, Category, CategoryWithUsage } from '../types';

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

/**
 * The single statement of "is this the system fallback category" (implementation plan for issue
 * #21, Decision 3) — every guard in this file (delete, rename, reorder) and every caller outside
 * `src/db` that needs to render ✨ Otros as inert (no edit sheet, no drag handle) reads this
 * function rather than re-spelling the two slug literals.
 */
export function isOtrosSlug(slug: string): boolean {
  return slug === OTROS_EXPENSE_SLUG || slug === OTROS_INCOME_SLUG;
}

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
 * `#screen=settings-categories`'s row source (implementation plan for issue #21, Decision 2, 6).
 * One grouped query — aggregate in SQL, not in JS (`sqlite-drizzle.md`) — rather than one query
 * per row. `monthCount` is movements whose `date_local` falls inside
 * `[startDateLocal, endDateLocal]`; `totalCount` is every movement of the category, all time.
 *
 * Both counts include **excluded** movements: an excluded movement is still stored, still
 * belongs to the category, and still gets re-parented when the category is deleted (Business
 * Rule 7) — this is a storage fact, not an analysis figure, so this function never names
 * `excludedAt` / `includedAmount` and does not restate the inclusion rule (Decision 6;
 * `inclusion-rule-single-definition.test.ts` stays green with this query in the file).
 */
export function listCategoriesWithUsage(
  db: AppDatabase,
  params: { income: 0 | 1; locale: SupportedLocale; startDateLocal: string; endDateLocal: string },
): CategoryWithUsage[] {
  const rows = db
    .select({
      id: transactionCategories.id,
      slug: transactionCategories.slug,
      income: transactionCategories.income,
      labels: transactionCategories.labels,
      assets: transactionCategories.assets,
      sortOrder: transactionCategories.sortOrder,
      totalCount: sql<number>`count(${transactions.id})`,
      monthCount: sql<number>`sum(case when ${transactions.dateLocal} between ${params.startDateLocal} and ${params.endDateLocal} then 1 else 0 end)`,
    })
    .from(transactionCategories)
    .leftJoin(transactions, eq(transactions.transactionCategoryId, transactionCategories.id))
    .where(eq(transactionCategories.income, params.income))
    .groupBy(transactionCategories.id)
    .orderBy(asc(transactionCategories.sortOrder))
    .all() as (TransactionCategoryRow & { totalCount: number | null; monthCount: number | null })[];

  return rows.map((row) => ({
    ...mapCategoryRow(row, params.locale),
    totalCount: row.totalCount ?? 0,
    monthCount: row.monthCount ?? 0,
  }));
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
 * Wraps {@link createCategory} for a person-initiated create (implementation plan for issue #21,
 * Decisions 4, 5, 7). `createCategory` requires a `slug` and a `sortOrder` a screen cannot compute
 * without SQL — this derives both inside one transaction:
 *
 * - the slug is derived from `params.name` (never re-derived on a later rename — Decision 4) and
 *   made unique against **every** existing slug (the unique index is table-wide, not
 *   per-direction);
 * - the new row takes ✨ Otros' current `sortOrder`, and ✨ Otros is pushed one position down — so
 *   a new category always lands immediately above the fallback of its direction (Decision 5).
 *
 * `income` comes only from `params.income` (the active tab) — there is no way to create a
 * category without a direction, matching Decision 7.
 */
export function createUserCategory(
  db: AppDatabase,
  params: { income: 0 | 1; name: string; emoji: string },
  ports: { newId: () => string; now: () => string },
): Category {
  return db.transaction((tx: AppDatabase) => {
    const fallbackSlug = params.income === 1 ? OTROS_INCOME_SLUG : OTROS_EXPENSE_SLUG;
    const fallback = tx
      .select()
      .from(transactionCategories)
      .where(eq(transactionCategories.slug, fallbackSlug))
      .get() as TransactionCategoryRow | undefined;
    if (!fallback) {
      throw new Error(`Fallback category '${fallbackSlug}' is missing — cannot create a category`);
    }

    const takenSlugs = tx
      .select({ slug: transactionCategories.slug })
      .from(transactionCategories)
      .all()
      .map((row) => (row as { slug: string }).slug);

    const slug = nextAvailableSlug(slugifyCategoryName(params.name), takenSlugs);

    const created = createCategory(
      tx,
      {
        slug,
        income: params.income,
        labels: { es: params.name, en: params.name },
        assets: { emoji: params.emoji },
        sortOrder: fallback.sortOrder,
      },
      ports,
      null,
    );

    tx.update(transactionCategories)
      .set({ sortOrder: fallback.sortOrder + 1 })
      .where(eq(transactionCategories.id, fallback.id))
      .run();

    return created;
  });
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
 * Renames a category's display name and re-icons it, without ever touching its `slug` or its
 * `sortOrder` (implementation plan for issue #21, Decisions 3, 4). Writes the same `name` to both
 * `es` and `en` labels — the mockup's edit sheet has one *Nombre* field, not a per-locale pair.
 *
 * `updateCategory` takes the full writable shape, so a naive caller could rewrite the stable slug
 * or the sort order by accident; this reads the row first and passes its own `slug`/`sortOrder`
 * straight back through. Refuses either ✨ Otros by slug — there is no store-level `BEFORE UPDATE`
 * backstop for a rename (Decision 3's table; recorded as follow-up 2, not silently skipped).
 */
export function renameCategory(db: AppDatabase, id: string, params: { name: string; emoji: string }): void {
  db.transaction((tx: AppDatabase) => {
    const row = tx
      .select()
      .from(transactionCategories)
      .where(eq(transactionCategories.id, id))
      .get() as TransactionCategoryRow | undefined;
    if (!row) {
      throw new Error(`Category '${id}' does not exist`);
    }
    if (isOtrosSlug(row.slug)) {
      throw new Error(`Category '${row.slug}' is a ✨ Otros fallback category and cannot be renamed`);
    }

    updateCategory(tx, id, {
      slug: row.slug,
      labels: { es: params.name, en: params.name },
      assets: { emoji: params.emoji },
      sortOrder: row.sortOrder,
    });
  });
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
    if (isOtrosSlug(category.slug)) {
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

/**
 * Persists a drag-to-reorder result (implementation plan for issue #21, Decision 5). Validates
 * that `orderedIds` is **exactly** the set of non-fallback ids of `params.income`'s direction,
 * each appearing once — omitting an id, repeating one, naming a foreign-direction id, or naming
 * the fallback id throws before any `UPDATE` runs, so a rejected call leaves every `sort_order`
 * unchanged. On success, assigns `1…n` in the given order and pins ✨ Otros at `n + 1` — the only
 * two functions in this file that ever write `sort_order` are this one and
 * {@link createUserCategory}.
 */
export function reorderCategories(
  db: AppDatabase,
  params: { income: 0 | 1; orderedIds: readonly string[] },
): void {
  db.transaction((tx: AppDatabase) => {
    const rows = tx
      .select({ id: transactionCategories.id, slug: transactionCategories.slug })
      .from(transactionCategories)
      .where(eq(transactionCategories.income, params.income))
      .all() as { id: string; slug: string }[];

    const fallback = rows.find((row) => isOtrosSlug(row.slug));
    if (!fallback) {
      throw new Error(`Fallback category for income=${params.income} is missing — cannot reorder`);
    }

    const movableIds = rows.filter((row) => row.id !== fallback.id).map((row) => row.id);
    const expected = new Set(movableIds);
    const given = params.orderedIds;
    const isExactlyTheMovableSet =
      given.length === movableIds.length &&
      new Set(given).size === given.length &&
      given.every((id) => expected.has(id));

    if (!isExactlyTheMovableSet) {
      throw new Error(
        'reorderCategories: orderedIds must contain exactly the non-fallback ids of this direction, each once',
      );
    }

    given.forEach((id, index) => {
      tx.update(transactionCategories)
        .set({ sortOrder: index + 1 })
        .where(eq(transactionCategories.id, id))
        .run();
    });
    tx.update(transactionCategories)
      .set({ sortOrder: given.length + 1 })
      .where(eq(transactionCategories.id, fallback.id))
      .run();
  });
}
