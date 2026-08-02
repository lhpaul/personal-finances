/**
 * Wraps Drizzle's `migrate()` with a typed error and never deletes, recreates or truncates the
 * store on failure (spec Business Rule 12, AC16).
 *
 * `client.ts` (the Expo runtime) and `testing/memory-db.ts` (the Node test tier) each import
 * their own driver-specific `migrate` function (`drizzle-orm/expo-sqlite/migrator` and
 * `drizzle-orm/better-sqlite3/migrator` respectively — Decision 1: one schema, two drivers) and
 * pass a thunk that calls it, so this module stays driver-agnostic. Drizzle's own migrator runs
 * every pending migration inside one `BEGIN … COMMIT`, with `ROLLBACK` on any error (verified
 * against `sqlite-core/dialect.js` in the implementation plan's Verification Log) — that
 * transactional guarantee, not anything in this file, is what makes a failed migration leave the
 * store byte-identical to its pre-migration state. This module's job is only to surface the
 * failure as a typed, attributable error rather than letting a raw driver exception propagate
 * (Operational Visibility: "attributable to the specific change that failed").
 */
export class DatabaseMigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseMigrationError';
  }
}

/**
 * @param migrate Driver-bound thunk that runs Drizzle's `migrate()` for this store.
 * @param latestMigrationTag The newest entry's tag from the migration journal
 *   (`drizzle/meta/_journal.json`), used only to attribute a failure to a migration by name in
 *   the surfaced error message. Drizzle's own migrator does not expose which individual
 *   migration or statement failed (it collapses the journal into a tag-less list before running
 *   it), so this is a best-effort attribution: for a single-migration history (this item ships
 *   exactly one) it is unambiguous; for a later multi-migration history it names the most
 *   recently added migration, which is the one most likely to be the one still pending.
 */
export function runMigrations(migrate: () => void, latestMigrationTag: string): void {
  try {
    migrate();
  } catch (cause) {
    throw new DatabaseMigrationError(
      `Failed to apply database migration '${latestMigrationTag}'`,
      { cause },
    );
  }
}

/**
 * `async` sibling of {@link runMigrations} (implementation plan Decision 2). `drizzle-orm`'s
 * Expo migrator (`drizzle-orm/expo-sqlite/migrator`) is genuinely `async` — confirmed against
 * `node_modules/drizzle-orm/expo-sqlite/migrator.d.ts` at implementation time:
 * `migrate<TSchema>(db, config): Promise<void>` — so `src/db/runtime.ts` (the Expo runtime)
 * awaits this instead of {@link runMigrations}. The existing synchronous export above is left
 * byte-identical: `src/db/testing/memory-db.ts` and every test that depends on it keep working
 * unchanged.
 *
 * @param migrate Driver-bound thunk that runs Drizzle's `migrate()` for this store; may return
 *   `void` or `Promise<void>` — `await`ing a returned `undefined` is a no-op.
 * @param latestMigrationTag Same attribution semantics as {@link runMigrations}.
 */
export async function runMigrationsAsync(
  migrate: () => void | Promise<void>,
  latestMigrationTag: string,
): Promise<void> {
  try {
    await migrate();
  } catch (cause) {
    throw new DatabaseMigrationError(
      `Failed to apply database migration '${latestMigrationTag}'`,
      { cause },
    );
  }
}
