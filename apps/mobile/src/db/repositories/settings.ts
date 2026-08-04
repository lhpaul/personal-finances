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
 * Typed, defensively-coerced accessor over `app_settings.first_launch_at` (implementation plan
 * for issue #19, Decision 15) — `bootstrap.ts`'s `ensureFirstLaunchAt` writes this as an ISO
 * instant string on every fresh install; this is the settings local-profile screen's first
 * read of it. Returns `undefined` for anything that is not a non-empty string, so a caller never
 * has to handle `unknown`.
 */
export function readFirstLaunchAt(db: AppDatabase): string | undefined {
  const raw = getSetting(db, 'first_launch_at');
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
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

const LOOSE_TIME_PATTERN = /^(\d{1,2}):(\d{1,2})$/;

/** Zero-pads an `"H:mm"` / `"HH:m"` / `"HH:mm"` string into a canonical `"HH:mm"` one. A value that
 * does not even loosely look like `hour:minute` passes through unchanged — `writeReminderSettings`
 * is not the validation boundary (the screens that call it only ever produce well-formed strings
 * through `timeOfDayFromParts` / the preset tables); this only guarantees the *shape* is canonical
 * once it does reach storage. */
export function normalizeTimeOfDay(time: string): string {
  const match = LOOSE_TIME_PATTERN.exec(time);
  if (!match) return time;
  const hour = match[1]?.padStart(2, '0') ?? '';
  const minute = match[2]?.padStart(2, '0') ?? '';
  return `${hour}:${minute}`;
}

/**
 * The write-side sibling of {@link readReminderSettings} (implementation plan for issue #18,
 * Layer-by-Layer). Writes through the existing `setSetting` — `onConflictDoUpdate` on the primary
 * key, hence idempotent (AGENTS.md non-negotiable 4) — and normalises before writing: `days`
 * de-duplicated and sorted ascending, `timeOfDay` re-serialised as a zero-padded 24-hour `"HH:mm"`
 * string. This is what makes scenario 9's "an unsorted duplicated day list proves normalisation"
 * assertion true regardless of what a caller happens to pass in.
 */
/** De-duplicates and sorts ascending — the exact normalisation {@link writeReminderSettings}
 * applies before writing, exported so a caller that must build a *derived* value (e.g. the
 * schedule to plan and apply) from the same input can use the identical rule rather than
 * re-deriving it. */
export function normalizeReminderDays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

export function writeReminderSettings(
  db: AppDatabase,
  settings: { enabled: boolean; timeOfDay: string; days: number[] },
): void {
  const normalizedDays = normalizeReminderDays(settings.days);
  const normalizedTime = normalizeTimeOfDay(settings.timeOfDay);

  setSetting(db, 'reminder_enabled', settings.enabled);
  setSetting(db, 'reminder_time', normalizedTime);
  setSetting(db, 'reminder_days', normalizedDays);
}
