/**
 * Pure key selectors for `onboarding-ready`'s summary card (implementation plan Decision 7,
 * Decision 13). No React, no `t` — the screen calls `t(...)` with the key these return.
 *
 * Explicit `_single` / `_plural` keys, not i18next plural suffixes (Decision 13): the catalogue
 * is typed with `keySeparator: false`, and i18next's own `_one` / `_other` inference has no
 * precedent in this repository.
 */
import type { ReminderDaysSummary } from '../reminders/summary';

/** `{{count}} banco conectado` / `{{count}} bancos conectados` (`index.html:1101`). */
export function banksTitleKey(count: number): string {
  return count === 1 ? 'onboarding_ready.banks_title_single' : 'onboarding_ready.banks_title_plural';
}

/** `{{count}} producto` / `{{count}} productos` (`index.html:1101`). */
export function banksProductsKey(count: number): string {
  return count === 1
    ? 'onboarding_ready.banks_products_single'
    : 'onboarding_ready.banks_products_plural';
}

/**
 * The catalogue key for a scalar reminder-days summary. Returns `undefined` for `'custom'` — a
 * custom day set has no single drawn catalogue string (Assumption A5); the caller composes it
 * from `reminderDayKeys(summary.days)` joined by `REMINDER_DAY_SEPARATOR` instead.
 */
export function reminderDaysKey(summary: ReminderDaysSummary): string | undefined {
  switch (summary.kind) {
    case 'weekdays':
      return 'reminders.days_weekdays';
    case 'everyday':
      return 'reminders.days_everyday';
    case 'custom':
      return undefined;
  }
}

/** The mockup's own separator for the `days` portion of a custom set, reused from
 * `index.html:1102`'s `{{time}} · {{days}}` subtitle (Assumption A5) — a module constant, not
 * copy, so it needs no catalogue entry. */
export const REMINDER_DAY_SEPARATOR = ' · ';

/** Ordered catalogue keys for a custom day set (Assumption A5) — `reminders.day_1`…`_7`, in
 * ascending (Monday-first) order. */
export function reminderDayKeys(days: number[]): string[] {
  return [...days].sort((a, b) => a - b).map((day) => `reminders.day_${day}`);
}
