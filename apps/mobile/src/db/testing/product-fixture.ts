import { eq } from 'drizzle-orm';

import { userFinancialInstitutions, userFinancialProducts } from '../schema';
import type { AppDatabase } from '../types';

/**
 * Test-only helpers that build a connected bank and one or more of its products, for repository
 * tests that need a real `user_financial_products.id` to attach movements to. Not used by
 * application code — `src/db/seeds/` never creates a connection or a product (those are always
 * discovered by a sync, which is a later item's surface).
 */

export function createTestConnection(
  db: AppDatabase,
  ports: { newId: () => string; now: () => string },
  financialInstitutionId = 'banco-de-chile',
): string {
  const id = ports.newId();
  db.insert(userFinancialInstitutions)
    .values({
      id,
      financialInstitutionId,
      status: 'active',
      credentialsKey: `secure-store-key-${id}`,
      syncStatus: 'idle',
      createdAt: ports.now(),
    })
    .run();
  return id;
}

/**
 * Test-only, direct field overrides on a connection row (issue #10) — for feature-level tests
 * (`src/features/sync/__tests__/*`) that need to plant a specific sync-bookkeeping state
 * (`syncStatus`, `lastSuccessAt`, …) without going through a real sync. Lives in `src/db/testing/`
 * — never `src/features/` — because only `src/db/` may import `drizzle-orm`
 * (`src/db/__tests__/db-access-boundary.test.ts`).
 */
export function setConnectionFieldsForTest(
  db: AppDatabase,
  userFinancialInstitutionId: string,
  fields: Partial<{
    status: string;
    syncStatus: string;
    lastSyncAt: string | null;
    lastSuccessAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }>,
): void {
  db.update(userFinancialInstitutions)
    .set(fields)
    .where(eq(userFinancialInstitutions.id, userFinancialInstitutionId))
    .run();
}

export function createTestProduct(
  db: AppDatabase,
  ports: { newId: () => string; now: () => string },
  userFinancialInstitutionId: string,
  overrides?: { externalId?: string; type?: string; name?: string; currencyCode?: string },
): string {
  const id = ports.newId();
  db.insert(userFinancialProducts)
    .values({
      id,
      userFinancialInstitutionId,
      externalId: overrides?.externalId ?? `product-${id}`,
      type: overrides?.type ?? 'checking',
      name: overrides?.name ?? 'Cuenta corriente',
      // `currencyCode` defaults to the schema's own `'CLP'` default when omitted (found in
      // review on PR #82 — needed to test a foreign-currency product's manual-entry write).
      ...(overrides?.currencyCode !== undefined ? { currencyCode: overrides.currencyCode } : {}),
      updatedAt: ports.now(),
    })
    .run();
  return id;
}
