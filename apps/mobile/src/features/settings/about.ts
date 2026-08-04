/**
 * `#screen=settings-about`'s pure composition (implementation plan for issue #19, Decisions 8,
 * 9). No React, no I/O.
 */

/** The narrow slice of `expo-constants`'s `Constants` this module needs — narrow so a test can
 * supply a plain object instead of the real module. */
export interface AppVersionConstants {
  expoConfig?: { version?: string } | null;
}

/** The mockup draws `"Versión 1.0.0 (MVP)"` — sample data, exactly like its RUT and its `57`
 * movement count (Assumption A6). The real value is read from `app.config.js` through
 * `expo-constants`; `'0.0.0'` is `app.config.js`'s own pre-release default (Decision 9). */
const FALLBACK_VERSION = '0.0.0';

export function resolveAppVersion(constants: AppVersionConstants): string {
  return constants.expoConfig?.version ?? FALLBACK_VERSION;
}

export interface AboutLinkRowDescriptor {
  iconKey: string;
  titleKey: string;
}

/**
 * The three inert rows (implementation plan for issue #19, Decision 8) — *Política de
 * privacidad*, *Términos de servicio*, *Enviar feedback* — drawn exactly as the mockup draws
 * them, with no destination: the mockup's own markup declares them non-navigating (no `onclick`
 * anywhere on these three `.mu-item`s), and BEHAVIOR.md records "sin telemetría ni links que
 * envíen datos — no hay backend" for this screen.
 */
export const ABOUT_LINK_ROWS: readonly AboutLinkRowDescriptor[] = [
  { iconKey: 'settings.about.link_icon_privacy', titleKey: 'settings.about.privacy_policy' },
  { iconKey: 'settings.about.link_icon_terms', titleKey: 'settings.about.terms' },
  { iconKey: 'settings.about.link_icon_feedback', titleKey: 'settings.about.feedback' },
] as const;
