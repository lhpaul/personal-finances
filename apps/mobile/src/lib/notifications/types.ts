/**
 * The device notifications contract this app depends on (implementation plan for issue #18,
 * Layer-by-Layer → Frontend/UI → new files). Deliberately minimal and no-token: there is no
 * `getExpoPushTokenAsync` here and never will be — this port is for **local** reminders only
 * (AGENTS.md, "there is no backend"; plan Decision 16).
 *
 * The only production implementer is `expo-notifications.adapter.ts`, and the only file allowed
 * to import `expo-notifications` at all (Decision 1, enforced by `notificationsBoundary` +
 * `notifications-boundary.test.ts`).
 */

/** Mirrors `expo-notifications`' `PermissionResponse.status` values, without leaking the
 * package's own type into every consumer (Decision 1). */
export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** ISO weekday: `1` = Monday … `7` = Sunday (item #8 Decision 8, adopted verbatim — plan
 * Cross-Cutting Operational Assumption Check). The adapter — and only the adapter — converts to
 * the platform's own `1 = Sunday … 7 = Saturday` numbering (Decision 4). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReminderTrigger =
  | { kind: 'weekly'; isoWeekday: IsoWeekday; hour: number; minute: number }
  | { kind: 'daily'; hour: number; minute: number };

export type ReminderRequest = {
  identifier: string;
  title: string;
  body: string;
  trigger: ReminderTrigger;
};

/** A person's interaction with a notification (a tap), reduced to the two fields
 * `use-reminder-tap-routing.ts` needs (Decision 15) — never the full platform payload, so the
 * hook cannot accidentally depend on a shape only `expo-notifications` defines. */
export type ReminderTapEvent = {
  identifier: string;
  /** Epoch milliseconds — used only for de-duplicating the same tap seen twice (once via
   * `getLastResponse()`, once via the listener that registers moments later), never displayed. */
  date: number;
};

/**
 * Every method returns a `Promise` — including `getPermission`/`listScheduledIdentifiers`, which
 * an in-memory test double can resolve synchronously-wrapped — so a caller never has to branch on
 * "is this the real adapter or the memory double" (Decision 1, mirrors `SecureStorePort`).
 *
 * No "cancel all" method: `applyReminderSchedule` (Decision 2) owns the cancel-then-schedule
 * sequence and only ever cancels identifiers it recognises as its own
 * (`REMINDER_ID_PREFIX`-prefixed) — a port-level "cancel everything" would make it too easy for a
 * future caller to delete a notification this app does not own.
 */
export interface NotificationsPort {
  getPermission(): Promise<PermissionState>;
  /** The **only** sanctioned caller is `use-notification-permission.ts` (Decision 7) — asserted by
   * `notifications-boundary.test.ts`, not just documented here. */
  requestPermission(): Promise<PermissionState>;
  listScheduledIdentifiers(): Promise<string[]>;
  schedule(request: ReminderRequest): Promise<void>;
  cancel(identifier: string): Promise<void>;
  /** Idempotent — safe to call before every `schedule()` (Decision 13). A no-op on iOS. */
  prepareChannel(name: string): Promise<void>;
  /** Deep-links to the OS settings page for this app (the `disabled` note's "Abrir ajustes del
   * teléfono", Decision 11). Delegates to `expo-linking`'s `openSettings()` in the real adapter. */
  openSystemSettings(): Promise<void>;
  /** Registers a listener fired when the person taps a notification while the app is running (a
   * warm tap, Decision 15). Returns an unsubscribe function — the **only** sanctioned caller is
   * `use-reminder-tap-routing.ts`, which removes it in its effect cleanup. */
  addResponseListener(listener: (event: ReminderTapEvent) => void): () => void;
  /** The most recently received tap, if the app was opened by one (a cold start, Decision 15) —
   * `null` if none. Read once, on mount, in addition to the listener above. */
  getLastResponse(): Promise<ReminderTapEvent | null>;
}
