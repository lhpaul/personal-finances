import type { ScrapeResult } from '@finanzas/bank-scraper';

import type { DbPorts } from '../../db/ids';
import type { AppDatabase, SyncConnection } from '../../db/types';

/**
 * Sync-engine types (implementation plan Decision 16, issue #10; spec Business Rules 1-2, AC29).
 *
 * `@finanzas/bank-scraper` is imported **type-only** here — `ScrapeResult` is the only thing this
 * feature needs from it, and a type-only import is erased at compile time, so no React and no
 * `react-native-webview` is ever pulled into this module's runtime graph (`no-secure-store.test.ts`
 * asserts the module-specifier half of this; `src/db/__tests__/db-access-boundary.test.ts` asserts
 * the SQL-library half for every file outside `src/db`).
 */

/**
 * What the engine asks a scraper implementation to do (Decision 16). `credentialsKey` is the
 * secure-store *key name* the schema already stores in plaintext — never a credential value. The
 * runner (not this feature) reads `expo-secure-store` and hands the plaintext to
 * `ScrapeSession.start()`; it is implemented by the item that mounts the hidden WebView
 * (Assumption A8).
 */
export interface ScraperRunRequest {
  connectionId: string;
  countryCode: string;
  bankId: string;
  credentialsKey: string;
  signal?: AbortSignal;
}

export interface ScraperRunner {
  run(request: ScraperRunRequest): Promise<ScrapeResult>;
}

/** Everything `runSync` / `runAppOpenSync` need, injected rather than imported, so the whole
 * feature is testable against a fake runner and an in-memory database with no device. */
export interface SyncDeps {
  db: AppDatabase;
  ports: DbPorts;
  runner: ScraperRunner;
  /** The app shell's own `ensureDatabaseReady()` promise — awaited before any query, so a sync
   * requested before bootstrap resolves never touches a table that may not exist yet. */
  ready: Promise<void>;
}

export interface SyncRequest {
  connectionId: string;
}

/**
 * The spec's Operational Visibility list, exactly (issue #10): what a sync reports back to its
 * caller, never persisted (spec Decision 12).
 */
export interface SyncSummary {
  productsDiscovered: number;
  productsRefreshed: number;
  movementsStored: number;
  movementsAlreadyKnown: number;
  foreignCurrencyMovementsStored: number;
  failedProductInstanceIds: string[];
}

/**
 * `runSync`'s result. `'refused'` is Decision 13's AC28 case — a second read request refused
 * without touching the connection's record. Every other outcome — success, failure, partial,
 * cancellation — is `'completed'`, because a sync attempted and recorded is not a refusal, even
 * when the read itself failed; the caller reads `connectionState.syncStatus` / `lastErrorCode`
 * for that.
 */
export type SyncRunResult =
  | { status: 'completed'; summary: SyncSummary; connectionState: SyncConnection }
  | { status: 'refused'; reason: 'read_in_progress' };
