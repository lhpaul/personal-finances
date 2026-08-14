import {
  commonHelperFunctions,
  generateExecutableStepFunction,
  generateInstanceIdHelperFunction,
  generateLoginInvalidCredentialsErrorFunction,
  generateWaitForElementHelperFunctions,
} from './script-utils';
import { accountTransactionsScript } from '../configs/cl/banco-de-chile/banco-de-chile.account-transactions.script';
import { creditCardDetailsScript } from '../configs/cl/banco-de-chile/banco-de-chile.credit-card-details.script';
import { homeScript as chileHomeScript } from '../configs/cl/banco-de-chile/banco-de-chile.home.script';
import { loginScript as chileLoginScript } from '../configs/cl/banco-de-chile/banco-de-chile.login.script';
import { homeScript as falabellaHomeScript } from '../configs/cl/banco-falabella/banco-falabella.home.script';
import { loginScript as falabellaLoginScript } from '../configs/cl/banco-falabella/banco-falabella.login.script';
import { loginScript as pelotillehueLoginScript } from '../configs/cl/banco-pelotillehue/banco-pelotillehue.login.script';

/**
 * Every generated script source this package can produce, named for a useful test-failure
 * message. `no-float-parsing.test.ts` and `no-network-egress.test.ts` scan this list because
 * ESLint cannot see inside a template literal.
 *
 * Named exception to the bank-containment scan (`testing/bank-containment.test.ts`): this file
 * imports every registered bank's reading routines so the scan covers every script this package
 * can actually inject.
 */
export function allGeneratedScriptSources(): Record<string, string> {
  return {
    commonHelperFunctions: commonHelperFunctions(),
    generateExecutableStepFunction: generateExecutableStepFunction({
      stepName: 'sample-step',
      logGroup: 'sample',
      code: 'return document.title;',
    }),
    generateWaitForElementHelperFunctions: generateWaitForElementHelperFunctions({
      label: 'Sample',
      selector: "document.getElementById('sample')",
    }),
    generateLoginInvalidCredentialsErrorFunction: generateLoginInvalidCredentialsErrorFunction(),
    generateInstanceIdHelperFunction: generateInstanceIdHelperFunction(),
    chileLoginScript: chileLoginScript({ rut: 'sample-rut', password: 'sample-password' }),
    chileHomeScript: chileHomeScript(),
    accountTransactionsScript: accountTransactionsScript({ priorMonths: 1 }),
    creditCardDetailsScript: creditCardDetailsScript({ priorMonths: 1 }),
    falabellaLoginScript: falabellaLoginScript({ rut: 'sample-rut', password: 'sample-password' }),
    falabellaHomeScript: falabellaHomeScript(),
    pelotillehueLoginScript: pelotillehueLoginScript({ rut: 'sample-rut', password: 'sample-password' }),
  };
}
