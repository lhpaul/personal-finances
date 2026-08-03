/**
 * Home-screen implementation plan (issue #12), Residual verification strategy — mirrors
 * `onboarding-catalogue-keys.test.ts`'s control (non-negotiable 8). Scans the home route and
 * every home feature component with the existing `catalogue-key-scan` helper.
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import { findTranslationKeys } from '../../../test-utils/catalogue-key-scan';

const APP_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'app', '(tabs)');
const COMPONENTS_ROOT = path.resolve(__dirname, '..', 'components');

const SCANNED_FILES = [
  path.join(APP_ROOT, 'home.tsx'),
  path.join(COMPONENTS_ROOT, 'ChallengeHero.tsx'),
  path.join(COMPONENTS_ROOT, 'AllClearHero.tsx'),
  path.join(COMPONENTS_ROOT, 'SyncErrorNote.tsx'),
  path.join(COMPONENTS_ROOT, 'FirstSyncEmptyState.tsx'),
  path.join(COMPONENTS_ROOT, 'FinancialSummaryCard.tsx'),
  path.join(COMPONENTS_ROOT, 'TrendCard.tsx'),
  path.join(COMPONENTS_ROOT, 'CategoryBreakdownCard.tsx'),
  path.join(COMPONENTS_ROOT, 'RecentMovementsSection.tsx'),
  path.join(COMPONENTS_ROOT, 'ConnectedBanksCard.tsx'),
];

function scanAll(): { keys: string[]; dynamic: { file: string; line: number; column: number }[] } {
  const keys: string[] = [];
  const dynamic: { file: string; line: number; column: number }[] = [];

  for (const file of SCANNED_FILES) {
    // `scanAll()` runs during Jest's collection phase, before any `it` runs — a missing file
    // would otherwise throw from `readFileSync` and fail the whole suite silently, hiding the
    // dedicated "every scanned file exists" assertion's diagnostic (found in review).
    if (!fs.existsSync(file)) {
      throw new Error(`Scanned home file is missing: ${file}. Update SCANNED_FILES.`);
    }
    const source = fs.readFileSync(file, 'utf8');
    const result = findTranslationKeys(source);
    keys.push(...result.keys);
    dynamic.push(...result.dynamic.map((finding) => ({ file: path.basename(file), ...finding })));
  }

  return { keys, dynamic };
}

describe('home screen catalogue keys (non-negotiable 8)', () => {
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

  it('uses no dynamic (non-literal) key anywhere on the home screen', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  const homeCatalogueKeys = Object.keys(es).filter((key) => key.startsWith('home.'));

  it.each(homeCatalogueKeys)('home catalogue key %s is used by the screen', (key) => {
    expect(uniqueKeys).toContain(key);
  });
});
