import { DateParseError, parseBankDateLocal } from './date';

// Parser-risk addendum table (implementation plan), D1-D11.
describe('parseBankDateLocal — accepted vectors', () => {
  it('D1: 01/03/2026 -> 2026-03-01', () => {
    expect(parseBankDateLocal('01/03/2026')).toBe('2026-03-01');
  });

  it('D2: 1/3/2026 -> 2026-03-01 (single-digit day/month zero-padded)', () => {
    expect(parseBankDateLocal('1/3/2026')).toBe('2026-03-01');
  });

  it('D3: 31/12/2025 -> 2025-12-31', () => {
    expect(parseBankDateLocal('31/12/2025')).toBe('2025-12-31');
  });

  it('D4: 29/02/2024 -> 2024-02-29 (leap year)', () => {
    expect(parseBankDateLocal('29/02/2024')).toBe('2024-02-29');
  });

  it('D8: 03/01/2026 -> 2026-01-03 (proves DD/MM, not MM/DD)', () => {
    expect(parseBankDateLocal('03/01/2026')).toBe('2026-01-03');
  });

  it('D10: " 01/03/2026 " -> 2026-03-01 (surrounding whitespace tolerated)', () => {
    expect(parseBankDateLocal(' 01/03/2026 ')).toBe('2026-03-01');
  });
});

describe('parseBankDateLocal — throwing vectors', () => {
  it('D5: 29/02/2025 throws — not a calendar day (toDateLocal RangeError)', () => {
    expect(() => parseBankDateLocal('29/02/2025')).toThrow(RangeError);
  });

  it('D6: 31/04/2026 throws — April has 30 days', () => {
    expect(() => parseBankDateLocal('31/04/2026')).toThrow(RangeError);
  });

  it('D7: 2026-03-01 throws — already ISO, not the bank\'s format (negative lookalike)', () => {
    expect(() => parseBankDateLocal('2026-03-01')).toThrow(DateParseError);
  });

  it('D9: 01/03/26 throws — a two-digit year is not accepted rather than guessed', () => {
    let thrown: unknown;
    try {
      parseBankDateLocal('01/03/26');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DateParseError);
    expect((thrown as DateParseError).code).toBe('two_digit_year');
  });

  it('D11: "01/03/2026 14:32" throws unexpected_trailing_content', () => {
    let thrown: unknown;
    try {
      parseBankDateLocal('01/03/2026 14:32');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DateParseError);
    expect((thrown as DateParseError).code).toBe('unexpected_trailing_content');
  });
});

describe('parseBankDateLocal — never touches Date or the device timezone', () => {
  it('produces the same calendar day regardless of which timezone tests run under', () => {
    // See also Implementation Order Step 12 / Step 4: the whole package test run is additionally
    // executed under TZ=Pacific/Kiritimati (UTC+14) and TZ=Pacific/Niue (UTC-11) — this
    // in-process assertion is the fast, always-on half of AC8.
    expect(parseBankDateLocal('01/03/2026')).toBe('2026-03-01');
  });
});
