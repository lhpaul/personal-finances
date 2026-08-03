import type { SyncConnection } from '../../db/types';

/**
 * Automatic-sync eligibility (implementation plan Decision 12, issue #10; spec Business Rule 24,
 * Decisions 1-3, AC24, AC25, AC27).
 *
 * Pure: takes no database handle, no `Date.now()`. Every AC24/AC25/AC27 case is a table-driven
 * unit test over {@link isDueForAutomaticSync}. The constant lives here, not in
 * `@finanzas/shared-domain` — that package's surface is a rule about a movement, and this is an
 * app-scheduling policy.
 */
export const AUTOMATIC_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** `now - iso > AUTOMATIC_SYNC_INTERVAL_MS`, strictly greater ("more than six hours"). `null`
 * (never synced / never attempted) counts as due. Duration arithmetic over two ISO-8601 UTC
 * instants — not calendar-day derivation, so Business Rule 16 is not in play here. */
function olderThanInterval(iso: string | null, nowIso: string): boolean {
  if (iso === null) return true;
  return Date.parse(nowIso) - Date.parse(iso) > AUTOMATIC_SYNC_INTERVAL_MS;
}

/**
 * True when **all** hold (spec Business Rule 24):
 *
 * - `connection.status === 'active'` (AC27 — `inactive` and `disconnected` are never automatic)
 * - `connection.syncStatus !== 'syncing'`
 * - `connection.lastErrorCode !== 'invalid_credentials'` (AC25)
 * - `lastSuccessAt` is `null`, or more than six hours old (AC24)
 * - `lastSyncAt` is `null`, or more than six hours old (spec Decision 2 — the last-*attempt* half
 *   of the interval, so a permanently failing connection does not read the bank on every app
 *   open)
 */
export function isDueForAutomaticSync(connection: SyncConnection, nowIso: string): boolean {
  if (connection.status !== 'active') return false;
  if (connection.syncStatus === 'syncing') return false;
  if (connection.lastErrorCode === 'invalid_credentials') return false;
  if (!olderThanInterval(connection.lastSuccessAt, nowIso)) return false;
  if (!olderThanInterval(connection.lastSyncAt, nowIso)) return false;
  return true;
}

/** Filters a connection list down to the ones due for an automatic sync right now. */
export function selectConnectionsDueForAutomaticSync(
  connections: readonly SyncConnection[],
  nowIso: string,
): SyncConnection[] {
  return connections.filter((connection) => isDueForAutomaticSync(connection, nowIso));
}
