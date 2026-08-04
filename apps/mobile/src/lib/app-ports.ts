import * as Crypto from 'expo-crypto';

/**
 * The app tier's own `newId` / `now` ports (implementation plan for issue #14, Layer-by-Layer).
 *
 * A handful of repository writes (e.g. `groupAliasIntoMerchant`) take injected `newId` / `now`
 * ports rather than generating ids and timestamps themselves (`src/db/ids.ts`'s `NewId` / `Now`).
 * `src/db/runtime.ts` already supplies its own copy for the bootstrap path, and implementation
 * plan Decision 2 requires that file to stay exactly as written once it exists — so a feature
 * hook that calls one of those writes needs an equivalent of its own, not a change to
 * `runtime.ts`.
 *
 * Lives in `src/lib/`, not `src/db/`: `expo-crypto` is a platform concern the app tier is allowed
 * to use directly — the `dbAccessBoundary` rule (and its test,
 * `src/db/__tests__/db-access-boundary.test.ts`) restrict only `drizzle-orm`, `expo-sqlite` and
 * `better-sqlite3` outside `src/db/`.
 */
export function newId(): string {
  return Crypto.randomUUID();
}

/** ISO-8601, matching every other `now` port in this codebase (`src/db/ids.ts`'s `Now`). */
export function now(): string {
  return new Date().toISOString();
}
