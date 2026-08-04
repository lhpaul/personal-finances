import { useEffect, useState } from 'react';

import {
  excludeTransaction,
  reincludeTransaction,
  setTransactionNote,
  setUserCategory,
} from '../../db/repositories/transactions';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, Transaction } from '../../db/types';

export type DetailExclusionInput = {
  reason: NonNullable<Transaction['exclusionReason']>;
  note?: string | null;
};

export class TransactionDetailActionInFlightError extends Error {
  constructor() {
    super('A previous transaction-detail write is still in flight');
    this.name = 'TransactionDetailActionInFlightError';
  }
}

/**
 * Distinguishes a single-flight rejection (a second action button tap that arrived while an
 * earlier write was still running) from a genuine write failure. Extracted as a pure, exported
 * function — not inlined into the screen's own catch block — so `TransactionDetailScreen`'s
 * `withWriteGuard` can be unit-tested without a React renderer (item #2's no-renderer precedent).
 *
 * An in-flight rejection is never a real failure: the first call is still in progress and will
 * resolve or reject on its own. The screen must not surface `transaction_detail.write_failed`
 * for it (found in review on PR #84 — the screen previously mapped every rejection, including
 * this one, to the write-failed note, which misreported an ordinary disabled-button race as a
 * save error).
 */
export function isWriteInFlightError(error: unknown): boolean {
  return error instanceof TransactionDetailActionInFlightError;
}

export interface TransactionDetailActionsCore {
  changeCategory(categoryId: string): Promise<void>;
  saveNote(note: string | null): Promise<void>;
  excludeMovement(input: DetailExclusionInput): Promise<void>;
  reincludeMovement(): Promise<void>;
  /** Test/inspection hook — not used by the screen. */
  isInFlight(): boolean;
}

/**
 * The write side's single-flight guard (implementation plan Decision 2, concurrent-event-source
 * addendum, Testing Strategy Scenario 20), factored out of the hook as a plain function so it is
 * testable without a React renderer — the same shape #13's `createStageActionsCore` uses. Bound
 * to one `transactionId`, unlike #13's per-call `transactionId` argument, because this hook is
 * scoped to a single screen's single movement.
 *
 * `run` defers the actual write to a microtask so a second call issued in the same synchronous
 * tick — a double tap on *Confirmar* or *Volver a incluir* — still sees `inFlight` `true` and
 * rejects, instead of racing ahead of the flag's own reset.
 */
export function createTransactionDetailActionsCore(
  db: AppDatabase,
  transactionId: string,
  ports: { now: () => string } = { now: () => new Date().toISOString() },
): TransactionDetailActionsCore {
  let inFlight = false;

  function run(fn: () => void): Promise<void> {
    if (inFlight) return Promise.reject(new TransactionDetailActionInFlightError());
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
    changeCategory: (categoryId) => run(() => setUserCategory(db, transactionId, categoryId, ports)),
    saveNote: (note) => run(() => setTransactionNote(db, transactionId, note, ports)),
    excludeMovement: (input) => run(() => excludeTransaction(db, transactionId, input, ports)),
    reincludeMovement: () => run(() => reincludeTransaction(db, transactionId, ports)),
    isInFlight: () => inFlight,
  };
}

export type TransactionDetailActionsState =
  | { status: 'pending' }
  | { status: 'ready'; actions: TransactionDetailActionsCore }
  | { status: 'error'; error: unknown };

/**
 * `useTransactionDetailActions(transactionId)` (implementation plan Decision 2): awaits the same
 * memoized `getAppDatabase()` handle once, behind a cancellation guard, and exposes the four
 * writes through `createTransactionDetailActionsCore`. Mirrors `useStageActions`'s shape; not
 * independently hook-tested for the same reason `useStageActions` is not (no React hook-testing
 * renderer installed — Verification Log).
 */
export function useTransactionDetailActions(transactionId: string): TransactionDetailActionsState {
  const [state, setState] = useState<TransactionDetailActionsState>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    getAppDatabase()
      .then((db) => {
        if (cancelled) return;
        setState({ status: 'ready', actions: createTransactionDetailActionsCore(db, transactionId) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', error });
      });

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  return state;
}
