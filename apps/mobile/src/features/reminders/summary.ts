/**
 * Pure reminder-days summarisation (implementation plan Decision 8, Assumption A5, A8). Placed
 * in a `reminders` feature folder — not `onboarding` — because item #18
 * (`notifications-schedule`) and `settings-notifications` (#19) reuse it; onboarding-ready is
 * only its first consumer.
 *
 * ISO weekday integers, `1` = Monday … `7` = Sunday (Assumption A8). No React, no `t`.
 */

export type ReminderDaysSummary =
  | { kind: 'weekdays' }
  | { kind: 'everyday' }
  | { kind: 'custom'; days: number[] };

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERYDAY = [1, 2, 3, 4, 5, 6, 7];

function normalizeDays(days: number[]): number[] {
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * `[1,2,3,4,5]` (in any order, with any duplicates) -> `{ kind: 'weekdays' }`.
 * `[1..7]` -> `{ kind: 'everyday' }`. Anything else, including `[]`, -> `{ kind: 'custom', days }`
 * with the normalized (deduplicated, ascending) day list.
 */
export function summarizeReminderDays(days: number[]): ReminderDaysSummary {
  const normalized = normalizeDays(days);
  if (sameDays(normalized, WEEKDAYS)) return { kind: 'weekdays' };
  if (sameDays(normalized, EVERYDAY)) return { kind: 'everyday' };
  return { kind: 'custom', days: normalized };
}
