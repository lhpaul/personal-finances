import { formatRut, isValidRut } from '@finanzas/shared-utils';
import type { BankConfig } from '../../../types/bank-config.types';
import { FALABELLA_ALLOWED_ORIGINS, FALABELLA_BANK_ID, FALABELLA_CREDENTIAL_ENTRY_ORIGIN } from './banco-falabella.constants';
import { homeScript } from './banco-falabella.home.script';
import { loginScript } from './banco-falabella.login.script';
import { bancoFalabellaNormalizer } from './banco-falabella.normalizer';

/**
 * Banco Falabella's complete configuration. Id is `falabella` (matching the product catalogue
 * seed), not the source's `bancofalabella`. Login + SPA home (products and movements). The
 * product picker in `apps/mobile` stays `coming_soon` until a later item flips it.
 *
 * Script map order is load-bearing: `home` is listed first because its path is more specific.
 * `WebViewDriverService` uses `Object.keys(...).find(url.includes(path))`, so a login path of
 * `www.bancofalabella.cl` would otherwise match the home URL as well and starve the home script.
 */
export const BANCO_FALABELLA_CONFIG: BankConfig = {
  id: FALABELLA_BANK_ID,
  name: 'Banco Falabella',
  url: `${FALABELLA_CREDENTIAL_ENTRY_ORIGIN}/`,
  allowedOrigins: FALABELLA_ALLOWED_ORIGINS,
  credentialEntryOrigin: FALABELLA_CREDENTIAL_ENTRY_ORIGIN,
  fields: [
    {
      id: 'rut',
      label: 'RUT',
      type: 'text',
      placeholder: '12.345.678-9',
      maxLength: 12,
      formatter: formatRut,
      validation: {
        fn: isValidRut,
        message: 'Por favor ingresa un RUT válido (ej: 12.345.678-9)',
      },
    },
    {
      id: 'password',
      label: 'Clave Internet',
      type: 'password',
      placeholder: 'Ingresa tu clave',
      maxLength: 6,
    },
  ],
  scripts: {
    home: {
      path: 'web-clientes/techbank-client',
      script: () => homeScript(),
      singleExecution: true,
    },
    login: {
      path: 'www.bancofalabella.cl',
      script: (input) => loginScript(input as { rut: string; password: string }),
      singleExecution: true,
    },
  },
  normalizer: bancoFalabellaNormalizer,
};
