/** Scenario 4 of the implementation plan's Testing Strategy (AC2, Decision 1). Boots the real
 * i18next runtime from `index.ts` and resolves a known flat key in `es`, then in `en` after
 * `setLocale('en')`. This is the regression control for `keySeparator: false`: a nested-lookup
 * regression would return the raw key string instead of the resolved value. */
import es from '../es.json';
import en from '../en.json';
import type { setLocale as SetLocale } from '../index';
import type i18nType from 'i18next';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'es' }]),
}));

describe('i18next runtime init (scenario 4, Decision 1)', () => {
  beforeEach(() => {
    // Each test needs its own i18next instance — index.ts initialises at module load, so the
    // module registry must be reset before every `require` to avoid one test's setLocale()
    // call leaking into the next. `require`, not a dynamic `import()`, because this test suite
    // runs under Jest's CommonJS transform (no --experimental-vm-modules).
    jest.resetModules();
  });

  it('resolves a known flat key in es, and the same key in en after setLocale', async () => {
    // Needs a fresh module instance per test (see the beforeEach comment above); a dynamic
    // import() throws under Jest's CommonJS transform.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../index') as { default: typeof i18nType; setLocale: typeof SetLocale };
    const { default: i18n, setLocale } = mod;

    expect(i18n.t('ds.gallery.title')).toBe(es['ds.gallery.title']);
    // A nested-lookup regression (default keySeparator) would return the key itself.
    expect(i18n.t('ds.gallery.title')).not.toBe('ds.gallery.title');

    await setLocale('en');
    expect(i18n.t('ds.gallery.title')).toBe(en['ds.gallery.title']);
  });

  it('resolves an interpolated key', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see the previous test
    const mod = require('../index') as { default: typeof i18nType };
    const { default: i18n } = mod;
    expect(i18n.t('dev.placeholder.route', { route: '/settings' })).toContain('/settings');
  });
});
