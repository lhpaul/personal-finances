import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

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
  ConnectableInstitution,
  ConnectedBankSummary,
  PickerInstitution,
} from '../types';

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

function mapConnectionRow(row: ConnectionRow): BankConnection {
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

  return row === undefined ? undefined : mapConnectionRow(row);
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
 * `idle -> syncing` (spec Business Rule 17, Decision 7). Deliberately does **not** touch
 * `last_success_at` — that omission is the mechanism behind AC22 ("last attempt and last success
 * are two separate facts"). Item #10 owns this function's shape; this item defines it only
 * because item #10 has not merged first (implementation plan Resolution R5) — the signature
 * matches item #10's merged plan exactly, so whichever item lands second finds its own definition
 * already present and does not redefine it.
 */
export function markConnectionSyncing(db: AppDatabase, id: string, now: string): void {
  db.update(userFinancialInstitutions)
    .set({ syncStatus: 'syncing', lastSyncAt: now })
    .where(eq(userFinancialInstitutions.id, id))
    .run();
}

/**
 * The compensating action of Decision 7: only removes a connection this same call created, and
 * only when it never completed a sync (`last_success_at` still null) — a connection that once
 * synced successfully is never deleted by this path (spec Business Rule 19, "never silently
 * discarded").
 */
export function deleteConnectionIfNeverSynced(db: AppDatabase, id: string): void {
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
