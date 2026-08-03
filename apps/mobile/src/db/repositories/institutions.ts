import { eq } from 'drizzle-orm';

import { parseAssets } from '../json';
import { financialInstitutions, userFinancialInstitutions } from '../schema';
import type { AppDatabase, ConnectableInstitution, SyncConnection } from '../types';

/**
 * `financial_institutions` / `user_financial_institutions` repository (implementation plan
 * Layer-by-Layer, spec Business Rule 20, AC22; issue #10 Decisions 8, 11, 13; Business Rules
 * 23-26; AC10-AC13, AC24-AC27).
 */

interface UserFinancialInstitutionRow {
  id: string;
  financialInstitutionId: string;
  status: string;
  credentialsKey: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  countryCode: string;
}

function mapSyncConnection(row: UserFinancialInstitutionRow): SyncConnection {
  return {
    id: row.id,
    financialInstitutionId: row.financialInstitutionId,
    countryCode: row.countryCode,
    status: row.status as SyncConnection['status'],
    credentialsKey: row.credentialsKey,
    syncStatus: row.syncStatus as SyncConnection['syncStatus'],
    lastSyncAt: row.lastSyncAt,
    lastSuccessAt: row.lastSuccessAt,
    lastErrorCode: row.lastErrorCode as SyncConnection['lastErrorCode'],
    lastErrorMessage: row.lastErrorMessage,
  };
}

/** `bankId` for a `ScraperRunner` call is `financialInstitutionId` itself — the same slug the
 * scraper's `BANK_CONFIGS` registry is keyed by (`docs/project/4-database-model.md`). `countryCode`
 * is not stored on `user_financial_institutions`, so every read here joins `financial_institutions`
 * for it. */
function connectionSelection(db: AppDatabase) {
  return db
    .select({
      id: userFinancialInstitutions.id,
      financialInstitutionId: userFinancialInstitutions.financialInstitutionId,
      status: userFinancialInstitutions.status,
      credentialsKey: userFinancialInstitutions.credentialsKey,
      syncStatus: userFinancialInstitutions.syncStatus,
      lastSyncAt: userFinancialInstitutions.lastSyncAt,
      lastSuccessAt: userFinancialInstitutions.lastSuccessAt,
      lastErrorCode: userFinancialInstitutions.lastErrorCode,
      lastErrorMessage: userFinancialInstitutions.lastErrorMessage,
      createdAt: userFinancialInstitutions.createdAt,
      countryCode: financialInstitutions.countryCode,
    })
    .from(userFinancialInstitutions)
    .innerJoin(
      financialInstitutions,
      eq(userFinancialInstitutions.financialInstitutionId, financialInstitutions.id),
    );
}

/** One connection, in sync-engine shape, or `undefined` when the id does not exist. */
export function getConnection(db: AppDatabase, userFinancialInstitutionId: string): SyncConnection | undefined {
  const row = connectionSelection(db)
    .where(eq(userFinancialInstitutions.id, userFinancialInstitutionId))
    .get() as UserFinancialInstitutionRow | undefined;
  return row ? mapSyncConnection(row) : undefined;
}

/**
 * Every connection, in sync-engine shape, regardless of `status` or `sync_status` — the
 * automatic-sync eligibility predicate (`src/features/sync/auto-sync.ts`, Decision 12) is the one
 * place that filters by those, so this repository stays a dumb read and every AC24/AC25/AC27 case
 * is a table-driven unit test over a pure function rather than a SQL predicate.
 */
export function listSyncableConnections(db: AppDatabase): SyncConnection[] {
  const rows = connectionSelection(db).all() as UserFinancialInstitutionRow[];
  return rows.map(mapSyncConnection);
}

/**
 * `beginSync` (Decision 8): writes exactly one column. Does **not** write `last_sync_at` — every
 * *exit* from `syncing` writes the attempt time (`recordSyncOutcomeInTx` / `recordSyncOutcome`),
 * from the same `now` the write phase uses, which is what makes AC12's "last-success time equals
 * last-attempt time" exactly true.
 */
export function markConnectionSyncing(db: AppDatabase, userFinancialInstitutionId: string): void {
  db.update(userFinancialInstitutions)
    .set({ syncStatus: 'syncing' })
    .where(eq(userFinancialInstitutions.id, userFinancialInstitutionId))
    .run();
}

/**
 * What one sync's exit implies for the connection's record (Decision 8's exit table), built by
 * `src/features/sync/map-read-result.ts` from a mapped `ScrapeResult`. Carries no `now` — the
 * caller supplies one `now` value to {@link recordSyncOutcomeInTx} / {@link recordSyncOutcome},
 * the same one used for every other write in the same sync.
 */
export type ConnectionSyncRecord =
  | { outcome: 'complete' }
  | { outcome: 'failed'; errorCode: string; errorMessage: string }
  | { outcome: 'partial'; errorCode: string; errorMessage: string }
  | { outcome: 'cancelled' };

/**
 * Writes one connection's exit from `syncing` (Decision 8's exit table; spec Business Rules
 * 23-25; AC10-AC13). Every branch sets `sync_status` and `last_sync_at = now` — there is no exit
 * that leaves nothing recorded. Only `complete` sets `last_success_at` and clears the error
 * columns; `failed` and `partial` set the error columns and leave `last_success_at` untouched
 * (omitted from the `set` object, not merely unchanged in value); `cancelled` touches neither —
 * an older failure (e.g. `invalid_credentials`) survives a stop, so the connection does not
 * silently become eligible for automatic syncing again (Decision 10, Assumption A2).
 */
export function recordSyncOutcomeInTx(
  tx: AppDatabase,
  userFinancialInstitutionId: string,
  record: ConnectionSyncRecord,
  now: string,
): void {
  const patch: Record<string, unknown> = { lastSyncAt: now };

  switch (record.outcome) {
    case 'complete':
      patch.syncStatus = 'ok';
      patch.lastSuccessAt = now;
      patch.lastErrorCode = null;
      patch.lastErrorMessage = null;
      break;
    case 'failed':
    case 'partial':
      patch.syncStatus = 'error';
      patch.lastErrorCode = record.errorCode;
      patch.lastErrorMessage = record.errorMessage;
      break;
    case 'cancelled':
      patch.syncStatus = 'idle';
      break;
  }

  tx.update(userFinancialInstitutions)
    .set(patch)
    .where(eq(userFinancialInstitutions.id, userFinancialInstitutionId))
    .run();
}

/**
 * The standalone counterpart to {@link recordSyncOutcomeInTx} (Decision 6): used when a
 * structural defect (`MovementValidationError`) means Phase B's transaction never ran at all, so
 * there is no open transaction to write the failure record inside. Opens its own transaction —
 * a single-row update is already atomic, but this keeps the call shape identical to every other
 * write in this codebase.
 */
export function recordSyncOutcome(
  db: AppDatabase,
  userFinancialInstitutionId: string,
  record: ConnectionSyncRecord,
  now: string,
): void {
  db.transaction((tx: AppDatabase) => {
    recordSyncOutcomeInTx(tx, userFinancialInstitutionId, record, now);
  });
}

/**
 * Crash recovery (Decision 11, spec Business Rule 25, AC26): every connection whose stored
 * `sync_status` is `syncing` is returned to `idle`, with the attempt time recorded and no failure
 * written — `last_success_at` and any existing failure reason/message are left exactly as they
 * were. Run once, before the automatic-sync eligibility check, on every app open
 * (`src/features/sync/app-open.ts`). The device lock is in-process (Decision 13), so at app open
 * it is always free — a `syncing` row can only be a leftover from a killed process.
 */
export function clearStuckSyncingConnections(db: AppDatabase, now: string): number {
  const stuck = db
    .select({ id: userFinancialInstitutions.id })
    .from(userFinancialInstitutions)
    .where(eq(userFinancialInstitutions.syncStatus, 'syncing'))
    .all() as { id: string }[];

  if (stuck.length === 0) return 0;

  db.update(userFinancialInstitutions)
    .set({ syncStatus: 'idle', lastSyncAt: now })
    .where(eq(userFinancialInstitutions.syncStatus, 'syncing'))
    .run();

  return stuck.length;
}

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
