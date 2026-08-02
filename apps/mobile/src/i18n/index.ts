/**
 * i18next runtime, initialised once at module load (implementation plan Decision 3). Imported
 * for its side effect as the first import of `apps/mobile/app/_layout.tsx`, so the runtime is
 * configured before any `useTranslation()` call in any route, including the `__DEV__`-only
 * design-system gallery.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';
import { resolveDeviceLocale, type SupportedLocale } from './locale';

// `i18n.use`/`i18n.changeLanguage` (member access on the default export), not the named
// `use`/`changeLanguage` re-exports i18next also offers: `eslint-plugin-react-hooks` treats a
// bare `use(...)` call as a React Hook by its naming convention and errors on it being called
// at module scope, which a named import of i18next's `use` would trigger here.
void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: resolveDeviceLocale(),
  fallbackLng: 'es',
  // Flat keys (`"ds.section.buttons"`) are single dotted strings, not nested objects — the
  // default `'.'` keySeparator would otherwise walk into a non-existent nested path and
  // silently return the key itself instead of the translation (Decision 1).
  keySeparator: false,
  interpolation: {
    // React already escapes interpolated values.
    escapeValue: false,
  },
  react: {
    // Resources are bundled synchronously above, so there is nothing to suspend on.
    useSuspense: false,
  },
});

export default i18n;

/**
 * Switches the active locale. Returns the underlying `i18next` promise so callers can await
 * the switch. Does not persist the choice — there is no language-selection surface in the MVP,
 * and persistence would need `app_settings`, which belongs to item #3.
 */
export function setLocale(locale: SupportedLocale): Promise<unknown> {
  return i18n.changeLanguage(locale);
}
