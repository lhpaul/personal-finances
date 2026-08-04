/**
 * Implementation plan Testing Strategy → Residual verification strategy, item 2 (non-negotiable
 * 8). Scans the three onboarding route files and the onboarding feature components with the
 * existing `src/test-utils/catalogue-key-scan` helper — the same control
 * `gallery-catalogue-keys.test.ts` applies to the design-system gallery.
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import { findTranslationKeys } from '../../../test-utils/catalogue-key-scan';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', '(onboarding)');
const FEATURE_ROOT = path.resolve(__dirname, '..');
const REMINDERS_FEATURE_ROOT = path.resolve(__dirname, '..', '..', 'reminders');

const SCANNED_FILES = [
  path.join(APP_ROOT, 'intro.tsx'),
  path.join(APP_ROOT, 'value.tsx'),
  path.join(APP_ROOT, 'ready.tsx'),
  path.join(FEATURE_ROOT, 'components', 'ValueStepPage.tsx'),
  path.join(FEATURE_ROOT, 'components', 'ReadySummaryRow.tsx'),
  // Implementation plan for issue #18: `reminder-content.ts` reads the three
  // `reminders.notification_title` / `notification_body` / `channel_name` keys through the `i18n`
  // instance directly (Decision 12) — not from any onboarding screen. Without this file in the
  // scan, this suite's own "every reminders.* key is used by a screen" assertion below would fail
  // for those three keys the moment item #18 adds them, even though they are genuinely used.
  path.join(REMINDERS_FEATURE_ROOT, 'reminder-content.ts'),
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

describe('onboarding screens catalogue keys (non-negotiable 8)', () => {
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

  it('uses no dynamic (non-literal) key anywhere in the onboarding screens', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    // Not `toHaveProperty(key)` — these keys are flat strings that themselves contain literal
    // dots (`keySeparator: false`), and `toHaveProperty` treats a dotted string as a nested path.
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  const onboardingCatalogueKeys = Object.keys(es).filter(
    (key) => key.startsWith('onboarding_intro.') || key.startsWith('onboarding_value.') || key.startsWith('onboarding_ready.'),
  );

  it.each(onboardingCatalogueKeys)('onboarding catalogue key %s is used by a screen', (key) => {
    expect(uniqueKeys).toContain(key);
  });

  const reminderCatalogueKeys = Object.keys(es).filter((key) => key.startsWith('reminders.'));

  it.each(reminderCatalogueKeys)('reminders catalogue key %s is used by a screen', (key) => {
    expect(uniqueKeys).toContain(key);
  });
});
