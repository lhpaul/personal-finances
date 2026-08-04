import type { DbPorts } from '../../db/ids';
import type { AppDatabase, SyncConnection } from '../../db/types';
import type { ScraperRunner, SyncDeps, SyncRunResult } from '../sync';
import { resolveRetryAction, type SyncFailureKind } from './failure-copy';
import type { SyncPhase } from './bank-syncing-state';

/**
 * `use-bank-sync.ts`'s outcome mapping (Decision 6) and retry decision (Decision 8), split into
 * their own React-free module (item #12's hook/pure split precedent) for two independent
 * reasons: unit-testability without a renderer, **and** so `credential-leak.db.test.ts` (which
 * runs under the `db` Jest project — `testEnvironment: 'node'`, no React Native transform) can
 * import {@link runAttempt} directly without pulling in `react`/`expo-router`/`expo-crypto`/the
 * deep `@finanzas/bank-scraper/src/component` import chain that `use-bank-sync.ts` and
 * `use-scraper-runner.tsx` carry (found during implementation: importing `use-bank-sync.ts`, or
 * even `src/db/runtime.ts`'s `createRuntimePorts` for its `expo-crypto` import alone, from a
 * `.db.test.ts` file fails to parse). `ports` is therefore an explicit dependency here rather
 * than built internally — the real hook supplies `createRuntimePorts()`; the db-test suite
 * supplies `openBootstrappedMemoryDb()`'s own deterministic, `node:crypto`-based ports.
 */

export interface RunAttemptDeps {
  db: AppDatabase;
  ports: DbPorts;
  runner: ScraperRunner;
  runSync: (deps: SyncDeps, request: { connectionId: string }) => Promise<SyncRunResult>;
  getConnection: (db: AppDatabase, connectionId: string) => Pick<SyncConnection, 'lastErrorCode'> | undefined;
}

export interface AttemptOutcome {
  phase: Exclude<SyncPhase, 'starting' | 'reading'>;
  failure: { reasonCode: SyncFailureKind } | null;
}

/**
 * The outcome mapping, extracted so it is testable without a renderer. `runSync`'s own device
 * lock is the re-entrancy net — this function does not add one of its own.
 *
 * Never throws (concurrency addendum, "error propagation across async boundaries"): `runSync`
 * itself only rejects for a programming error (an unknown connection id, item #10's own
 * contract), but that rejection is still caught here rather than left to propagate to a
 * fire-and-forget caller, where it would surface as an unhandled promise rejection instead of a
 * screen state. The caught error's own message is never read — only the fixed `parse_failed`
 * code is (Decision 5's "never a raw exception" guarantee).
 */
export async function runAttempt(deps: RunAttemptDeps, request: { connectionId: string }): Promise<AttemptOutcome> {
  const syncDeps: SyncDeps = {
    db: deps.db,
    ports: deps.ports,
    runner: deps.runner,
    // `deps.db` is only ever produced here after `getAppDatabase()` has already resolved (the
    // hook awaits it before calling this function), so bootstrap is already complete.
    ready: Promise.resolve(),
  };

  let result: SyncRunResult;
  try {
    result = await deps.runSync(syncDeps, request);
  } catch {
    return { phase: 'failed', failure: { reasonCode: 'parse_failed' } };
  }

  if (result.status === 'refused') {
    // Scenario 14: no `getConnection` call for a refusal — item #10 wrote nothing.
    return { phase: 'refused', failure: { reasonCode: 'read_in_progress' } };
  }
  if (result.connectionState.syncStatus === 'ok') {
    return { phase: 'succeeded', failure: null };
  }
  if (result.connectionState.syncStatus === 'idle') {
    // A cancelled read (Assumption A1, Decision 9) — no failure was recorded.
    return { phase: 'stopped', failure: null };
  }

  // 'error' — item #10's own transaction has already committed by the time runSync resolves.
  const connection = deps.getConnection(deps.db, request.connectionId);
  return {
    phase: 'failed',
    failure: { reasonCode: connection?.lastErrorCode ?? 'parse_failed' },
  };
}

export type RetryDecision =
  | { kind: 'noop' }
  | { kind: 'reenter_credentials' }
  | { kind: 'restart_read' };

/**
 * What pressing *Reintentar* should do, given the current attempt outcome (Decision 8; scenarios
 * 16-18). Pure — extracted so the decision is testable without a renderer. `null` (no attempt has
 * settled yet) and any non-terminal phase both resolve to `'noop'`, which is what makes a second
 * press while `phase === 'reading'` harmless (scenario 18) — the hook's own `inFlightRef` guard
 * in `useBankSync` is the second, synchronous net against true re-entrancy.
 */
export function resolveRetryDecision(outcome: AttemptOutcome | null): RetryDecision {
  if (outcome === null) return { kind: 'noop' };
  if (outcome.phase !== 'failed' && outcome.phase !== 'refused') return { kind: 'noop' };
  const kind = outcome.failure?.reasonCode ?? 'read_in_progress';
  return resolveRetryAction(kind) === 'reenter_credentials'
    ? { kind: 'reenter_credentials' }
    : { kind: 'restart_read' };
}
