import { toDateLocal, type DateLocal } from '@finanzas/shared-utils';

/**
 * Banco de Chile's `DD/MM/YYYY` date parsing (spec Business Rule 11, spec Decision 3, AC8;
 * implementation plan Decision 11). Runs on the React Native side, never in the page: the page
 * only splits the raw string on `/`, zero-pads and reorders it into `YYYY-MM-DD` — no `new Date`,
 * no `toISOString`, in either half. This is the calendar-validity gate: `toDateLocal` (from
 * `@finanzas/shared-utils`) is what actually throws `RangeError` for a non-calendar day
 * (`31/02/2026`), never the reverse.
 */

export type DateParseErrorCode = 'malformed' | 'two_digit_year' | 'unexpected_trailing_content';

export class DateParseError extends Error {
  readonly code: DateParseErrorCode;

  constructor(code: DateParseErrorCode, message: string) {
    super(message);
    this.name = 'DateParseError';
    this.code = code;
  }
}

const DATE_PATTERN = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/u;
const TRAILING_CONTENT_PATTERN = /^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}\s+\S/u;
const TWO_DIGIT_YEAR_PATTERN = /^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2}$/u;

/**
 * Parses `text` as the bank's `DD/MM/YYYY` presentation into a `DateLocal` (`YYYY-MM-DD`).
 * Throws `DateParseError` on anything not shaped like `DD/MM/YYYY` with a full 4-digit year, and
 * (via `toDateLocal`) `RangeError` on a shape that parses but is not a real calendar day.
 * Surrounding whitespace is tolerated; nothing else is.
 */
export function parseBankDateLocal(text: string): DateLocal {
  const trimmed = text.trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) {
    if (TRAILING_CONTENT_PATTERN.test(trimmed)) {
      throw new DateParseError(
        'unexpected_trailing_content',
        'parseBankDateLocal: expected only DD/MM/YYYY, found trailing content after the date',
      );
    }
    if (TWO_DIGIT_YEAR_PATTERN.test(trimmed)) {
      throw new DateParseError(
        'two_digit_year',
        'parseBankDateLocal: a two-digit year is not accepted — the bank always states four',
      );
    }
    throw new DateParseError('malformed', 'parseBankDateLocal: expected DD/MM/YYYY');
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  // toDateLocal is the calendar-validity gate: throws RangeError for a non-calendar day.
  return toDateLocal({ year, month, day });
}
