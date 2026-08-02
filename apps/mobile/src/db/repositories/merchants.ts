import { eq } from 'drizzle-orm';

import { merchants, transactions } from '../schema';
import type { AppDatabase } from '../types';

/**
 * `merchants` repository (implementation plan Layer-by-Layer, spec Business Rule 21, AC10, AC22).
 *
 * There is no `deleteTransaction` export anywhere in `src/db` (Business Rule 5, AC22) — a
 * movement is never deleted, only excluded. `deleteMerchant` reflects the same asymmetry on the
 * merchant side: its aliases go with it (`merchant_aliases.merchant_id` is
 * `ON DELETE CASCADE`), but every movement that named it survives and simply stops naming a
 * merchant.
 */
export function deleteMerchant(db: AppDatabase, merchantId: string): void {
  db.transaction((tx: AppDatabase) => {
    // `transactions.merchant_id` has no `ON DELETE` action, so with `PRAGMA foreign_keys = ON`
    // (Decision 5) the merchant row cannot be deleted while a movement still references it —
    // this update must run first, inside the same transaction, so the operation is indivisible.
    tx.update(transactions)
      .set({ merchantId: null })
      .where(eq(transactions.merchantId, merchantId))
      .run();
    // `merchant_aliases` cascades via its own foreign key (`ON DELETE CASCADE`).
    tx.delete(merchants).where(eq(merchants.id, merchantId)).run();
  });
}
