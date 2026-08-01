import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getMvpRoutes, getOutOfMvpScreens, loadMockupManifest } from '../test-utils/mockup-manifest';
import { listRouteFiles, toRoutePath } from '../test-utils/route-inventory';

const APP_DIR = path.resolve(__dirname, '..', '..', 'app');
const MANIFEST_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'design',
  'mockups',
  'mobile',
  'mockup-manifest.js',
);

function derivedRoutes(): string[] {
  return listRouteFiles(APP_DIR)
    .map(toRoutePath)
    .filter((route): route is string => route !== null);
}

describe('route / manifest parity (AC5, AC6, AC14, Business Rule 3)', () => {
  it('loadMockupManifest throws a descriptive error when window.__MOCKUP_MANIFEST__ is undefined', () => {
    const tmpFile = path.join(os.tmpdir(), `empty-manifest-${Date.now()}.js`);
    fs.writeFileSync(tmpFile, 'window.somethingElse = {};');

    try {
      expect(() => loadMockupManifest(tmpFile)).toThrow(/__MOCKUP_MANIFEST__/);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  const manifest = loadMockupManifest(MANIFEST_PATH);
  const mvpRoutes = getMvpRoutes(manifest);

  it('the manifest yields exactly 25 MVP routes before the set comparison runs', () => {
    expect(mvpRoutes).toHaveLength(25);
  });

  it('the derived route-file set equals the manifest MVP route set exactly (AC5)', () => {
    const derived = derivedRoutes();

    // Set equality, not just a count match — two different route strings could still
    // produce the same count.
    expect(new Set(derived)).toEqual(new Set(mvpRoutes));
    expect(derived).toHaveLength(mvpRoutes.length);
  });

  it('no route exists for any of the eight out-of-MVP manifest screens (AC6)', () => {
    const outOfMvpScreens = getOutOfMvpScreens(manifest);
    const outOfMvpScreenIds = outOfMvpScreens.map((screen) => screen.screen_id);

    expect(outOfMvpScreenIds.sort()).toEqual(
      [
        'auth',
        'verify-code',
        'budgets',
        'budget-create',
        'planning',
        'planning-life',
        'benefits',
        'benefit-category',
      ].sort(),
    );

    const derived = new Set(derivedRoutes());
    for (const screen of outOfMvpScreens) {
      expect(derived.has(screen.route)).toBe(false);
    }
  });

  it('no design-system reference route exists (AC6)', () => {
    const derived = derivedRoutes();
    expect(derived.some((route) => route.includes('design-system'))).toBe(false);
  });

  it('no (auth) route group exists anywhere in the app (AC14)', () => {
    const files = listRouteFiles(APP_DIR);
    expect(files.some((file) => file.includes('(auth)'))).toBe(false);
  });

  it('the (tabs) group renders exactly two route files: home and transactions (AC14)', () => {
    const tabFiles = listRouteFiles(APP_DIR)
      .filter((file) => file.startsWith('(tabs)/'))
      .filter((file) => !file.endsWith('_layout.tsx'))
      .sort();

    expect(tabFiles).toEqual(['(tabs)/home.tsx', '(tabs)/transactions.tsx']);
  });
});
