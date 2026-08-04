import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Now, NewId } from '../ids';
import { parseAssets, parseInstitutionMetadata } from '../json';
import {
  financialInstitutions,
  userFinancialInstitutions,
  userFinancialProducts,
  transactions,
} from '../schema';
import type {
  AppDatabase,
  BankConnection,
  BankConnectionSummary,
  ConnectableInstitution,
  ConnectedBankSummary,
  PickerInstitution,
  SyncConnection,
} from '../types';

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
 * `markConnectionSyncing` (Decision 8): writes exactly one column. Does **not** write
 * `last_sync_at` — every *exit* from `syncing` writes the attempt time
 * (`recordSyncOutcomeInTx` / `recordSyncOutcome`), from the same `now` the write phase uses,
 * which is what makes AC12's "last-success time equals last-attempt time" exactly true.
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
  | { outcome: 'failed'; errorCode: NonNullable<SyncConnection['lastErrorCode']>; errorMessage: string }
  | { outcome: 'partial'; errorCode: NonNullable<SyncConnection['lastErrorCode']>; errorMessage: string }
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
  const patch: Partial<typeof userFinancialInstitutions.$inferInsert> = { lastSyncAt: now };

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

// -------------------------------------------------------------------------------------------
// Connect-a-bank (issue #9). The functions below are this item's own contribution — added next
// to the merged reads above, following the merged codebase's convention of keeping every
// `user_financial_institutions` writer in this one file (implementation plan Resolution R5).
// -------------------------------------------------------------------------------------------

/** `bank-picker` (`list`, `search`, `no-results`) — spec Business Rule 9: the picker draws
 * every seeded bank, not a hand-written list. Ordering is **not** applied here — the pure
 * `sortForPicker` (`src/features/connect-bank/institution-search.ts`) is the single place
 * "available first, then by name" is decided, so `list` and a cleared `search` render identically
 * (Business Rule 10). */
export function listInstitutions(db: AppDatabase): PickerInstitution[] {
  const rows = db
    .select({
      id: financialInstitutions.id,
      name: financialInstitutions.name,
      scraperStatus: financialInstitutions.scraperStatus,
      metadata: financialInstitutions.metadata,
    })
    .from(financialInstitutions)
    .all() as { id: string; name: string; scraperStatus: string; metadata: string | null }[];

  return rows.map((row) => {
    const metadata = parseInstitutionMetadata(row.metadata);
    return {
      id: row.id,
      name: row.name,
      scraperStatus: row.scraperStatus as PickerInstitution['scraperStatus'],
      shortName: metadata.short_name,
      brandColor: metadata.brand_color,
    };
  });
}

interface ConnectionRow {
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

function mapConnectionRow(row: ConnectionRow, institutionId: string): BankConnection {
  const metadata = parseInstitutionMetadata(row.institutionMetadata);
  return {
    id: row.id,
    institutionId,
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
}

/** Spec Use Cases 5 and 7 — "does a connection already exist for this bank?". Read-only; never
 * used to answer the RUT-lock question (Decision 6 answers that from the secure store, through
 * {@link listConnectionsForCredentialLookup}), only to decide whether {@link upsertConnection}
 * inserts or updates. */
export function getConnectionByInstitution(
  db: AppDatabase,
  institutionId: string,
): BankConnection | undefined {
  const row = db
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
    .where(eq(userFinancialInstitutions.financialInstitutionId, institutionId))
    .get() as ConnectionRow | undefined;

  return row === undefined ? undefined : mapConnectionRow(row, institutionId);
}

/**
 * Confirming credentials creates or repairs a connection (spec Business Rules 14-16, AC19-AC21,
 * implementation plan Decision 7). Select-then-branch is safe here without a race window: every
 * SQLite call in this codebase's `'sync'` drivers is synchronous, so nothing can interleave
 * between the `select` and the `insert`/`update` below within one JS call stack — the
 * `user_financial_institutions_institution_unique` index is still the backstop that makes
 * "exactly one connection per bank" true even if that assumption is ever violated.
 *
 * On update: only `status` is touched. `credentials_key`, `last_sync_at`, `last_success_at` and
 * the error columns survive untouched (Business Rules 14-15), which is what lets AC21 and AC22
 * hold across a reconnect.
 */
export function upsertConnection(
  db: AppDatabase,
  args: { institutionId: string; credentialsKey: string; newId: NewId; now: Now },
): { id: string; created: boolean } {
  const existing = db
    .select({ id: userFinancialInstitutions.id })
    .from(userFinancialInstitutions)
    .where(eq(userFinancialInstitutions.financialInstitutionId, args.institutionId))
    .get() as { id: string } | undefined;

  if (existing !== undefined) {
    db.update(userFinancialInstitutions)
      .set({ status: 'active' })
      .where(eq(userFinancialInstitutions.id, existing.id))
      .run();
    return { id: existing.id, created: false };
  }

  const id = args.newId();
  db.insert(userFinancialInstitutions)
    .values({
      id,
      financialInstitutionId: args.institutionId,
      status: 'active',
      credentialsKey: args.credentialsKey,
      syncStatus: 'idle',
      createdAt: args.now(),
    })
    .run();
  return { id, created: true };
}

/**
 * The compensating action of Decision 7: only removes a connection this same call created, and
 * only when it never completed a sync (`last_success_at` still null) — a connection that once
 * synced successfully is never deleted by this path (spec Business Rule 19, "never silently
 * discarded").
 *
 * Also refuses to delete a connection that already has products (found in review — CodeRabbit PR
 * #80): `user_financial_products` and `transactions` both cascade from
 * `user_financial_institutions` (`onDelete: 'cascade'`), so without this guard a `'partial'` sync
 * outcome — which item #10's `recordSyncOutcomeInTx` can write without ever setting
 * `last_success_at` — would let this delete take stored movements with it. AGENTS.md
 * non-negotiable 3: "Bank movements are never deleted." This item's own `connectBank` never
 * reaches that state today (the compensating delete only runs for a connection *this same call*
 * created, which cannot yet have products), but this exported function offers no such protection
 * to a future caller on its own.
 */
export function deleteConnectionIfNeverSynced(db: AppDatabase, id: string): void {
  const hasProducts =
    db
      .select({ id: userFinancialProducts.id })
      .from(userFinancialProducts)
      .where(eq(userFinancialProducts.userFinancialInstitutionId, id))
      .get() !== undefined;
  if (hasProducts) return;

  db.delete(userFinancialInstitutions)
    .where(
      and(eq(userFinancialInstitutions.id, id), isNull(userFinancialInstitutions.lastSuccessAt)),
    )
    .run();
}

/**
 * Decision 6's deterministic key list — a keychain has no "list every key" API, so the RUT lock
 * (`src/features/connect-bank/rut-lock.ts`) walks this list, oldest connection first, looking for
 * a stored credential entry. Ordered by `created_at` so the answer is deterministic when more
 * than one connection has a stored entry.
 */
export function listConnectionsForCredentialLookup(
  db: AppDatabase,
): { id: string; institutionId: string; credentialsKey: string; createdAt: string }[] {
  const rows = db
    .select({
      id: userFinancialInstitutions.id,
      institutionId: userFinancialInstitutions.financialInstitutionId,
      credentialsKey: userFinancialInstitutions.credentialsKey,
      createdAt: userFinancialInstitutions.createdAt,
    })
    .from(userFinancialInstitutions)
    .orderBy(userFinancialInstitutions.createdAt)
    .all() as { id: string; institutionId: string; credentialsKey: string; createdAt: string }[];
  return rows;
}

/**
 * `bank-connected` (`single`, `multiple`) — spec Business Rule 23, Decision 15: one row per
 * connection that has **completed** a sync (`status = 'active'` and `last_success_at is not
 * null`), with the product/movement counts the sync actually stored (spec Decision 8). Until
 * item #10 lands, both counts are honestly `0` and the row only appears once a `last_success_at`
 * is planted (the dev fixtures surface, or later, a real sync).
 */
export function listConnectedBankSummaries(db: AppDatabase): ConnectedBankSummary[] {
  const rows = db
    .select({
      id: userFinancialInstitutions.id,
      institutionName: financialInstitutions.name,
      institutionMetadata: financialInstitutions.metadata,
    })
    .from(userFinancialInstitutions)
    .innerJoin(
      financialInstitutions,
      eq(userFinancialInstitutions.financialInstitutionId, financialInstitutions.id),
    )
    .where(
      and(
        eq(userFinancialInstitutions.status, 'active'),
        isNotNull(userFinancialInstitutions.lastSuccessAt),
      ),
    )
    .all() as { id: string; institutionName: string; institutionMetadata: string | null }[];

  if (rows.length === 0) return [];

  const connectionIds = rows.map((row) => row.id);

  const productCountRows = db
    .select({
      connectionId: userFinancialProducts.userFinancialInstitutionId,
      count: sql<number>`count(*)`,
    })
    .from(userFinancialProducts)
    .where(inArray(userFinancialProducts.userFinancialInstitutionId, connectionIds))
    .groupBy(userFinancialProducts.userFinancialInstitutionId)
    .all() as { connectionId: string; count: number }[];

  const movementCountRows = db
    .select({
      connectionId: userFinancialProducts.userFinancialInstitutionId,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .innerJoin(userFinancialProducts, eq(transactions.userFinancialProductId, userFinancialProducts.id))
    .where(inArray(userFinancialProducts.userFinancialInstitutionId, connectionIds))
    .groupBy(userFinancialProducts.userFinancialInstitutionId)
    .all() as { connectionId: string; count: number }[];

  const productCountById = new Map(productCountRows.map((row) => [row.connectionId, row.count]));
  const movementCountById = new Map(movementCountRows.map((row) => [row.connectionId, row.count]));

  return rows.map((row) => {
    const metadata = parseInstitutionMetadata(row.institutionMetadata);
    return {
      id: row.id,
      institutionName: row.institutionName,
      institutionShortName: metadata.short_name,
      institutionBrandColor: metadata.brand_color,
      productCount: productCountById.get(row.id) ?? 0,
      movementCount: movementCountById.get(row.id) ?? 0,
    };
  });
}

// -------------------------------------------------------------------------------------------
// settings-banks / bank-review (issue #20). Two reads share one row shape (`BankConnectionSummary`,
// Resolution R6): `listSettingsBankConnections` (filtered to `'active' | 'inactive'`) for the
// list, and `getBankConnectionSummary` (unfiltered) for the detail screen's
// redirect-when-disconnected guard (Decision 13). Named apart from `connections.ts`'s own
// `listBankConnections` (issue #12, unfiltered, for `home`) so the two never read as each other.
// Neither reuses `getConnectionByInstitution` (issue #9): that function's `BankConnection` shape
// carries no `lastErrorMessage`, which `resolveSyncErrorKey` (Decision 10) needs on its input for
// shape parity with the stored column, so this item reads its own shape instead of extending a
// merged sibling item's return type.
// -------------------------------------------------------------------------------------------

interface BankConnectionSummaryRow {
  id: string;
  financialInstitutionId: string;
  institutionName: string;
  institutionMetadata: string | null;
  institutionAssets: string | null;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
}

function bankConnectionSummarySelection(db: AppDatabase) {
  return db
    .select({
      id: userFinancialInstitutions.id,
      financialInstitutionId: userFinancialInstitutions.financialInstitutionId,
      institutionName: financialInstitutions.name,
      institutionMetadata: financialInstitutions.metadata,
      institutionAssets: financialInstitutions.assets,
      status: userFinancialInstitutions.status,
      syncStatus: userFinancialInstitutions.syncStatus,
      lastSyncAt: userFinancialInstitutions.lastSyncAt,
      lastSuccessAt: userFinancialInstitutions.lastSuccessAt,
      lastErrorCode: userFinancialInstitutions.lastErrorCode,
      lastErrorMessage: userFinancialInstitutions.lastErrorMessage,
      createdAt: userFinancialInstitutions.createdAt,
    })
    .from(userFinancialInstitutions)
    .innerJoin(
      financialInstitutions,
      eq(userFinancialInstitutions.financialInstitutionId, financialInstitutions.id),
    );
}

function mapBankConnectionSummary(
  row: BankConnectionSummaryRow,
  productCount: number,
): BankConnectionSummary {
  const metadata = parseInstitutionMetadata(row.institutionMetadata);
  return {
    id: row.id,
    institutionId: row.financialInstitutionId,
    name: row.institutionName,
    shortName: metadata.short_name,
    brandColor: metadata.brand_color,
    logoUrl: parseAssets(row.institutionAssets).logo,
    status: row.status as BankConnectionSummary['status'],
    syncStatus: row.syncStatus as BankConnectionSummary['syncStatus'],
    lastSyncAt: row.lastSyncAt,
    lastSuccessAt: row.lastSuccessAt,
    lastErrorCode: row.lastErrorCode as BankConnectionSummary['lastErrorCode'],
    lastErrorMessage: row.lastErrorMessage,
    productCount,
  };
}

function countProductsByConnection(db: AppDatabase, connectionIds: string[]): Map<string, number> {
  if (connectionIds.length === 0) return new Map();
  const rows = db
    .select({
      connectionId: userFinancialProducts.userFinancialInstitutionId,
      count: sql<number>`count(*)`,
    })
    .from(userFinancialProducts)
    .where(inArray(userFinancialProducts.userFinancialInstitutionId, connectionIds))
    .groupBy(userFinancialProducts.userFinancialInstitutionId)
    .all() as { connectionId: string; count: number }[];
  return new Map(rows.map((row) => [row.connectionId, row.count]));
}

/**
 * `settings-banks`'s list (implementation plan for issue #20, Assumption A7): one row per
 * connection whose `status` is `'active'` or `'inactive'` — a `'disconnected'` connection is
 * never listed (Decision 1's "excluded from the list" consequence). Ordered by `created_at` so
 * the list is stable across reads.
 */
export function listSettingsBankConnections(db: AppDatabase): BankConnectionSummary[] {
  const rows = bankConnectionSummarySelection(db)
    .where(inArray(userFinancialInstitutions.status, ['active', 'inactive']))
    .orderBy(asc(userFinancialInstitutions.createdAt))
    .all() as BankConnectionSummaryRow[];

  const countById = countProductsByConnection(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => mapBankConnectionSummary(row, countById.get(row.id) ?? 0));
}

/**
 * `bank-review`'s single-connection read (implementation plan for issue #20, Decision 13):
 * unlike {@link listSettingsBankConnections}, this is **not** filtered by `status` — the caller
 * distinguishes "no connection at all" (`undefined`) from "a connection that exists but is
 * disconnected" (`status: 'disconnected'`) and redirects to `/settings/banks` on either.
 */
export function getBankConnectionSummary(
  db: AppDatabase,
  institutionId: string,
): BankConnectionSummary | undefined {
  const row = bankConnectionSummarySelection(db)
    .where(eq(userFinancialInstitutions.financialInstitutionId, institutionId))
    .get() as BankConnectionSummaryRow | undefined;
  if (row === undefined) return undefined;

  const countById = countProductsByConnection(db, [row.id]);
  return mapBankConnectionSummary(row, countById.get(row.id) ?? 0);
}
