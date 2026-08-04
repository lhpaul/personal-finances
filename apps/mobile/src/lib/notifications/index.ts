import { expoNotificationsAdapter } from './expo-notifications.adapter';
import type { NotificationsPort } from './types';

export type {
  IsoWeekday,
  NotificationsPort,
  PermissionState,
  ReminderRequest,
  ReminderTapEvent,
  ReminderTrigger,
} from './types';
export {
  createMemoryNotificationsPort,
  type FailableMethod,
  type MemoryNotificationsPort,
  type NotificationsCallLogEntry,
} from './testing/memory-notifications';

/**
 * The lazily-memoized real port accessor (implementation plan for issue #18, Layer-by-Layer →
 * new files) — `getNotificationsPort()` always returns the same `expoNotificationsAdapter`
 * instance, mirroring the single-implementer contract every other port in this codebase follows
 * (`SecureStorePort`'s one adapter). Every test uses `createMemoryNotificationsPort()` directly
 * instead of this function, so no test needs the real `expo-notifications` package installed to
 * pass.
 */
export function getNotificationsPort(): NotificationsPort {
  return expoNotificationsAdapter;
}
