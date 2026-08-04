/**
 * Implementation plan for issue #18, Testing Strategy → Residual verification strategy, item 4
 * (non-negotiable 8). Scans the three route files plus every reminders feature file that calls
 * `t(...)` with the existing `src/test-utils/catalogue-key-scan` helper, mirroring
 * `onboarding-catalogue-keys.test.ts`'s shape exactly.
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import { findTranslationKeys } from '../../../test-utils/catalogue-key-scan';

const ONBOARDING_APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', '(onboarding)');
const SETTINGS_APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', 'settings');
const FEATURE_ROOT = path.resolve(__dirname, '..');

const SCANNED_FILES = [
  path.join(ONBOARDING_APP_ROOT, 'notifications', 'index.tsx'),
  path.join(ONBOARDING_APP_ROOT, 'notifications', 'schedule.tsx'),
  path.join(SETTINGS_APP_ROOT, 'notifications.tsx'),
  path.join(FEATURE_ROOT, 'reminder-content.ts'),
  path.join(FEATURE_ROOT, 'components', 'SamplePushCard.tsx'),
  path.join(FEATURE_ROOT, 'components', 'TimePresetGrid.tsx'),
  path.join(FEATURE_ROOT, 'components', 'CustomTimeCard.tsx'),
  path.join(FEATURE_ROOT, 'components', 'DayCheckList.tsx'),
];

function scanAll(): { keys: string[]; dynamic: { file: string; line: number; column: number }[] } {
  const keys: string[] = [];
  const dynamic: { file: string; line: number; column: number }[] = [];

  for (const file of SCANNED_FILES) {
    const source = fs.readFileSync(file, 'utf8');
    const result = findTranslationKeys(source);
    keys.push(...result.keys);
    dynamic.push(...result.dynamic.map((finding) => ({ file: path.basename(file), ...finding })));
  }

  return { keys, dynamic };
}

describe('reminders screens catalogue keys (non-negotiable 8)', () => {
  it('every scanned file exists', () => {
    for (const file of SCANNED_FILES) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  const { keys, dynamic } = scanAll();
  const uniqueKeys = Array.from(new Set(keys));

  it('found call sites to check', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('uses no dynamic (non-literal) key anywhere in the reminders screens', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  const remindersScreenCatalogueKeys = Object.keys(es).filter(
    (key) =>
      key.startsWith('notifications_intro.') ||
      key.startsWith('notifications_schedule.') ||
      key.startsWith('settings_notifications.') ||
      key === 'reminders.notification_title' ||
      key === 'reminders.notification_body' ||
      key === 'reminders.channel_name',
  );

  it.each(remindersScreenCatalogueKeys)('catalogue key %s is used by a screen', (key) => {
    expect(uniqueKeys).toContain(key);
  });
});
