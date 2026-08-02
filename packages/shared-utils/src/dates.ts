/**
 * `date_local` derivation, month/week period boundaries, and Spanish/English date labels
 * (Decisions 2, 3, 7, 8, 12 — implementation plan for issue #4).
 *
 * ## Decision 2 — the only two `Intl` seams in this module
 *
 * `deriveZonedParts` (the timezone seam) and the four label formatters —
 * `formatShortDate`, `formatLongDate`, `formatMonthYear`, `formatMonthAbbreviation` (the
 * locale-label seam) — are the **only** functions in this file permitted to call `Intl`. No
 * month, day or weekday name may ever be hardcoded here (Decision 7): the label seam reads the
 * name straight out of `Intl.DateTimeFormat(locale, …).format(...)`. All other functions in
 * this module — `parseDateLocal`, `toDateLocal`, `isValidDateLocal`, `addDays`, the period
 * functions — are pure UTC civil-date arithmetic (Decision 3) and never touch `Intl` or the
 * host clock. Nothing in this module calls `Date.now()` or a no-arg `new Date()`; the instant
 * is always passed in.
 */

export type DateLocal = string;

export type SupportedLocale = 'es' | 'en';

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-based
  day: number;
  hour: number;
  minute: number;
}

export interface Period {
  start: DateLocal;
  end: DateLocal;
}

export const SANTIAGO_TIME_ZONE = 'America/Santiago';

const MIN_SUPPORTED_YEAR = 100;
const MAX_SUPPORTED_YEAR = 9999;

const DATE_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------------------------------------
// Pure UTC civil-date arithmetic (Decision 3). No Intl, no table, no host-clock read.
// ---------------------------------------------------------------------------------------------

/**
 * Shape, calendar validity, and the 0100-9999 supported year range (Decision 3 — rejects the
 * two-digit years `Date.UTC`'s legacy remap would otherwise silently corrupt).
 */
export function isValidDateLocal(value: string): boolean {
  const match = DATE_LOCAL_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** Throws `RangeError` on any input `isValidDateLocal` rejects. */
export function parseDateLocal(dateLocal: DateLocal): CivilDate {
  if (!isValidDateLocal(dateLocal)) {
    throw new RangeError(
      'parseDateLocal: expected a DateLocal string in "YYYY-MM-DD" format, with a calendar-valid ' +
        'date and a year in the supported range 0100-9999',
    );
  }
  const match = DATE_LOCAL_PATTERN.exec(dateLocal);
  // isValidDateLocal already confirmed this matches; the non-null assertion below is safe.
  const [, yearStr, monthStr, dayStr] = match as RegExpExecArray;
  return { year: Number(yearStr), month: Number(monthStr), day: Number(dayStr) };
}

/**
 * Zero-pads month and day. Throws `RangeError` if `civil.year` falls outside 0100-9999, or if
 * `year`, `month`, or `day` is not an integer (rejects `NaN`, `Infinity`, and non-integer
 * values) — the single construction-side guard every `DateLocal`-returning function in this file
 * routes through (Decision 3, "Arithmetic self-consistency at the range boundary"). Callers that
 * reach this guard through arithmetic (`addDays`, `getWeekPeriod`, `shiftMonthPeriod`,
 * `shiftWeekPeriod`) do not catch or wrap the error — it propagates to the caller unchanged.
 */
export function toDateLocal(civil: CivilDate): DateLocal {
  const { year, month, day } = civil;
  if (!Number.isInteger(year) || year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    throw new RangeError(
      `toDateLocal: year ${year} is outside the supported range ${MIN_SUPPORTED_YEAR}-${MAX_SUPPORTED_YEAR}`,
    );
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`toDateLocal: month ${month} must be an integer in the range 1-12`);
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
    throw new RangeError(
      `toDateLocal: day ${day} must be an integer in the range 1-${daysInMonth} for month ${month}`,
    );
  }
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Signed day addition. Throws `RangeError` if `days` is not a safe integer (`NaN`, `Infinity`,
 * or non-integer), or (via `toDateLocal`) at the 0100/9999 boundary.
 */
export function addDays(dateLocal: DateLocal, days: number): DateLocal {
  if (!Number.isSafeInteger(days)) {
    throw new RangeError('addDays: days must be a safe integer');
  }
  const { year, month, day } = parseDateLocal(dateLocal);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toDateLocal({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/**
 * `2025-01-24` -> `{ start: '2025-01-01', end: '2025-01-31' }`. Never crosses the 0100-9999
 * boundary on its own — it never changes the input's year (Decision 3).
 */
export function getMonthPeriod(dateLocal: DateLocal): Period {
  const { year, month } = parseDateLocal(dateLocal);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
  return {
    start: toDateLocal({ year, month, day: 1 }),
    end: toDateLocal({ year, month, day: lastDay }),
  };
}

/**
 * Monday-start week. `2025-01-24` (Fri) -> `{ start: '2025-01-20', end: '2025-01-26' }`. Throws
 * `RangeError` (via `addDays`) if walking back to Monday or forward to Sunday would cross
 * 0100-9999.
 */
export function getWeekPeriod(dateLocal: DateLocal): Period {
  const { year, month, day } = parseDateLocal(dateLocal);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  const daysSinceMonday = (weekday + 6) % 7;
  const start = addDays(dateLocal, -daysSinceMonday); // propagates addDays' RangeError at the year floor
  return { start, end: addDays(start, 6) }; // propagates addDays' RangeError at the year ceiling
}

/**
 * Shifts a month period by `months` (signed). Drives the mockup's `‹ ›` month nav. Throws
 * `RangeError` if `period.start` is not the first of a month (it always anchors on day 1, so it
 * needs no end-of-month clamping), or (via `toDateLocal`) if the shifted month's year would fall
 * outside 0100-9999. Throws `RangeError` if `months` is not a safe integer.
 */
export function shiftMonthPeriod(period: Period, months: number): Period {
  if (!Number.isSafeInteger(months)) {
    throw new RangeError('shiftMonthPeriod: months must be a safe integer');
  }
  const { year, month, day } = parseDateLocal(period.start);
  if (day !== 1) {
    throw new RangeError('shiftMonthPeriod: period.start must be the first day of a month');
  }
  const totalMonths = year * 12 + (month - 1) + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const lastDay = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
  return {
    start: toDateLocal({ year: newYear, month: newMonth, day: 1 }),
    end: toDateLocal({ year: newYear, month: newMonth, day: lastDay }),
  };
}

/**
 * Signed day difference: `differenceInDays(from, to) === to - from`, in days
 * (`differenceInDays('2025-01-01', '2025-01-31') === 30`). Pure UTC civil-date arithmetic
 * (Decision 3) — issue #5's `@finanzas/shared-domain` depends on this instead of computing day
 * counts itself, which is what lets that package ban the `Date` global outright. Throws
 * `RangeError` (via `parseDateLocal`) if either argument is not a valid `DateLocal`.
 */
export function differenceInDays(from: DateLocal, to: DateLocal): number {
  const a = parseDateLocal(from);
  const b = parseDateLocal(to);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const utcFrom = Date.UTC(a.year, a.month - 1, a.day);
  const utcTo = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcTo - utcFrom) / millisecondsPerDay);
}

/**
 * Shifts a week period by `weeks` (signed). Drives the `S-1` / `S-2` chart columns. Throws
 * `RangeError` if `weeks` is not a safe integer, or (via `addDays`) if the shifted week would
 * cross 0100-9999.
 */
export function shiftWeekPeriod(period: Period, weeks: number): Period {
  if (!Number.isSafeInteger(weeks)) {
    throw new RangeError('shiftWeekPeriod: weeks must be a safe integer');
  }
  const days = weeks * 7;
  return {
    start: addDays(period.start, days),
    end: addDays(period.end, days),
  };
}

// ---------------------------------------------------------------------------------------------
// Intl seams (Decision 2). Nothing above this line calls Intl or reads the host clock/zone.
// ---------------------------------------------------------------------------------------------

/**
 * Shared formatter cache for both Intl seams. Keyed so the timezone seam (canonical timezone
 * strings, e.g. `'America/Santiago'`) and the locale-label seam (`'label:<locale>:<options>'`
 * keys) can never collide in the same cache entry.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Caches the canonicalization probe used by `deriveZonedParts` (raw `timeZone` argument ->
 * canonical IANA identifier). The canonical identifier for a given input string is stable for the
 * process lifetime, so caching it only removes repeated `Intl.DateTimeFormat` construction and
 * does not change semantics.
 */
const canonicalTimeZoneCache = new Map<string, string>();

/**
 * Converts a UTC instant to Chilean (or any IANA-zone) wall-clock fields via
 * `Intl.DateTimeFormat(...).formatToParts`, read by `type`, never by position. This is the one
 * seam whose output can depend on a real, non-`'UTC'` timezone (Decision 3). Fails loudly rather
 * than returning a silently wrong date: throws if the runtime cannot resolve a required part, or
 * if it silently substitutes a different zone than the one requested.
 */
export function deriveZonedParts(instant: Date, timeZone: string = SANTIAGO_TIME_ZONE): ZonedParts {
  // Canonicalize first: a valid IANA alias ('US/Eastern', a lowercase identifier, etc.) resolves
  // to a different canonical string than the literal input. This bare probe — no hourCycle, no
  // field options — only exercises the timezone *name* table, not the offset/DST *rule* data a
  // reduced-ICU build might be missing for a given zone. The canonical result for a given input
  // string is stable for the process lifetime, so it is cached to avoid constructing a second
  // `Intl.DateTimeFormat` on every call (construction, not `formatToParts`, is the expensive part).
  let canonicalTimeZone = canonicalTimeZoneCache.get(timeZone);
  if (canonicalTimeZone === undefined) {
    canonicalTimeZone = new Intl.DateTimeFormat(undefined, { timeZone }).resolvedOptions().timeZone;
    canonicalTimeZoneCache.set(timeZone, canonicalTimeZone);
  }
  let formatter = formatterCache.get(canonicalTimeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: canonicalTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23', // NOT hour12: false — some ICU builds render midnight as 24:00
    });
    // Honoured-zone check: a spec-compliant Intl.DateTimeFormat.resolvedOptions() must report the
    // zone the formatter actually applied (ECMA-402 §12.1.3). This catches a runtime that accepts
    // but silently substitutes a different zone for an unsupported/ignored `timeZone` option — a
    // case the missing-part check below cannot catch, because a substituted zone still yields a
    // complete, plausible-looking set of parts.
    const resolvedTimeZone = formatter.resolvedOptions().timeZone;
    if (resolvedTimeZone !== canonicalTimeZone) {
      throw new Error(
        `deriveZonedParts: runtime resolved time zone "${resolvedTimeZone}" instead of the ` +
          `requested "${timeZone}" (canonical "${canonicalTimeZone}") — this device's Intl ` +
          'implementation is not honoring the requested time zone',
      );
    }
    formatterCache.set(canonicalTimeZone, formatter);
  }

  const found: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(instant)) {
    found[part.type] = part.value;
  }
  // Capability check: fail loudly rather than return a silently wrong civil date.
  for (const key of ['year', 'month', 'day', 'hour', 'minute'] as const) {
    if (found[key] === undefined) {
      throw new Error(`deriveZonedParts: runtime Intl cannot resolve "${key}" for time zone ${timeZone}`);
    }
  }
  return {
    year: Number(found.year),
    month: Number(found.month), // 1-based
    day: Number(found.day),
    hour: Number(found.hour),
    minute: Number(found.minute),
  };
}

/** `2025-01-24`. Converts an instant to the `date_local` value for `timeZone` (default Santiago). */
export function deriveDateLocal(instant: Date, timeZone: string = SANTIAGO_TIME_ZONE): DateLocal {
  const { year, month, day } = deriveZonedParts(instant, timeZone);
  return toDateLocal({ year, month, day });
}

/** `14:32` — 24-hour, zero-padded. Numeric only, so it takes no `locale`. */
export function formatTimeOfDay(instant: Date, timeZone: string = SANTIAGO_TIME_ZONE): string {
  const { hour, minute } = deriveZonedParts(instant, timeZone);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getLabelFormatter(
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `label:${locale}:${JSON.stringify(options)}`;
  let formatter = formatterCache.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    formatterCache.set(cacheKey, formatter);
  }
  return formatter;
}

/**
 * Constructs the UTC-midnight instant for a civil date. `timeZone: 'UTC'` is pinned on every
 * label formatter (Decision 2), so this is deterministic under a hostile host timezone.
 */
function civilDateAsUtcMidnightInstant(dateLocal: DateLocal): Date {
  const { year, month, day } = parseDateLocal(dateLocal);
  return new Date(Date.UTC(year, month - 1, day));
}

/** `24 ene` (`es`) / `Jan 24` (`en`). No leading zero on the day (Decision 8). No default locale. */
export function formatShortDate(dateLocal: DateLocal, locale: SupportedLocale): string {
  const instant = civilDateAsUtcMidnightInstant(dateLocal);
  return getLabelFormatter(locale, { day: 'numeric', month: 'short' }).format(instant);
}

/**
 * `viernes, 24 de enero de 2025` (`es`) / `Friday, January 24, 2025` (`en`). No default locale.
 */
export function formatLongDate(dateLocal: DateLocal, locale: SupportedLocale): string {
  const instant = civilDateAsUtcMidnightInstant(dateLocal);
  return getLabelFormatter(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}

/** `ene 2025` (`es`) / `Jan 2025` (`en`). No default locale. */
export function formatMonthYear(dateLocal: DateLocal, locale: SupportedLocale): string {
  const instant = civilDateAsUtcMidnightInstant(dateLocal);
  return getLabelFormatter(locale, { month: 'short', year: 'numeric' }).format(instant);
}

/** `ene` (`es`) / `Jan` (`en`). No default locale. */
export function formatMonthAbbreviation(dateLocal: DateLocal, locale: SupportedLocale): string {
  const instant = civilDateAsUtcMidnightInstant(dateLocal);
  return getLabelFormatter(locale, { month: 'short' }).format(instant);
}
