import { deriveDateLocal } from '@finanzas/shared-utils';
import { eq } from 'drizzle-orm';

import { credentialsKeyFor } from '../lib/secure-store/credential-store';
import { transactions, userFinancialInstitutions, userFinancialProducts } from './schema';
import type { AppDatabase } from './types';

/**
 * `__DEV__`-only fixture support for the connect-a-bank smoke runbook (implementation plan
 * Decision 13). Lives in `src/db` — not `src/dev` — because it is the one place allowed to touch
 * SQL directly (`dbAccessBoundary`); `src/dev/connect-fixtures-store.ts` is a thin
 * `getAppDatabase()`-calling wrapper around the functions here, mirroring the
 * `app/ → feature hooks → src/db` layering `src/dev/sample-store.ts` already established for the
 * home-screen fixture surface.
 *
 * Every row this file plants uses a deterministic, fixture-owned id
 * (`dev-fixture-connection-<institutionId>` and its products/transactions) so replanting is
 * idempotent (delete-then-insert) and clearing never touches a row a real sync could have
 * written (item #10, not yet built, would use a different id scheme entirely — `expo-crypto`
 * UUIDs).
 */

function fixtureConnectionId(institutionId: string): string {
  return `dev-fixture-connection-${institutionId}`;
}

/** Removes a previously-planted connection for this institution, if any — cascades (`PRAGMA
 * foreign_keys = ON`) to its products and their transactions, so replanting never duplicates. */
function clearPlantedConnection(db: AppDatabase, institutionId: string): void {
  db.delete(userFinancialInstitutions)
    .where(eq(userFinancialInstitutions.id, fixtureConnectionId(institutionId)))
    .run();
}

/**
 * Plants one `active` connection whose first sync already succeeded, with `productCount`
 * products and `movementCount` movements spread across them — real numbers `bank-connected`'s
 * `single`/`multiple` states can render (AC24, AC25), until item #10 makes this true for real.
 */
export function plantSyncedConnection(
  db: AppDatabase,
  institutionId: string,
  counts: { productCount: number; movementCount: number },
): void {
  clearPlantedConnection(db, institutionId);
  const nowInstant = new Date();
  const now = nowInstant.toISOString();
  // Found in review (CodeRabbit PR #80): `now.slice(0, 10)` reads the UTC date, which can name
  // the wrong Santiago day near local midnight (AGENTS.md troubleshooting: "A transaction shows
  // up in the wrong month").
  const dateLocal = deriveDateLocal(nowInstant);
  const connectionId = fixtureConnectionId(institutionId);

  db.insert(userFinancialInstitutions)
    .values({
      id: connectionId,
      financialInstitutionId: institutionId,
      status: 'active',
      credentialsKey: credentialsKeyFor(institutionId),
      syncStatus: 'ok',
      lastSyncAt: now,
      lastSuccessAt: now,
      createdAt: now,
    })
    .run();

  const productCount = Math.max(1, counts.productCount);
  const productIds: string[] = [];
  for (let i = 0; i < productCount; i += 1) {
    const productId = `${connectionId}-product-${i}`;
    productIds.push(productId);
    db.insert(userFinancialProducts)
      .values({
        id: productId,
        userFinancialInstitutionId: connectionId,
        externalId: `fixture-external-${productId}`,
        type: 'checking',
        name: 'Cuenta corriente',
        updatedAt: now,
      })
      .run();
  }

  for (let i = 0; i < counts.movementCount; i += 1) {
    const productId = productIds[i % productIds.length] as string;
    const txnId = `${connectionId}-txn-${i}`;
    db.insert(transactions)
      .values({
        id: txnId,
        userFinancialProductId: productId,
        externalId: null,
        dedupHash: txnId,
        amount: 1000 + i,
        type: 'debit',
        occurredAt: now,
        dateLocal,
        rawDescription: 'Movimiento de ejemplo',
        isManual: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

/** Removes every connection this fixture surface may have planted (Assumption A6: the
 * `multiple`-state fixture plants a second connection against a coming-soon institution, which
 * is legitimate at the data layer and unreachable from the picker). */
export function clearConnectFixtures(db: AppDatabase, institutionIds: string[]): void {
  for (const institutionId of institutionIds) {
    clearPlantedConnection(db, institutionId);
  }
}
