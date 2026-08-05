import path from 'node:path';

import { DUMP_TABLE_ORDER } from '../../../../scripts/db/dump';
import { findPreservationViolations } from '../../checks/preservation';
import { openFileBackedLegacyStore } from '../../testing/memory-db';
import { createBetterSqliteCipherPort } from '../../testing/cipher-port';
import { buildCensus, CENSUS_TABLES } from '../census';

const FIXTURE_PATH = path.resolve(__dirname, '../../__fixtures__/store-v1.sql');

describe('CENSUS_TABLES stays in sync with scripts/db/dump.ts (V22)', () => {
  it('covers the exact same declared tables as DUMP_TABLE_ORDER, plus __drizzle_migrations', () => {
    const declared = CENSUS_TABLES.filter((table) => table !== '__drizzle_migrations');
    expect(declared).toEqual(DUMP_TABLE_ORDER);
    expect(CENSUS_TABLES).toContain('__drizzle_migrations');
    expect(CENSUS_TABLES).toHaveLength(DUMP_TABLE_ORDER.length + 1);
  });
});

describe('buildCensus (Decision 6, V22, V23)', () => {
  it('covers all 12 declared tables plus __drizzle_migrations, with non-empty seeded data', () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const handle = port.openPlain('finanzas.db');

    const census = buildCensus(handle);

    expect(census.tables.map((table) => table.name)).toEqual(CENSUS_TABLES.slice());
    // The fixture is the repository's canonical "a store with real content" snapshot — at least
    // one seeded row must be visible, or this test would vacuously pass on a broken query.
    const usersTable = census.tables.find((table) => table.name === 'users');
    expect(Object.keys(usersTable?.rows ?? {}).length).toBeGreaterThan(0);
    const migrationsTable = census.tables.find((table) => table.name === '__drizzle_migrations');
    expect(Object.keys(migrationsTable?.rows ?? {}).length).toBeGreaterThan(0);

    handle.close();
    store.cleanup();
  });

  it('two censuses of the identical store compare violation-free', () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const handle = port.openPlain('finanzas.db');

    const before = buildCensus(handle);
    const after = buildCensus(handle);

    expect(findPreservationViolations(before, after)).toEqual([]);

    handle.close();
    store.cleanup();
  });

  it('a deliberately dropped row is reported as row_lost', () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const handle = port.openPlain('finanzas.db');

    const before = buildCensus(handle);
    handle.exec('DELETE FROM merchant_aliases;');
    const after = buildCensus(handle);

    const findings = findPreservationViolations(before, after);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((finding) => finding.kind === 'row_lost' && finding.table === 'merchant_aliases')).toBe(
      true,
    );

    handle.close();
    store.cleanup();
  });

  it('a mutated column is reported as column_value_changed', () => {
    const store = openFileBackedLegacyStore({ fixturePath: FIXTURE_PATH });
    const port = createBetterSqliteCipherPort({ directory: store.directory });
    const handle = port.openPlain('finanzas.db');

    const before = buildCensus(handle);
    handle.exec("UPDATE merchants SET name = 'MUTATED FOR TEST' WHERE id = (SELECT id FROM merchants LIMIT 1);");
    const after = buildCensus(handle);

    const findings = findPreservationViolations(before, after);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((finding) => finding.kind === 'column_value_changed' && finding.table === 'merchants')).toBe(
      true,
    );

    handle.close();
    store.cleanup();
  });
});
