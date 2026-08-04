import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { readReminderSettings } from '../../db/repositories/settings';
import { getAppDatabase } from '../../db/runtime';
import type { ReminderSettings } from '../../db/types';
import { getNotificationsPort } from '../../lib/notifications';
import { reminderChannelName, reminderContent } from './reminder-content';
import { saveReminders, type SaveRemindersInput, type SaveRemindersResult } from './save-reminders';

const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, timeOfDay: undefined, days: undefined };

export type ReminderSettingsStatus = 'loading' | 'ready';

export type SaveReminderSettingsInput = SaveRemindersInput['settings'];

export interface UseReminderSettingsResult {
  status: ReminderSettingsStatus;
  settings: ReminderSettings;
  saving: boolean;
  save: (next: SaveReminderSettingsInput) => Promise<SaveRemindersResult>;
}

/**
 * `{ status, settings, saving, save }` over `getAppDatabase()` + `readReminderSettings` +
 * `saveReminders` (implementation plan for issue #18, Layer-by-Layer). Cancellation-guarded (a
 * result arriving after unmount never calls `setState`) and re-entrancy-guarded: a second `save()`
 * call while one is already in flight returns the **same** promise rather than starting a second
 * write-and-schedule sequence (concurrency addendum item 2 — a double tap on **Guardar** or
 * **Continuar** can fire before the first `saveReminders` resolves). The underlying write is
 * idempotent regardless (`onConflictDoUpdate`), so this guard protects the *scheduling* sequence,
 * which is not naturally serialisable.
 */
export function useReminderSettings(): UseReminderSettingsResult {
  const port = useMemo(() => getNotificationsPort(), []);
  const [status, setStatus] = useState<ReminderSettingsStatus>('loading');
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef<Promise<SaveRemindersResult> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;

    getAppDatabase()
      .then((db) => {
        if (cancelledRef.current) return;
        setSettings(readReminderSettings(db));
        setStatus('ready');
      })
      .catch(() => {
        if (cancelledRef.current) return;
        setSettings(DEFAULT_SETTINGS);
        setStatus('ready');
      });

    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const save = useCallback(
    (next: SaveReminderSettingsInput): Promise<SaveRemindersResult> => {
      if (inFlightRef.current) return inFlightRef.current;

      setSaving(true);
      const attempt = (async (): Promise<SaveRemindersResult> => {
        const db = await getAppDatabase();
        const { title, body } = reminderContent();
        const result = await saveReminders({
          db,
          port,
          settings: next,
          content: { title, body, channelName: reminderChannelName() },
        });
        if (!cancelledRef.current) {
          if (result.status === 'ok') setSettings({ ...next, days: next.days });
          setSaving(false);
        }
        inFlightRef.current = null;
        return result;
      })().catch((error: unknown): SaveRemindersResult => {
        // `getAppDatabase()` itself can reject (a bootstrap failure) — outside `saveReminders`'
        // own internal guard. Without this catch the rejection would escape as an unhandled
        // rejection and leave `saving` stuck at `true` forever (mirrors
        // `use-wipe-local-data.ts`'s `attemptConfirmDelete` precedent).
        if (!cancelledRef.current) setSaving(false);
        inFlightRef.current = null;
        return { status: 'error' };
      });

      inFlightRef.current = attempt;
      return attempt;
    },
    [port],
  );

  return { status, settings, saving, save };
}
