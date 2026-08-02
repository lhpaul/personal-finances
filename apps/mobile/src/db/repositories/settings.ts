import { eq } from 'drizzle-orm';

import { parseSettingValue, serializeSettingValue } from '../json';
import { appSettings } from '../schema';
import type { AppDatabase, ReminderSettings } from '../types';

/** `app_settings` is a key-value table (data model, spec Seed Data Contract → Settings keys).
 * Every value is JSON-encoded on write and parsed back through the guard on read. */

export function getSetting(db: AppDatabase, key: string): unknown {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get() as
    | { value: string }
    | undefined;
  if (!row) return undefined;
  return parseSettingValue(row.value);
}

export function setSetting(db: AppDatabase, key: string, value: unknown): void {
  const serialized = serializeSettingValue(value);
  db.insert(appSettings)
    .values({ key, value: serialized })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: serialized } })
    .run();
}

/**
 * Onboarding accessors over `app_settings.onboarding_completed` (implementation plan Decision 8
 * value-shape table). The value is a boolean JSON literal; anything else (absent, malformed,
 * `"true"` as a string, `1`, …) reads back as `false` — a first launch is never mistaken for a
 * returning one because of a stray value shape.
 */
export function isOnboardingCompleted(db: AppDatabase): boolean {
  return getSetting(db, 'onboarding_completed') === true;
}

/** Idempotent by construction (`setSetting`'s `onConflictDoUpdate` on the primary key) — calling
 * this twice, or after it is already `true`, leaves the same end state (implementation plan
 * Decision 5, AC5). */
export function markOnboardingCompleted(db: AppDatabase): void {
  setSetting(db, 'onboarding_completed', true);
}

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `reminder_time` is well-formed only as a zero-padded 24-hour `"HH:mm"` string (Assumption
 * A8). Anything else — missing, non-string, wrong shape — reads back as `undefined` rather than
 * throwing, per Decision 8's "renders with title only" behaviour. */
function readReminderTimeOfDay(raw: unknown): string | undefined {
  return typeof raw === 'string' && TIME_OF_DAY_PATTERN.test(raw) ? raw : undefined;
}

/** `reminder_days` is well-formed only as a non-empty array of integers in `1..7` (Monday =
 * `1` … Sunday = `7`, Assumption A8). Anything else reads back as `undefined`. */
function readReminderDays(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const isWellFormed = raw.every(
    (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 7,
  );
  return isWellFormed ? (raw as number[]) : undefined;
}

/**
 * Reads the reminder-settings contract this item defines for item #18 to write (implementation
 * plan Decision 8). Every field is read defensively — `getSetting` returns `unknown`, and
 * `parseSettingValue` already returns `null` for unparseable JSON, so every branch below is
 * reachable and independently tolerant of a missing or malformed value.
 */
export function readReminderSettings(db: AppDatabase): ReminderSettings {
  return {
    enabled: getSetting(db, 'reminder_enabled') === true,
    timeOfDay: readReminderTimeOfDay(getSetting(db, 'reminder_time')),
    days: readReminderDays(getSetting(db, 'reminder_days')),
  };
}
