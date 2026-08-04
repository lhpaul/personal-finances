import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';

import { FOREGROUND_BEHAVIOR, REMINDER_CHANNEL_ID } from '../../features/reminders/constants';
import type { NotificationsPort, PermissionState, ReminderTapEvent, ReminderTrigger } from './types';
import { toPlatformWeekday } from './weekday';

/**
 * The **only** module in this repository allowed to import `expo-notifications` (implementation
 * plan for issue #18, Decision 1, mirroring item #9's `expo-secure-store.adapter.ts` exactly).
 * Enforced twice: `notificationsBoundary` (`eslint.config.mjs`) for the fast feedback loop, and
 * `apps/mobile/src/__tests__/notifications-boundary.test.ts` — a source-text scan — so the
 * guarantee survives a lint-config regression.
 *
 * Imports `REMINDER_CHANNEL_ID` / `FOREGROUND_BEHAVIOR` from the plain, I/O-free
 * `src/features/reminders/constants.ts` (Decisions 13, 14) — that file has no React and no
 * `expo-notifications` import of its own, so both the one sanctioned adapter and every other
 * feature module may import it without tripping the boundary this file itself enforces.
 */

function toPermissionState(response: Notifications.NotificationPermissionsStatus): PermissionState {
  if (response.status === 'granted') return 'granted';
  if (response.status === 'denied') return 'denied';
  return 'undetermined';
}

function toNativeTrigger(trigger: ReminderTrigger): Notifications.SchedulableNotificationTriggerInput {
  if (trigger.kind === 'daily') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: trigger.hour,
      minute: trigger.minute,
      channelId: REMINDER_CHANNEL_ID,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: toPlatformWeekday(trigger.isoWeekday),
    hour: trigger.hour,
    minute: trigger.minute,
    channelId: REMINDER_CHANNEL_ID,
  };
}

/**
 * Decides what happens when a reminder fires while the app is in the foreground (Decision 14).
 * Installed once at module load — every consumer reaches this module through
 * `getNotificationsPort()` (`index.ts`), so "module load" already means "first real use".
 */
Notifications.setNotificationHandler({
  handleNotification: async () => FOREGROUND_BEHAVIOR,
});

/** Guards channel creation so it runs once per process (Decision 13, concurrent-event-source
 * addendum's shared-mutable-state guard (b)) — concurrent first callers share one preparation
 * rather than racing two channel creations. Cleared on failure so a later call genuinely retries
 * instead of caching a permanent failure (mirrors `src/db/runtime.ts`'s single-flight guard). */
let channelPrepared: Promise<void> | undefined;

export const expoNotificationsAdapter: NotificationsPort = {
  async getPermission(): Promise<PermissionState> {
    const response = await Notifications.getPermissionsAsync();
    return toPermissionState(response);
  },

  async requestPermission(): Promise<PermissionState> {
    const response = await Notifications.requestPermissionsAsync();
    return toPermissionState(response);
  },

  async listScheduledIdentifiers(): Promise<string[]> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((request) => request.identifier);
  },

  async schedule(request): Promise<void> {
    // `prepareChannel` is a distinct port method the caller invokes once before scheduling
    // anything (`applyReminderSchedule`, Decision 13) — `schedule()` does not call it itself,
    // because only the caller knows the translated channel name to pass.
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body },
      trigger: toNativeTrigger(request.trigger),
    });
  },

  async cancel(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },

  prepareChannel(name: string): Promise<void> {
    if (!channelPrepared) {
      channelPrepared = Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name,
        importance: Notifications.AndroidImportance.DEFAULT,
      })
        .then(() => undefined)
        .catch((error: unknown) => {
          channelPrepared = undefined;
          throw error;
        });
    }
    return channelPrepared;
  },

  async openSystemSettings(): Promise<void> {
    await Linking.openSettings();
  },

  addResponseListener(listener: (event: ReminderTapEvent) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      listener({
        identifier: response.notification.request.identifier,
        date: response.notification.date,
      });
    });
    return () => subscription.remove();
  },

  async getLastResponse(): Promise<ReminderTapEvent | null> {
    const response = Notifications.getLastNotificationResponse();
    if (!response) return null;
    return { identifier: response.notification.request.identifier, date: response.notification.date };
  },
};
