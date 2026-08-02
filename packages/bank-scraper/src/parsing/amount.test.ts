import { AmountParseError, parseMinorUnits, type AmountParseErrorCode } from './amount';

const MINUS_SIGN = '−';
const NBSP = ' ';
const THIN_SPACE = ' ';

interface AcceptedCase {
  id: string;
  text: string;
  currency: string;
  expected: number;
}

interface ThrowingCase {
  id: string;
  text: string;
  currency: string;
  code: AmountParseErrorCode;
}

// Parser-risk addendum table (implementation plan), A1-A18. A8 is corrected from the plan's
// table: the plan's illustrative Decision 10 formula
// (`Number(integerDigits) * 10 ** exponent + Number(fractionDigits.padEnd(exponent, '0'))`)
// computes 123450 for "US$ 1.234,5" (0.5 dollars padded to two cents is 50 cents — the same
// rule that gives A6/A7 their values), not the `12345` the table cell states; the corrected
// value is used here and recorded in the PR description.
const acceptedCases: readonly AcceptedCase[] = [
  { id: 'A1', text: '$1.234.567', currency: 'CLP', expected: 1234567 },
  { id: 'A2', text: '$0', currency: 'CLP', expected: 0 },
  { id: 'A3', text: '1.234', currency: 'CLP', expected: 1234 },
  { id: 'A4', text: '$1.234,00', currency: 'CLP', expected: 1234 },
  { id: 'A6', text: 'US$ 1.234,56', currency: 'USD', expected: 123456 },
  { id: 'A7', text: 'USD 0,07', currency: 'USD', expected: 7 },
  { id: 'A8 (corrected)', text: 'US$ 1.234,5', currency: 'USD', expected: 123450 },
  { id: 'A10', text: `$${NBSP}12.000${THIN_SPACE}`, currency: 'CLP', expected: 12000 },
  { id: 'A11a', text: '-$1.234', currency: 'CLP', expected: 1234 },
  { id: 'A11b', text: `${MINUS_SIGN}$1.234`, currency: 'CLP', expected: 1234 },
];

const throwingCases: readonly ThrowingCase[] = [
  { id: 'A5', text: '$1.234,50', currency: 'CLP', code: 'fraction_exceeds_currency_exponent' },
  { id: 'A9', text: 'US$ 1.234,567', currency: 'USD', code: 'fraction_exceeds_currency_exponent' },
  { id: 'A12a', text: '', currency: 'CLP', code: 'empty_amount' },
  { id: 'A12b', text: '   ', currency: 'CLP', code: 'empty_amount' },
  { id: 'A13', text: 'Saldo no disponible', currency: 'CLP', code: 'no_digits' },
  { id: 'A14', text: '$1.2.3', currency: 'CLP', code: 'malformed_grouping' },
  { id: 'A16', text: '$9.007.199.254.740.993', currency: 'CLP', code: 'not_safe_integer' },
  { id: 'A17', text: '$1.234 $5.678', currency: 'CLP', code: 'multiple_amounts' },
  { id: 'A18', text: '€1.234', currency: 'EUR', code: 'unknown_currency' },
];

describe('parseMinorUnits — accepted vectors', () => {
  it.each(acceptedCases)('$id: $text ($currency) -> $expected', ({ text, currency, expected }) => {
    expect(parseMinorUnits(text, currency)).toBe(expected);
  });

  it('never returns a value with a decimal part (result is always an integer)', () => {
    for (const { text, currency } of acceptedCases) {
      expect(Number.isInteger(parseMinorUnits(text, currency))).toBe(true);
    }
  });
});

describe('parseMinorUnits — throwing vectors', () => {
  it.each(throwingCases)('$id: $text ($currency) throws $code', ({ text, currency, code }) => {
    let thrown: unknown;
    try {
      parseMinorUnits(text, currency);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AmountParseError);
    expect((thrown as AmountParseError).code).toBe(code);
  });
});

describe('parseMinorUnits — A15: English convention is rejected', () => {
  it('throws on "$1,234.56" rather than silently misreading it as Chilean', () => {
    expect(() => parseMinorUnits('$1,234.56', 'CLP')).toThrow(AmountParseError);
  });
});

describe('parseMinorUnits — does not over-fire', () => {
  it('accepts every real vector the four reading-routine fixtures will need', () => {
    expect(parseMinorUnits('$500.000', 'CLP')).toBe(500000);
    expect(parseMinorUnits('$1.234', 'CLP')).toBe(1234);
    expect(parseMinorUnits('US$ 100,00', 'USD')).toBe(10000);
  });
});
