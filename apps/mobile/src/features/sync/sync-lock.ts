/**
 * The device-wide single-read lock (implementation plan Decision 13, issue #10; spec Business
 * Rule 22, AC28).
 *
 * `activeConnectionId` is the only shared mutable state this feature has. It is module-private,
 * mutated only by {@link acquireReadLock} and the release handle it returns, and JavaScript's
 * single-threaded event loop makes the test-and-set in `acquireReadLock` atomic — there is no
 * `await` between the read of `activeConnectionId` and the write to it, so two overlapping
 * `runSync` calls (same connection, or different connections) can never both acquire the lock
 * (`sync-lock.test.ts` proves this by starting two calls without awaiting the first).
 *
 * This is deliberately not a queue: spec Decision 11 says one read at a time and the MVP has one
 * bank, so a refusal is correct behaviour, not a wait.
 */

let activeConnectionId: string | null = null;

/** True while a read is in progress for any connection. */
export function isReadInProgress(): boolean {
  return activeConnectionId !== null;
}

/**
 * Attempts to acquire the device-wide lock for `connectionId`. Returns a release handle on
 * success, or `null` when the lock is already held — for the same connection **or a different
 * one** (AC28's second sentence: a request for a different connection while a read is running
 * also gets no second read). The release handle is idempotent-safe to call from a `finally` on
 * every exit path, including a throw.
 */
export function acquireReadLock(connectionId: string): (() => void) | null {
  if (activeConnectionId !== null) return null;
  activeConnectionId = connectionId;
  return () => {
    if (activeConnectionId === connectionId) {
      activeConnectionId = null;
    }
  };
}

/** Test-only escape hatch, mirroring `src/db/bootstrap.ts`'s `__resetBootstrapForTests`. Not for
 * app use — production code never needs to force-clear an in-process lock. */
export function __resetReadLockForTests(): void {
  activeConnectionId = null;
}
