import { canConnect, formatRutForDisplay } from '../credential-form';

/** Implementation plan Testing Strategy scenario 6 (AC13, AC14). */

describe('formatRutForDisplay (Assumption A1)', () => {
  it('formats a dotless RUT canonically', () => {
    expect(formatRutForDisplay('123456785')).toBe('12.345.678-5');
  });

  it("formats the mockup's own placeholder, whose check digit is arithmetically wrong, without throwing", () => {
    expect(formatRutForDisplay('123456789')).toBe('12.345.678-9');
  });

  it('returns the raw input unchanged when it is structurally malformed', () => {
    expect(formatRutForDisplay('abc')).toBe('abc');
    expect(formatRutForDisplay('')).toBe('');
  });
});

describe('canConnect (Business Rule 11, AC13-AC14)', () => {
  it('is false for an empty form', () => {
    expect(canConnect({ rut: '', password: '' })).toBe(false);
  });

  it('is false when the RUT check digit is wrong, even with a password', () => {
    expect(canConnect({ rut: '12.345.678-9', password: 'clave' })).toBe(false);
  });

  it('is false when the password is empty, even with a valid RUT', () => {
    expect(canConnect({ rut: '12.345.678-5', password: '' })).toBe(false);
  });

  it('is true for a valid RUT and a non-empty password', () => {
    expect(canConnect({ rut: '12.345.678-5', password: 'clave' })).toBe(true);
  });

  it('accepts a dotless, dashless RUT once its check digit is correct', () => {
    expect(canConnect({ rut: '123456785', password: 'clave' })).toBe(true);
  });

  it('has no password length ceiling (Assumption A5)', () => {
    expect(canConnect({ rut: '12.345.678-5', password: 'x'.repeat(64) })).toBe(true);
  });
});
