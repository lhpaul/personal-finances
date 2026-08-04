import type { AppDatabase } from '../../db/types';
import { normalizeReminderDays, normalizeTimeOfDay, writeReminderSettings } from '../../db/repositories/settings';
import type { IsoWeekday, NotificationsPort } from '../../lib/notifications';
import { applyReminderSchedule } from './apply-schedule';
import { planReminderSchedule } from './schedule-plan';

export type SaveRemindersInput = {
  db: AppDatabase;
  port: NotificationsPort;
  settings: { enabled: boolean; timeOfDay: string; days: number[] };
  /** Resolved notification copy and channel display name (Decision 12) — passed in by the caller
   * rather than read here through `reminder-content.ts`'s `i18n` import. This keeps `saveReminders`
   * (and therefore `save-reminders.db.test.ts`, which runs under the Node `db` Jest project with
   * no React Native module transforms configured) completely free of any `i18n` /
   * `expo-localization` import chain. */
  content: { title: string; body: string; channelName: string };
};

/**
 * `{ status: 'ok'; identifiers }` on a normal save; `{ status: 'permission-lost' }` when the
 * person tried to turn reminders **on** (or keep them on) without a granted OS permission
 * (Decision 5) — the caller re-renders the OS-blocked frame instead of pretending the save worked.
 * `{ status: 'error' }` is additive to the plan's own two-variant contract: the systemic
 * write-path defect this item must not repeat is a caught failure with no visible state and no
 * retry path — every await below that can genuinely reject (a native scheduling call, a database
 * write) is wrapped so a rejection becomes this result instead of an unhandled promise rejection
 * that leaves the screen showing a stale "saved" state.
 */
export type SaveRemindersResult =
  | { status: 'ok'; identifiers: string[] }
  | { status: 'permission-lost' }
  | { status: 'error' };

/**
 * `saveReminders({ db, port, settings, content })` (implementation plan for issue #18,
 * Layer-by-Layer): writes through `writeReminderSettings`, then plans and applies the schedule.
 * Order matters (Testing Strategy scenario 9): the database write happens before the native
 * schedule call, so a saved-but-unscheduled state is at worst "the schedule catches up on the
 * next save", never "scheduled but the person's choice was never actually persisted".
 *
 * When `settings.enabled` is `true` and the live permission is not `granted`, this function
 * deliberately returns before writing anything (Decision 5's "the stored intent is deliberately
 * not rewritten" — the person did not change their mind, the OS changed the answer).
 */
export async function saveReminders(input: SaveRemindersInput): Promise<SaveRemindersResult> {
  const { db, port, settings, content } = input;

  let permission;
  try {
    permission = await port.getPermission();
  } catch {
    return { status: 'error' };
  }

  if (settings.enabled && permission !== 'granted') {
    return { status: 'permission-lost' };
  }

  try {
    writeReminderSettings(db, settings);
  } catch {
    return { status: 'error' };
  }

  try {
    // Plan against the **normalised** values — exactly what `writeReminderSettings` just
    // persisted — not the raw input, which may not yet be zero-padded/de-duplicated
    // (`planReminderSchedule`'s `time` parser requires the canonical "HH:mm" shape).
    const plan = planReminderSchedule({
      enabled: settings.enabled,
      permission,
      time: normalizeTimeOfDay(settings.timeOfDay),
      days: normalizeReminderDays(settings.days) as IsoWeekday[],
      title: content.title,
      body: content.body,
    });
    const identifiers = await applyReminderSchedule(port, plan, content.channelName);
    return { status: 'ok', identifiers };
  } catch {
    return { status: 'error' };
  }
}
