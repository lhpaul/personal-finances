/**
 * Compile-time key checking for `t('…')` calls (implementation plan Decision 5). `es.json` is
 * the source of truth for the key union — both catalogues carry the same key set, enforced at
 * runtime by `catalogue-parity.test.ts`.
 *
 * `keySeparator: false` must appear here **and** in the runtime `init()` call in `index.ts`, or
 * the inferred key type stops being flat.
 */
import 'i18next';

import type es from './es.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    keySeparator: false;
    resources: {
      translation: typeof es;
    };
  }
}
