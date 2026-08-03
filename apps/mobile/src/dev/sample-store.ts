import { clearSampleFixture, loadSampleFixture, simulateSyncError } from '../db/dev-fixture';
import { getAppDatabase } from '../db/runtime';
// `.sql` is inlined to a string at bundle time by `babel-plugin-inline-import`
// (`apps/mobile/babel.config.js`) plus the `sql` entry in `metro.config.js`'s `sourceExts` — the
// same mechanism `drizzle/migrations.js` uses. Never imported by application code outside this
// `__DEV__`-only surface.
import fixtureSql from '../db/__fixtures__/store-v1.sql';

/**
 * `getAppDatabase()`-calling wrappers around `src/db/dev-fixture.ts` (implementation plan for
 * issue #12, Decision 11) — the `app/ → feature hooks → src/db` layering applied to a `__DEV__`-
 * only surface. `SampleDataPanel.tsx` calls these three functions and nothing else in `src/db`
 * directly, keeping `dbAccessBoundary` intact.
 */

export async function loadSampleData(): Promise<void> {
  const db = await getAppDatabase();
  loadSampleFixture(db, fixtureSql);
}

export async function simulateSampleSyncError(): Promise<void> {
  const db = await getAppDatabase();
  simulateSyncError(db, fixtureSql);
}

export async function clearSampleData(): Promise<void> {
  const db = await getAppDatabase();
  clearSampleFixture(db, fixtureSql);
}
