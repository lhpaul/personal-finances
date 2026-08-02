import {
  banksProductsKey,
  banksTitleKey,
  reminderDayKeys,
  reminderDaysKey,
} from '../ready-summary';

/** Testing Strategy scenario 10. */
describe('banksTitleKey', () => {
  it('count 1 -> the single key', () => {
    expect(banksTitleKey(1)).toBe('onboarding_ready.banks_title_single');
  });

  it('count 0 -> the plural key', () => {
    expect(banksTitleKey(0)).toBe('onboarding_ready.banks_title_plural');
  });

  it('count 2 -> the plural key', () => {
    expect(banksTitleKey(2)).toBe('onboarding_ready.banks_title_plural');
  });
});

describe('banksProductsKey', () => {
  it('count 1 -> the single key', () => {
    expect(banksProductsKey(1)).toBe('onboarding_ready.banks_products_single');
  });

  it('count 0 -> the plural key', () => {
    expect(banksProductsKey(0)).toBe('onboarding_ready.banks_products_plural');
  });

  it('count 3 -> the plural key (index.html:1101 scenario)', () => {
    expect(banksProductsKey(3)).toBe('onboarding_ready.banks_products_plural');
  });
});

describe('reminderDaysKey', () => {
  it('weekdays -> the weekdays key', () => {
    expect(reminderDaysKey({ kind: 'weekdays' })).toBe('reminders.days_weekdays');
  });

  it('everyday -> the everyday key', () => {
    expect(reminderDaysKey({ kind: 'everyday' })).toBe('reminders.days_everyday');
  });

  it('custom -> undefined (no single drawn catalogue string, Assumption A5)', () => {
    expect(reminderDaysKey({ kind: 'custom', days: [6, 7] })).toBeUndefined();
  });
});

describe('reminderDayKeys', () => {
  it('maps each day to its catalogue key, sorted ascending', () => {
    expect(reminderDayKeys([7, 1])).toEqual(['reminders.day_1', 'reminders.day_7']);
  });

  it('an empty day list returns an empty key list', () => {
    expect(reminderDayKeys([])).toEqual([]);
  });
});
