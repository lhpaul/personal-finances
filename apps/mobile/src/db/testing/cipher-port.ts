import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  detachStatement,
  getUserVersionStatement,
  isValidRawKeyHex,
  quoteIdentifier,
  setUserVersionStatement,
  userTableCountStatement,
} from '../encryption/statements';
import type { CipherDatabasePort, CipherHandle } from '../encryption/types';

/**
 * **A labelled test double, not a proof that SQLCipher works** (implementation plan Decision 9).
 * `better-sqlite3` bundles plain SQLite and has no SQLCipher — it cannot execute `PRAGMA key` for
 * effect, and plain SQLite's `ATTACH` grammar does not even accept SQLCipher's `KEY` clause (a
 * parse error, not a silently-ignored pragma). This double therefore diverges from the real
 * statement text in exactly two places, both commented at the point of divergence below:
 * `openKeyed` never issues `keyPragma(...)`, and `attachEncrypted` omits the `KEY` clause
 * `attachEncryptedStatement(...)` produces. Everything else — `copyUserVersionTo`, `detach`,
 * `userTableCount`, the generic `exec`/`query` — reuses the exact same pure builders the real
 * device adapter (`src/db/client.ts`) does, because those operations have nothing
 * SQLCipher-specific about them.
 *
 * What this double proves: the six-state resolver, the resume and abort paths, the census gate,
 * the fail-closed key branches, and the wipe ordering (Testing Strategy → "What the Node tier
 * deliberately does not prove"). It never proves `PRAGMA key` encrypts, that `sqlcipher_export`
 * copies faithfully through a codec, or that a wrong key is rejected — those three are
 * device-only, each with its own runbook step.
 */

/** `exportMainTo`'s mirror of `sqlcipher_export`'s documented statement set (V12): every table
 * with storage (`rootpage > 0`, i.e. excluding views), every plain and unique index, and
 * `sqlite_sequence`'s rows when an `AUTOINCREMENT` table has created it. Triggers and views are
 * schema objects this app's migrations do not declare today; the ordering below (tables before
 * every other object type) is what makes a later `CREATE INDEX`/`CREATE TRIGGER` succeed against
 * a table that already exists in the target schema. */
function qualifyCreateStatement(sql: string, alias: string): string {
  return sql.replace(
    /^(CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+)(?:IF NOT EXISTS\s+)?/i,
    (_match, prefix: string) => `${prefix}${alias}.`,
  );
}

function exportMainToDouble(sqlite: Database.Database, alias: string): void {
  const objects = sqlite
    .prepare<[], { type: string; name: string; sql: string }>(
      "SELECT type, name, sql FROM main.sqlite_schema WHERE sql IS NOT NULL AND rootpage > 0 AND name != 'sqlite_sequence' ORDER BY (type = 'table') DESC",
    )
    .all();

  for (const object of objects) {
    sqlite.exec(qualifyCreateStatement(object.sql, alias));
  }

  const tables = objects.filter((object) => object.type === 'table');
  // Foreign-key enforcement is ON on every connection this app opens (`client.ts`'s Decision 5) —
  // but `sqlite_schema`'s row order is schema-declaration order, not dependency order, and the
  // real `sqlcipher_export` copies pages directly, bypassing constraint checking entirely.
  // Toggling this off for exactly the copy loop below mirrors that bypass without needing to
  // duplicate `scripts/db/dump.ts`'s `DUMP_TABLE_ORDER` dependency ordering in this double too.
  sqlite.pragma('foreign_keys = OFF');
  try {
    for (const table of tables) {
      sqlite.exec(
        `INSERT INTO ${alias}.${quoteIdentifier(table.name)} SELECT * FROM main.${quoteIdentifier(table.name)};`,
      );
    }
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }

  const sequenceCount = sqlite
    .prepare<[], { n: number }>("SELECT count(*) AS n FROM main.sqlite_schema WHERE name = 'sqlite_sequence'")
    .get();
  if (sequenceCount && sequenceCount.n > 0) {
    sqlite.exec(`DELETE FROM ${alias}.sqlite_sequence;`);
    sqlite.exec(`INSERT INTO ${alias}.sqlite_sequence SELECT * FROM main.sqlite_sequence;`);
  }
}

function openHandle(filePath: string, directory: string): CipherHandle {
  const sqlite = new Database(filePath);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);

  return {
    db,
    exec(sql: string): void {
      sqlite.exec(sql);
    },
    query<T = Record<string, unknown>>(sql: string): T[] {
      return sqlite.prepare<[], T>(sql).all();
    },
    userTableCount(schema?: string): number {
      const row = sqlite.prepare<[], { n: number }>(userTableCountStatement(schema)).get();
      return row?.n ?? 0;
    },
    attachEncrypted(alias: string, databaseName: string, keyHex: string): void {
      if (!isValidRawKeyHex(keyHex)) {
        throw new Error('cipher-port test double: attachEncrypted key is not 64 lowercase hex characters.');
      }
      // Divergence #1 from the real statement text (module doc comment): no `KEY` clause — plain
      // SQLite's ATTACH grammar does not accept one.
      const targetPath = path.join(directory, databaseName);
      const escapedPath = targetPath.replace(/'/g, "''");
      sqlite.exec(`ATTACH DATABASE '${escapedPath}' AS ${alias};`);
    },
    exportMainTo(alias: string): void {
      exportMainToDouble(sqlite, alias);
    },
    copyUserVersionTo(alias: string): void {
      const row = sqlite.prepare<[], { user_version: number }>(getUserVersionStatement()).get();
      sqlite.exec(setUserVersionStatement(row?.user_version ?? 0, alias));
    },
    detach(alias: string): void {
      sqlite.exec(detachStatement(alias));
    },
    close(): void {
      sqlite.close();
    },
  };
}

export interface CipherPortDeps {
  /** The directory real, file-backed database files live in for this test run (a fresh temp
   * directory per test — `src/db/testing/memory-db.ts`'s `openFileBackedLegacyStore` creates and
   * cleans one up). `:memory:` cannot be `ATTACH`ed to a second file, which is exactly why this
   * double needs real files at all (Decision 9). */
  directory: string;
  /** Defaults to a clearly-labelled fake version string — this double has no real SQLCipher, so a
   * non-`null` default is never a claim that encryption works; it exists so every test other than
   * `capability.test.ts` can exercise the orchestration past the capability probe. Pass `null`
   * explicitly to exercise the "no SQLCipher" branch. */
  cipherVersion?: string | null;
}

export function createBetterSqliteCipherPort(deps: CipherPortDeps): CipherDatabasePort {
  const reportedVersion = deps.cipherVersion === undefined ? '4.7.0-test-double' : deps.cipherVersion;

  function resolvePath(databaseName: string): string {
    return path.join(deps.directory, databaseName);
  }

  return {
    cipherVersion(): string | null {
      return reportedVersion;
    },
    openPlain(databaseName: string): CipherHandle {
      return openHandle(resolvePath(databaseName), deps.directory);
    },
    openKeyed(databaseName: string, keyHex: string): CipherHandle {
      if (!isValidRawKeyHex(keyHex)) {
        throw new Error('cipher-port test double: openKeyed key is not 64 lowercase hex characters.');
      }
      // Divergence #2 from the real device adapter (module doc comment): no `PRAGMA key` issued.
      return openHandle(resolvePath(databaseName), deps.directory);
    },
    deleteDatabaseIfPresent(databaseName: string): void {
      const filePath = resolvePath(databaseName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    },
  };
}
