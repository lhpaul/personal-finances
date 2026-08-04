import { suggestCategory, type CategorySuggestion } from '@finanzas/shared-domain';

import { getCategory, listCategories, listMostUsedCategories } from '../../db/repositories/categories';
import { getTransactionContext } from '../../db/repositories/transactions';
import type { AppDatabase, Category, TransactionContext } from '../../db/types';
import type { SupportedLocale } from '../../i18n/locale';
import { buildCategoryChoices, MAX_CATEGORY_CHIPS, type CategoryChoice } from '../categorization/category-choices';

/**
 * `transaction-detail` (#16) implementation plan Decision 2, Layer-by-Layer: the pure
 * composition of `getTransactionContext`, `getCategory`, `listCategories` and
 * `listMostUsedCategories` into one internally-consistent snapshot. No React, no SQL of its own
 * — `useTransactionDetail` is the only caller. Because the driver is synchronous, this composes
 * every call in a single uninterrupted pass, so the movement, its category, its product and the
 * picker's chip inputs can never describe different store states (Decision 2).
 */
export interface TransactionDetailParams {
  transactionId: string;
  locale: SupportedLocale;
}

export interface TransactionDetailSnapshot {
  context: TransactionContext;
  /** `undefined` when the movement has no category — never re-read by a second mapper; this
   * reuses the already-exported `getCategory` (Decision 3). */
  category: Category | undefined;
  /** The curated (at most seven) chip list `CategoryPickerSheet` renders first — #13's own
   * `buildCategoryChoices`, fed with exactly the inputs #13's `CategorizeScreen` gives it
   * (Decision 7). */
  categoryChoices: CategoryChoice[];
  /** The movement's own direction's full taxonomy, for the picker's "Elegir otra" expansion —
   * the same two-tier chip list #13's `CategorizeScreen` already offers, reused rather than
   * reinvented. */
  taxonomy: Category[];
  suggestion: CategorySuggestion | null;
}

export function readTransactionDetail(
  db: AppDatabase,
  params: TransactionDetailParams,
): TransactionDetailSnapshot | undefined {
  const context = getTransactionContext(db, params.transactionId);
  if (!context) return undefined;

  const { transaction, merchant } = context;
  const category =
    transaction.transactionCategoryId !== null
      ? getCategory(db, transaction.transactionCategoryId, params.locale)
      : undefined;

  const income = transaction.type === 'credit' ? 1 : 0;
  const taxonomy = listCategories(db, { income, locale: params.locale });
  const used = listMostUsedCategories(db, { income, limit: MAX_CATEGORY_CHIPS, locale: params.locale });
  const suggestion = suggestCategory({ currentCategorySource: transaction.categorySource, merchant });
  const categoryChoices = buildCategoryChoices({ suggestion, used, taxonomy });

  return { context, category, categoryChoices, taxonomy, suggestion };
}
