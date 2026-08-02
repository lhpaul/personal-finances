import {
  commonHelperFunctions,
  generateExecutableStepFunction,
  generateInstanceIdHelperFunction,
  generateLoginInvalidCredentialsErrorFunction,
  generateWaitForElementHelperFunctions,
} from './script-utils';
import { accountTransactionsScript } from '../configs/cl/banco-de-chile/banco-de-chile.account-transactions.script';
import { creditCardDetailsScript } from '../configs/cl/banco-de-chile/banco-de-chile.credit-card-details.script';
import { homeScript } from '../configs/cl/banco-de-chile/banco-de-chile.home.script';
import { loginScript } from '../configs/cl/banco-de-chile/banco-de-chile.login.script';

/**
 * Every generated script source this package can produce, named for a useful test-failure
 * message (implementation plan Decision 10, Escalation Check). `no-float-parsing.test.ts` and
 * `no-network-egress.test.ts` scan this list because ESLint cannot see inside a template literal.
 *
 * Named exception to the bank-containment scan (`testing/bank-containment.test.ts`): this file
 * imports every registered bank's reading routines so the scan below covers every script this
 * package can actually inject, matching Decision 10's stated scope — not a selector, page path
 * or parsing rule of its own.
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
    loginScript: loginScript({ rut: 'sample-rut', password: 'sample-password' }),
    homeScript: homeScript(),
    accountTransactionsScript: accountTransactionsScript({ priorMonths: 1 }),
    creditCardDetailsScript: creditCardDetailsScript({ priorMonths: 1 }),
  };
}
