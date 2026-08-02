import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * The shared database-handle type every repository function accepts (implementation plan
 * Decision 1). Both concrete drivers — `ExpoSQLiteDatabase` (`src/db/client.ts`) and
 * `BetterSQLite3Database` (`src/db/testing/memory-db.ts`) — extend
 * `BaseSQLiteDatabase<'sync', ...>`, so a repository function written once against this type runs
 * unchanged against either. The `RunResult` and schema generics are intentionally erased to
 * `any` here: this is the one place in `src/db` that needs to be driver-agnostic across two
 * concrete `RunResult` shapes (`SQLiteRunResult` vs better-sqlite3's own), and repository code
 * never inspects a raw run-result shape directly — it always reads through `.get()` / `.all()` /
 * the domain types below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see the doc comment above.
export type AppDatabase = BaseSQLiteDatabase<'sync', any, any>;

/**
 * Domain types repositories return, so a caller never sees a Drizzle row type
 * (`docs/best-practices/stack/typescript.md`). Populated incrementally as repositories are
 * added (Step 7).
 */

export type SupportedCurrency = 'CLP';

export interface Category {
  id: string;
  slug: string;
  income: boolean;
  name: string;
  emoji: string | undefined;
  sortOrder: number;
}

export interface ConnectableInstitution {
  id: string;
  name: string;
  countryCode: string;
  scraperStatus: 'available' | 'coming_soon';
  logoUrl: string | undefined;
}
