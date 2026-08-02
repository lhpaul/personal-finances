/** Scenario 6 of the implementation plan's Testing Strategy (AC4, Decision 11). Because
 * `@testing-library/react-native` is not installed (Decision 11), this is the actual AC4
 * control — `eslint-plugin-i18next`'s `jsx-text-only` mode cannot see attribute copy (Decision
 * 6), so it cannot by itself prove the gallery renders entirely from catalogue keys. */
import fs from 'node:fs';
import path from 'node:path';

import es from '../i18n/es.json';
import { findTranslationKeys } from '../test-utils/catalogue-key-scan';

const GALLERY_PATH = path.resolve(__dirname, '..', 'dev', 'DesignSystemGallery.tsx');

describe('DesignSystemGallery catalogue keys (AC4)', () => {
  const source = fs.readFileSync(GALLERY_PATH, 'utf8');
  const { keys, dynamic } = findTranslationKeys(source);
  const uniqueKeys = Array.from(new Set(keys));
  const catalogueKeys = Object.keys(es).filter((key) => key.startsWith('ds.'));

  it('found call sites to check', () => {
    expect(keys.length).toBeGreaterThan(0);
  });

  it('uses no dynamic (non-literal) key', () => {
    expect(dynamic).toEqual([]);
  });

  it.each(uniqueKeys)('t(%s) exists in the es catalogue', (key) => {
    // Not `toHaveProperty(key)` — these keys are flat strings that themselves contain literal
    // dots (`keySeparator: false`), and `toHaveProperty` treats a dotted string as a nested
    // path, not a single key.
    expect(Object.prototype.hasOwnProperty.call(es, key)).toBe(true);
  });

  it.each(catalogueKeys)('ds.* catalogue key %s is used by the gallery', (key) => {
    expect(uniqueKeys).toContain(key);
  });

  it('imports no gallery.strings module', () => {
    expect(source).not.toMatch(/gallery\.strings/);
  });

  it('imports useTranslation from react-i18next', () => {
    expect(source).toMatch(/import\s*\{\s*useTranslation\s*\}\s*from\s*'react-i18next'/);
  });
});
