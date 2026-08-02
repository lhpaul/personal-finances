import { sql } from 'drizzle-orm';

import { runMigrationsAsync } from './migrate';
import { getSetting, setSetting } from './repositories/settings';
import { applySeeds } from './seeds/apply';
import { users } from './schema';
import type { AppDatabase } from './types';

/**
 * `ensureDatabaseReady(deps)` — single-flight, all-or-nothing app-launch preparation
 * (implementation plan Layer-by-Layer; spec Use Case 1, Use Case 2, Business Rules 9-16). In
 * order: migrate → write `schema_version` (Decision 17) → ensure the single `users` row → write
 * `first_launch_at` if absent → apply seeds. Every step is idempotent, so a retried call after a
 * partial failure converges to the same end state (AC1, AC15).
 *
 * Driver-agnostic (Decision 1): the caller injects the already-opened `db` handle, a
 * driver-bound `migrate` thunk, the newest migration's tag (for error attribution — see
 * `migrate.ts`), and the `newId` / `now` ports (Decision 13). `src/db/client.ts` supplies these
 * for the Expo runtime; tests supply the `better-sqlite3` equivalents.
 */

export class DatabaseBootstrapError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseBootstrapError';
  }
}

export interface BootstrapDeps {
  db: AppDatabase;
  /** Driver-bound thunk that runs Drizzle's `migrate()` for this store (see `migrate.ts`).
   * Widened to allow an async thunk (implementation plan Decision 2) — the Expo runtime's
   * `drizzle-orm/expo-sqlite/migrator` is genuinely `async`; the existing synchronous
   * `better-sqlite3` thunk still works unchanged because `await`ing a returned `undefined` is a
   * no-op. */
  migrate: () => void | Promise<void>;
  /** The newest entry's tag from `drizzle/meta/_journal.json`, for error attribution only. */
  latestMigrationTag: string;
  newId: () => string;
  now: () => string;
}

function countAppliedMigrations(db: AppDatabase): number {
  const row = db.get<{ count: number } | undefined>(
    sql`select count(*) as count from __drizzle_migrations`,
  );
  return row?.count ?? 0;
}

function ensureSingleUserRow(db: AppDatabase, newId: () => string, now: () => string): void {
  const existing = db.select().from(users).limit(1).get();
  if (existing) return;
  db.insert(users).values({ id: newId(), createdAt: now() }).run();
}

function ensureFirstLaunchAt(db: AppDatabase, now: () => string): void {
  if (getSetting(db, 'first_launch_at') !== undefined) return;
  setSetting(db, 'first_launch_at', now());
}

async function runBootstrap(deps: BootstrapDeps): Promise<void> {
  try {
    await runMigrationsAsync(deps.migrate, deps.latestMigrationTag);
  } catch (cause) {
    // Already a typed DatabaseMigrationError (migrate.ts); surface it as the bootstrap
    // failure's cause rather than swallowing it (Business Rule 12, AC16).
    throw new DatabaseBootstrapError('Database migration failed during bootstrap', { cause });
  }

  try {
    const appliedCount = countAppliedMigrations(deps.db);
    setSetting(deps.db, 'schema_version', appliedCount);
    ensureSingleUserRow(deps.db, deps.newId, deps.now);
    ensureFirstLaunchAt(deps.db, deps.now);
    applySeeds(deps.db, deps.now());
  } catch (cause) {
    throw new DatabaseBootstrapError('Database bootstrap failed after migration', { cause });
  }
}

// Module-level single-flight promise (implementation plan's concurrent-event-source addendum):
// written exactly once, on the first call, before any `await`, so two callers arriving before
// the first finishes share one run rather than migrating or seeding twice. Cleared on failure so
// the next call genuinely retries instead of caching a permanent failure.
let bootstrapPromise: Promise<void> | undefined;

export function ensureDatabaseReady(deps: BootstrapDeps): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap(deps).catch((error: unknown) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  return bootstrapPromise;
}

/** Test-only escape hatch: clears the single-flight promise so each test starts clean. Not
 * exported for app use — production code never needs to force a re-bootstrap mid-process. */
export function __resetBootstrapForTests(): void {
  bootstrapPromise = undefined;
}
