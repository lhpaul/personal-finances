import { listCategories } from '../../db/repositories/categories';
import type { SupportedLocale } from '../../db/labels';
import { listUserProducts } from '../../db/repositories/products';
import { countTransactionsByMonth, listTransactionsPage } from '../../db/repositories/transactions';
import type {
  AppDatabase,
  Category,
  MonthCount,
  TransactionListPage,
  TransactionPageParams,
  UserProduct,
} from '../../db/types';

/**
 * The pure composition {@link readTransactionsPage} calls (implementation plan for issue #15,
 * Decision 2, Layer-by-Layer). Bundles everything one read of the `transactions` screen needs:
 * the page itself, the month-group counts (built from the **same** predicates as the page, so a
 * header count and the rows under it can never describe different sets), the category catalogue
 * (both directions, for search's category-name resolution and the row's category label) and the
 * product list (for the **Producto** filter pills).
 */
export interface TransactionsPageData {
  page: TransactionListPage;
  monthCounts: MonthCount[];
  categories: Category[];
  products: UserProduct[];
}

/**
 * No React, so it is testable against a real in-memory store in the `db` tier. Every repository
 * call here is synchronous (`BaseSQLiteDatabase<'sync', …>`), so the four reads happen in one
 * uninterrupted pass with no interleaved write — the mechanism behind "one internally consistent
 * snapshot" (concurrency addendum).
 */
export function readTransactionsPage(
  db: AppDatabase,
  params: TransactionPageParams,
  locale: SupportedLocale,
): TransactionsPageData {
  return {
    page: listTransactionsPage(db, params, locale),
    monthCounts: countTransactionsByMonth(db, params),
    categories: [
      ...listCategories(db, { income: 0, locale }),
      ...listCategories(db, { income: 1, locale }),
    ],
    products: listUserProducts(db),
  };
}
