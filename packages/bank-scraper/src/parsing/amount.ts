/**
 * Chilean-convention amount parsing (spec Business Rules 9 and 12, AC7, AC9, AC10;
 * implementation plan Decision 10). Runs on the React Native side, never in the page (Decision
 * 1) — a plain function is provable in a millisecond, with no `Date`, no `parseFloat`, and no
 * float anywhere in the result.
 *
 * `.` groups thousands; `,` introduces decimals. A supported bank's foreign-currency card
 * statement (US dollars) is presented in that same Chilean style (`US$ 1.234,56`), not the
 * English decimal-point convention. Arithmetic is done on digit **strings**, never on a `float`.
 */

export type AmountParseErrorCode =
  | 'unknown_currency'
  | 'empty_amount'
  | 'no_digits'
  | 'multiple_amounts'
  | 'malformed_grouping'
  | 'fraction_exceeds_currency_exponent'
  | 'not_safe_integer';

export class AmountParseError extends Error {
  readonly code: AmountParseErrorCode;

  constructor(code: AmountParseErrorCode, message: string) {
    super(message);
    this.name = 'AmountParseError';
    this.code = code;
  }
}

/** The minor-unit exponent for every currency this package parses. An unknown code is a defect. */
export const CURRENCY_MINOR_UNIT_EXPONENTS: Readonly<Record<string, number>> = {
  CLP: 0,
  USD: 2,
};

const CURRENCY_WORD_PATTERN = /us\$|usd|clp/giu;
const DOLLAR_SIGN_PATTERN = /\$/gu;
const SIGN_PATTERN = /[+\-−]/gu;
const WHITESPACE_PATTERN = /\s+/u;
const NUMERIC_CHAR_PATTERN = /[0-9]/u;
const CLEANED_SHAPE_PATTERN = /^[0-9.,]+$/u;
const DIGITS_ONLY_PATTERN = /^[0-9]+$/u;
const LEADING_GROUP_PATTERN = /^[0-9]{1,3}$/u;
const THOUSANDS_GROUP_PATTERN = /^[0-9]{3}$/u;
const NONZERO_DIGIT_PATTERN = /[^0]/u;

/**
 * Parses one Chilean-formatted amount into a positive integer number of `currencyCode`'s minor
 * units. Never returns or computes through a `float`: every step operates on digit strings.
 * Throws `AmountParseError` — never returns `NaN` or a negative/fractional value — on anything
 * that is not a single, exact amount in the requested currency.
 */
export function parseMinorUnits(text: string, currencyCode: string): number {
  // Object.hasOwn guards against an inherited Object.prototype key (e.g. currencyCode ===
  // 'constructor'): a plain bracket lookup would resolve through the prototype chain to an
  // inherited function, skip the unknown_currency check below, and let `exponent` (now a
  // function) coerce every later arithmetic use of it to 0 or NaN instead of throwing
  // (CodeRabbit finding #52).
  const exponent = Object.hasOwn(CURRENCY_MINOR_UNIT_EXPONENTS, currencyCode)
    ? CURRENCY_MINOR_UNIT_EXPONENTS[currencyCode]
    : undefined;
  if (exponent === undefined) {
    throw new AmountParseError('unknown_currency', `parseMinorUnits: unknown currency code "${currencyCode}"`);
  }

  if (text.trim().length === 0) {
    throw new AmountParseError('empty_amount', 'parseMinorUnits: input is empty or whitespace-only');
  }

  // Strip currency words/symbols and sign characters, but keep whitespace for now — needed below
  // to detect two separate amount tokens sharing one cell (AC "multiple amounts").
  const withoutCurrencyAndSign = text
    .replace(CURRENCY_WORD_PATTERN, '')
    .replace(DOLLAR_SIGN_PATTERN, '')
    .replace(SIGN_PATTERN, '');

  const tokens = withoutCurrencyAndSign
    .split(WHITESPACE_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const numericTokens = tokens.filter((token) => NUMERIC_CHAR_PATTERN.test(token));

  if (numericTokens.length > 1) {
    throw new AmountParseError('multiple_amounts', 'parseMinorUnits: more than one amount in a single cell');
  }
  if (numericTokens.length === 0) {
    throw new AmountParseError('no_digits', 'parseMinorUnits: no digits found in the input');
  }

  const cleaned = numericTokens[0] as string;
  if (!CLEANED_SHAPE_PATTERN.test(cleaned)) {
    throw new AmountParseError('no_digits', 'parseMinorUnits: unexpected characters remain after stripping');
  }

  const lastCommaIndex = cleaned.lastIndexOf(',');
  let integerPart: string;
  let fractionPart: string;
  if (lastCommaIndex === -1) {
    integerPart = cleaned;
    fractionPart = '';
  } else {
    integerPart = cleaned.slice(0, lastCommaIndex);
    fractionPart = cleaned.slice(lastCommaIndex + 1);
    if (integerPart.includes(',') || !DIGITS_ONLY_PATTERN.test(fractionPart)) {
      throw new AmountParseError(
        'malformed_grouping',
        'parseMinorUnits: only the last comma may introduce a decimal fraction',
      );
    }
  }

  const dotGroups = integerPart.split('.');
  if (dotGroups.some((group) => group.length === 0)) {
    throw new AmountParseError('malformed_grouping', 'parseMinorUnits: empty group around a thousands separator');
  }
  if (dotGroups.length > 1) {
    const [firstGroup, ...restGroups] = dotGroups as [string, ...string[]];
    const groupsAreValid =
      LEADING_GROUP_PATTERN.test(firstGroup) && restGroups.every((group) => THOUSANDS_GROUP_PATTERN.test(group));
    if (!groupsAreValid) {
      throw new AmountParseError(
        'malformed_grouping',
        'parseMinorUnits: thousands-separator groups must be exactly 3 digits',
      );
    }
  } else if (!DIGITS_ONLY_PATTERN.test(dotGroups[0] as string)) {
    throw new AmountParseError('malformed_grouping', 'parseMinorUnits: integer part must be digits only');
  }
  const integerDigits = dotGroups.join('');

  let exactFractionPart = fractionPart;
  if (fractionPart.length > exponent) {
    const excess = fractionPart.slice(exponent);
    if (NONZERO_DIGIT_PATTERN.test(excess)) {
      // Business Rule 12: an amount that would need rounding to reach a whole minor unit is a
      // defect. A trailing all-zero excess (e.g. CLP "1.234,00") is exact and is accepted.
      throw new AmountParseError(
        'fraction_exceeds_currency_exponent',
        `parseMinorUnits: fraction has more precision than ${currencyCode} supports`,
      );
    }
    exactFractionPart = fractionPart.slice(0, exponent);
  }
  const fractionDigits = exactFractionPart.padEnd(exponent, '0');

  const minorUnits = Number(integerDigits + fractionDigits);
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AmountParseError('not_safe_integer', 'parseMinorUnits: result exceeds Number.isSafeInteger');
  }
  return minorUnits;
}
