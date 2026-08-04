import { upsertConnection } from '../db/repositories/institutions';
import { createRuntimePorts, getAppDatabase } from '../db/runtime';
import { buildSyncRequest, setPendingSyncHandoff } from '../features/connect-bank/sync-handoff';
import { credentialsKeyFor } from '../lib/secure-store/credential-store';

/**
 * `__DEV__`-only fixture support for the bank-syncing smoke runbook (implementation plan
 * Decision 10, issue #11). `getAppDatabase()`-calling wrapper around item #9/#10's own
 * `upsertConnection` / `setPendingSyncHandoff` — the `app/ → feature hooks → src/db` layering
 * `src/dev/connect-fixtures-store.ts` already established, applied here. No new SQL: this file
 * writes nothing item #9's own connect flow does not already write for a real connection.
 *
 * Deliberately reuses `banco-de-chile` — the MVP's only supported bank (AGENTS.md) — rather than
 * inventing a fixture-only institution id, so a script's fabricated `ScrapeResult` composes with
 * `runSync`'s real write path (`recordSyncOutcome`, `applySyncWrite`) exactly as a genuine read
 * would.
 */

const FIXTURE_INSTITUTION_ID = 'banco-de-chile';

/**
 * Ensures a syncable connection row exists for the fixture institution and hands the syncing
 * screen its `ConnectHandoff`, exactly as `useConnectBank` does after a real `connectBank` call.
 * Never reads or writes a secure-store credential — this pairs only with an installed script
 * (`src/dev/scripted-runner.ts`), which never reaches the keychain either.
 */
export async function ensureFixtureConnection(): Promise<void> {
  const db = await getAppDatabase();
  const ports = createRuntimePorts();
  const credentialsKey = credentialsKeyFor(FIXTURE_INSTITUTION_ID);

  const { id } = upsertConnection(db, {
    institutionId: FIXTURE_INSTITUTION_ID,
    credentialsKey,
    newId: ports.newId,
    now: ports.now,
  });

  setPendingSyncHandoff(
    buildSyncRequest({ userFinancialInstitutionId: id, credentialsKey }, FIXTURE_INSTITUTION_ID),
  );
}
