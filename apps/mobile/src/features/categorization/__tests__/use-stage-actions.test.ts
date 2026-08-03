import { StageActionInFlightError, createStageActionsCore } from '../use-stage-actions';
import type { AppDatabase } from '../../../db/types';

/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 23 (AC12, Decision
 * 7). Exercises `createStageActionsCore` — the write side's single-flight guard — as a plain
 * function over a fake database handle, so no real SQLite driver is needed (item #2's
 * no-renderer precedent; the hook `useStageActions` that awaits `getAppDatabase()` is not
 * independently tested, for the same reason `useOnboardingSummary` / `useLaunchDecision` are
 * not).
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

describe('createStageActionsCore single-flight guard', () => {
  it('rejects a second confirmCategory issued before the first resolves, and does not double-write', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createStageActionsCore(db, { now: () => '2026-01-01T00:00:00.000Z' });

    const first = actions.confirmCategory('tx-1', 'comida');
    const second = actions.confirmCategory('tx-1', 'transporte');

    await expect(second).rejects.toBeInstanceOf(StageActionInFlightError);
    await first;

    expect(calls.filter((c) => c === 'update')).toHaveLength(1);
  });

  it('allows a new call once the previous one has resolved', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createStageActionsCore(db, { now: () => '2026-01-01T00:00:00.000Z' });

    await actions.confirmCategory('tx-1', 'comida');
    await actions.markReviewLater('tx-2');

    expect(calls.filter((c) => c === 'update')).toHaveLength(2);
  });

  it('the guard is shared across every write — a review-flag write blocks an in-flight exclusion, too', async () => {
    const calls: string[] = [];
    const db = fakeDbRecordingCalls(calls);
    const actions = createStageActionsCore(db, { now: () => '2026-01-01T00:00:00.000Z' });

    const first = actions.excludeMovement('tx-1', { reason: 'other' });
    const second = actions.markUncertain('tx-2');

    await expect(second).rejects.toBeInstanceOf(StageActionInFlightError);
    await first;
  });

  it('isInFlight reflects the guard state before and after a write settles', async () => {
    const db = fakeDbRecordingCalls([]);
    const actions = createStageActionsCore(db, { now: () => '2026-01-01T00:00:00.000Z' });

    expect(actions.isInFlight()).toBe(false);
    const pending = actions.confirmCategory('tx-1', 'comida');
    expect(actions.isInFlight()).toBe(true);
    await pending;
    expect(actions.isInFlight()).toBe(false);
  });
});
