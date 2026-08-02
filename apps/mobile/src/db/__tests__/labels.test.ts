import { resolveLabel, toSupportedLocale } from '../labels';

/** Scenario 11 (AC11), per the Testing Strategy's test-file table. */
describe('toSupportedLocale', () => {
  it.each([
    ['es', 'es'],
    ['en', 'en'],
    ['es-CL', 'es'],
    ['EN', 'en'],
    ['fr', 'es'],
    ['', 'es'],
    [null, 'es'],
    [undefined, 'es'],
  ] as const)('maps %p to %p', (input, expected) => {
    expect(toSupportedLocale(input)).toBe(expected);
  });

  it('is case-insensitive and takes the part before any dash for a region-tagged code', () => {
    expect(toSupportedLocale('EN-US')).toBe('en');
    expect(toSupportedLocale('es-419')).toBe('es');
  });
});

describe('resolveLabel', () => {
  it('returns the English name for "en"', () => {
    expect(resolveLabel({ es: 'Comida', en: 'Food' }, 'en')).toBe('Food');
  });

  it('returns the Spanish name for "es"', () => {
    expect(resolveLabel({ es: 'Comida', en: 'Food' }, 'es')).toBe('Comida');
  });

  it('falls back to es when the en key is absent from a row', () => {
    expect(resolveLabel({ es: 'Comida' }, 'en')).toBe('Comida');
  });

  it('returns an empty string when neither key is present', () => {
    expect(resolveLabel({}, 'es')).toBe('');
  });
});
