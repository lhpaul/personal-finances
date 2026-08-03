/**
 * Implementation plan Testing Strategy → Residual verification strategy (AC29). Scans the four
 * connect-bank route files and every feature component under `src/features/connect-bank/` with
 * the existing `src/test-utils/catalogue-key-scan` helper — the same control
 * `onboarding-catalogue-keys.test.ts` applies to the onboarding screens.
 */
import fs from 'node:fs';
import path from 'node:path';

import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { findTranslationKeys } from '../test-utils/catalogue-key-scan';

const APP_ROOT = path.resolve(__dirname, '..', '..', 'app', '(onboarding)');
const FEATURE_ROOT = path.resolve(__dirname, '..', 'features', 'connect-bank');

const SCANNED_FILES = [
  path.join(APP_ROOT, 'connect-bank.tsx'),
  path.join(APP_ROOT, 'bank-picker.tsx'),
  path.join(APP_ROOT, 'bank-credentials.tsx'),
  path.join(APP_ROOT, 'bank-connected.tsx'),
  path.join(FEATURE_ROOT, 'components', 'SecurityAccordion.tsx'),
  path.join(FEATURE_ROOT, 'components', 'BankPickerResults.tsx'),
  path.join(FEATURE_ROOT, 'components', 'CredentialForm.tsx'),
  path.join(FEATURE_ROOT, 'components', 'ConnectedBankSummaryList.tsx'),
];

/** Keys passed to `t(key, { count })` — the scanner extracts the bare literal (`t()`'s first
 * argument), but the catalogue itself only carries the i18next-suffixed `_one`/`_other` pair
 * (Assumption A4). These are checked against the suffixed variants instead of the bare key. */
const PLURAL_BASE_KEYS = new Set([
  'connect_picker.result_count',
  'connect_connected.products_count',
  'connect_connected.movements_count',
]);

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

describe('connect-bank screens catalogue keys (non-negotiable 8, AC29)', () => {
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

  it('uses no dynamic (non-literal) key anywhere in the connect-bank screens', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue (or its _one/_other plural pair)', (key) => {
    if (PLURAL_BASE_KEYS.has(key)) {
      expect(Object.prototype.hasOwnProperty.call(es, `${key}_one`)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(es, `${key}_other`)).toBe(true);
      return;
    }
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  it.each(uniqueKeys)('t(%s) exists in the en catalogue (or its _one/_other plural pair)', (key) => {
    if (PLURAL_BASE_KEYS.has(key)) {
      expect(Object.prototype.hasOwnProperty.call(en, `${key}_one`)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(en, `${key}_other`)).toBe(true);
      return;
    }
    expect(Object.prototype.hasOwnProperty.call(en, key)).toBe(true);
  });

  const connectCatalogueKeys = Object.keys(es).filter(
    (key) =>
      key.startsWith('connect_intro.') ||
      key.startsWith('connect_picker.') ||
      key.startsWith('connect_credentials.') ||
      key.startsWith('connect_connected.'),
  );

  it.each(connectCatalogueKeys)('connect catalogue key %s is used by a screen (or its plural base is)', (key) => {
    const pluralBase = key.replace(/_(one|other)$/, '');
    if (PLURAL_BASE_KEYS.has(pluralBase)) {
      expect(uniqueKeys).toContain(pluralBase);
      return;
    }
    expect(uniqueKeys).toContain(key);
  });
});
