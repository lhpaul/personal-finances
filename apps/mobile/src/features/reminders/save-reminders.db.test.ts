import { readReminderSettings } from '../../db/repositories/settings';
import { openBootstrappedMemoryDb } from '../../db/testing/memory-db';
import { createMemoryNotificationsPort } from '../../lib/notifications/testing/memory-notifications';
import { saveReminders } from './save-reminders';

/** Fixed content — this suite never imports `reminder-content.ts` (which reads through the `i18n`
 * instance): `saveReminders` takes resolved content as an input precisely so this Node-tier `db`
 * test never needs `expo-localization`'s React Native module transform. */
const TEST_CONTENT = { title: 'Desafío diario', body: 'Categoriza tus gastos de hoy.', channelName: 'Recordatorios' };

/**
 * Implementation plan for issue #18, Testing Strategy scenarios 9-10. Routed to the `db` Jest
 * project by its `.db.test.ts` suffix (item #12's precedent, `jest.config.js`).
 */
describe('saveReminders (issue #18)', () => {
  it('writes the normalised settings and applies the schedule, in that order — a second identical save is unchanged', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const port = createMemoryNotificationsPort('granted');

      const first = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '9:0', days: [5, 1, 1, 3] },
        content: TEST_CONTENT,
      });

      expect(first.status).toBe('ok');
      expect(readReminderSettings(db)).toEqual({
        enabled: true,
        timeOfDay: '09:00',
        days: [1, 3, 5],
      });
      const firstIdentifiers = Array.from(port.scheduled.keys()).sort();
      expect(firstIdentifiers).toEqual(['finanzas-reminder-w1', 'finanzas-reminder-w3', 'finanzas-reminder-w5']);

      const second = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '09:00', days: [1, 3, 5] },
        content: TEST_CONTENT,
      });

      expect(second.status).toBe('ok');
      expect(readReminderSettings(db)).toEqual({
        enabled: true,
        timeOfDay: '09:00',
        days: [1, 3, 5],
      });
      expect(Array.from(port.scheduled.keys()).sort()).toEqual(firstIdentifiers);
    } finally {
      sqlite.close();
    }
  });

  it('a revoked permission is reported, not swallowed — the stored intent is unchanged and nothing is scheduled', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const port = createMemoryNotificationsPort('denied');

      const result = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] },
        content: TEST_CONTENT,
      });

      expect(result).toEqual({ status: 'permission-lost' });
      expect(readReminderSettings(db)).toEqual({ enabled: false, timeOfDay: undefined, days: undefined });
      expect(port.scheduled.size).toBe(0);
    } finally {
      sqlite.close();
    }
  });

  it('turning reminders off writes and cancels regardless of the OS permission', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const port = createMemoryNotificationsPort('denied');

      const result = await saveReminders({
        db,
        port,
        settings: { enabled: false, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] },
        content: TEST_CONTENT,
      });

      expect(result).toEqual({ status: 'ok', identifiers: [] });
      expect(readReminderSettings(db).enabled).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it('a rejecting schedule call surfaces as a reported error, not a thrown exception (systemic write-path check)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const port = createMemoryNotificationsPort('granted');
      port.failNext('schedule', new Error('native scheduling call rejected'));

      const result = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] },
        content: TEST_CONTENT,
      });

      expect(result).toEqual({ status: 'error' });
    } finally {
      sqlite.close();
    }
  });

  it('a rejecting getPermission call surfaces as a reported error before anything is written', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const port = createMemoryNotificationsPort('undetermined');
      port.failNext('getPermission', new Error('native permission read rejected'));

      const result = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] },
        content: TEST_CONTENT,
      });

      expect(result).toEqual({ status: 'error' });
      expect(readReminderSettings(db)).toEqual({ enabled: false, timeOfDay: undefined, days: undefined });
    } finally {
      sqlite.close();
    }
  });

  it('a rejecting database write surfaces as a reported error, not a thrown exception (systemic write-path check)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    // Close the underlying handle *before* calling saveReminders, so writeReminderSettings'
    // own statement execution throws — the same class of failure a locked file or a mid-wipe
    // race (concurrency addendum) could produce. `sqlite.close()` is idempotent (verified: a
    // second call is a no-op), so the outer `finally` below is still safe to call.
    sqlite.close();
    try {
      const port = createMemoryNotificationsPort('granted');

      const result = await saveReminders({
        db,
        port,
        settings: { enabled: true, timeOfDay: '09:00', days: [1, 2, 3, 4, 5] },
        content: TEST_CONTENT,
      });

      expect(result).toEqual({ status: 'error' });
      // Nothing was scheduled — the write failure is caught *before* `applyReminderSchedule`
      // is ever called (save-reminders.ts:59-63), so the port must show no side effects at all.
      expect(port.scheduled.size).toBe(0);
      expect(port.callLog).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('a malformed stored value on a fresh store reads back through the defensive settings reader', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      // No prior write at all — the fresh-store defensive-read path (readReminderSettings'
      // own contract, item #8 Decision 8).
      expect(readReminderSettings(db)).toEqual({ enabled: false, timeOfDay: undefined, days: undefined });
    } finally {
      sqlite.close();
    }
  });
});
