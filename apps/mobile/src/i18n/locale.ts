/**
 * Device-locale mapping, kept free of any i18next import so it is unit-testable without
 * booting the i18n runtime and without mocking i18next (implementation plan Decision 2).
 *
 * `index.ts` imports this module; this module never imports `index.ts`.
 */
import { getLocales } from 'expo-localization';

export const SUPPORTED_LOCALES = ['es', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** `es` (es-CL) is the primary, production locale — `i18n.md`, "Locales and fallbacks". */
export const DEFAULT_LOCALE: SupportedLocale = 'es';

/**
 * Maps any BCP-47 language code (or nothing) onto a supported locale. Case-insensitive and
 * tolerant of a region tag (`en-US` → `en`), because `expo-localization`'s `languageCode` is
 * documented to return the bare language subtag but platform behaviour varies. Anything
 * unresolved — empty string, `null`, `undefined`, or an unknown language — falls back to
 * `DEFAULT_LOCALE` (`i18n.md`, "Locales and fallbacks"; implementation plan Decision 4).
 */
export function toSupportedLocale(languageCode: string | null | undefined): SupportedLocale {
  if (languageCode === null || languageCode === undefined) return DEFAULT_LOCALE;

  const normalized = languageCode.toLowerCase().split(/[-_]/)[0];
  if (normalized === undefined || normalized === '') return DEFAULT_LOCALE;

  const match = SUPPORTED_LOCALES.find((locale) => locale === normalized);
  return match ?? DEFAULT_LOCALE;
}

/**
 * Reads the device locale via `expo-localization`'s `getLocales()[0]?.languageCode` and maps
 * it to a supported locale, defaulting to `es` when the array is empty or the language code is
 * absent.
 */
export function resolveDeviceLocale(): SupportedLocale {
  const locales = getLocales();
  return toSupportedLocale(locales[0]?.languageCode);
}
