import type { IsoWeekday, PermissionState, ReminderRequest, ReminderTrigger } from '../../lib/notifications';
import { REMINDER_ID_PREFIX, REMINDER_TRIGGER_STRATEGY, type TriggerStrategy } from './constants';

/**
 * Deterministic identifier derivation (implementation plan for issue #18, Decision 2). The same
 * logical reminder always resolves to the same id — `finanzas-reminder-w<isoWeekday>` for a
 * weekly trigger, `finanzas-reminder-daily` for the daily one — which is what makes
 * "changing the schedule reschedules rather than duplicating" a property of the data rather than
 * of call order.
 */
export function reminderIdentifier(trigger: ReminderTrigger): string {
  if (trigger.kind === 'daily') return `${REMINDER_ID_PREFIX}-daily`;
  return `${REMINDER_ID_PREFIX}-w${trigger.isoWeekday}`;
}

export interface PlanReminderScheduleInput {
  enabled: boolean;
  permission: PermissionState;
  /** `"HH:mm"`, 24-hour, zero-padded. */
  time: string;
  days: IsoWeekday[];
  strategy?: TriggerStrategy;
  /** Resolved notification copy (Decision 12 — `reminderContent()`, read once by the caller so
   * the planner itself stays free of any `i18n` import). Every returned request carries the same
   * `title`/`body` — there is exactly one reminder message in this item's scope. */
  title: string;
  body: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const match = TIME_PATTERN.exec(time);
  if (!match) {
    throw new RangeError(`planReminderSchedule: expected a 24-hour "HH:mm" string, got "${time}"`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function normalizeDays(days: IsoWeekday[]): IsoWeekday[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

/**
 * Pure and synchronous (implementation plan for issue #18, Decision 3, Decision 5). Returns `[]`
 * unless `enabled === true && permission === 'granted' && days.length > 0` — the conjunction of
 * stored intent and live OS permission (Decision 5), so a caller never has to re-derive "should we
 * actually schedule anything" itself.
 *
 * Otherwise returns one request per selected ISO day (`weekly-per-day`, the default) or a single
 * daily request when every day is selected under `daily-when-every-day` (Decision 3) — sorted by
 * identifier so two calls with the same input are `toEqual`-identical (Decision 2).
 */
export function planReminderSchedule(input: PlanReminderScheduleInput): ReminderRequest[] {
  if (!input.enabled || input.permission !== 'granted') return [];

  const days = normalizeDays(input.days);
  if (days.length === 0) return [];

  const strategy = input.strategy ?? REMINDER_TRIGGER_STRATEGY;
  const { hour, minute } = parseTimeOfDay(input.time);

  const triggers: ReminderTrigger[] =
    strategy === 'daily-when-every-day' && days.length === 7
      ? [{ kind: 'daily', hour, minute }]
      : days.map((isoWeekday) => ({ kind: 'weekly', isoWeekday, hour, minute }) as ReminderTrigger);

  const requests = triggers.map(
    (trigger): ReminderRequest => ({
      identifier: reminderIdentifier(trigger),
      title: input.title,
      body: input.body,
      trigger,
    }),
  );

  return requests.sort((a, b) => a.identifier.localeCompare(b.identifier));
}
