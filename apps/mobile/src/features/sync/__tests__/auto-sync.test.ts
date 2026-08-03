import { AUTOMATIC_SYNC_INTERVAL_MS, isDueForAutomaticSync, selectConnectionsDueForAutomaticSync } from '../auto-sync';
import type { SyncConnection } from '../../../db/types';

/**
 * Implementation plan Decision 12 (issue #10): the automatic-sync eligibility predicate. Spec
 * Business Rule 24, Decisions 1-3; AC24, AC25, AC27.
 */

const NOW = '2026-03-10T12:00:00.000Z';

function baseConnection(overrides?: Partial<SyncConnection>): SyncConnection {
  return {
    id: 'connection-1',
    financialInstitutionId: 'banco-de-chile',
    countryCode: 'CL',
    status: 'active',
    credentialsKey: 'secure-store-key-connection-1',
    syncStatus: 'idle',
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

function hoursAgo(hours: number): string {
  return new Date(Date.parse(NOW) - hours * 60 * 60 * 1000).toISOString();
}

describe('isDueForAutomaticSync (Decision 12, AC24, AC25, AC27)', () => {
  it('AUTOMATIC_SYNC_INTERVAL_MS is exactly six hours', () => {
    expect(AUTOMATIC_SYNC_INTERVAL_MS).toBe(6 * 60 * 60 * 1000);
  });

  it.each([
    ['never synced, never attempted', baseConnection(), true],
    [
      'last success and last attempt both more than 6h ago',
      baseConnection({ lastSuccessAt: hoursAgo(7), lastSyncAt: hoursAgo(7) }),
      true,
    ],
    [
      'last success exactly 6h ago (not strictly greater)',
      baseConnection({ lastSuccessAt: hoursAgo(6), lastSyncAt: hoursAgo(6) }),
      false,
    ],
    [
      'last success 5h59m ago — not due (AC24)',
      baseConnection({ lastSuccessAt: hoursAgo(5.9833), lastSyncAt: hoursAgo(5.9833) }),
      false,
    ],
    [
      'last success 6h01m ago — due (AC24)',
      baseConnection({ lastSuccessAt: hoursAgo(6.0167), lastSyncAt: hoursAgo(6.0167) }),
      true,
    ],
    [
      'last success old, but last *attempt* recent (a fast-failing connection) — not due',
      baseConnection({ lastSuccessAt: hoursAgo(30), lastSyncAt: hoursAgo(1) }),
      false,
    ],
    [
      'inactive connection — never automatic (AC27)',
      baseConnection({ status: 'inactive', lastSuccessAt: hoursAgo(30) }),
      false,
    ],
    [
      'disconnected connection — never automatic (AC27)',
      baseConnection({ status: 'disconnected', lastSuccessAt: hoursAgo(30) }),
      false,
    ],
    [
      'currently syncing — never automatic',
      baseConnection({ syncStatus: 'syncing', lastSuccessAt: hoursAgo(30) }),
      false,
    ],
    [
      'last failure was invalid_credentials — suspended (AC25)',
      baseConnection({ lastErrorCode: 'invalid_credentials', lastSuccessAt: hoursAgo(30) }),
      false,
    ],
    [
      'last failure was network (not invalid_credentials) — still eligible',
      baseConnection({ lastErrorCode: 'network', lastSuccessAt: hoursAgo(30), lastSyncAt: hoursAgo(30) }),
      true,
    ],
  ])('%s', (_label, connection, expected) => {
    expect(isDueForAutomaticSync(connection, NOW)).toBe(expected);
  });
});

describe('selectConnectionsDueForAutomaticSync', () => {
  it('filters a mixed list down to only the eligible connections', () => {
    const eligible = baseConnection({ id: 'eligible', lastSuccessAt: hoursAgo(30), lastSyncAt: hoursAgo(30) });
    const suspended = baseConnection({ id: 'suspended', lastErrorCode: 'invalid_credentials', lastSuccessAt: hoursAgo(30) });
    const inactive = baseConnection({ id: 'inactive', status: 'inactive' });
    const recent = baseConnection({ id: 'recent', lastSuccessAt: hoursAgo(1), lastSyncAt: hoursAgo(1) });

    const due = selectConnectionsDueForAutomaticSync([eligible, suspended, inactive, recent], NOW);
    expect(due.map((c) => c.id)).toEqual(['eligible']);
  });

  it('an empty list returns an empty list (degenerate input terminates)', () => {
    expect(selectConnectionsDueForAutomaticSync([], NOW)).toEqual([]);
  });
});
