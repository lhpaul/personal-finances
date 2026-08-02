import type { CategoryLabels } from './json';

/**
 * Locale resolution for data-driven copy (implementation plan Decision 12, spec Business Rule
 * 19 and Decision 4).
 *
 * `src/db` takes a resolved locale; it never reads the device. Repository functions that return
 * a category name accept `locale: SupportedLocale`, so `src/db` stays free of platform concerns
 * and the layering contract in `AGENTS.md` (`app/ → feature hooks → src/db → SQLite`) holds.
 * This file deliberately does **not** import `expo-localization` — the `getLocales()[0]?.languageCode`
 * read belongs to `src/i18n/`, item #2's surface (see the implementation plan's Cross-Cutting
 * Operational Assumption Check and Risks).
 */
export type SupportedLocale = 'es' | 'en';

/**
 * Lower-cases `languageCode`, takes the part before any `-`, and maps it to `'en'` for `en`
 * (case-insensitively, any region) and `'es'` for everything else, including `null` /
 * `undefined`. This is the same two-tier mapping `docs/best-practices/stack/i18n.md` and
 * `src/i18n/` use for the app's own catalogues — a "full tag, then language, then Spanish"
 * resolver was considered and dropped because `labels` is only ever keyed `es` / `en`, so a
 * full-locale-tag tier could never match anything this tier would not already match.
 */
export function toSupportedLocale(languageCode: string | null | undefined): SupportedLocale {
  if (!languageCode) return 'es';
  const primary = languageCode.toLowerCase().split('-')[0];
  return primary === 'en' ? 'en' : 'es';
}

/**
 * Looks `locale` up directly in `labels`, falling back to `es` when the requested key is
 * absent — including when `labels` itself carries no `es` key (Decision 3's "the `en` starter
 * labels are a first pass, not yet product-owner reviewed" acknowledges only the `en` side may
 * be incomplete; `es` is authoritative and expected to always be present, but this resolver does
 * not assume it and returns an empty string only if genuinely nothing is present).
 */
export function resolveLabel(labels: CategoryLabels, locale: SupportedLocale): string {
  const value = labels[locale];
  if (value !== undefined) return value;
  return labels.es ?? '';
}
