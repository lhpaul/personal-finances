import { clearStuckSyncingConnections, listSyncableConnections } from '../../db/repositories/institutions';
import { selectConnectionsDueForAutomaticSync } from './auto-sync';
import { runSync } from './sync-engine';
import type { SyncDeps, SyncRunResult } from './types';

/**
 * `runAppOpenSync` (implementation plan Decisions 11-12, issue #10; spec Use Case 6, Business
 * Rules 24-27; AC24, AC26, AC27).
 *
 * On every app open: clear any connection stuck at `syncing` first (Decision 11), then sync every
 * connection the eligibility predicate selects, one after another. Running the connections in
 * sequence — never concurrently — is what keeps Decision 13's one-read-at-a-time guarantee true
 * without the lock ever refusing one of *this* sweep's own requests.
 */
export async function runAppOpenSync(deps: SyncDeps): Promise<SyncRunResult[]> {
  await deps.ready;

  const now = deps.ports.now();
  clearStuckSyncingConnections(deps.db, now);

  const connections = listSyncableConnections(deps.db);
  const due = selectConnectionsDueForAutomaticSync(connections, deps.ports.now());

  const results: SyncRunResult[] = [];
  for (const connection of due) {
    // Sequential, deliberately: re-reading the connection immediately before deciding is
    // `selectConnectionsDueForAutomaticSync`'s job on the next sweep, not this one's — this sweep
    // acts on the snapshot it just took, and `runSync` itself re-reads the row before writing
    // (Decision 13's lock is what actually prevents an overlapping sweep from double-syncing the
    // same connection).
    const result = await runSync(deps, { connectionId: connection.id });
    results.push(result);
  }

  return results;
}
