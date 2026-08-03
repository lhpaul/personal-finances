import type { StageMovement } from '../../../db/types';
import { STAGE_BATCH_SIZE, buildStageBatch, estimateStageMinutes } from '../stage-batch';

/** Categorization flow (#13) implementation plan Testing Strategy, Scenarios 13-14. */

function movement(id: string, type: 'debit' | 'credit'): StageMovement {
  return {
    id,
    amount: 1000,
    type,
    dateLocal: '2026-01-01',
    occurredAt: '2026-01-01T00:00:00.000Z',
    rawDescription: id,
    categorySource: null,
    merchant: null,
  };
}

describe('buildStageBatch (AC2, AC3, P6)', () => {
  it('caps at STAGE_BATCH_SIZE and preserves queue order', () => {
    const pending = Array.from({ length: STAGE_BATCH_SIZE + 5 }, (_, i) => movement(`m-${i}`, 'debit'));
    const batch = buildStageBatch(pending);
    expect(batch).toHaveLength(STAGE_BATCH_SIZE);
    expect(batch.map((m) => m.id)).toEqual(pending.slice(0, STAGE_BATCH_SIZE).map((m) => m.id));
  });

  it('with fewer than the limit, returns the whole queue unchanged (A14)', () => {
    const pending = [movement('a', 'debit'), movement('b', 'credit')];
    expect(buildStageBatch(pending)).toEqual(pending);
  });

  it('in preview mode, promotes the first movement of the requested direction to position 1', () => {
    const pending = [movement('debit-1', 'debit'), movement('credit-1', 'credit'), movement('debit-2', 'debit')];
    const batch = buildStageBatch(pending, { previewDirection: 'income' });
    expect(batch.map((m) => m.id)).toEqual(['credit-1', 'debit-1', 'debit-2']);
  });

  it('in preview mode, leaves the batch unchanged when the requested direction is already first', () => {
    const pending = [movement('credit-1', 'credit'), movement('debit-1', 'debit')];
    const batch = buildStageBatch(pending, { previewDirection: 'income' });
    expect(batch.map((m) => m.id)).toEqual(['credit-1', 'debit-1']);
  });

  it('in preview mode, leaves the batch unchanged when no movement of the requested direction exists', () => {
    const pending = [movement('debit-1', 'debit'), movement('debit-2', 'debit')];
    const batch = buildStageBatch(pending, { previewDirection: 'income' });
    expect(batch.map((m) => m.id)).toEqual(['debit-1', 'debit-2']);
  });

  it('outside preview mode (no previewDirection), never reorders', () => {
    const pending = [movement('debit-1', 'debit'), movement('credit-1', 'credit')];
    expect(buildStageBatch(pending).map((m) => m.id)).toEqual(['debit-1', 'credit-1']);
  });
});

describe('estimateStageMinutes (A5, P1)', () => {
  it('never returns 0, even for a very short batch', () => {
    expect(estimateStageMinutes(1)).toBeGreaterThanOrEqual(1);
    expect(estimateStageMinutes(0)).toBeGreaterThanOrEqual(1);
  });

  it('rounds a full ten-movement stage to the top of the 1-3 minute promise', () => {
    expect(estimateStageMinutes(10)).toBe(3);
  });

  it('rounds half-up as P1 specifies', () => {
    // 6 movements * 15s = 90s = 1.5 minutes -> rounds to 2.
    expect(estimateStageMinutes(6)).toBe(2);
  });
});
