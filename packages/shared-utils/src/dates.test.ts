import {
  addDays,
  canonicalInstantForDateLocal,
  deriveDateLocal,
  deriveZonedParts,
  differenceInDays,
  formatLongDate,
  formatMonthAbbreviation,
  formatMonthHeading,
  formatMonthYear,
  formatShortDate,
  formatTimeOfDay,
  formatWallClockLabel,
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
      // 02:00Z is still 2025-01-23 23:00 in Santiago (UTC-03), so the two zones disagree on the
      // civil date. An ignored `timeZone` argument would make both assertions return the same
      // value, so this instant (unlike one where both zones happen to land on the same day) can
      // actually distinguish "honoured" from "silently ignored".
      const instant = new Date('2025-01-24T02:00:00Z');
      expect(deriveDateLocal(instant, 'UTC')).toBe('2025-01-24');
      expect(deriveDateLocal(instant)).toBe('2025-01-23');
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

      // ICU/CLDR baseline: these are the labels Node's bundled full-ICU CLDR data produces for
      // the `es` locale at plan/implementation time (Decision 7's width caveat covers `sept`, the
      // four-letter form CLDR uses for September). This suite runs on Node in CI and is expected
      // to fail if a Node/ICU upgrade changes a CLDR label — that is a real signal, not test
      // flakiness, and should be re-verified against the mockup rather than silenced. React
      // Native inherits locale data from the device's platform ICU (Hermes has no bundled CLDR of
      // its own), so this Node-only baseline does not by itself prove device parity; the smoke
      // runbook's device step is the place that verifies on-device output.
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

  // Scenario 23 of issue #15's implementation plan (Decision 8, Assumption A7): the
  // `transactions` month-group heading, exact against the mockup's `📅 Enero de 2025 (31)`.
  describe('Group I — formatMonthHeading (issue #15 Decision 8)', () => {
    it.each([
      ['2025-01-24', 'Enero de 2025'],
      ['2024-12-01', 'Diciembre de 2024'],
      ['2025-09-15', 'Septiembre de 2025'],
    ])('formatMonthHeading(%p, "es") -> %p', (dateLocal, expected) => {
      expect(formatMonthHeading(dateLocal, 'es')).toBe(expected);
    });

    it('honours en', () => {
      expect(formatMonthHeading('2025-01-24', 'en')).toBe('January 2025');
    });

    it('is stable across a month boundary (last day of December vs. first day of January)', () => {
      expect(formatMonthHeading('2024-12-31', 'es')).toBe('Diciembre de 2024');
      expect(formatMonthHeading('2025-01-01', 'es')).toBe('Enero de 2025');
    });

    it('is idempotent under re-capitalization: re-applying the same capitalization rule to its own output is a no-op', () => {
      const label = formatMonthHeading('2025-01-24', 'es');
      const [first, ...rest] = [...label];
      const reapplied = (first as string).toLocaleUpperCase('es') + rest.join('');
      expect(reapplied).toBe(label);
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

    describe('toDateLocal numeric-input validation (invalid year/month/day never silently pass)', () => {
      const invalidCivilDates: Array<[Partial<Record<'year' | 'month' | 'day', number>>, string]> = [
        [{ year: NaN }, 'NaN year'],
        [{ year: Infinity }, 'Infinity year'],
        [{ year: -Infinity }, '-Infinity year'],
        [{ year: 2025.5 }, 'non-integer year'],
        [{ month: NaN }, 'NaN month'],
        [{ month: Infinity }, 'Infinity month'],
        [{ month: 1.5 }, 'non-integer month'],
        [{ month: 0 }, 'month below range'],
        [{ month: 13 }, 'month above range'],
        [{ day: NaN }, 'NaN day'],
        [{ day: Infinity }, 'Infinity day'],
        [{ day: 1.5 }, 'non-integer day'],
        [{ day: 0 }, 'day below range'],
        [{ day: 32 }, 'day above range'],
      ];

      it.each(invalidCivilDates)('toDateLocal rejects %s', (overrides) => {
        const civil = { year: 2025, month: 1, day: 5, ...overrides };
        expect(() => toDateLocal(civil)).toThrow(RangeError);
      });

      // `day` is bounded by the actual length of `month`, not a fixed 31 — otherwise
      // `toDateLocal` (the plan's single construction-side guard) could build a `DateLocal` that
      // the module's own `isValidDateLocal`/`parseDateLocal` predicates reject.
      it('toDateLocal rejects day 31 for a 30-day month (April)', () => {
        expect(() => toDateLocal({ year: 2025, month: 4, day: 31 })).toThrow(RangeError);
      });

      it('toDateLocal rejects day 31 for February in a common year', () => {
        expect(() => toDateLocal({ year: 2025, month: 2, day: 31 })).toThrow(RangeError);
      });

      it('toDateLocal rejects day 30 for February in a leap year', () => {
        expect(() => toDateLocal({ year: 2024, month: 2, day: 30 })).toThrow(RangeError);
      });

      it('toDateLocal accepts day 29 for February in a leap year', () => {
        expect(toDateLocal({ year: 2024, month: 2, day: 29 })).toBe('2024-02-29');
      });
    });
  });

  describe('Group H — arithmetic entry points reject non-integer shift amounts', () => {
    it.each([NaN, Infinity, -Infinity, 1.5])('addDays("2025-01-01", %p) throws RangeError', (days) => {
      expect(() => addDays('2025-01-01', days)).toThrow(RangeError);
    });

    it.each([NaN, Infinity, -Infinity, 1.5])(
      'shiftMonthPeriod(period, %p) throws RangeError',
      (months) => {
        expect(() =>
          shiftMonthPeriod({ start: '2025-01-01', end: '2025-01-31' }, months),
        ).toThrow(RangeError);
      },
    );

    it.each([NaN, Infinity, -Infinity, 1.5])(
      'shiftWeekPeriod(period, %p) throws RangeError',
      (weeks) => {
        expect(() =>
          shiftWeekPeriod({ start: '2025-01-20', end: '2025-01-26' }, weeks),
        ).toThrow(RangeError);
      },
    );
  });

  describe('differenceInDays — issue #5 addition', () => {
    it('same-day difference is 0', () => {
      expect(differenceInDays('2025-01-15', '2025-01-15')).toBe(0);
    });

    it('crosses a month boundary', () => {
      expect(differenceInDays('2025-01-31', '2025-02-01')).toBe(1);
    });

    it('crosses a leap February', () => {
      expect(differenceInDays('2024-02-28', '2024-03-01')).toBe(2);
    });

    it('crosses a non-leap February', () => {
      expect(differenceInDays('2025-02-28', '2025-03-01')).toBe(1);
    });

    it('crosses a year boundary', () => {
      expect(differenceInDays('2024-12-31', '2025-01-01')).toBe(1);
    });

    it('is negative when `to` precedes `from`', () => {
      expect(differenceInDays('2025-01-31', '2025-01-01')).toBe(-30);
    });

    it('matches the plan-quoted example', () => {
      expect(differenceInDays('2025-01-01', '2025-01-31')).toBe(30);
    });

    it('throws RangeError on an invalid `from`', () => {
      expect(() => differenceInDays('2025-02-30', '2025-03-01')).toThrow(RangeError);
    });

    it('throws RangeError on an invalid `to`', () => {
      expect(() => differenceInDays('2025-01-01', 'not-a-date')).toThrow(RangeError);
    });
  });

  /** Onboarding item #8's Testing Strategy scenario 9. */
  describe('formatWallClockLabel', () => {
    it.each([
      ['09:00', '9:00 AM'],
      ['12:00', '12:00 PM'],
      ['00:30', '12:30 AM'],
      ['18:00', '6:00 PM'],
      ['23:59', '11:59 PM'],
      ['00:00', '12:00 AM'],
      ['01:05', '1:05 AM'],
    ])('formatWallClockLabel(%p) -> %p', (timeOfDay, expected) => {
      expect(formatWallClockLabel(timeOfDay)).toBe(expected);
    });

    it('throws RangeError on a non-24-hour or malformed input (documented behaviour)', () => {
      expect(() => formatWallClockLabel('9am')).toThrow(RangeError);
      expect(() => formatWallClockLabel('24:00')).toThrow(RangeError);
      expect(() => formatWallClockLabel('09:60')).toThrow(RangeError);
      expect(() => formatWallClockLabel('')).toThrow(RangeError);
    });
  });

  /**
   * Issue #10's implementation plan, Decision 14. `canonicalInstantForDateLocal` is the one write
   * path the sync engine uses to turn a bank-stated `dateLocal` into `transactions.occurred_at`;
   * the round-trip property below is what actually matters for AC23, not a spot check — the
   * property must hold for every day, not merely a hand-picked one.
   */
  describe('canonicalInstantForDateLocal (issue #10 addition)', () => {
    it('returns midday UTC for the given calendar day', () => {
      expect(canonicalInstantForDateLocal('2026-02-01')).toBe('2026-02-01T12:00:00.000Z');
    });

    it('round-trips through deriveDateLocal (Santiago) for every day of a full year, both sides of both 2025 DST transitions', () => {
      let dateLocal = '2025-01-01';
      let iterations = 0;
      while (dateLocal <= '2025-12-31') {
        const instant = canonicalInstantForDateLocal(dateLocal);
        expect(deriveDateLocal(new Date(instant))).toBe(dateLocal);
        dateLocal = addDays(dateLocal, 1);
        iterations += 1;
      }
      expect(iterations).toBe(365);
    });

    it('round-trips across a leap-year February', () => {
      const dateLocal = '2024-02-29';
      expect(deriveDateLocal(new Date(canonicalInstantForDateLocal(dateLocal)))).toBe(dateLocal);
    });

    it('throws RangeError on a value isValidDateLocal rejects — proof the guard actually runs', () => {
      expect(() => canonicalInstantForDateLocal('2026-13-01')).toThrow(RangeError);
      expect(() => canonicalInstantForDateLocal('not-a-date')).toThrow(RangeError);
    });

    it('does not throw on the one boundary value the guard must accept — proof it is not vacuously strict', () => {
      expect(() => canonicalInstantForDateLocal('2026-02-01')).not.toThrow();
    });
  });
});
