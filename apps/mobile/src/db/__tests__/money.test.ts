import { assertMinorUnits, assertPositiveMinorUnits, canonicalizeCurrencyCode } from '../money';

/**
 * Money guards (implementation plan Decision 4; issue #10's `canonicalizeCurrencyCode` addition).
 */

describe('assertMinorUnits', () => {
  it('returns whole numbers unchanged, positive or negative', () => {
    expect(assertMinorUnits(1000, 'field')).toBe(1000);
    expect(assertMinorUnits(-500, 'field')).toBe(-500);
    expect(assertMinorUnits(0, 'field')).toBe(0);
  });

  it('throws on a fractional value', () => {
    expect(() => assertMinorUnits(1000.5, 'field')).toThrow();
  });
});

describe('assertPositiveMinorUnits', () => {
  it('returns a whole positive number unchanged', () => {
    expect(assertPositiveMinorUnits(4200, 'field')).toBe(4200);
  });

  it('throws on zero, a negative value, or a fraction', () => {
    expect(() => assertPositiveMinorUnits(0, 'field')).toThrow();
    expect(() => assertPositiveMinorUnits(-1, 'field')).toThrow();
    expect(() => assertPositiveMinorUnits(1.5, 'field')).toThrow();
  });
});

describe('canonicalizeCurrencyCode (issue #10 — CodeRabbit finding on PR #78)', () => {
  it('uppercases and trims a differently-cased or padded code', () => {
    expect(canonicalizeCurrencyCode('clp')).toBe('CLP');
    expect(canonicalizeCurrencyCode(' Clp ')).toBe('CLP');
    expect(canonicalizeCurrencyCode('usd')).toBe('USD');
    expect(canonicalizeCurrencyCode(' USD ')).toBe('USD');
  });

  it('leaves an already-canonical code unchanged (idempotent)', () => {
    expect(canonicalizeCurrencyCode('CLP')).toBe('CLP');
    expect(canonicalizeCurrencyCode(canonicalizeCurrencyCode('clp'))).toBe(canonicalizeCurrencyCode('clp'));
  });

  it('defaults to CLP when absent, null, or empty after trimming', () => {
    expect(canonicalizeCurrencyCode(undefined)).toBe('CLP');
    expect(canonicalizeCurrencyCode(null)).toBe('CLP');
    expect(canonicalizeCurrencyCode('')).toBe('CLP');
    expect(canonicalizeCurrencyCode('   ')).toBe('CLP');
  });

  it('planted-negative: a bare equality check without canonicalization would treat "clp" as foreign — proves the guard is load-bearing', () => {
    const rawCode: string = ' clp ';
    expect(rawCode !== 'CLP').toBe(true); // the bug this function exists to prevent
    expect(canonicalizeCurrencyCode(rawCode) !== 'CLP').toBe(false); // the guard corrects it
  });
});
