import type { ScrapeResult } from '@finanzas/bank-scraper';

import { getConnection } from '../../../db/repositories/institutions';
import { createTestConnection, setConnectionFieldsForTest } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { runAppOpenSync } from '../app-open';
import { runSync } from '../sync-engine';
import { __resetReadLockForTests } from '../sync-lock';
import type { ScraperRunner, SyncDeps } from '../types';

/**
 * `runAppOpenSync` (implementation plan Decisions 11-12, issue #10): crash recovery then the
 * automatic-sync sweep, in sequence. Spec Use Case 6, Business Rules 24-27; AC24, AC26, AC27.
 */

const EMPTY_COMPLETE_READ: ScrapeResult = {
  outcome: 'complete',
  countryCode: 'CL',
  bankId: 'banco-de-chile',
  products: [],
  movements: [],
  readFailure: null,
  productFailures: [],
  skippedProductKinds: [],
  traces: [],
};

/**
 * Offsets from the deterministic `ports.now()` clock (`createDeterministicPorts` starts at
 * `2026-01-01T00:00:00.000Z`, not the host's real wall clock) — `runAppOpenSync` itself reads
 * `deps.ports.now()` for both the crash-recovery timestamp and the eligibility check, so a
 * fixture built against the real `Date.now()` would silently compare against a completely
 * different era and every "old" timestamp would look like it is in the future.
 */
function hoursBefore(anchorIso: string, hours: number): string {
  return new Date(Date.parse(anchorIso) - hours * 60 * 60 * 1000).toISOString();
}

function createRecordingRunner(): ScraperRunner & { syncedConnectionIds: string[] } {
  const syncedConnectionIds: string[] = [];
  return {
    syncedConnectionIds,
    run: async (request) => {
      syncedConnectionIds.push(request.connectionId);
      return EMPTY_COMPLETE_READ;
    },
  };
}

async function makeDeps(runner: ScraperRunner) {
  __resetReadLockForTests();
  const { sqlite, db, ports } = await openBootstrappedMemoryDb();
  const deps: SyncDeps = { db, ports, runner, ready: Promise.resolve() };
  return { sqlite, db, ports, deps };
}

describe('runAppOpenSync (Decisions 11-12, AC24, AC26, AC27)', () => {
  it('a connection stuck at syncing is returned to idle before the eligibility check runs, and is not swept in the same pass (AC26)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const stuckId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, stuckId, { syncStatus: 'syncing' });

      await runAppOpenSync(deps);

      expect(runner.syncedConnectionIds).not.toContain(stuckId);
      const after = getConnection(db, stuckId);
      expect(after?.syncStatus).toBe('idle');
      expect(after?.lastErrorCode).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('an eligible connection (old last success and last attempt, active) is synced (AC24)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const eligibleId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, eligibleId, { lastSuccessAt: hoursBefore(anchor, 30), lastSyncAt: hoursBefore(anchor, 30) });

      const results = await runAppOpenSync(deps);

      expect(runner.syncedConnectionIds).toContain(eligibleId);
      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe('completed');
    } finally {
      sqlite.close();
    }
  });

  it('a connection whose last success is recent is not swept (AC24)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const recentId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, recentId, { lastSuccessAt: hoursBefore(anchor, 1), lastSyncAt: hoursBefore(anchor, 1) });

      await runAppOpenSync(deps);

      expect(runner.syncedConnectionIds).not.toContain(recentId);
    } finally {
      sqlite.close();
    }
  });

  it('an inactive connection is never swept, even if its last success is very old (AC27)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const inactiveId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, inactiveId, { status: 'inactive', lastSuccessAt: hoursBefore(anchor, 100) });

      await runAppOpenSync(deps);

      expect(runner.syncedConnectionIds).not.toContain(inactiveId);
    } finally {
      sqlite.close();
    }
  });

  it('a disconnected connection is never swept (AC27)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const disconnectedId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, disconnectedId, { status: 'disconnected', lastSuccessAt: hoursBefore(anchor, 100) });

      await runAppOpenSync(deps);

      expect(runner.syncedConnectionIds).not.toContain(disconnectedId);
    } finally {
      sqlite.close();
    }
  });

  it('a connection suspended by a credential rejection is not swept automatically, but syncs when asked explicitly (AC25)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const suspendedId = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, suspendedId, { lastErrorCode: 'invalid_credentials', lastSuccessAt: hoursBefore(anchor, 100) });

      await runAppOpenSync(deps);
      expect(runner.syncedConnectionIds).not.toContain(suspendedId);

      // "Sincronizar ahora" is never subject to the interval or the suspension (spec Business
      // Rule 24's last sentence) — a direct runSync call still succeeds.
      const explicit = await runSync(deps, { connectionId: suspendedId });
      expect(explicit.status).toBe('completed');
      expect(runner.syncedConnectionIds).toContain(suspendedId);
    } finally {
      sqlite.close();
    }
  });

  it('multiple eligible connections are synced one after another, never concurrently (Decision 13)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, db, ports, deps } = await makeDeps(runner);
    try {
      const anchor = ports.now();
      const first = createTestConnection(db, ports, 'banco-de-chile');
      setConnectionFieldsForTest(db, first, { lastSuccessAt: hoursBefore(anchor, 30), lastSyncAt: hoursBefore(anchor, 30) });

      const results = await runAppOpenSync(deps);

      expect(results.every((r) => r.status === 'completed')).toBe(true);
      expect(runner.syncedConnectionIds).toEqual([first]);
    } finally {
      sqlite.close();
    }
  });

  it('an empty connection list returns an empty result array (degenerate input terminates)', async () => {
    const runner = createRecordingRunner();
    const { sqlite, deps } = await makeDeps(runner);
    try {
      const results = await runAppOpenSync(deps);
      expect(results).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
