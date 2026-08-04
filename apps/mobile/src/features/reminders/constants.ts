/**
 * Pure constants for the reminders feature (implementation plan for issue #18, Layer-by-Layer).
 * No React, no I/O, no `expo-notifications` import — safe for `expo-notifications.adapter.ts`
 * (the notifications boundary's one sanctioned importer) **and** every plain feature module to
 * import (Decisions 3, 13, 14).
 */

/** Every identifier this app schedules starts with this prefix (Decision 2) — the id is how
 * `applyReminderSchedule` recognises "a notification this app owns" versus one a future feature
 * might register. */
export const REMINDER_ID_PREFIX = 'finanzas-reminder';

/** The Android notification channel's technical id (Decision 13) — opaque to the person; the
 * catalogue's `reminders.channel_name` is what they actually see in the OS settings. */
export const REMINDER_CHANNEL_ID = 'reminders';

export type TriggerStrategy = 'weekly-per-day' | 'daily-when-every-day';

/** Reversible default (Decision 3). `daily-when-every-day` collapses a seven-day selection into a
 * single `DAILY` trigger; every other selection is identical under both strategies. */
export const REMINDER_TRIGGER_STRATEGY: TriggerStrategy = 'weekly-per-day';

/** `#s-notifications-schedule` (`index.html:1049`) draws `9:00 AM` selected; `index.html:1072-1078`
 * draws Monday-Friday checked (Assumption A2). */
export const DEFAULT_REMINDER_TIME = '09:00';
export const DEFAULT_REMINDER_DAYS: number[] = [1, 2, 3, 4, 5];

/**
 * Structurally identical to `expo-notifications`' own `NotificationBehavior` (Verification Log),
 * declared locally rather than imported from the package — this file must stay free of any
 * `expo-notifications` import, including a type-only one, so it can be imported by both the one
 * sanctioned adapter **and** every other feature module without tripping the notifications
 * boundary scan (which matches the import specifier, not the import's kind).
 */
export type ForegroundBehavior = {
  shouldShowBanner: boolean;
  shouldShowList: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
};

/**
 * Foreground behaviour (Decision 14): a banner and a list entry, no sound, no badge — BR6's
 * "nunca castiga" spirit argues against interrupting someone already using the app.
 * `shouldShowAlert` is deliberately omitted: the installed typings mark it deprecated in favour of
 * the two `shouldShow*` fields.
 */
export const FOREGROUND_BEHAVIOR: ForegroundBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
};
