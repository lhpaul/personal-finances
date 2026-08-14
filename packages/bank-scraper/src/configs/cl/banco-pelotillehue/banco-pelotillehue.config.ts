import { formatRut, isValidRut } from '@finanzas/shared-utils';
import type { BankConfig } from '../../../types/bank-config.types';
import {
  PELOTILLEHUE_ALLOWED_ORIGINS,
  PELOTILLEHUE_BANK_ID,
  PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN,
  PELOTILLEHUE_INLINE_HTML,
} from './banco-pelotillehue.constants';
import { loginScript } from './banco-pelotillehue.login.script';
import { bancoPelotillehueNormalizer } from './banco-pelotillehue.normalizer';

/**
 * Synthetic demo bank. The host WebView loads {@link PELOTILLEHUE_INLINE_HTML} with base URL
 * `https://pelotillehue.test` — no third-party site, no credential bytes in the injected script.
 * Not seeded in `apps/mobile`.
 */
export const BANCO_PELOTILLEHUE_CONFIG: BankConfig = {
  id: PELOTILLEHUE_BANK_ID,
  name: 'Banco Pelotillehue',
  url: `${PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN}/`,
  allowedOrigins: PELOTILLEHUE_ALLOWED_ORIGINS,
  credentialEntryOrigin: PELOTILLEHUE_CREDENTIAL_ENTRY_ORIGIN,
  inlineHtml: PELOTILLEHUE_INLINE_HTML,
  fields: [
    {
      id: 'rut',
      label: 'RUT',
      type: 'text',
      placeholder: '12.345.678-9',
      formatter: formatRut,
      validation: {
        fn: isValidRut,
        message: 'Por favor ingresa un RUT válido (ej: 12.345.678-9)',
      },
    },
    {
      id: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Ingresa tu contraseña',
    },
  ],
  scripts: {
    login: {
      path: '/',
      script: (input) => loginScript(input as { rut: string; password: string }),
      singleExecution: true,
    },
  },
  normalizer: bancoPelotillehueNormalizer,
};
