/**
 * Values shared between `banco-de-chile.config.ts` and the four reading routines, split into
 * their own module so the routines never need to import the config file itself (which would
 * create a dependency cycle: the config's `scripts` map references each routine).
 */

export const BANCO_DE_CHILE_BANK_ID = 'banco-de-chile';

/**
 * The single HTTPS origin a credential may ever be typed into (spec Business Rule 5).
 * Post-login navigation uses {@link BANCO_DE_CHILE_ALLOWED_ORIGINS}, which is a superset.
 */
export const BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN = 'https://login.portales.bancochile.cl';

/**
 * Exact origins the WebView may load during a read. Login stays on
 * {@link BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN}; after sign-in the bank navigates to
 * `https://portalpersonas.bancochile.cl` (observed in scraper-lab, origin_blocked).
 */
export const BANCO_DE_CHILE_ALLOWED_ORIGINS: readonly string[] = [
  BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN,
  'https://portalpersonas.bancochile.cl',
];
