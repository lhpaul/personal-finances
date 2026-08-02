import {
  commonHelperFunctions,
  generateExecutableStepFunction,
  generateInstanceIdHelperFunction,
  generateLoginInvalidCredentialsErrorFunction,
  generateWaitForElementHelperFunctions,
} from './script-utils';

/**
 * Every generated script source this package can produce, named for a useful test-failure
 * message (implementation plan Decision 10, Escalation Check). `no-float-parsing.test.ts` and
 * `no-network-egress.test.ts` scan this list because ESLint cannot see inside a template literal.
 *
 * This starts with the bank-agnostic helpers (`src/scripts/script-utils.ts`); once the Banco de
 * Chile reading routines exist (Implementation Order Step 9) this list is extended to include
 * their generated output too, so the scan covers every script this package can actually inject.
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
  };
}
