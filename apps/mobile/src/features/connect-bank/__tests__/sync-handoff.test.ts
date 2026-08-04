import {
  buildSyncRequest,
  consumePendingSyncHandoff,
  setPendingSyncHandoff,
  SYNCING_ROUTE,
  __resetPendingSyncHandoffForTests,
} from '../sync-handoff';

describe('buildSyncRequest (Decision 8)', () => {
  it('builds a handoff carrying the key, never a credential value', () => {
    const handoff = buildSyncRequest(
      { userFinancialInstitutionId: 'connection-1', credentialsKey: 'bank_creds:banco-de-chile' },
      'banco-de-chile',
    );
    expect(handoff).toEqual({
      connectionId: 'connection-1',
      countryCode: 'cl',
      bankId: 'banco-de-chile',
      credentialsKey: 'bank_creds:banco-de-chile',
    });
    expect(Object.keys(handoff).sort()).toEqual(['bankId', 'connectionId', 'countryCode', 'credentialsKey']);
  });
});

describe('SYNCING_ROUTE', () => {
  it('points at the (onboarding) route group', () => {
    expect(SYNCING_ROUTE).toBe('/(onboarding)/bank-syncing');
  });
});

/**
 * Found in review (CodeRabbit PR #80): `buildSyncRequest` alone proves nothing about whether
 * item #11's syncing screen can actually retrieve the handoff — `useConnectBank` had no route to
 * hand its result to. These tests exercise the module-scoped store directly, proving a handoff
 * set after a successful connect is exactly what a later `consumePendingSyncHandoff()` call
 * returns, and that it is consumed at most once (a stale handoff from a prior connect attempt
 * must never leak into an unrelated later read).
 */
describe('setPendingSyncHandoff / consumePendingSyncHandoff (found in review)', () => {
  afterEach(() => {
    __resetPendingSyncHandoffForTests();
  });

  it('returns null when nothing has been set', () => {
    expect(consumePendingSyncHandoff()).toBeNull();
  });

  it('returns exactly the handoff that was set', () => {
    const handoff = buildSyncRequest(
      { userFinancialInstitutionId: 'connection-2', credentialsKey: 'bank_creds:santander' },
      'santander',
    );
    setPendingSyncHandoff(handoff);
    expect(consumePendingSyncHandoff()).toEqual(handoff);
  });

  it('consumes the handoff at most once — a second read sees null', () => {
    setPendingSyncHandoff(
      buildSyncRequest(
        { userFinancialInstitutionId: 'connection-3', credentialsKey: 'bank_creds:banco-de-chile' },
        'banco-de-chile',
      ),
    );
    expect(consumePendingSyncHandoff()).not.toBeNull();
    expect(consumePendingSyncHandoff()).toBeNull();
  });

  it('a later set replaces an earlier, unconsumed one — no queueing', () => {
    setPendingSyncHandoff(
      buildSyncRequest({ userFinancialInstitutionId: 'stale', credentialsKey: 'bank_creds:stale' }, 'stale'),
    );
    const latest = buildSyncRequest(
      { userFinancialInstitutionId: 'fresh', credentialsKey: 'bank_creds:fresh' },
      'fresh',
    );
    setPendingSyncHandoff(latest);
    expect(consumePendingSyncHandoff()).toEqual(latest);
  });
});
