/**
 * Values shared between Falabella's config and its reading routines, split so the routines never
 * import the config file (which would cycle: the config's `scripts` map references each routine).
 */

export const FALABELLA_BANK_ID = 'falabella';

export const FALABELLA_CREDENTIAL_ENTRY_ORIGIN = 'https://www.bancofalabella.cl';

export const FALABELLA_ALLOWED_ORIGINS: readonly string[] = [FALABELLA_CREDENTIAL_ENTRY_ORIGIN];
