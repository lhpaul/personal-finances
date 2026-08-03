import { eq, inArray, sql } from 'drizzle-orm';

import { parseAssets, parseInstitutionMetadata } from '../json';
import { financialInstitutions, userFinancialInstitutions, userFinancialProducts } from '../schema';
import type { AppDatabase, BankConnection, ConnectedBanksSummary } from '../types';

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

interface BankConnectionRow {
  id: string;
  institutionName: string;
  institutionAssets: string | null;
  institutionMetadata: string | null;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
}

/**
 * `home`'s "Bancos conectados" card (implementation plan for issue #12, Decision 4 inputs, Layer-
 * by-Layer). A sibling of {@link getConnectedBanksSummary}, which answers a different question
 * (connected institutions plus product counts, for `onboarding-ready`) — this reads **every**
 * connection regardless of `status`, because `resolveHomeState` needs to see a `disconnected` or
 * `error` connection too.
 */
export function listBankConnections(db: AppDatabase): BankConnection[] {
  const rows = db
    .select({
      id: userFinancialInstitutions.id,
      institutionName: financialInstitutions.name,
      institutionAssets: financialInstitutions.assets,
      institutionMetadata: financialInstitutions.metadata,
      status: userFinancialInstitutions.status,
      syncStatus: userFinancialInstitutions.syncStatus,
      lastSyncAt: userFinancialInstitutions.lastSyncAt,
      lastSuccessAt: userFinancialInstitutions.lastSuccessAt,
      lastErrorCode: userFinancialInstitutions.lastErrorCode,
    })
    .from(userFinancialInstitutions)
    .innerJoin(
      financialInstitutions,
      eq(userFinancialInstitutions.financialInstitutionId, financialInstitutions.id),
    )
    .all() as BankConnectionRow[];

  return rows.map((row) => {
    const metadata = parseInstitutionMetadata(row.institutionMetadata);
    return {
      id: row.id,
      institutionName: row.institutionName,
      institutionLogoUrl: parseAssets(row.institutionAssets).logo,
      institutionShortName: metadata.short_name,
      institutionBrandColor: metadata.brand_color,
      status: row.status,
      syncStatus: row.syncStatus,
      lastSyncAt: row.lastSyncAt,
      lastSuccessAt: row.lastSuccessAt,
      lastErrorCode: row.lastErrorCode,
    };
  });
}
