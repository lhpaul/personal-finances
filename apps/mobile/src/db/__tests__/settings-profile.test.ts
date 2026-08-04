import { eq } from 'drizzle-orm';

import { readFirstLaunchAt, setSetting } from '../repositories/settings';
import { appSettings } from '../schema';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * Scenario 13 of the implementation plan for issue #19: `readFirstLaunchAt` returns the
 * bootstrap-written value, and `undefined` on a store where the key was removed or malformed.
 */
describe('readFirstLaunchAt (implementation plan for issue #19, Decision 15)', () => {
  it('returns the value bootstrap.ts writes on a fresh install', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const value = readFirstLaunchAt(db);
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      sqlite.close();
    }
  });

  it('returns undefined when the key has never been written (or was removed)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      db.delete(appSettings).where(eq(appSettings.key, 'first_launch_at')).run();
      expect(readFirstLaunchAt(db)).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('returns undefined for a malformed (non-string) value rather than throwing', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'first_launch_at', 12345);
      expect(readFirstLaunchAt(db)).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it('returns undefined for an empty string', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      setSetting(db, 'first_launch_at', '');
      expect(readFirstLaunchAt(db)).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
