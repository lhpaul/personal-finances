import { useEffect, useState } from 'react';

import { getConnectedBanksSummary } from '../../db/repositories/connections';
import { readReminderSettings } from '../../db/repositories/settings';
import { getAppDatabase } from '../../db/runtime';
import type { ConnectedBanksSummary, ReminderSettings } from '../../db/types';

export type OnboardingSummary =
  | { status: 'pending' }
  | { status: 'ready'; banks: ConnectedBanksSummary; reminders: ReminderSettings };

const EMPTY_BANKS: ConnectedBanksSummary = { connectionCount: 0, institutionNames: [], productCount: 0 };
const DISABLED_REMINDERS: ReminderSettings = { enabled: false, timeOfDay: undefined, days: undefined };

/**
 * `onboarding-ready`'s data source (implementation plan Layer-by-Layer). Reads through
 * `getConnectedBanksSummary` and `readReminderSettings` — never through Drizzle directly
 * (`dbAccessBoundary`).
 *
 * Does **not** re-throw on failure (unlike `useLaunchDecision`): a failed summary read degrades
 * to "no rows" rather than making the whole ready screen unreachable over a cosmetic query
 * (concurrent-event-source addendum, "Error propagation across async boundaries").
 */
export function useOnboardingSummary(): OnboardingSummary {
  const [state, setState] = useState<OnboardingSummary>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;

    getAppDatabase()
      .then((db) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          banks: getConnectedBanksSummary(db),
          reminders: readReminderSettings(db),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: 'ready', banks: EMPTY_BANKS, reminders: DISABLED_REMINDERS });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
