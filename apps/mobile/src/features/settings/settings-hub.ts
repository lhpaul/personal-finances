import type { ReminderSettings } from '../../db/types';

/**
 * The settings hub's five rows, in mockup order (implementation plan for issue #19, Decision 14,
 * Assumption A10). Pure descriptors — no `t()` call, no React — the route resolves `iconKey` /
 * `titleKey` through the catalogue and `href` through `expo-router`'s `Link`.
 */
export interface SettingsHubRowDescriptor {
  screenId: string;
  href: string;
  iconKey: string;
  titleKey: string;
}

export const SETTINGS_HUB_ROWS: readonly SettingsHubRowDescriptor[] = [
  {
    screenId: 'settings-account',
    href: '/settings/account',
    iconKey: 'settings.hub.account_icon',
    titleKey: 'settings.hub.account_title',
  },
  {
    screenId: 'settings-banks',
    href: '/settings/banks',
    iconKey: 'settings.hub.banks_icon',
    titleKey: 'settings.hub.banks_title',
  },
  {
    screenId: 'settings-notifications',
    href: '/settings/notifications',
    iconKey: 'settings.hub.reminders_icon',
    titleKey: 'settings.hub.reminders_title',
  },
  {
    screenId: 'settings-categories',
    href: '/settings/categories',
    iconKey: 'settings.hub.categories_icon',
    titleKey: 'settings.hub.categories_title',
  },
  {
    screenId: 'settings-about',
    href: '/settings/about',
    iconKey: 'settings.hub.about_icon',
    titleKey: 'settings.hub.about_title',
  },
] as const;

/**
 * A hub row's subtitle, as a closed, discriminated union of **variants** rather than a catalogue
 * key string (implementation plan for issue #19, Decision 15). i18next's generated `t()`
 * signature is typed against the literal key union in `es.json` (`i18next.d.ts`), so a route that
 * received a plain `string` key here could not call `t()` with it at all under
 * `strict`/`noUncheckedIndexedAccess`; the route instead switches on `variant` and calls `t()`
 * with a literal key per branch — the same "literal key per branch, never a variable key"
 * discipline `app/(onboarding)/ready.tsx` already established (its Decision 13). `'raw'` is the
 * one variant that is not copy at all — the RUT — so the route renders it verbatim, with no
 * `t()` call.
 */
export type HubSubtitle =
  | { variant: 'raw'; text: string }
  | { variant: 'account_no_bank' }
  | { variant: 'banks_empty' }
  | { variant: 'banks_single'; banks: number; products: number }
  | { variant: 'banks_plural'; banks: number; products: number }
  | { variant: 'categories'; expense: number; income: number }
  | { variant: 'about_version'; version: string };

/** `'account_no_bank'` when no credential entry exists anywhere (Assumption A5); otherwise the
 * caller's already-formatted RUT, rendered as-is. */
export function accountSubtitle(rut: string | null): HubSubtitle {
  return rut === null ? { variant: 'account_no_bank' } : { variant: 'raw', text: rut };
}

/** `'banks_empty'` when there are no fully-synced connections; otherwise the singular/plural
 * variant with the connection and summed product counts (Decision 15). */
export function banksSubtitle(bankCount: number, productCount: number): HubSubtitle {
  if (bankCount === 0) return { variant: 'banks_empty' };
  return bankCount === 1
    ? { variant: 'banks_single', banks: bankCount, products: productCount }
    : { variant: 'banks_plural', banks: bankCount, products: productCount };
}

/** `true` only when reminders are enabled **and** both the time and the days are well-formed
 * (Decision 15's fallback, mirroring item #8's `ReadySummaryRow` "renders with title only" rule).
 * The route composes the actual `"{{time}} · {{days}}"` string when this is `true` — that
 * composition needs per-day translation (`t(...)`), so it stays out of this pure module. */
export function remindersAreFullyConfigured(reminders: ReminderSettings): boolean {
  return reminders.enabled && reminders.timeOfDay !== undefined && reminders.days !== undefined;
}

/** The seed guarantees both directions are always non-empty, so this variant has no fallback
 * (Decision 15). */
export function categoriesSubtitle(categories: { expense: number; income: number }): HubSubtitle {
  return { variant: 'categories', expense: categories.expense, income: categories.income };
}

export function aboutSubtitle(version: string): HubSubtitle {
  return { variant: 'about_version', version };
}
