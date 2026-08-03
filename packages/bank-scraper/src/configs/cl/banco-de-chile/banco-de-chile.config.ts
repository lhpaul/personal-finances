import { formatRut, isValidRut } from '@finanzas/shared-utils';
import type { BankConfig } from '../../../types/bank-config.types';
import { BANCO_DE_CHILE_ALLOWED_ORIGINS, BANCO_DE_CHILE_BANK_ID, BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN } from './banco-de-chile.constants';
import { accountTransactionsScript } from './banco-de-chile.account-transactions.script';
import { creditCardDetailsScript } from './banco-de-chile.credit-card-details.script';
import { homeScript } from './banco-de-chile.home.script';
import { loginScript } from './banco-de-chile.login.script';
import { bancoDeChileNormalizer } from './banco-de-chile.normalizer';

/**
 * Banco de Chile's complete, self-contained configuration (spec Business Rule 24, Conflict 3;
 * implementation plan Layer-by-Layer Changes → Banco de Chile). Everything Banco de Chile-specific
 * — its address, its sign-in form, its page addresses, its selectors and its parsing — lives
 * under this directory; nothing outside it may reach into a bank page (AC27).
 *
 * The bank is identified as `banco-de-chile` (spec Conflict 3): the source's `bancochile`
 * identifier is a porting detail corrected here, not a contract preserved from the source.
 */
export const BANCO_DE_CHILE_CONFIG: BankConfig = {
  id: BANCO_DE_CHILE_BANK_ID,
  name: 'Banco de Chile',
  url: `${BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN}/login`,
  allowedOrigins: BANCO_DE_CHILE_ALLOWED_ORIGINS,
  credentialEntryOrigin: BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN,
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
      label: 'Contraseña',
      type: 'password',
      placeholder: 'Ingresa tu contraseña',
      maxLength: 8,
    },
  ],
  scripts: {
    login: {
      path: '/login',
      script: (input) => loginScript(input as { rut: string; password: string }),
      singleExecution: true,
    },
    home: {
      path: 'index.html#/home',
      script: () => homeScript(),
      singleExecution: false,
    },
    accountTransactions: {
      path: 'cuenta/saldos-movimientos/',
      script: (input) => accountTransactionsScript(input as { priorMonths?: number } | undefined),
      singleExecution: false,
    },
    creditCardDetails: {
      path: 'tarjeta-credito/consultar/saldos',
      script: (input) => creditCardDetailsScript(input as { priorMonths?: number } | undefined),
      singleExecution: false,
      delay: 1000,
    },
  },
  normalizer: bancoDeChileNormalizer,
};
