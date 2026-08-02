import {
  findAccountNumberViolations,
  findAmountViolations,
  findNameViolations,
  findRutViolations,
  isSyntheticAccountNumber,
  isSyntheticAmount,
} from './fixture-scan';
import { PROHIBITED_NAME_TOKENS } from './prohibited-name-tokens';
import { SYNTHETIC_NAMES } from './synthetic-allowlist';

describe('findRutViolations', () => {
  it('flags a check-digit-valid RUT in dotted form', () => {
    // 12.345.678-5 is check-digit valid.
    expect(findRutViolations('<td>12.345.678-5</td>').length).toBe(1);
  });

  it('flags a check-digit-valid RUT in bare form', () => {
    expect(findRutViolations('<td>12345678-5</td>').length).toBe(1);
  });

  it('flags a check-digit-valid RUT with a K check digit', () => {
    // 1.000.005-K is check-digit valid.
    expect(findRutViolations('<td>1.000.005-K</td>').length).toBe(1);
  });

  it('does not flag a check-digit-INVALID RUT (what a scrubbed fixture should contain)', () => {
    expect(findRutViolations('<td>12.345.678-9</td>').length).toBe(0);
  });

  it('does not flag a date, an amount, or a phone number (negative lookalikes)', () => {
    expect(findRutViolations('01/03/2026')).toEqual([]);
    expect(findRutViolations('$1.234.567')).toEqual([]);
    expect(findRutViolations('+56 9 1234 5678')).toEqual([]);
  });

  it('reports two RUT-shaped tokens on one line as two violations, each with its own byte offset', () => {
    const violations = findRutViolations('12.345.678-5 and also 1.000.005-K');
    expect(violations).toHaveLength(2);
    expect(violations[0]?.byteOffset).not.toBe(violations[1]?.byteOffset);
  });
});

describe('findNameViolations', () => {
  it('flags a prohibited name token, matched whole-word and case-insensitively', () => {
    expect(findNameViolations('Titular: juan gonzalez', PROHIBITED_NAME_TOKENS).length).toBeGreaterThan(0);
  });

  it('flags a prohibited name token accent-insensitively', () => {
    expect(findNameViolations('Muñoz', PROHIBITED_NAME_TOKENS).length).toBeGreaterThan(0);
  });

  it('does not flag the synthetic allowlist names', () => {
    expect(findNameViolations(SYNTHETIC_NAMES.join(' '), PROHIBITED_NAME_TOKENS, SYNTHETIC_NAMES)).toEqual([]);
  });

  it('does not flag the bank\'s own product wording', () => {
    expect(findNameViolations('Cuenta Corriente', PROHIBITED_NAME_TOKENS)).toEqual([]);
    expect(findNameViolations('Tarjeta de Crédito', PROHIBITED_NAME_TOKENS)).toEqual([]);
  });

  it('does not flag a merchant description with no prohibited token', () => {
    expect(findNameViolations('Compra Supermercado Central', PROHIBITED_NAME_TOKENS)).toEqual([]);
  });

  it('reports each occurrence separately', () => {
    const violations = findNameViolations('Juan y otro Juan', PROHIBITED_NAME_TOKENS);
    expect(violations).toHaveLength(2);
  });
});

describe('isSyntheticAmount / findAmountViolations', () => {
  it.each([1111000, 222000, 33000, 0])('accepts %i as synthetic', (value) => {
    expect(isSyntheticAmount(value)).toBe(true);
  });

  it('accepts US$ 1.111,00 as synthetic', () => {
    expect(findAmountViolations('US$ 1.111,00')).toEqual([]);
  });

  it.each(['$1.111.000', '$222.000', '$33.000', '$0'])('does not flag the constructed fixture amount %s', (text) => {
    expect(findAmountViolations(text)).toEqual([]);
  });

  it('flags a non-synthetic amount', () => {
    expect(findAmountViolations('$1.234.567')).toHaveLength(1);
  });

  it('checks multiple amounts in one row independently', () => {
    const violations = findAmountViolations('<td>$1.111.000</td><td>$1.234.567</td>');
    expect(violations).toHaveLength(1);
  });
});

describe('isSyntheticAccountNumber / findAccountNumberViolations', () => {
  it('accepts an all-identical-digit account number', () => {
    expect(isSyntheticAccountNumber('11111111')).toBe(true);
  });

  it('accepts an allow-listed account number', () => {
    expect(isSyntheticAccountNumber('00000000123', ['00000000123'])).toBe(true);
  });

  it('rejects a non-synthetic-looking account number', () => {
    expect(isSyntheticAccountNumber('12345678')).toBe(false);
  });

  it('does not flag a date, a four-digit year, or a CSS pixel value', () => {
    expect(findAccountNumberViolations('01/03/2026')).toEqual([]);
    expect(findAccountNumberViolations('2026')).toEqual([]);
    expect(findAccountNumberViolations('width: 1200px;')).toEqual([]);
  });

  it('does not flag an allow-listed account number even embedded in markup', () => {
    expect(findAccountNumberViolations('<td>00000000123</td>', ['00000000123'])).toEqual([]);
  });

  it('flags multiple non-synthetic runs on one line, each reported', () => {
    const violations = findAccountNumberViolations('12345678 and 87654321');
    expect(violations).toHaveLength(2);
  });
});
