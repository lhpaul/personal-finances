import type { NotificationsPort, ReminderRequest } from '../../lib/notifications';
import { REMINDER_ID_PREFIX } from './constants';

/**
 * Cancel-owned-then-schedule (implementation plan for issue #18, Decision 2). Lists the currently
 * scheduled identifiers, cancels **every** identifier that starts with `REMINDER_ID_PREFIX`, then
 * schedules each request in the plan — in that order, always — and returns the resulting
 * identifier set. Identifiers the app does not own (no `REMINDER_ID_PREFIX` prefix) are never
 * touched, so this cannot delete another feature's notifications.
 *
 * `channelName` prepares the Android notification channel (Decision 13) once per process — the
 * real adapter's own module-level guard makes a second call here a no-op, so calling it on every
 * `applyReminderSchedule` invocation (only when there is something to schedule) is safe.
 */
export async function applyReminderSchedule(
  port: NotificationsPort,
  plan: ReminderRequest[],
  channelName: string,
): Promise<string[]> {
  const scheduledIdentifiers = await port.listScheduledIdentifiers();
  const ownedIdentifiers = scheduledIdentifiers.filter((identifier) =>
    identifier.startsWith(REMINDER_ID_PREFIX),
  );

  for (const identifier of ownedIdentifiers) {
    await port.cancel(identifier);
  }

  if (plan.length > 0) {
    await port.prepareChannel(channelName);
  }

  for (const request of plan) {
    await port.schedule(request);
  }

  return plan.map((request) => request.identifier);
}
