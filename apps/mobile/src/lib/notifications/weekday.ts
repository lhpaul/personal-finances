import type { IsoWeekday } from './types';

/**
 * ISO `1` = Monday … `7` = Sunday  →  platform `1` = Sunday … `7` = Saturday (implementation plan
 * for issue #18, Decision 4). Extracted into its own side-effect-free module — rather than left
 * private inside `expo-notifications.adapter.ts` — so `adapter-weekday-mapping.test.ts` can import
 * it without loading `expo-notifications` at all (that module's own import would trigger the
 * adapter's `setNotificationHandler` side effect at module scope, which needs a real or mocked
 * native module this pure conversion has nothing to do with).
 */
export function toPlatformWeekday(iso: IsoWeekday): number {
  return (iso % 7) + 1;
}
