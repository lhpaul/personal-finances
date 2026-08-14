import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';
import { resolveDeviceLocale } from './locale';

// `i18n.use` (member access on the default export), not the named `use` re-export: a bare
// `use(...)` call is treated as a React Hook and would error at module scope.
void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: resolveDeviceLocale(),
  fallbackLng: 'es',
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
