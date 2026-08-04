import { applyFixtureSql, setOnboardingCompleted } from '../db/dev-e2e-fixture';
import { clearSampleFixture, loadSampleFixture } from '../db/dev-fixture';
// `.sql` is inlined to a string at bundle time by `babel-plugin-inline-import`
// (`apps/mobile/babel.config.js`) — the same mechanism `src/dev/sample-store.ts` already uses.
import storeFixtureSql from '../db/__fixtures__/store-v1.sql';
import stageQueueFixtureSql from '../db/__fixtures__/stage-queue-v1.sql';
import transactionDetailFixtureSql from '../db/__fixtures__/transaction-detail-v1.sql';
import { getAppDatabase } from '../db/runtime';
import { deleteCredentials } from '../lib/secure-store/credential-store';
import { expoSecureStoreAdapter } from '../lib/secure-store/expo-secure-store.adapter';
import type { SecureStorePort } from '../lib/secure-store/types';
import { clearScript, installScript } from './scripted-runner';
import { ensureFixtureConnection } from './sync-fixtures-store';

/**
 * `__DEV__`-only fixture surface for the Maestro E2E suite (implementation plan for issue #22,
 * D6, D7). `getAppDatabase()`-calling wrappers around `src/db/dev-e2e-fixture.ts` plus the
 * existing dev fixture modules — the `app/ → feature hooks → src/db` layering
 * `src/dev/sample-store.ts` and `src/dev/connect-fixtures-store.ts` already established, applied
 * here. `E2eFixtures.tsx` calls only {@link applyE2eFixtureState} and nothing else in `src/db` or
 * `src/lib/secure-store` directly, keeping `dbAccessBoundary` and `secureStoreBoundary` intact.
 */

export type E2eFixtureStateId = 'reset' | 'synced-home' | 'stage-queue' | 'transaction-detail' | 'scripted-read';

/** The ordered id list `.maestro/flow-contract.json`'s `fixture_states` must equal exactly
 * (D6's extension rule) — `e2e-fixture-store.test.ts` asserts the two never drift. */
export const E2E_FIXTURE_STATES: E2eFixtureStateId[] = [
  'reset',
  'synced-home',
  'stage-queue',
  'transaction-detail',
  'scripted-read',
];

/** The two fixture institutions `reset` deletes a secure-store credential for (D7) — never a real
 * bank the flows never touch. Deliberately unconditional (D7): flow 01 types a credential into
 * the **real** form, so the entry it must remove was not written by `connect-fixtures-store.ts`
 * and is not tracked by its "restore whatever was there before" bookkeeping. */
const RESET_CREDENTIAL_INSTITUTION_IDS = ['banco-de-chile', 'santander'];

/**
 * Applies one of {@link E2E_FIXTURE_STATES} against the app database (and, for `reset`, the
 * secure store). Every branch is idempotent (D6's "idempotent because" column) — applying the
 * same state twice in one session converges rather than accumulates.
 *
 * `port` defaults to {@link expoSecureStoreAdapter} so a test can substitute an in-memory
 * `SecureStorePort`, mirroring `connect-fixtures-store.ts`'s own optional-port parameter.
 */
export async function applyE2eFixtureState(
  id: E2eFixtureStateId,
  port: SecureStorePort = expoSecureStoreAdapter,
): Promise<void> {
  const db = await getAppDatabase();

  switch (id) {
    case 'reset': {
      clearSampleFixture(db, storeFixtureSql);
      setOnboardingCompleted(db, false);
      clearScript();
      for (const institutionId of RESET_CREDENTIAL_INSTITUTION_IDS) {
        await deleteCredentials(port, institutionId);
      }
      return;
    }
    case 'synced-home': {
      loadSampleFixture(db, storeFixtureSql);
      setOnboardingCompleted(db, true);
      return;
    }
    case 'stage-queue': {
      applyFixtureSql(db, stageQueueFixtureSql);
      setOnboardingCompleted(db, true);
      return;
    }
    case 'transaction-detail': {
      applyFixtureSql(db, transactionDetailFixtureSql);
      setOnboardingCompleted(db, true);
      return;
    }
    case 'scripted-read': {
      // Deliberately leaves the onboarding flag untouched (D6): flow 01 applies this state
      // *before* onboarding, while the flag is still false.
      await ensureFixtureConnection();
      installScript('complete_with_data');
      return;
    }
  }
}
