import { eq } from 'drizzle-orm';

import { parseAssets } from '../json';
import { financialInstitutions, userFinancialInstitutions } from '../schema';
import type { AppDatabase, ConnectableInstitution } from '../types';

/**
 * `financial_institutions` / `user_financial_institutions` repository (implementation plan
 * Layer-by-Layer, spec Business Rule 20, AC22).
 */

interface FinancialInstitutionRow {
  id: string;
  name: string;
  countryCode: string;
  scraperStatus: string;
  assets: string | null;
}

/** Spec "Which banks can be connected right now?" (`bank-picker`) — backed by the
 * `financial_institutions_scraper_status_idx` index. */
export function listConnectableInstitutions(db: AppDatabase): ConnectableInstitution[] {
  const rows = db
    .select()
    .from(financialInstitutions)
    .where(eq(financialInstitutions.scraperStatus, 'available'))
    .all() as FinancialInstitutionRow[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    countryCode: row.countryCode,
    scraperStatus: row.scraperStatus as ConnectableInstitution['scraperStatus'],
    logoUrl: parseAssets(row.assets).logo,
  }));
}

/**
 * Disconnecting a bank is not deleting it (Business Rule 20). Marks the connection
 * `disconnected` and touches **nothing else** — in particular, `credentials_key` (the secure-store
 * *key name*, `TEXT NOT NULL`) is left byte-identical, so a later reconnect can reuse the same
 * deterministic key. The credential *value* is removed by the separate secure-store item; this
 * repository never reads or writes a credential.
 */
export function disconnectInstitution(db: AppDatabase, userFinancialInstitutionId: string): void {
  db.update(userFinancialInstitutions)
    .set({ status: 'disconnected' })
    .where(eq(userFinancialInstitutions.id, userFinancialInstitutionId))
    .run();
}
