import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit configuration for the on-device SQLite store.
 *
 * `driver: 'expo'` is required so `drizzle-kit generate` also emits `drizzle/migrations.js`,
 * the bundle Metro loads at runtime (see `src/db/migrate.ts` and `apps/mobile/metro.config.js`).
 * Under this driver drizzle-kit rejects `migrate`, `studio` and `pull` — see the implementation
 * plan's Verification Log and Decision 6 for why `db:check` is a custom CLI instead of a
 * drizzle-kit command.
 */
export default {
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './drizzle',
} satisfies Config;
