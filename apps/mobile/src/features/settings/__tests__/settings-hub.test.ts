import {
  accountSubtitle,
  aboutSubtitle,
  banksSubtitle,
  categoriesSubtitle,
  remindersAreFullyConfigured,
  SETTINGS_HUB_ROWS,
} from '../settings-hub';

/** Scenario 7 of the implementation plan for issue #19: hub rows and subtitles. */
describe('SETTINGS_HUB_ROWS (brief scope; Decision 14, Assumption A10)', () => {
  it('has exactly the five mockup rows, in mockup order, with the five manifest routes', () => {
    expect(SETTINGS_HUB_ROWS.map((row) => row.href)).toEqual([
      '/settings/account',
      '/settings/banks',
      '/settings/notifications',
      '/settings/categories',
      '/settings/about',
    ]);
    expect(SETTINGS_HUB_ROWS).toHaveLength(5);
  });

  it('every row has a non-empty screenId, iconKey and titleKey', () => {
    for (const row of SETTINGS_HUB_ROWS) {
      expect(row.screenId.length).toBeGreaterThan(0);
      expect(row.iconKey.length).toBeGreaterThan(0);
      expect(row.titleKey.length).toBeGreaterThan(0);
    }
  });
});

describe('accountSubtitle (Decision 15, Assumption A5)', () => {
  it('returns the raw formatted RUT when one exists', () => {
    expect(accountSubtitle('12.345.678-5')).toEqual({ variant: 'raw', text: '12.345.678-5' });
  });

  it('falls back to the no-bank variant when there is none', () => {
    expect(accountSubtitle(null)).toEqual({ variant: 'account_no_bank' });
  });
});

describe('banksSubtitle (Decision 15)', () => {
  it('returns the empty variant when there are no connections', () => {
    expect(banksSubtitle(0, 0)).toEqual({ variant: 'banks_empty' });
  });

  it('returns the singular variant for exactly one bank', () => {
    expect(banksSubtitle(1, 3)).toEqual({ variant: 'banks_single', banks: 1, products: 3 });
  });

  it('returns the plural variant for more than one bank', () => {
    expect(banksSubtitle(2, 5)).toEqual({ variant: 'banks_plural', banks: 2, products: 5 });
  });
});

describe('remindersAreFullyConfigured (Decision 15)', () => {
  it('is true when enabled with both time and days present', () => {
    expect(remindersAreFullyConfigured({ enabled: true, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] })).toBe(true);
  });

  it('is false when disabled', () => {
    expect(remindersAreFullyConfigured({ enabled: false, timeOfDay: '09:00', days: [1] })).toBe(false);
  });

  it('is false when timeOfDay is missing', () => {
    expect(remindersAreFullyConfigured({ enabled: true, timeOfDay: undefined, days: [1] })).toBe(false);
  });

  it('is false when days is missing', () => {
    expect(remindersAreFullyConfigured({ enabled: true, timeOfDay: '09:00', days: undefined })).toBe(false);
  });
});

describe('categoriesSubtitle (Decision 15)', () => {
  it('always returns the categories variant with both counts — no fallback needed', () => {
    expect(categoriesSubtitle({ expense: 10, income: 6 })).toEqual({
      variant: 'categories',
      expense: 10,
      income: 6,
    });
  });
});

describe('aboutSubtitle (Decision 9)', () => {
  it('returns the version variant with the given version string', () => {
    expect(aboutSubtitle('1.2.3')).toEqual({ variant: 'about_version', version: '1.2.3' });
  });
});
