import { clearSampleFixture, loadSampleFixture, simulateSyncError } from '../db/dev-fixture';
import { upsertBankTransactions } from '../db/repositories/transactions';
import { listUserProducts } from '../db/repositories/products';
import { createRuntimePorts, getAppDatabase } from '../db/runtime';
// `.sql` is inlined to a string at bundle time by `babel-plugin-inline-import`
// (`apps/mobile/babel.config.js`) plus the `sql` entry in `metro.config.js`'s `sourceExts` — the
// same mechanism `drizzle/migrations.js` uses. Never imported by application code outside this
// `__DEV__`-only surface.
import fixtureSql from '../db/__fixtures__/store-v1.sql';
import { buildDemoMovements } from './demo-movements';

/**
 * `getAppDatabase()`-calling wrappers around `src/db/dev-fixture.ts` (implementation plan for
 * issue #12, Decision 11) — the `app/ → feature hooks → src/db` layering applied to a `__DEV__`-
 * only surface. `SampleDataPanel.tsx` calls these functions and nothing else in `src/db` directly,
 * keeping `dbAccessBoundary` intact.
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

/**
 * "Generar movimientos de demo" (implementation plan for issue #15, Decision 14) — persists
 * `buildDemoMovements`'s 240-movement dataset through the existing `upsertBankTransactions`, one
 * call per product. A no-op when no product exists yet (the base fixture has not been loaded).
 * Idempotent: re-running it refreshes the same rows through the same dedup upsert the sync engine
 * uses (Business Rule 5), never duplicating a movement.
 */
export async function generateDemoMovements(): Promise<void> {
  const db = await getAppDatabase();
  const products = listUserProducts(db);
  const ports = createRuntimePorts();

  for (const batch of buildDemoMovements(products.map((product) => product.id))) {
    await upsertBankTransactions(db, batch.userFinancialProductId, batch.rows, ports);
  }
}
