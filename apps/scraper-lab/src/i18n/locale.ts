import { getLocales } from 'expo-localization';

export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'es';

export function toSupportedLocale(languageCode: string | null | undefined): SupportedLocale {
  if (languageCode === null || languageCode === undefined) return DEFAULT_LOCALE;
  const normalized = languageCode.toLowerCase().split(/[-_]/)[0];
  if (normalized === undefined || normalized === '') return DEFAULT_LOCALE;
  const match = SUPPORTED_LOCALES.find((locale) => locale === normalized);
  return match ?? DEFAULT_LOCALE;
}

export function resolveDeviceLocale(): SupportedLocale {
  return toSupportedLocale(getLocales()[0]?.languageCode);
}
