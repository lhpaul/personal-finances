/** Scenarios 1-3 of the implementation plan's Testing Strategy (AC2). `expo-localization` is
 * mocked so `resolveDeviceLocale()` is testable without a device. */
import { getLocales } from 'expo-localization';

import { DEFAULT_LOCALE, resolveDeviceLocale, SUPPORTED_LOCALES, toSupportedLocale } from '../locale';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

const mockedGetLocales = getLocales as jest.MockedFunction<typeof getLocales>;

describe('SUPPORTED_LOCALES / DEFAULT_LOCALE', () => {
  it('supports exactly es and en, defaulting to es', () => {
    expect(SUPPORTED_LOCALES).toEqual(['es', 'en']);
    expect(DEFAULT_LOCALE).toBe('es');
  });
});

describe('toSupportedLocale (scenario 1-2, AC2)', () => {
  it('maps a bare es code to es', () => {
    expect(toSupportedLocale('es')).toBe('es');
  });

  it('maps a bare en code to en', () => {
    expect(toSupportedLocale('en')).toBe('en');
  });

  it('strips a region tag joined with a hyphen', () => {
    expect(toSupportedLocale('en-US')).toBe('en');
    expect(toSupportedLocale('es-CL')).toBe('es');
  });

  it('strips a region tag joined with an underscore', () => {
    expect(toSupportedLocale('en_US')).toBe('en');
  });

  it('is case-insensitive', () => {
    expect(toSupportedLocale('EN')).toBe('en');
    expect(toSupportedLocale('Es-CL')).toBe('es');
  });

  it('falls back to es for an unknown language', () => {
    expect(toSupportedLocale('fr')).toBe('es');
    expect(toSupportedLocale('pt-BR')).toBe('es');
  });

  it('falls back to es for an empty string', () => {
    expect(toSupportedLocale('')).toBe('es');
  });

  it('falls back to es for null', () => {
    expect(toSupportedLocale(null)).toBe('es');
  });

  it('falls back to es for undefined', () => {
    expect(toSupportedLocale(undefined)).toBe('es');
  });
});

describe('resolveDeviceLocale (scenario 3, AC2)', () => {
  afterEach(() => {
    mockedGetLocales.mockReset();
  });

  it('returns the mapped locale when getLocales() reports one', () => {
    mockedGetLocales.mockReturnValue([
      { languageCode: 'en' } as ReturnType<typeof getLocales>[number],
    ]);
    expect(resolveDeviceLocale()).toBe('en');
  });

  it('returns es when the array is empty', () => {
    mockedGetLocales.mockReturnValue([]);
    expect(resolveDeviceLocale()).toBe('es');
  });

  it('returns es when languageCode is absent on the first entry', () => {
    mockedGetLocales.mockReturnValue([
      { languageCode: null } as ReturnType<typeof getLocales>[number],
    ]);
    expect(resolveDeviceLocale()).toBe('es');
  });
});
