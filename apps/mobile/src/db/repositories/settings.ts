import { eq } from 'drizzle-orm';

import { parseSettingValue, serializeSettingValue } from '../json';
import { appSettings } from '../schema';
import type { AppDatabase } from '../types';

/** `app_settings` is a key-value table (data model, spec Seed Data Contract → Settings keys).
 * Every value is JSON-encoded on write and parsed back through the guard on read. */

export function getSetting(db: AppDatabase, key: string): unknown {
  const row = db.select().from(appSettings).where(eq(appSettings.key, key)).get() as
    | { value: string }
    | undefined;
  if (!row) return undefined;
  return parseSettingValue(row.value);
}

export function setSetting(db: AppDatabase, key: string, value: unknown): void {
  const serialized = serializeSettingValue(value);
  db.insert(appSettings)
    .values({ key, value: serialized })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: serialized } })
    .run();
}
