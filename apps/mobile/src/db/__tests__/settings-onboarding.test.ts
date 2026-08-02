import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  readReminderSettings,
  setSetting,
} from '../repositories/settings';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/** Testing Strategy scenarios 3 and 7. */
describe('settings repository — onboarding accessors (Decision 5, Decision 8, AC5)', () => {
  it('a freshly bootstrapped store has not completed onboarding', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(isOnboardingCompleted(db)).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it('markOnboardingCompleted makes isOnboardingCompleted true, and is idempotent', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      markOnboardingCompleted(db);
      expect(isOnboardingCompleted(db)).toBe(true);

      markOnboardingCompleted(db); // calling twice must not throw or change the end state
      expect(isOnboardingCompleted(db)).toBe(true);
    } finally {
      sqlite.close();
    }
  });

  it('a malformed onboarding_completed value reads back as false, not throws', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'onboarding_completed', 'yes'); // wrong shape: string, not boolean
      expect(isOnboardingCompleted(db)).toBe(false);
    } finally {
      sqlite.close();
    }
  });
});

describe('settings repository — readReminderSettings (Decision 8 value-shape table)', () => {
  it('absent keys read back as disabled, with no time or days', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(readReminderSettings(db)).toEqual({ enabled: false, timeOfDay: undefined, days: undefined });
    } finally {
      sqlite.close();
    }
  });

  it('a malformed reminder_time and reminder_days each read back as undefined independently', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'reminder_enabled', true);
      setSetting(db, 'reminder_time', '9am'); // wrong shape
      setSetting(db, 'reminder_days', 'monday'); // wrong shape: not an array

      expect(readReminderSettings(db)).toEqual({ enabled: true, timeOfDay: undefined, days: undefined });
    } finally {
      sqlite.close();
    }
  });

  it('a valid, full record reads back exactly (9:00 AM · días laborales scenario)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'reminder_enabled', true);
      setSetting(db, 'reminder_time', '09:00');
      setSetting(db, 'reminder_days', [1, 2, 3, 4, 5]);

      expect(readReminderSettings(db)).toEqual({
        enabled: true,
        timeOfDay: '09:00',
        days: [1, 2, 3, 4, 5],
      });
    } finally {
      sqlite.close();
    }
  });

  it('a record missing reminder_time still reads reminder_days (partial record, "title only" row)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'reminder_enabled', true);
      setSetting(db, 'reminder_days', [6, 7]);

      expect(readReminderSettings(db)).toEqual({ enabled: true, timeOfDay: undefined, days: [6, 7] });
    } finally {
      sqlite.close();
    }
  });

  it('an out-of-range day (0 or 8) invalidates the whole reminder_days array rather than silently keeping a bad value', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'reminder_days', [0, 1, 2]);
      expect(readReminderSettings(db).days).toBeUndefined();

      setSetting(db, 'reminder_days', [1, 8]);
      expect(readReminderSettings(db).days).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
