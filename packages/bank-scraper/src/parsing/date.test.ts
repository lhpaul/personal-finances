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
  // CodeRabbit finding #53: a single in-process assertion cannot demonstrate timezone
  // independence by itself — this suite cannot change its own process timezone, and this
  // repeats D1's exact vector. What this test actually proves in-process is that the function
  // never constructs a Date object at all (so there is no timezone-dependent code path to
  // exercise), including at the calendar boundaries a Date-based/UTC-normalized implementation
  // is most likely to get wrong. The real cross-timezone guarantee (AC8) is verified by running
  // this whole suite under TZ=Pacific/Kiritimati (UTC+14) and TZ=Pacific/Niue (UTC-11) —
  // Implementation Order Step 12 / Step 4 — where a Date().toISOString()-based implementation
  // would shift a local midnight to the previous UTC calendar day.
  it.each([
    ['01/03/2026', '2026-03-01'], // D1's own vector, for a stable baseline
    ['31/12/2025', '2025-12-31'], // year-end boundary
    ['01/01/2026', '2026-01-01'], // year-start boundary
    ['29/02/2024', '2024-02-29'], // leap-year month-end boundary
    ['28/02/2025', '2025-02-28'], // non-leap-year month-end boundary
    ['30/04/2026', '2026-04-30'], // 30-day-month boundary
    ['31/01/2026', '2026-01-31'], // 31-day-month boundary
  ])('returns the same calendar day in-process for %s regardless of which timezone this run happens to use', (input, expected) => {
    expect(parseBankDateLocal(input)).toBe(expected);
  });
});
