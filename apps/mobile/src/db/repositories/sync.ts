import type { DbPorts } from '../ids';
import type { AppDatabase } from '../types';
import { createMovementEnricher, loadMerchantMatchingSet } from './merchants';
import type { ConnectionSyncRecord } from './institutions';
import { recordSyncOutcomeInTx } from './institutions';
import type { BankProductInput, BankProductWriteCounts } from './products';
import { listProductIdsByExternalId, upsertBankProductsInTx } from './products';
import type { BankTransactionInput, PreparedBankTransaction } from './transactions';
import { MovementValidationError, prepareBankTransactions, writeBankTransactionsInTx } from './transactions';

/**
 * The whole sync write (implementation plan Decision 5, issue #10; spec Business Rules 5-10,
 * 12-21; AC1, AC2, AC7-AC9, AC14-AC22).
 *
 * `db.transaction(...)` in this codebase runs against `BaseSQLiteDatabase<'sync', …>` drivers:
 * the callback **cannot `await`**. Hashing (`ports.digestSha256`) is asynchronous. So the write
 * is split into two phases:
 *
 * - **Phase A — precompute (async, no writes).** Resolves every product id (reusing a stored one
 *   or reserving a fresh one before any hashing happens, because `dedup_hash` folds in the
 *   product id), validates every amount, assigns occurrence indexes and computes every dedup
 *   hash. A movement whose product cannot be resolved — matching neither a product in this read
 *   nor one already stored under this connection — is treated as the same structural defect as a
 *   rejected amount (Decision 6, Assumption A5): `MovementValidationError('unresolved_product')`.
 * - **Phase B — one transaction (sync).** Products upsert → per-product movement upsert (with
 *   enrichment on the insert branch) → the connection's own record. One `db.transaction`, one
 *   commit: a throw anywhere inside rolls the whole thing back, including the connection record
 *   (Business Rule 21, AC14).
 *
 * A thrown `MovementValidationError` propagates out of this function **before** Phase B ever
 * opens — the store is untouched (Business Rule 21's "or none of it is"). The connection's own
 * failure record for that case is a **separate** write, made by the caller
 * (`src/features/sync/sync-engine.ts`), because there is no open transaction left to write it
 * inside (Decision 6).
 */

export interface SyncMovementInput extends BankTransactionInput {
  /** The read's opaque instance identity for the product this movement belongs to — resolved
   * against `productIdByExternalId` in Phase A, never trusted as a literal row id. */
  productExternalId: string;
}

export interface SyncWriteInput {
  userFinancialInstitutionId: string;
  products: BankProductInput[];
  movements: SyncMovementInput[];
  connectionRecord: ConnectionSyncRecord;
}

export interface SyncWriteResult extends BankProductWriteCounts {
  movementsStored: number;
  movementsAlreadyKnown: number;
}

function groupMovementsByProduct(movements: SyncMovementInput[]): Map<string, BankTransactionInput[]> {
  const groups = new Map<string, BankTransactionInput[]>();
  for (const { productExternalId, ...rest } of movements) {
    const existing = groups.get(productExternalId);
    if (existing) {
      existing.push(rest);
    } else {
      groups.set(productExternalId, [rest]);
    }
  }
  return groups;
}

export async function applySyncWrite(
  db: AppDatabase,
  ports: DbPorts,
  input: SyncWriteInput,
): Promise<SyncWriteResult> {
  // Phase A — every `await` happens here, before the transaction opens.
  const productIdByExternalId = listProductIdsByExternalId(db, input.userFinancialInstitutionId);
  for (const product of input.products) {
    if (!productIdByExternalId.has(product.externalId)) {
      productIdByExternalId.set(product.externalId, ports.newId());
    }
  }

  const groupedMovements = groupMovementsByProduct(input.movements);
  const preparedByProductId = new Map<string, PreparedBankTransaction[]>();
  for (const [productExternalId, rows] of groupedMovements) {
    const productId = productIdByExternalId.get(productExternalId);
    if (productId === undefined) {
      throw new MovementValidationError('unresolved_product');
    }
    preparedByProductId.set(productId, await prepareBankTransactions(productId, rows, ports));
  }

  const now = ports.now();

  // Phase B — one transaction, no `await`, one commit (Business Rule 21, AC14).
  let result: SyncWriteResult = {
    discovered: 0,
    refreshed: 0,
    movementsStored: 0,
    movementsAlreadyKnown: 0,
  };

  db.transaction((tx: AppDatabase) => {
    const productCounts = upsertBankProductsInTx(
      tx,
      input.userFinancialInstitutionId,
      input.products,
      productIdByExternalId,
      now,
    );

    const enricher = createMovementEnricher(loadMerchantMatchingSet(tx));

    let movementsStored = 0;
    let movementsAlreadyKnown = 0;
    for (const [productId, prepared] of preparedByProductId) {
      const counts = writeBankTransactionsInTx(tx, productId, prepared, now, enricher);
      movementsStored += counts.storedFirstTime;
      movementsAlreadyKnown += counts.alreadyKnown;
    }

    recordSyncOutcomeInTx(tx, input.userFinancialInstitutionId, input.connectionRecord, now);

    result = {
      discovered: productCounts.discovered,
      refreshed: productCounts.refreshed,
      movementsStored,
      movementsAlreadyKnown,
    };
  });

  return result;
}
