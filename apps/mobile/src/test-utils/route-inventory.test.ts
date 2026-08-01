import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listRouteFiles, toRoutePath } from './route-inventory';

describe('toRoutePath', () => {
  it.each<[string, string | null, string]>([
    ['dashboard.tsx', '/dashboard', 'plain top-level route'],
    ['(tabs)/home.tsx', '/(tabs)/home', 'group parentheses preserved, not stripped'],
    [
      '(onboarding)/notifications/index.tsx',
      '/(onboarding)/notifications',
      'index collapses to its parent directory',
    ],
    ['categorize/index.tsx', '/categorize', 'index collapse next to sibling non-index routes'],
    [
      'categorize/merchant/[merchantId].tsx',
      '/categorize/merchant/[merchantId]',
      'dynamic segment preserved character-for-character',
    ],
    ['settings/banks/[bankId].tsx', '/settings/banks/[bankId]', 'nested dynamic segment'],
    ['_layout.tsx', null, 'layout files are not destinations'],
    ['(tabs)/_layout.tsx', null, 'layout inside a group'],
    ['index.tsx', null, 'entry shim, excluded by Decision 7'],
    ['settings/_shared.ts', null, 'leading-underscore non-route file'],
    [
      '+not-found.tsx',
      null,
      'Expo special file; must not be counted as a manifest route even if a later item adds it',
    ],
    ['dashboard.test.tsx', null, 'negative case: a test file whose name resembles a route'],
    ['dashboard.tsx.bak', null, 'negative case: only .tsx/.ts route extensions count'],
    [
      'Settings/about.tsx',
      '/Settings/about',
      'guard against accidental case folding hiding a real mismatch',
    ],
    [
      'settings//about.tsx',
      '/settings/about',
      'separator normalisation so a path-join artefact cannot fail parity spuriously',
    ],
  ])('%s -> %s (%s)', (input, expected) => {
    expect(toRoutePath(input)).toBe(expected);
  });
});

describe('listRouteFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'route-inventory-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recurses into nested directories', () => {
    fs.writeFileSync(path.join(tmpDir, 'dashboard.tsx'), '');
    fs.mkdirSync(path.join(tmpDir, '(tabs)'));
    fs.writeFileSync(path.join(tmpDir, '(tabs)', 'home.tsx'), '');
    fs.mkdirSync(path.join(tmpDir, 'categorize', 'merchant'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'categorize', 'merchant', '[merchantId].tsx'), '');

    const files = listRouteFiles(tmpDir).sort();

    expect(files).toEqual(
      ['(tabs)/home.tsx', 'categorize/merchant/[merchantId].tsx', 'dashboard.tsx'].sort(),
    );
  });

  it('returns paths with / separators regardless of platform', () => {
    fs.mkdirSync(path.join(tmpDir, 'settings', 'banks'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'settings', 'banks', 'index.tsx'), '');

    const [onlyFile] = listRouteFiles(tmpDir);

    expect(onlyFile).toBe('settings/banks/index.tsx');
    expect(onlyFile).not.toContain('\\');
  });
});
