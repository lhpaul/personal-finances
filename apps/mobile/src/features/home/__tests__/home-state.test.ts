import type { BankConnection } from '../../../db/types';
import { resolveHomeState } from '../home-state';

function connection(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: 'conn-1',
    institutionId: 'banco-de-chile',
    institutionName: 'Banco de Chile',
    institutionLogoUrl: undefined,
    institutionShortName: 'BCH',
    institutionBrandColor: '#003da5',
    status: 'active',
    syncStatus: 'ok',
    lastSyncAt: '2026-02-27T21:14:00.000Z',
    lastSuccessAt: '2026-02-27T21:14:00.000Z',
    lastErrorCode: null,
    ...overrides,
  };
}

/** Scenario 10 of the home-screen implementation plan's Testing Strategy (Decision 4, A1-A2). */
describe('resolveHomeState', () => {
  it('returns "empty" when there are no connections at all', () => {
    expect(resolveHomeState({ connections: [], uncategorizedCount: 0 })).toBe('empty');
  });

  it('returns "empty" when the only connection has no lastSuccessAt yet', () => {
    expect(
      resolveHomeState({
        connections: [connection({ lastSuccessAt: null })],
        uncategorizedCount: 5,
      }),
    ).toBe('empty');
  });

  it('returns "sync-error" when error and pending are both true — sync-error outranks pending (A1)', () => {
    expect(
      resolveHomeState({
        connections: [connection({ syncStatus: 'error' })],
        uncategorizedCount: 3,
      }),
    ).toBe('sync-error');
  });

  it('returns "sync-error" when a connection has errored, with no uncategorized movements', () => {
    expect(
      resolveHomeState({
        connections: [connection({ syncStatus: 'error' })],
        uncategorizedCount: 0,
      }),
    ).toBe('sync-error');
  });

  it('returns "empty" when a connection errored before its first success — empty outranks sync-error (A2, found in review)', () => {
    expect(
      resolveHomeState({
        connections: [connection({ syncStatus: 'error', lastSuccessAt: null })],
        uncategorizedCount: 3,
      }),
    ).toBe('empty');
  });

  it('returns "pending" when uncategorizedCount is positive and no connection has errored', () => {
    expect(
      resolveHomeState({ connections: [connection()], uncategorizedCount: 4 }),
    ).toBe('pending');
  });

  it('returns "all-clear" when neither error nor pending applies', () => {
    expect(
      resolveHomeState({ connections: [connection()], uncategorizedCount: 0 }),
    ).toBe('all-clear');
  });

  it('returns "sync-error" when one of two connections has errored', () => {
    expect(
      resolveHomeState({
        connections: [connection({ id: 'a' }), connection({ id: 'b', syncStatus: 'error' })],
        uncategorizedCount: 0,
      }),
    ).toBe('sync-error');
  });

  it('returns "pending" when only one of two connections has a lastSuccessAt (the other still counts as first-sync-done overall)', () => {
    expect(
      resolveHomeState({
        connections: [
          connection({ id: 'a', lastSuccessAt: null }),
          connection({ id: 'b' }),
        ],
        uncategorizedCount: 2,
      }),
    ).toBe('pending');
  });

  it('is a total function: every input produces exactly one of the four states', () => {
    const states = new Set([
      resolveHomeState({ connections: [], uncategorizedCount: 0 }),
      resolveHomeState({ connections: [connection()], uncategorizedCount: 0 }),
      resolveHomeState({ connections: [connection({ syncStatus: 'error' })], uncategorizedCount: 0 }),
      resolveHomeState({ connections: [connection()], uncategorizedCount: 1 }),
    ]);
    for (const state of states) {
      expect(['empty', 'sync-error', 'pending', 'all-clear']).toContain(state);
    }
  });
});
