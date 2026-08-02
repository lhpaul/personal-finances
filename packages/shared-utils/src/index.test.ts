import {
  PACKAGE_NAME,
  formatClp,
  formatClpAbbreviated,
  deriveDateLocal,
  getMonthPeriod,
  formatLongDate,
  isValidRut,
  formatRut,
} from './index';

describe('@finanzas/shared-utils', () => {
  it('exposes its own package name', () => {
    expect(PACKAGE_NAME).toBe('@finanzas/shared-utils');
  });

  it('re-exports the public surface of money.ts, dates.ts and rut.ts through the barrel, with no name collisions', () => {
    expect(typeof formatClp).toBe('function');
    expect(typeof formatClpAbbreviated).toBe('function');
    expect(typeof deriveDateLocal).toBe('function');
    expect(typeof getMonthPeriod).toBe('function');
    expect(typeof formatLongDate).toBe('function');
    expect(typeof isValidRut).toBe('function');
    expect(typeof formatRut).toBe('function');
  });
});
