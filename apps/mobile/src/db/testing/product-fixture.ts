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

export function createTestProduct(
  db: AppDatabase,
  ports: { newId: () => string; now: () => string },
  userFinancialInstitutionId: string,
  overrides?: { externalId?: string; type?: string; name?: string },
): string {
  const id = ports.newId();
  db.insert(userFinancialProducts)
    .values({
      id,
      userFinancialInstitutionId,
      externalId: overrides?.externalId ?? `product-${id}`,
      type: overrides?.type ?? 'checking',
      name: overrides?.name ?? 'Cuenta corriente',
      updatedAt: ports.now(),
    })
    .run();
  return id;
}
