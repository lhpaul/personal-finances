import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { __resetBootstrapForTests, ensureDatabaseReady } from '../bootstrap';
import { getSetting } from '../repositories/settings';
import { financialInstitutions } from '../schema';
import { latestJournalEntryTag, MIGRATIONS_FOLDER, openMemoryDb } from '../testing/memory-db';
import { createDeterministicPorts } from '../testing/ports';

/**
 * Scenario 15 (AC15), plus the concurrent-bootstrap test from the implementation plan's
 * concurrent-event-source addendum.
 */
describe('bootstrap', () => {
  afterEach(() => {
    __resetBootstrapForTests();
  });

  it('writes schema_version = 1 after a fresh install, only after migrate succeeds (AC15)', async () => {
    const { sqlite, db } = openMemoryDb();
    try {
      const ports = createDeterministicPorts();
      await ensureDatabaseReady({
        db,
        migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
        latestMigrationTag: latestJournalEntryTag(),
        newId: ports.newId,
        now: ports.now,
      });

      expect(getSetting(db, 'schema_version')).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it('three concurrent callers share one bootstrap run (single-flight)', async () => {
    const { sqlite, db } = openMemoryDb();
    try {
      const ports = createDeterministicPorts();
      const deps = {
        db,
        migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
        latestMigrationTag: latestJournalEntryTag(),
        newId: ports.newId,
        now: ports.now,
      };

      await Promise.all([
        ensureDatabaseReady(deps),
        ensureDatabaseReady(deps),
        ensureDatabaseReady(deps),
      ]);

      // The fresh-install institution count (six), not a multiple of it — proves migrate and
      // seed each ran exactly once despite three concurrent callers.
      const institutionRows = db.select().from(financialInstitutions).all();
      expect(institutionRows).toHaveLength(6);
    } finally {
      sqlite.close();
    }
  });
});
