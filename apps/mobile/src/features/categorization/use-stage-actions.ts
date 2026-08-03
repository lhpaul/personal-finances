import { useEffect, useState } from 'react';

import { excludeTransaction, setReviewFlag, setUserCategory } from '../../db/repositories/transactions';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, Transaction } from '../../db/types';

/** Derived from `Transaction['exclusionReason']` (`db/types.ts`) rather than redeclared, so the
 * reason union has exactly one source of truth (CodeRabbit finding on PR #79). */
export type StageExclusionReason = NonNullable<Transaction['exclusionReason']>;

export class StageActionInFlightError extends Error {
  constructor() {
    super('A previous categorization write is still in flight');
    this.name = 'StageActionInFlightError';
  }
}

export interface StageActionsCore {
  confirmCategory(transactionId: string, categoryId: string): Promise<void>;
  markReviewLater(transactionId: string): Promise<void>;
  markUncertain(transactionId: string): Promise<void>;
  excludeMovement(transactionId: string, input: { reason: StageExclusionReason; note?: string | null }): Promise<void>;
  /** Test/inspection hook — not used by the screens. */
  isInFlight(): boolean;
}

/**
 * The write side's single-flight guard (implementation plan Decision 7, spec AC12, Testing
 * Strategy Scenario 23), factored out of the hook as a plain function so it is testable without
 * a React renderer (item #2's no-renderer precedent).
 *
 * `run` defers the actual write to a microtask (`Promise.resolve().then(...)`) rather than
 * executing it synchronously before returning a promise. This is deliberate: it is what makes a
 * second call issued in the same synchronous tick — the exact shape of a double tap on
 * "Siguiente →" — see `inFlight` still `true` and reject, instead of the flag having already
 * cleared before the second call ever checks it.
 */
export function createStageActionsCore(
  db: AppDatabase,
  ports: { now: () => string } = { now: () => new Date().toISOString() },
): StageActionsCore {
  let inFlight = false;

  function run(fn: () => void): Promise<void> {
    if (inFlight) return Promise.reject(new StageActionInFlightError());
    inFlight = true;
    return Promise.resolve()
      .then(() => {
        fn();
      })
      .finally(() => {
        inFlight = false;
      });
  }

  return {
    confirmCategory: (transactionId, categoryId) =>
      run(() => setUserCategory(db, transactionId, categoryId, ports)),
    markReviewLater: (transactionId) => run(() => setReviewFlag(db, transactionId, 'review_later', ports)),
    markUncertain: (transactionId) => run(() => setReviewFlag(db, transactionId, 'uncertain', ports)),
    excludeMovement: (transactionId, input) => run(() => excludeTransaction(db, transactionId, input, ports)),
    isInFlight: () => inFlight,
  };
}

export type StageActionsState =
  | { status: 'pending' }
  | { status: 'ready'; actions: StageActionsCore }
  | { status: 'error'; error: unknown };

/**
 * `useStageActions()` (implementation plan Decision 16): awaits the same memoized
 * `getAppDatabase()` handle once, behind a cancellation guard, and exposes the four writes
 * through `createStageActionsCore`. Mirrors `useOnboardingSummary` / `useLaunchDecision`'s
 * shape; not independently hook-tested for the same reason those are not (no React
 * hook-testing renderer installed — Verification Log). `createStageActionsCore` above is the
 * part of this hook's behavior that *is* independently testable, and is covered by
 * `use-stage-actions.test.ts`.
 */
export function useStageActions(): StageActionsState {
  const [state, setState] = useState<StageActionsState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    getAppDatabase()
      .then((db) => {
        if (cancelled) return;
        setState({ status: 'ready', actions: createStageActionsCore(db) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', error });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
