import { addDays, deriveDateLocal, formatTimeOfDay } from '@finanzas/shared-utils';

/**
 * The discriminated shape a `BankRow` sub-label or the `sync-error` note renders through i18n
 * keys — no Spanish string is built here (implementation plan Assumption A11, Decision "no
 * hard-coded copy in TypeScript"). `describeSyncTime` never calls `Date.now()` — the instant is
 * always passed in (mirroring `@finanzas/shared-utils`'s own no-host-clock-read discipline).
 */
export type SyncTimeDescriptor =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hours'; hours: number }
  | { kind: 'yesterday'; timeOfDay: string }
  | { kind: 'date'; dateLocal: string };

const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Classifies how long ago `isoInstant` was, relative to `now` (Assumption A11). "hours" applies
 * only within the same **local** calendar day as `now` — an event from a different calendar day
 * is "yesterday" or "date" instead, even if fewer than 24 raw hours have elapsed. Stable across
 * the Santiago DST transition because the elapsed-time tiers are computed from the raw
 * millisecond difference between two absolute instants (never from wall-clock subtraction), and
 * the day-boundary comparison goes through `deriveDateLocal` (`Intl`-backed, DST-aware) rather
 * than a fixed 24-hour cutoff.
 */
export function describeSyncTime(now: Date, isoInstant: string): SyncTimeDescriptor {
  const then = new Date(isoInstant);
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - then.getTime()) / MILLISECONDS_PER_MINUTE),
  );

  const nowDateLocal = deriveDateLocal(now);
  const thenDateLocal = deriveDateLocal(then);

  if (elapsedMinutes < MINUTES_PER_HOUR) {
    return { kind: 'minutes', minutes: elapsedMinutes };
  }
  if (thenDateLocal === nowDateLocal) {
    return { kind: 'hours', hours: Math.floor(elapsedMinutes / MINUTES_PER_HOUR) };
  }
  if (thenDateLocal === addDays(nowDateLocal, -1)) {
    return { kind: 'yesterday', timeOfDay: formatTimeOfDay(then) };
  }
  return { kind: 'date', dateLocal: thenDateLocal };
}
