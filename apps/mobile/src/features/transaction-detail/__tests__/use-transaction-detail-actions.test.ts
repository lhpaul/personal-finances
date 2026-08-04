import {
  createTransactionDetailActionsCore,
  TransactionDetailActionInFlightError,
} from '../use-transaction-detail-actions';
import type { AppDatabase } from '../../../db/types';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 20 (concurrency
 * addendum). Exercises `createTransactionDetailActionsCore` — the write side's single-flight
 * guard — as a plain function over a fake database handle (item #2's no-renderer precedent;
 * mirrors #13's `use-stage-actions.test.ts`).
 */
function fakeDbRecordingCalls(calls: string[]): AppDatabase {
  const chain = {
    set: () => chain,
    where: () => chain,
    run: () => {
      calls.push('run');
    },
  };
  return {
    update: () => {
      calls.push('update');
      return chain;
    },
  } as unknown as AppDatabase;
}

describe('createTransactionDetailActionsCore single-flight guard', () => {
  it('rejects a second saveNote issued before the first resolves, and does not double-write', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createTransactionDetailActionsCore(db, 'tx-1', { now: () => '2026-01-01T00:00:00.000Z' });

    const first = actions.saveNote('primera nota');
    const second = actions.saveNote('segunda nota');

    await expect(second).rejects.toBeInstanceOf(TransactionDetailActionInFlightError);
    await first;

    expect(calls.filter((c) => c === 'update')).toHaveLength(1);
  });

  it('allows a new call once the previous one has resolved', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createTransactionDetailActionsCore(db, 'tx-1', { now: () => '2026-01-01T00:00:00.000Z' });

    await actions.saveNote('una nota');
    await actions.reincludeMovement();

    expect(calls.filter((c) => c === 'update')).toHaveLength(2);
  });

  it('the guard is shared across every write — an exclusion blocks an in-flight category change, too', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createTransactionDetailActionsCore(db, 'tx-1', { now: () => '2026-01-01T00:00:00.000Z' });

    const first = actions.excludeMovement({ reason: 'other' });
    const second = actions.changeCategory('comida');

    await expect(second).rejects.toBeInstanceOf(TransactionDetailActionInFlightError);
    await first;
  });

  it('isInFlight reflects the guard state before and after a write settles', async () => {
    const db = fakeDbRecordingCalls([]);
    const actions = createTransactionDetailActionsCore(db, 'tx-1', { now: () => '2026-01-01T00:00:00.000Z' });

    expect(actions.isInFlight()).toBe(false);
    const pending = actions.reincludeMovement();
    expect(actions.isInFlight()).toBe(true);
    await pending;
    expect(actions.isInFlight()).toBe(false);
  });
});
