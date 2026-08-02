import {
  addDays,
  deriveDateLocal,
  deriveZonedParts,
  formatLongDate,
  formatMonthAbbreviation,
  formatMonthYear,
  formatShortDate,
  formatTimeOfDay,
  getMonthPeriod,
  getWeekPeriod,
  isValidDateLocal,
  parseDateLocal,
  shiftMonthPeriod,
  shiftWeekPeriod,
  toDateLocal,
} from './dates';

// No @types/node in this dependency-free package (Decision — see package.json note in the
// implementation plan): declare the minimal ambient shape this file needs instead of adding one.
declare const process: { env: Record<string, string | undefined> };

// Group E (host-timezone independence): the whole file runs under a host timezone as far from
// Chile as possible. Every function in dates.ts is UTC civil-date math or an explicit-timeZone
// Intl call, so nothing here should be sensitive to this — that is exactly what this file proves.
process.env.TZ = 'Pacific/Kiritimati';

describe('dates', () => {
  describe('Group A — getMonthPeriod across every month-end shape', () => {
    const cases: Array<[string, string, string, string]> = [
      ['2025-01-24', '2025-01-01', '2025-01-31', '31 days'],
      ['2025-04-15', '2025-04-01', '2025-04-30', '30 days'],
      ['2025-02-10', '2025-02-01', '2025-02-28', 'common year'],
      ['2024-02-10', '2024-02-01', '2024-02-29', 'leap year'],
      ['2000-02-05', '2000-02-01', '2000-02-29', 'century leap year'],
      ['1900-02-05', '1900-02-01', '1900-02-28', 'century non-leap year'],
      ['2025-12-31', '2025-12-01', '2025-12-31', 'year end'],
      ['2025-01-01', '2025-01-01', '2025-01-31', 'the start boundary itself'],
      ['2025-01-31', '2025-01-01', '2025-01-31', 'the end boundary itself'],
    ];

    it.each(cases)('getMonthPeriod(%p) -> { %p, %p } (%s)', (input, start, end) => {
      expect(getMonthPeriod(input)).toEqual({ start, end });
    });
  });

  describe('Group B — getWeekPeriod, Monday-start', () => {
    const cases: Array<[string, string, string, string]> = [
      ['2025-01-24', '2025-01-20', '2025-01-26', 'Fri'],
      ['2025-01-20', '2025-01-20', '2025-01-26', 'Mon, the start'],
      ['2025-01-26', '2025-01-20', '2025-01-26', 'Sun, the end'],
      ['2025-01-27', '2025-01-27', '2025-02-02', 'next Mon — crosses a month end'],
      ['2024-12-30', '2024-12-30', '2025-01-05', 'Mon — crosses a year end'],
      ['2025-03-03', '2025-03-03', '2025-03-09', 'Mon'],
    ];

    it.each(cases)('getWeekPeriod(%p) -> { %p, %p } (%s)', (input, start, end) => {
      expect(getWeekPeriod(input)).toEqual({ start, end });
    });

    describe('Group B addendum — the 0100/9999 arithmetic boundary (Decision 3)', () => {
      it('addDays("0100-01-01", -1) throws RangeError — naive result is 0099-12-31', () => {
        expect(() => addDays('0100-01-01', -1)).toThrow(RangeError);
      });

      it('getWeekPeriod("0100-01-01") throws RangeError — its Monday-start would be 0099-12-28', () => {
        expect(() => getWeekPeriod('0100-01-01')).toThrow(RangeError);
      });

      it('addDays("9999-12-31", 1) throws RangeError — naive result is the five-digit year 10000', () => {
        expect(() => addDays('9999-12-31', 1)).toThrow(RangeError);
      });

      it('getWeekPeriod("9999-12-31") throws RangeError — its Sunday-end would be 10000-01-02', () => {
        expect(() => getWeekPeriod('9999-12-31')).toThrow(RangeError);
      });

      it('control case: getWeekPeriod("0100-01-05") is safely in range on both ends', () => {
        // Deviation from the implementation plan's illustrative expected value
        // ({ '0100-01-01', '0100-01-07' }): per the proleptic-Gregorian weekday
        // Date.UTC(...).getUTCDay() actually computes (verified directly:
        // `new Date(Date.UTC(100, 0, 5)).getUTCDay()` -> 2, Tuesday), 0100-01-05 is a Tuesday,
        // not a Friday, so its Monday-start week is 0100-01-04..0100-01-10. The plan's Group B
        // addendum text did not carry this specific value through its Verification Log (unlike
        // the DST instants, which were), so this is treated as a plan arithmetic slip in one
        // illustrative vector, not a design ambiguity: the algorithm itself (Monday-start via
        // UTC civil-date weekday) is unambiguous and is exactly what every other vector in this
        // file — including the in-range control case at the opposite (9999) edge, immediately
        // below — already exercises.
        expect(getWeekPeriod('0100-01-05')).toEqual({ start: '0100-01-04', end: '0100-01-10' });
      });
    });
  });

  describe('Group C — shiftMonthPeriod / shiftWeekPeriod', () => {
    it('shiftMonthPeriod back across a year end', () => {
      expect(shiftMonthPeriod({ start: '2025-01-01', end: '2025-01-31' }, -1)).toEqual({
        start: '2024-12-01',
        end: '2024-12-31',
      });
    });

    it('shiftMonthPeriod forward from a 31-day month to a 28-day month — no clamping bug', () => {
      expect(shiftMonthPeriod({ start: '2025-01-01', end: '2025-01-31' }, 1)).toEqual({
        start: '2025-02-01',
        end: '2025-02-28',
      });
    });

    it('shiftMonthPeriod forward into a leap-year February', () => {
      expect(shiftMonthPeriod({ start: '2024-01-01', end: '2024-01-31' }, 1)).toEqual({
        start: '2024-02-01',
        end: '2024-02-29',
      });
    });

    it('shiftMonthPeriod(p, 0) returns the same period', () => {
      const p = { start: '2025-01-01', end: '2025-01-31' };
      expect(shiftMonthPeriod(p, 0)).toEqual(p);
    });

    it('shiftMonthPeriod(p, -13) crosses more than a year', () => {
      expect(shiftMonthPeriod({ start: '2025-01-01', end: '2025-01-31' }, -13)).toEqual({
        start: '2023-12-01',
        end: '2023-12-31',
      });
    });

    it('shiftMonthPeriod throws RangeError when period.start is not the first of a month', () => {
      expect(() =>
        shiftMonthPeriod({ start: '2025-01-15', end: '2025-01-31' }, 1),
      ).toThrow(RangeError);
    });

    it('shiftWeekPeriod six weeks back (the "Últimas 6 semanas" chart window)', () => {
      expect(shiftWeekPeriod({ start: '2025-01-20', end: '2025-01-26' }, -6)).toEqual({
        start: '2024-12-09',
        end: '2024-12-15',
      });
    });

    describe('Group C addendum — the 0100/9999 arithmetic boundary for the shift functions', () => {
      it('shiftMonthPeriod at the lower edge throws RangeError', () => {
        expect(() =>
          shiftMonthPeriod({ start: '0100-01-01', end: '0100-01-31' }, -1),
        ).toThrow(RangeError);
      });

      it('shiftWeekPeriod at the lower edge throws RangeError', () => {
        expect(() =>
          shiftWeekPeriod({ start: '0100-01-04', end: '0100-01-10' }, -1),
        ).toThrow(RangeError);
      });

      it('shiftMonthPeriod at the upper edge throws RangeError', () => {
        expect(() =>
          shiftMonthPeriod({ start: '9999-12-01', end: '9999-12-31' }, 1),
        ).toThrow(RangeError);
      });

      it('shiftWeekPeriod at the upper edge throws RangeError', () => {
        expect(() =>
          shiftWeekPeriod({ start: '9999-12-20', end: '9999-12-26' }, 1),
        ).toThrow(RangeError);
      });

      it('control case: both edge weeks are themselves valid in-range Monday-start weeks', () => {
        expect(getWeekPeriod('0100-01-04')).toEqual({ start: '0100-01-04', end: '0100-01-10' });
        expect(getWeekPeriod('9999-12-20')).toEqual({ start: '9999-12-20', end: '9999-12-26' });
      });
    });
  });

  describe('Group D — deriveDateLocal across the 2025 Chile DST transitions', () => {
    const cases: Array<[string, string, string, string]> = [
      ['2025-04-06T02:00:00Z', '2025-04-05', '23:00', 'last hour before DST ends'],
      ['2025-04-06T03:00:00Z', '2025-04-05', '23:00', 'the repeated wall-clock hour'],
      ['2025-04-06T04:00:00Z', '2025-04-06', '00:00', 'first instant after DST ends'],
      ['2025-09-07T03:00:00Z', '2025-09-06', '23:00', 'last instant before DST starts'],
      ['2025-09-07T04:00:00Z', '2025-09-07', '01:00', 'the skipped hour'],
      ['2025-09-07T05:00:00Z', '2025-09-07', '02:00', 'settled into offset -03'],
      ['2025-01-01T02:00:00Z', '2024-12-31', '23:00', 'year-boundary trap'],
      ['2025-01-01T03:00:00Z', '2025-01-01', '00:00', 'the real start of the Chilean year'],
      ['2025-12-31T02:59:00Z', '2025-12-30', '23:59', 'month/year-end minute'],
      ['2025-04-01T02:00:00Z', '2025-03-31', '23:00', 'month-end trap'],
    ];

    it.each(cases)(
      'deriveDateLocal(%p) -> %p, formatTimeOfDay -> %p (%s)',
      (instantIso, expectedDateLocal, expectedTime) => {
        const instant = new Date(instantIso);
        expect(deriveDateLocal(instant)).toBe(expectedDateLocal);
        expect(formatTimeOfDay(instant)).toBe(expectedTime);
      },
    );

    it('composes with getMonthPeriod: the month-end trap row falls in March, not April', () => {
      const dateLocal = deriveDateLocal(new Date('2025-04-01T02:00:00Z'));
      expect(dateLocal).toBe('2025-03-31');
      expect(getMonthPeriod(dateLocal)).toEqual({ start: '2025-03-01', end: '2025-03-31' });
    });

    it('composes with getMonthPeriod: the year-boundary trap row falls in December 2024', () => {
      const dateLocal = deriveDateLocal(new Date('2025-01-01T02:00:00Z'));
      expect(dateLocal).toBe('2024-12-31');
      expect(getMonthPeriod(dateLocal)).toEqual({ start: '2024-12-01', end: '2024-12-31' });
    });

    it('composes with getMonthPeriod: the repeated-hour DST row stays in April', () => {
      const dateLocal = deriveDateLocal(new Date('2025-04-06T03:00:00Z'));
      expect(getMonthPeriod(dateLocal)).toEqual({ start: '2025-04-01', end: '2025-04-30' });
    });
  });

  describe('Group E — determinism under a hostile host timezone', () => {
    it('deriveDateLocal is deterministic across repeated calls with the same instant', () => {
      const instant = new Date('2025-04-06T03:00:00Z');
      expect(deriveDateLocal(instant)).toBe(deriveDateLocal(instant));
      expect(deriveDateLocal(instant)).toBe('2025-04-05');
    });

    it('formatTimeOfDay is deterministic across repeated calls with the same instant', () => {
      const instant = new Date('2025-09-07T04:00:00Z');
      expect(formatTimeOfDay(instant)).toBe(formatTimeOfDay(instant));
      expect(formatTimeOfDay(instant)).toBe('01:00');
    });

    it('every exported function requires an explicit instant/dateLocal argument (compile-time guarantee)', () => {
      // deriveZonedParts, deriveDateLocal and formatTimeOfDay's `instant: Date` parameter has no
      // default; the four label formatters' `dateLocal` and `locale` parameters have no default
      // either. Omitting any of these is a TypeScript compile error, not a runtime concern — this
      // test exists to document that the "pass the clock in" guarantee (brief rule 4) is enforced
      // by the type system, verified by `pnpm --filter @finanzas/shared-utils typecheck`.
      expect(typeof deriveDateLocal).toBe('function');
      expect(deriveDateLocal.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Group F — deriveZonedParts contract', () => {
    const RealDateTimeFormat = Intl.DateTimeFormat;

    afterEach(() => {
      Intl.DateTimeFormat = RealDateTimeFormat;
    });

    function installMockDateTimeFormat(
      buildFullFormatter: () => Pick<Intl.DateTimeFormat, 'resolvedOptions' | 'formatToParts'>,
    ): void {
      function MockDateTimeFormat(
        this: unknown,
        locale?: string | string[],
        options?: Intl.DateTimeFormatOptions,
      ): Intl.DateTimeFormat {
        if (options && 'hourCycle' in options) {
          return buildFullFormatter() as Intl.DateTimeFormat;
        }
        // The bare canonicalization probe (no hourCycle) is left honest — it exercises only the
        // timezone *name* table, not the offset/DST *rule* data a reduced-ICU build might lack.
        return new RealDateTimeFormat(locale, options);
      }
      Intl.DateTimeFormat = MockDateTimeFormat as unknown as typeof Intl.DateTimeFormat;
    }

    it('parts are read by type, and month is 1-based, not 0-based', () => {
      const parts = deriveZonedParts(new Date('2025-01-24T23:30:00Z'));
      expect(parts).toEqual({ year: 2025, month: 1, day: 24, hour: 20, minute: 30 });
    });

    it('formatTimeOfDay at local midnight returns 00:00, never 24:00', () => {
      // 2025-04-06T04:00:00Z is 2025-04-06 00:00 in America/Santiago (just after DST ends).
      expect(formatTimeOfDay(new Date('2025-04-06T04:00:00Z'))).toBe('00:00');
    });

    it('an explicit non-default timezone is honoured, not ignored', () => {
      expect(deriveDateLocal(new Date('2025-01-24T23:30:00Z'), 'UTC')).toBe('2025-01-24');
      expect(deriveDateLocal(new Date('2025-01-24T23:30:00Z'))).toBe('2025-01-24');
    });

    it('a valid IANA alias round-trips to the same fields as its canonical zone', () => {
      const instant = new Date('2025-06-15T12:00:00Z');
      expect(deriveZonedParts(instant, 'US/Eastern')).toEqual(
        deriveZonedParts(instant, 'America/New_York'),
      );
    });

    it('throws a descriptive Error naming the timezone when a required part is missing', async () => {
      jest.resetModules();
      installMockDateTimeFormat(() => ({
        resolvedOptions: () => ({ timeZone: 'America/Santiago' }) as Intl.ResolvedDateTimeFormatOptions,
        formatToParts: () => [
          { type: 'month', value: '04' },
          { type: 'day', value: '06' },
          { type: 'hour', value: '00' },
          { type: 'minute', value: '00' },
          // 'year' intentionally omitted
        ],
      }));
      const freshDates = await import('./dates');
      expect(() => freshDates.deriveZonedParts(new Date('2025-04-06T03:00:00Z'))).toThrow(
        /cannot resolve "year"/,
      );
    });

    it('throws a descriptive Error naming both zones when the runtime silently substitutes a different zone', async () => {
      jest.resetModules();
      installMockDateTimeFormat(() => ({
        // Silently substituted — reports UTC instead of the requested America/Santiago, while
        // still returning a complete, plausible-looking set of parts.
        resolvedOptions: () => ({ timeZone: 'UTC' }) as Intl.ResolvedDateTimeFormatOptions,
        formatToParts: () => [
          { type: 'year', value: '2025' },
          { type: 'month', value: '04' },
          { type: 'day', value: '06' },
          { type: 'hour', value: '03' },
          { type: 'minute', value: '00' },
        ],
      }));
      const freshDates = await import('./dates');
      expect(() => freshDates.deriveZonedParts(new Date('2025-04-06T03:00:00Z'))).toThrow(
        /resolved time zone "UTC" instead of the requested "America\/Santiago"/,
      );
    });

    it('the happy path is unaffected on a fresh module instance', async () => {
      jest.resetModules();
      const freshDates = await import('./dates');
      expect(freshDates.deriveZonedParts(new Date('2025-01-24T23:30:00Z'))).toEqual({
        year: 2025,
        month: 1,
        day: 24,
        hour: 20,
        minute: 30,
      });
    });
  });

  describe('Group G — locale-parameterised labels, exact against the mockup for es, honoured for en', () => {
    describe('es — exact against the mockup (Decisions 7, 8)', () => {
      it.each([
        ['2025-01-24', '24 ene'],
        ['2024-12-11', '11 dic'],
        ['2024-12-29', '29 dic'],
        ['2025-01-05', '5 ene'],
      ])('formatShortDate(%p, "es") -> %p', (dateLocal, expected) => {
        expect(formatShortDate(dateLocal, 'es')).toBe(expected);
      });

      it.each([
        ['2025-01-24', 'viernes, 24 de enero de 2025'],
        ['2025-01-05', 'domingo, 5 de enero de 2025'],
        ['2024-02-29', 'jueves, 29 de febrero de 2024'],
        ['2025-03-01', 'sábado, 1 de marzo de 2025'],
      ])('formatLongDate(%p, "es") -> %p', (dateLocal, expected) => {
        expect(formatLongDate(dateLocal, 'es')).toBe(expected);
      });

      it('the "á" in sábado is the precomposed codepoint U+00E1, not a decomposed sequence', () => {
        const result = formatLongDate('2025-03-01', 'es');
        expect(result).toContain('sábado');
        expect(result.normalize('NFC')).toBe(result);
      });

      it.each([
        ['2025-01-24', 'ene 2025'],
        ['2024-12-01', 'dic 2024'],
      ])('formatMonthYear(%p, "es") -> %p', (dateLocal, expected) => {
        expect(formatMonthYear(dateLocal, 'es')).toBe(expected);
      });

      it.each([
        ['2025-01-24', 'ene'],
        ['2025-02-24', 'feb'],
        ['2025-03-24', 'mar'],
        ['2025-04-24', 'abr'],
        ['2025-05-24', 'may'],
        ['2025-06-24', 'jun'],
        ['2025-07-24', 'jul'],
        ['2025-08-24', 'ago'],
        ['2025-09-24', 'sept'],
        ['2025-10-24', 'oct'],
        ['2025-11-24', 'nov'],
        ['2025-12-24', 'dic'],
      ])('formatMonthAbbreviation(%p, "es") -> %p', (dateLocal, expected) => {
        expect(formatMonthAbbreviation(dateLocal, 'es')).toBe(expected);
      });

      it.each([
        ['2025-01-19', 'domingo'],
        ['2025-01-20', 'lunes'],
        ['2025-01-21', 'martes'],
        ['2025-01-22', 'miércoles'],
        ['2025-01-23', 'jueves'],
        ['2025-01-24', 'viernes'],
        ['2025-01-25', 'sábado'],
      ])('weekday sweep: formatLongDate(%p, "es") starts with %p', (dateLocal, weekday) => {
        expect(formatLongDate(dateLocal, 'es')).toMatch(new RegExp(`^${weekday}, `));
      });
    });

    describe('en — honoured, not merely accepted (proof the locale parameter is read)', () => {
      it('formatShortDate honours en', () => {
        expect(formatShortDate('2025-01-24', 'en')).toBe('Jan 24');
      });

      it('formatLongDate honours en', () => {
        expect(formatLongDate('2025-01-24', 'en')).toBe('Friday, January 24, 2025');
      });

      it('formatMonthYear honours en', () => {
        expect(formatMonthYear('2025-01-24', 'en')).toBe('Jan 2025');
      });

      it('formatMonthAbbreviation honours en', () => {
        expect(formatMonthAbbreviation('2025-01-24', 'en')).toBe('Jan');
      });
    });
  });

  describe('Parser-risk addendum — DateLocal structural parsing', () => {
    const isValidCases: Array<[string, boolean, string]> = [
      ['2025-01-24', true, 'canonical'],
      ['2024-02-29', true, 'valid leap day'],
      ['2025-02-29', false, 'calendar-invalid day, structurally well-formed'],
      ['2025-13-01', false, 'month out of range'],
      ['2025-00-10', false, 'month zero'],
      ['2025-04-31', false, "day beyond that month's length"],
      ['2025-01-00', false, 'day zero'],
      ['2025-1-24', false, 'unpadded month'],
      ['2025-01-24T00:00:00Z', false, 'full ISO instant'],
      ['2025-01-24 ', false, 'trailing whitespace'],
      ['20250124', false, 'separator-free'],
      ['2025/01/24', false, 'wrong separator'],
      ['-2025-01-24', false, 'leading sign'],
      ['0000-01-01', false, 'year zero — rejected two-digit-year range'],
      ['0099-12-31', false, "two-digit year — top of Date.UTC's legacy remap range"],
      ['0100-01-01', true, 'first year outside the remap range — the floor'],
      ['', false, 'empty string'],
    ];

    it.each(isValidCases)('isValidDateLocal(%p) -> %p (%s)', (input, expected) => {
      expect(isValidDateLocal(input)).toBe(expected);
    });

    it.each(isValidCases.filter(([, valid]) => !valid))(
      'parseDateLocal(%p) throws RangeError (%s)',
      (input) => {
        expect(() => parseDateLocal(input)).toThrow(RangeError);
      },
    );

    it('parseDateLocal error message names the expected format, not the unbounded input', () => {
      try {
        parseDateLocal('not-a-date-at-all-'.repeat(50));
        throw new Error('expected parseDateLocal to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toContain('YYYY-MM-DD');
        expect((error as Error).message.length).toBeLessThan(200);
      }
    });

    it('toDateLocal({ year: 2025, month: 1, day: 5 }) zero-pads both fields', () => {
      expect(toDateLocal({ year: 2025, month: 1, day: 5 })).toBe('2025-01-05');
    });

    it.each(isValidCases.filter(([, valid]) => valid))(
      'toDateLocal(parseDateLocal(%p)) round-trips to %p',
      (input) => {
        expect(toDateLocal(parseDateLocal(input))).toBe(input);
      },
    );
  });
});
