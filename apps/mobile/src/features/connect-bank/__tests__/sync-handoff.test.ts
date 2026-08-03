import { buildSyncRequest, SYNCING_ROUTE } from '../sync-handoff';

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
