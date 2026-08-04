import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { getNotificationsPort, type ReminderTapEvent } from '../../lib/notifications';
import { REMINDER_ID_PREFIX } from './constants';

/**
 * `useReminderTapRouting()` (implementation plan for issue #18, Decision 15) — registered once
 * from `app/_layout.tsx`. A tap routes to `/categorize/intro` only when: the tapped identifier is
 * one this app scheduled (`REMINDER_ID_PREFIX`), the tap has not already been handled (cold-start
 * de-duplication, concurrency addendum), and the person is not currently inside onboarding.
 *
 * Expo Router strips group segments from `usePathname()` (Decision 18 point 2), so onboarding
 * pathnames have no common `/(onboarding)` prefix to match against — this is the exhaustive list
 * of the ten onboarding route pathnames as they actually resolve.
 */
const ONBOARDING_PATHNAMES = new Set<string>([
  '/intro',
  '/value',
  '/connect-bank',
  '/bank-picker',
  '/bank-credentials',
  '/bank-syncing',
  '/bank-connected',
  '/notifications',
  '/notifications/schedule',
  '/ready',
]);

const REMINDER_TAP_DESTINATION = '/categorize/intro';

export interface HandleReminderTapDeps {
  event: ReminderTapEvent;
  pathname: string;
  hasHandled: (event: ReminderTapEvent) => boolean;
  markHandled: (event: ReminderTapEvent) => void;
  navigate: () => void;
}

/**
 * The pure decision extracted from the hook (mirrors `use-wipe-local-data.ts`'s
 * `attemptConfirmDelete` precedent) — testable with no renderer. Returns nothing; every effect is
 * expressed through the injected `hasHandled` / `markHandled` / `navigate` callbacks so a test can
 * assert both "did it navigate" and "did it mark the event handled" independently.
 */
export function handleReminderTap(deps: HandleReminderTapDeps): void {
  if (!deps.event.identifier.startsWith(REMINDER_ID_PREFIX)) return;
  if (deps.hasHandled(deps.event)) return;
  deps.markHandled(deps.event);
  if (ONBOARDING_PATHNAMES.has(deps.pathname)) return;
  deps.navigate();
}

export function useReminderTapRouting(): void {
  const port = getNotificationsPort();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const handledRef = useRef<{ identifier: string; date: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const dispatch = (event: ReminderTapEvent) => {
      handleReminderTap({
        event,
        pathname: pathnameRef.current,
        hasHandled: (candidate) =>
          handledRef.current !== null &&
          handledRef.current.identifier === candidate.identifier &&
          handledRef.current.date === candidate.date,
        markHandled: (candidate) => {
          handledRef.current = candidate;
        },
        navigate: () => router.replace(REMINDER_TAP_DESTINATION),
      });
    };

    const unsubscribe = port.addResponseListener(dispatch);

    port
      .getLastResponse()
      .then((event) => {
        if (cancelled || !event) return;
        dispatch(event);
      })
      .catch(() => {
        // A failing cold-start read must not crash the root layout — the warm-tap listener above
        // still works independently of this promise's outcome.
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // `port` is a stable module-level singleton and `router` is expo-router's own stable object,
    // so listing them here does not cause the effect to re-run in practice — `pathname` is
    // deliberately read through `pathnameRef` instead of being listed, so a navigation does not
    // tear down and re-create the listener on every route change.
  }, [port, router]);
}
