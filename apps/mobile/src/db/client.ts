import {
  defaultDatabaseDirectory,
  deleteDatabaseSync,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import {
  attachEncryptedStatement,
  cipherVersionStatement,
  detachStatement,
  exportStatement,
  getUserVersionStatement,
  keyPragma,
  setUserVersionStatement,
  userTableCountStatement,
} from './encryption/statements';
import type { CipherDatabasePort, CipherHandle, CipherOpenOptions } from './encryption/types';

/**
 * The only `expo-sqlite` import in the repository (implementation plan Decision 1, V27). Builds
 * the real {@link CipherDatabasePort} the encryption feature's composition entry point
 * (`encryption/open-encrypted-store.ts`) and the dev-only diagnostics probe
 * (`encryption/diagnostics.ts`, via `src/db/runtime.ts`) both run against — no other file may
 * open a database directly.
 *
 * `resolveDatabasePath` mirrors `expo-sqlite`'s own internal `pathUtils.js#createDatabasePath`
 * (not exported publicly) exactly: `openDatabaseSync(name)` resolves a bare name against
 * `defaultDatabaseDirectory` before handing it to the native layer, and `ATTACH DATABASE '<path>'`
 * needs that same resolved, absolute path — a bare name in the `ATTACH` statement would resolve
 * relative to the native process's own working directory instead, not the app's sandbox.
 */
function resolveDatabasePath(databaseName: string): string {
  if (databaseName === ':memory:') return databaseName;
  const directory = (defaultDatabaseDirectory as string).replace(/\/*$/, '');
  const name = databaseName.replace(/^\/+/, '');
  return `${directory}/${name}`;
}

function buildHandle(sqlite: SQLiteDatabase): CipherHandle {
  const db = drizzle(sqlite);
  return {
    db,
    exec(sql: string): void {
      sqlite.execSync(sql);
    },
    query<T = Record<string, unknown>>(sql: string): T[] {
      return sqlite.getAllSync<T>(sql);
    },
    userTableCount(schema?: string): number {
      const row = sqlite.getFirstSync<{ n: number }>(userTableCountStatement(schema));
      return row?.n ?? 0;
    },
    attachEncrypted(alias: string, databaseName: string, keyHex: string): void {
      sqlite.execSync(attachEncryptedStatement(alias, resolveDatabasePath(databaseName), keyHex));
    },
    exportMainTo(alias: string): void {
      sqlite.execSync(exportStatement(alias));
    },
    copyUserVersionTo(alias: string): void {
      const row = sqlite.getFirstSync<{ user_version: number }>(getUserVersionStatement());
      sqlite.execSync(setUserVersionStatement(row?.user_version ?? 0, alias));
    },
    detach(alias: string): void {
      sqlite.execSync(detachStatement(alias));
    },
    close(): void {
      sqlite.closeSync();
    },
  };
}

/** `deleteDatabaseIfPresent`'s "not found is success" rule (implementation plan Decision 7, V18)
 * — both platforms' native modules report a missing file with the substring `"not found"` in the
 * thrown error's message (confirmed against `ios/Exceptions.swift`'s
 * `DatabaseNotFoundException.reason` and `android/…/SQLExceptions.kt`'s `DatabaseNotFoundException`
 * — both literally `"… not found"`). Any other failure (most notably "currently open" —
 * `DeleteDatabaseException`) is a code defect, not an environment condition, and is rethrown. */
function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /not found/i.test(error.message);
}

/**
 * Builds the real, device-backed {@link CipherDatabasePort} (implementation plan Decision 9).
 * `openKeyed` issues `PRAGMA key` as the connection's **first** statement (V15 confirms nothing
 * runs before it can be set), then `PRAGMA foreign_keys = ON` (Decision 5's existing rule,
 * preserved). `openPlain` never issues a key at all — used only for the legacy plaintext store and
 * for the "does the encrypted store already have content" existence probe
 * (`encryption/key.ts`).
 *
 * Both `open*` methods accept `options?.forceNewConnection` (see {@link CipherOpenOptions}'s own
 * doc comment) and pass it straight through as `useNewConnection` — the only thing standing
 * between the diagnostics probe and silently reusing (and then closing) the app's own live
 * database connection.
 */
export function createExpoCipherDatabasePort(): CipherDatabasePort {
  return {
    cipherVersion(): string | null {
      const sqlite = openDatabaseSync(':memory:');
      try {
        const row = sqlite.getFirstSync<{ cipher_version: string }>(cipherVersionStatement());
        return row?.cipher_version ?? null;
      } finally {
        sqlite.closeSync();
      }
    },
    openPlain(databaseName: string, options?: CipherOpenOptions): CipherHandle {
      const sqlite = openDatabaseSync(
        databaseName,
        options?.forceNewConnection ? { useNewConnection: true } : undefined,
      );
      sqlite.execSync('PRAGMA foreign_keys = ON;');
      return buildHandle(sqlite);
    },
    openKeyed(databaseName: string, keyHex: string, options?: CipherOpenOptions): CipherHandle {
      const sqlite = openDatabaseSync(
        databaseName,
        options?.forceNewConnection ? { useNewConnection: true } : undefined,
      );
      sqlite.execSync(keyPragma(keyHex));
      sqlite.execSync('PRAGMA foreign_keys = ON;');
      return buildHandle(sqlite);
    },
    deleteDatabaseIfPresent(databaseName: string): void {
      try {
        deleteDatabaseSync(databaseName);
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw error;
      }
    },
  };
}
