import { getConnection, markConnectionSyncing, recordSyncOutcome } from '../../db/repositories/institutions';
import { applySyncWrite } from '../../db/repositories/sync';
import { MovementValidationError } from '../../db/repositories/transactions';
import { composeFailureMessageKey, countForeignCurrencyMovements, mapScrapeResultToSyncWriteInput } from './map-read-result';
import { acquireReadLock } from './sync-lock';
import type { ScraperRunRequest, SyncDeps, SyncRequest, SyncRunResult, SyncSummary } from './types';

/**
 * `runSync` (implementation plan Decisions 5, 6, 13, 16, issue #10; spec Business Rules 1-2,
 * 21-22; AC9-AC15, AC28-AC30).
 *
 * Sequence: await readiness → acquire the device lock → load the connection → mark it `syncing`
 * → run the injected scraper → map the result → `applySyncWrite` → release the lock in
 * `finally`. A runner rejection or a `MovementValidationError` from `applySyncWrite` is caught
 * and mapped to its own connection-record write (Decisions 6, 16) rather than propagated — this
 * function only rejects for a programming error (an unknown connection id).
 */

const EMPTY_SUMMARY: SyncSummary = {
  productsDiscovered: 0,
  productsRefreshed: 0,
  movementsStored: 0,
  movementsAlreadyKnown: 0,
  foreignCurrencyMovementsStored: 0,
  failedProductInstanceIds: [],
};

export async function runSync(deps: SyncDeps, request: SyncRequest): Promise<SyncRunResult> {
  await deps.ready;

  const release = acquireReadLock(request.connectionId);
  if (release === null) {
    return { status: 'refused', reason: 'read_in_progress' };
  }

  try {
    const connection = getConnection(deps.db, request.connectionId);
    if (!connection) {
      throw new Error(`runSync: unknown connection id "${request.connectionId}"`);
    }

    markConnectionSyncing(deps.db, request.connectionId);

    const runRequest: ScraperRunRequest = {
      connectionId: connection.id,
      countryCode: connection.countryCode,
      bankId: connection.financialInstitutionId,
      credentialsKey: connection.credentialsKey,
    };

    let scrapeResult;
    try {
      scrapeResult = await deps.runner.run(runRequest);
    } catch {
      // The runner rejected: it has not produced a ScrapeResult, so there is nothing to store and
      // no open transaction to write a failure record inside (Decision 16). The caught error's
      // own message is never stored — only the code-derived key is (Decision 9).
      const now = deps.ports.now();
      recordSyncOutcome(
        deps.db,
        request.connectionId,
        { outcome: 'failed', errorCode: 'network', errorMessage: composeFailureMessageKey('network') },
        now,
      );
      const connectionState = getConnection(deps.db, request.connectionId);
      if (!connectionState) throw new Error(`runSync: connection "${request.connectionId}" vanished mid-sync`);
      return { status: 'completed', summary: EMPTY_SUMMARY, connectionState };
    }

    const writeInput = mapScrapeResultToSyncWriteInput(request.connectionId, scrapeResult);

    let writeResult;
    try {
      writeResult = await applySyncWrite(deps.db, deps.ports, writeInput);
    } catch (error) {
      if (!(error instanceof MovementValidationError)) throw error;

      // A structural defect (Business Rule 12, Decision 6): the whole write never happened —
      // there is no open transaction left to record the failure inside, so this is a standalone
      // write of only the connection's own columns.
      const now = deps.ports.now();
      recordSyncOutcome(
        deps.db,
        request.connectionId,
        { outcome: 'failed', errorCode: 'parse_failed', errorMessage: composeFailureMessageKey('parse_failed') },
        now,
      );
      const connectionState = getConnection(deps.db, request.connectionId);
      if (!connectionState) throw new Error(`runSync: connection "${request.connectionId}" vanished mid-sync`);
      return { status: 'completed', summary: EMPTY_SUMMARY, connectionState };
    }

    const summary: SyncSummary = {
      productsDiscovered: writeResult.discovered,
      productsRefreshed: writeResult.refreshed,
      movementsStored: writeResult.movementsStored,
      movementsAlreadyKnown: writeResult.movementsAlreadyKnown,
      foreignCurrencyMovementsStored: countForeignCurrencyMovements(scrapeResult),
      failedProductInstanceIds: scrapeResult.productFailures.map((failure) => failure.productInstanceId),
    };

    const connectionState = getConnection(deps.db, request.connectionId);
    if (!connectionState) throw new Error(`runSync: connection "${request.connectionId}" vanished mid-sync`);
    return { status: 'completed', summary, connectionState };
  } finally {
    release();
  }
}
