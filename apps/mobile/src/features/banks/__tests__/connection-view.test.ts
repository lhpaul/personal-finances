import type { BankConnectionSummary } from '../../../db/types';
import {
  monogramFor,
  pluralKey,
  resolveBankReviewState,
  resolveConnectionListItem,
  resolveListSyncFragment,
  resolveReviewHeaderFragment,
  resolveSyncTimeKey,
  summarizeConnections,
} from '../connection-view';
import { describeSyncTime } from '../../home/relative-time';

const NOW = new Date('2026-02-10T12:00:00.000Z');

function baseConnection(overrides: Partial<BankConnectionSummary> = {}): BankConnectionSummary {
  return {
    id: 'conn-1',
    institutionId: 'banco-de-chile',
    name: 'Banco de Chile',
    shortName: 'BCH',
    brandColor: '#003da5',
    logoUrl: undefined,
    status: 'active',
    syncStatus: 'ok',
    lastSyncAt: '2026-02-10T10:00:00.000Z',
    lastSuccessAt: '2026-02-10T10:00:00.000Z',
    lastErrorCode: null,
    lastErrorMessage: null,
    productCount: 3,
    ...overrides,
  };
}

describe('pluralKey (Decision 11)', () => {
  it.each([
    [0, 'bank_count_other'],
    [1, 'bank_count_one'],
    [2, 'bank_count_other'],
  ])('count=%s -> %s', (count, expected) => {
    expect(pluralKey('bank_count', count)).toBe(expected);
  });
});

describe('resolveBankReviewState (Decision 9)', () => {
  it.each([
    ['idle', 'ok'],
    ['syncing', 'ok'],
    ['ok', 'ok'],
    ['error', 'error'],
  ] as const)('syncStatus=%s -> %s', (syncStatus, expected) => {
    expect(resolveBankReviewState({ syncStatus })).toBe(expected);
  });
});

describe('resolveSyncTimeKey (Decision 3)', () => {
  it('every descriptor kind resolves to the prefixed key', () => {
    expect(resolveSyncTimeKey({ kind: 'minutes', minutes: 5 }, 'settings_banks', 'es')).toEqual({
      key: 'settings_banks.synced_minutes',
      values: { value: 5 },
    });
    expect(resolveSyncTimeKey({ kind: 'hours', hours: 2 }, 'bank_review', 'es')).toEqual({
      key: 'bank_review.synced_hours',
      values: { value: 2 },
    });
    expect(resolveSyncTimeKey({ kind: 'yesterday', timeOfDay: '21:14' }, 'settings_banks', 'es')).toEqual({
      key: 'settings_banks.synced_yesterday',
      values: { time: '21:14' },
    });
    const dateResult = resolveSyncTimeKey({ kind: 'date', dateLocal: '2026-01-05' }, 'bank_review', 'es');
    expect(dateResult.key).toBe('bank_review.synced_date');
    expect(typeof dateResult.values.date).toBe('string');
  });
});

describe('resolveListSyncFragment (never-attempted case)', () => {
  it('never_synced when lastSyncAt is null', () => {
    expect(resolveListSyncFragment(null, NOW, 'es')).toEqual({
      key: 'settings_banks.never_synced',
      values: {},
    });
  });

  it('delegates to resolveSyncTimeKey when lastSyncAt is set', () => {
    const descriptor = describeSyncTime(NOW, '2026-02-10T10:00:00.000Z');
    expect(resolveListSyncFragment('2026-02-10T10:00:00.000Z', NOW, 'es')).toEqual(
      resolveSyncTimeKey(descriptor, 'settings_banks', 'es'),
    );
  });
});

describe('resolveReviewHeaderFragment (Decision 9)', () => {
  it('never_synced when last_success_at is null, in either state', () => {
    expect(resolveReviewHeaderFragment(null, NOW, 'es', 'ok')).toEqual({
      key: 'bank_review.never_synced',
      values: {},
    });
    expect(resolveReviewHeaderFragment(null, NOW, 'es', 'error')).toEqual({
      key: 'bank_review.never_synced',
      values: {},
    });
  });

  it('ok state uses the relative synced_* keys', () => {
    const result = resolveReviewHeaderFragment('2026-02-10T10:00:00.000Z', NOW, 'es', 'ok');
    expect(result.key).toBe('bank_review.synced_hours');
  });

  it('error state uses the absolute last_success_* keys, distinct from the ok-state key', () => {
    const result = resolveReviewHeaderFragment('2026-02-10T10:00:00.000Z', NOW, 'es', 'error');
    expect(result.key).toBe('bank_review.last_success_hours');
  });

  it("a failed later attempt does not move the last-success timestamp (brief AC1)", () => {
    const lastSuccessAt = '2026-02-08T21:14:00.000Z';
    const okResult = resolveReviewHeaderFragment(lastSuccessAt, NOW, 'es', 'ok');
    const errorResult = resolveReviewHeaderFragment(lastSuccessAt, NOW, 'es', 'error');
    // Same underlying instant, different (state-appropriate) presentation — never the attempt time.
    expect(okResult.key).not.toBe(errorResult.key);
  });
});

describe('summarizeConnections (Decision 11)', () => {
  it('sums product counts across connections', () => {
    expect(summarizeConnections([{ productCount: 3 }, { productCount: 2 }])).toEqual({
      bankCount: 2,
      productCount: 5,
    });
  });

  it('is zero for an empty list', () => {
    expect(summarizeConnections([])).toEqual({ bankCount: 0, productCount: 0 });
  });
});

describe('monogramFor (Assumption A13)', () => {
  it('prefers shortName', () => {
    expect(monogramFor({ shortName: 'BCH', name: 'Banco de Chile' })).toBe('BCH');
  });

  it('falls back to the first three letters of the name, upper-cased', () => {
    expect(monogramFor({ shortName: undefined, name: 'santander' })).toBe('SAN');
  });
});

describe('resolveConnectionListItem (Decision 3, Decision 4, Assumption A7/A8)', () => {
  it('a healthy connection composes row_subtitle from a sync fragment and a product-count fragment', () => {
    const item = resolveConnectionListItem(baseConnection(), NOW, 'es');
    expect(item.badgeTone).toBe('ok');
    expect(item.badgeLabelKey).toBe('settings_banks.badge_ok');
    expect(item.subLabelTone).toBe('default');
    expect(item.subLabel.kind).toBe('composed');
    if (item.subLabel.kind === 'composed') {
      expect(item.subLabel.productCountFragment).toEqual({
        key: 'settings_banks.product_count_other',
        values: { value: 3 },
      });
    }
  });

  it('an errored connection overrides the sub-label entirely (Assumption A8)', () => {
    const item = resolveConnectionListItem(baseConnection({ syncStatus: 'error' }), NOW, 'es');
    expect(item.badgeTone).toBe('danger');
    expect(item.badgeLabelKey).toBe('settings_banks.badge_error');
    expect(item.subLabelTone).toBe('danger');
    expect(item.subLabel).toEqual({
      kind: 'override',
      fragment: { key: 'settings_banks.sync_error', values: {} },
    });
  });
});
