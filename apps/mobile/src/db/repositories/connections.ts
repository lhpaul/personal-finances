import { eq, inArray, sql } from 'drizzle-orm';

import { financialInstitutions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import type { AppDatabase, ConnectedBanksSummary } from '../types';

/**
 * Read-only connection summary for `onboarding-ready` (implementation plan Decision 7,
 * Layer-by-Layer — Database / Data Layer). Write-side connection functions belong to item #9.
 *
 * The connection `status` value this reads is `'active'` — `docs/project/4-database-model.md`
 * → `user_financial_institutions.status` enumerates `active | inactive | disconnected`, and
 * `'active'` is the value item #9 writes on a successful connect (its plan's Resolution R2).
 * An earlier revision of this plan read `'connected'`, a value the schema does not define; that
 * wording was corrected before implementation (see `docs/project/4-database-model.md` and this
 * plan's own text).
 */
export function getConnectedBanksSummary(db: AppDatabase): ConnectedBanksSummary {
  const activeRows = db
    .select({
      id: userFinancialInstitutions.id,
      name: financialInstitutions.name,
    })
    .from(userFinancialInstitutions)
    .innerJoin(
      financialInstitutions,
      eq(userFinancialInstitutions.financialInstitutionId, financialInstitutions.id),
    )
    .where(eq(userFinancialInstitutions.status, 'active'))
    .all() as { id: string; name: string }[];

  if (activeRows.length === 0) {
    return { connectionCount: 0, institutionNames: [], productCount: 0 };
  }

  const activeInstitutionIds = activeRows.map((row) => row.id);
  const productCountRow = db
    .select({ count: sql<number>`count(*)` })
    .from(userFinancialProducts)
    .where(inArray(userFinancialProducts.userFinancialInstitutionId, activeInstitutionIds))
    .get() as { count: number } | undefined;

  return {
    connectionCount: activeRows.length,
    institutionNames: activeRows.map((row) => row.name),
    productCount: productCountRow?.count ?? 0,
  };
}
