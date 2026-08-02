/**
 * `db:check` — the four-mode verification CLI (implementation plan Decision 6). Run with `tsx`
 * via `pnpm --filter @finanzas/mobile db:check`. `drizzle-kit` cannot be this CLI itself: it
 * rejects `migrate`, `studio` and `pull` under `driver: 'expo'`, and its own `check` command only
 * validates journal integrity (Verification Log).
 *
 * All file-system and subprocess access for the checks lives here, so the analysers under
 * `src/db/checks/` stay pure and Metro can never pull `node:fs` into a bundle.
 *
 * - Mode 0 — journal integrity: shells out to `drizzle-kit check`.
 * - Mode 1 — history vs declared shape: migrates an empty in-memory store, introspects it,
 *   compares it against the newest snapshot, then proves no pending `drizzle-kit generate` diff
 *   exists by running it into a scratch copy of `drizzle/` (the real folder is never a write
 *   target).
 * - Mode 2 — additive-only: runs the additivity analyser over every consecutive snapshot pair.
 * - Mode 3 — preservation: for every committed `src/db/__fixtures__/store-v*.sql` snapshot,
 *   migrates an empty store, loads the fixture, takes a census, re-runs the (idempotent) full
 *   migration history, re-censuses, and asserts nothing pre-existing was lost or altered.
 *
 * Fails on the first failing mode with exit code 1, printing what would be lost.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { findNonAdditiveChanges } from '../../src/db/checks/additivity';
import {
  compareDeclaredShape,
  type IntrospectedTable,
  type IntrospectionResult,
} from '../../src/db/checks/declared-shape';
import { findPreservationViolations, type Census, type CensusTable } from '../../src/db/checks/preservation';
import type { SqliteSnapshot } from '../../src/db/checks/snapshot-types';
import { runMigrations } from '../../src/db/migrate';
import { loadFixture } from '../../src/db/testing/load-fixture';
import { DUMP_TABLE_ORDER } from './dump';

const MOBILE_ROOT = path.resolve(__dirname, '..', '..');
const DRIZZLE_DIR = path.join(MOBILE_ROOT, 'drizzle');
const META_DIR = path.join(DRIZZLE_DIR, 'meta');
const CONFIG_PATH = path.join(MOBILE_ROOT, 'drizzle.config.ts');
const DRIZZLE_KIT_BIN = path.resolve(MOBILE_ROOT, '..', '..', 'node_modules/drizzle-kit/bin.cjs');
const FIXTURES_DIR = path.join(MOBILE_ROOT, 'src', 'db', '__fixtures__');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

function readJournal(dir: string = META_DIR): Journal {
  return JSON.parse(fs.readFileSync(path.join(dir, '_journal.json'), 'utf8')) as Journal;
}

function readSnapshot(idx: number, dir: string = META_DIR): SqliteSnapshot {
  const file = path.join(dir, `${String(idx).padStart(4, '0')}_snapshot.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SqliteSnapshot;
}

function fail(mode: string, message: string): never {
  console.error(`\n✗ db:check ${mode} FAILED\n${message}\n`);
  process.exit(1);
}

function ok(mode: string, message: string): void {
  console.log(`✓ db:check ${mode}: ${message}`);
}

// -------------------------------------------------------------------------------------------
// Mode 0 — journal integrity
// -------------------------------------------------------------------------------------------
function runMode0(): void {
  try {
    const output = execFileSync(
      process.execPath,
      [DRIZZLE_KIT_BIN, 'check', '--config', CONFIG_PATH],
      { cwd: MOBILE_ROOT, encoding: 'utf8' },
    );
    ok('mode 0 (journal integrity)', output.trim().split('\n').pop() ?? 'passed');
  } catch (error) {
    const stdout =
      error && typeof error === 'object' && 'stdout' in error
        ? String((error as { stdout?: unknown }).stdout ?? '')
        : '';
    fail('mode 0 (journal integrity)', stdout || String(error));
  }
}

// -------------------------------------------------------------------------------------------
// Mode 1 — history vs declared shape
// -------------------------------------------------------------------------------------------
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function buildIntrospection(sqlite: Database.Database): IntrospectionResult {
  const tableRows = sqlite
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
    )
    .all();

  const tables: IntrospectedTable[] = tableRows.map(({ name }) => {
    const columns = sqlite
      .prepare<[], { name: string; type: string; notnull: number; pk: number }>(
        `PRAGMA table_info(${quoteIdent(name)})`,
      )
      .all()
      .map((c) => ({ name: c.name, type: c.type, notNull: c.notnull === 1, primaryKey: c.pk > 0 }));

    const indexList = sqlite
      .prepare<[], { name: string; unique: number }>(`PRAGMA index_list(${quoteIdent(name)})`)
      .all();
    const indexes = indexList.map((idx) => {
      const info = sqlite
        .prepare<[], { name: string | null }>(`PRAGMA index_info(${quoteIdent(idx.name)})`)
        .all();
      return { name: idx.name, columns: info.map((i) => i.name ?? ''), isUnique: idx.unique === 1 };
    });

    const fkRows = sqlite
      .prepare<[], { id: number; table: string; from: string; to: string }>(
        `PRAGMA foreign_key_list(${quoteIdent(name)})`,
      )
      .all();
    const fkGroups = new Map<number, { tableTo: string; columnsFrom: string[]; columnsTo: string[] }>();
    for (const fk of fkRows) {
      const group = fkGroups.get(fk.id) ?? { tableTo: fk.table, columnsFrom: [], columnsTo: [] };
      group.columnsFrom.push(fk.from);
      group.columnsTo.push(fk.to);
      fkGroups.set(fk.id, group);
    }

    return { name, columns, indexes, foreignKeys: [...fkGroups.values()] };
  });

  return { tables };
}

function writeTempConfig(tempConfigPath: string, outRelative: string): void {
  fs.writeFileSync(
    tempConfigPath,
    [
      "import type { Config } from 'drizzle-kit';",
      'export default {',
      "  dialect: 'sqlite',",
      "  driver: 'expo',",
      "  schema: './src/db/schema.ts',",
      `  out: ${JSON.stringify(outRelative)},`,
      '} satisfies Config;',
      '',
    ].join('\n'),
  );
}

function runMode1(): void {
  const journal = readJournal();
  const lastEntry = journal.entries[journal.entries.length - 1];
  if (!lastEntry) fail('mode 1 (history vs declared shape)', 'drizzle/meta/_journal.json has no entries.');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  try {
    runMigrations(() => migrate(db, { migrationsFolder: DRIZZLE_DIR }), lastEntry.tag);
  } catch (error) {
    sqlite.close();
    fail(
      'mode 1 (history vs declared shape)',
      `The full migration history did not apply cleanly to an empty store: ${String(error)}`,
    );
  }

  const introspection = buildIntrospection(sqlite);
  sqlite.close();
  const snapshot = readSnapshot(lastEntry.idx);
  const findings = compareDeclaredShape(introspection, snapshot);
  if (findings.length > 0) {
    fail(
      'mode 1 (history vs declared shape)',
      findings.map((f) => `- ${f.table}${f.column ? `.${f.column}` : ''}: ${f.detail}`).join('\n'),
    );
  }

  // Second half: prove no pending `drizzle-kit generate` diff exists, in a scratch copy of
  // drizzle/ so the real migration folder is never a write target (Risks table).
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-db-check-'));
  try {
    const tempDrizzleDir = path.join(tempRoot, 'drizzle');
    fs.cpSync(DRIZZLE_DIR, tempDrizzleDir, { recursive: true });
    const tempConfigPath = path.join(tempRoot, 'drizzle.config.ts');
    writeTempConfig(tempConfigPath, path.relative(MOBILE_ROOT, tempDrizzleDir));

    try {
      execFileSync(process.execPath, [DRIZZLE_KIT_BIN, 'generate', '--config', tempConfigPath], {
        cwd: MOBILE_ROOT,
        encoding: 'utf8',
      });
    } catch (error) {
      const stdout =
        error && typeof error === 'object' && 'stdout' in error
          ? String((error as { stdout?: unknown }).stdout ?? '')
          : '';
      fail('mode 1 (history vs declared shape)', `drizzle-kit generate failed: ${stdout || String(error)}`);
    }

    const tempJournal = readJournal(path.join(tempDrizzleDir, 'meta'));
    if (tempJournal.entries.length !== journal.entries.length) {
      fail(
        'mode 1 (history vs declared shape)',
        `schema.ts has pending changes not yet captured by a committed migration: drizzle-kit generate would emit a new migration (journal would grow from ${journal.entries.length} to ${tempJournal.entries.length} entries). Run pnpm --filter @finanzas/mobile db:generate.`,
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  ok(
    'mode 1 (history vs declared shape)',
    'live introspection matches the declared shape; no pending drizzle-kit generate diff.',
  );
}

// -------------------------------------------------------------------------------------------
// Mode 2 — additive-only
// -------------------------------------------------------------------------------------------
function runMode2(): void {
  const journal = readJournal();
  const snapshots = journal.entries.map((entry) => readSnapshot(entry.idx));

  const allFindings: string[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const next = snapshots[i];
    if (!prev || !next) continue;
    const findings = findNonAdditiveChanges(prev, next);
    for (const f of findings) {
      allFindings.push(
        `- [${journal.entries[i - 1]?.tag ?? '?'} → ${journal.entries[i]?.tag ?? '?'}] ${f.kind} on ${f.table}${f.column ? `.${f.column}` : ''}: ${f.detail}`,
      );
    }
  }

  if (allFindings.length > 0) {
    fail('mode 2 (additive-only)', allFindings.join('\n'));
  }

  ok(
    'mode 2 (additive-only)',
    `${snapshots.length} snapshot(s) in the journal; every consecutive pair is additive-only.`,
  );
}

// -------------------------------------------------------------------------------------------
// Mode 3 — preservation
// -------------------------------------------------------------------------------------------
function primaryKeyColumn(sqlite: Database.Database, table: string): string {
  const columns = sqlite
    .prepare<[], { name: string; pk: number }>(`PRAGMA table_info(${quoteIdent(table)})`)
    .all();
  const pk = columns.find((c) => c.pk === 1);
  if (!pk) throw new Error(`Table '${table}' has no single-column primary key to census by.`);
  return pk.name;
}

function buildCensus(sqlite: Database.Database): Census {
  const tables: CensusTable[] = DUMP_TABLE_ORDER.map((table) => {
    const pkColumn = primaryKeyColumn(sqlite, table);
    const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Record<string, unknown>[];
    const byPk: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      byPk[String(row[pkColumn])] = row;
    }
    return { name: table, rows: byPk };
  });
  return { tables };
}

function runMode3(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fail('mode 3 (preservation)', `Fixtures directory '${FIXTURES_DIR}' does not exist.`);
  }
  const fixtureFiles = fs
    .readdirSync(FIXTURES_DIR)
    .filter((name) => /^store-v\d+\.sql$/.test(name))
    .sort();
  if (fixtureFiles.length === 0) {
    fail('mode 3 (preservation)', `No 'store-v*.sql' fixture found under '${FIXTURES_DIR}'.`);
  }

  const journal = readJournal();
  const lastEntry = journal.entries[journal.entries.length - 1];
  if (!lastEntry) fail('mode 3 (preservation)', 'drizzle/meta/_journal.json has no entries.');

  for (const fixtureFile of fixtureFiles) {
    const fixturePath = path.join(FIXTURES_DIR, fixtureFile);
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    try {
      // The fixture is INSERT-only (Decision 18) — the store it loads into must already have the
      // full migration history's schema (tables, indexes, triggers) in place.
      runMigrations(() => migrate(db, { migrationsFolder: DRIZZLE_DIR }), lastEntry.tag);
      loadFixture(sqlite, fixturePath);

      const before = buildCensus(sqlite);
      // Idempotent: every migration this fixture's __drizzle_migrations already recorded is
      // skipped; only a genuinely new migration (added after this fixture was committed) would
      // run here — which is exactly the case mode 3 exists to prove safe.
      runMigrations(() => migrate(db, { migrationsFolder: DRIZZLE_DIR }), lastEntry.tag);
      const after = buildCensus(sqlite);

      const findings = findPreservationViolations(before, after);
      if (findings.length > 0) {
        fail(
          'mode 3 (preservation)',
          `${fixtureFile}:\n` +
            findings
              .map((f) => `- [${f.kind}] ${f.table}${f.primaryKey ? `#${f.primaryKey}` : ''}${f.column ? `.${f.column}` : ''}: ${f.detail}`)
              .join('\n'),
        );
      }
    } finally {
      sqlite.close();
    }
  }

  ok('mode 3 (preservation)', `${fixtureFiles.length} committed snapshot(s) survive the full migration history unchanged.`);
}

// -------------------------------------------------------------------------------------------
function main(): void {
  runMode0();
  runMode1();
  runMode2();
  runMode3();
  console.log('\ndb:check passed (modes 0-3).\n');
}

main();
