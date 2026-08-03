/**
 * The sync feature's barrel (implementation plan Layer-by-Layer — Application layer, issue #10).
 * `runSync`, `runAppOpenSync`, the types, and nothing else — no React, no route, no i18n entry
 * (spec Out of Scope: "Every screen"). Ships headless (spec Assumption A8): neither function is
 * wired into `app/_layout.tsx` here; a `ScraperRunner` implementation and the app-open hook belong
 * to the item that mounts the hidden WebView.
 */
export { runSync } from './sync-engine';
export { runAppOpenSync } from './app-open';
export { acquireReadLock, isReadInProgress, __resetReadLockForTests } from './sync-lock';
export {
  AUTOMATIC_SYNC_INTERVAL_MS,
  isDueForAutomaticSync,
  selectConnectionsDueForAutomaticSync,
} from './auto-sync';
export {
  buildConnectionSyncRecord,
  composeFailureMessageKey,
  countForeignCurrencyMovements,
  mapScrapeResultToSyncWriteInput,
  selectFailureReason,
  SYNC_FAILURE_PRECEDENCE,
} from './map-read-result';
export type {
  ScraperRunner,
  ScraperRunRequest,
  SyncDeps,
  SyncRequest,
  SyncRunResult,
  SyncSummary,
} from './types';
