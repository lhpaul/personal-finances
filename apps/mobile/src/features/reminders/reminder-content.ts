import i18n from '../../i18n';

/**
 * Notification copy composed at schedule time, not at fire time (implementation plan for issue
 * #18, Decision 12) — read once, through the already-initialised `i18n` instance, so the scheduler
 * can compose notification copy without a React hook. Kept separate from `schedule-plan.ts` so the
 * planner itself stays free of any `i18n` import.
 *
 * The scheduled body is the generic derivation from the catalogue (Assumption A6) — the mockup's
 * drawn sample names a specific merchant it cannot know at schedule time; that drawn string stays
 * exactly as drawn inside `SamplePushCard`, which is a picture of a notification, not a real one.
 */
export function reminderContent(): { title: string; body: string } {
  return {
    title: i18n.t('reminders.notification_title'),
    body: i18n.t('reminders.notification_body'),
  };
}

/** The Android channel's user-visible name (Decision 13) — what the person sees in the OS
 * notification settings, distinct from `REMINDER_CHANNEL_ID` (`constants.ts`), the channel's
 * opaque technical id. */
export function reminderChannelName(): string {
  return i18n.t('reminders.channel_name');
}
