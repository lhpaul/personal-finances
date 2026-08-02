import { toJsStringLiteral } from '../../../security/js-string-literal';
import { commonHelperFunctions, generateExecutableStepFunction, generateLoginInvalidCredentialsErrorFunction, generateWaitForElementHelperFunctions } from '../../../scripts/script-utils';
import { BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN } from './banco-de-chile.constants';

/**
 * Banco de Chile's sign-in routine (spec Use Case 1, Use Case 3, AC1, AC4, AC14, AC16;
 * implementation plan Decision 4 checkpoint 3, Decision 5, Decision 8).
 *
 * The credential fields are built with `toJsStringLiteral` — escaping, never interpolation
 * (Decision 5, control 1) — and are typed into the form with **no retry wrapper at all**
 * (Decision 8: `MAX_SUBMIT_ATTEMPTS = 1`). A rejected sign-in posts `invalid_credentials` with no
 * `message` field (Decision 5, control 3) and is never retried (Business Rule 22).
 */

const RUT_INPUT_LABEL = 'RutInput';
const RUT_INPUT_SELECTOR = "document.getElementById('ppriv_per-login-click-input-rut')";
const PASSWORD_INPUT_SELECTOR = "document.getElementById('ppriv_per-login-click-input-password')";
const SUBMIT_BUTTON_SELECTOR = "document.getElementById('ppriv_per-login-click-ingresar-login')";
const LOG_GROUP = 'login';

export function loginScript(credentials: { rut: string; password: string }): string {
  const rutLiteral = toJsStringLiteral(credentials.rut);
  const passwordLiteral = toJsStringLiteral(credentials.password);
  return `
    (function () {
      // Checkpoint 3 (Decision 4): the in-page gate, checked at the instant a credential would
      // be typed — the only checkpoint that observes the origin after injection's own delay.
      if (window.location.origin !== ${toJsStringLiteral(BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN)}) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'network' },
        }));
        return;
      }

      ${commonHelperFunctions()}
      ${generateWaitForElementHelperFunctions({ label: RUT_INPUT_LABEL, selector: RUT_INPUT_SELECTOR })}
      ${generateLoginInvalidCredentialsErrorFunction()}

      (async function () {
        sendTrace({ logGroup: '${LOG_GROUP}', message: 'Starting login script' });

        ${generateExecutableStepFunction({
          stepName: 'wait-for-page-to-be-ready',
          logGroup: LOG_GROUP,
          code: `
            await waitForPageToBeReady('${LOG_GROUP}');
            await waitFor${RUT_INPUT_LABEL}Element();
          `,
        })}

        // Credential entry and submit run with no retry wrapper (Decision 8: MAX_SUBMIT_ATTEMPTS
        // = 1) — a flaky submit must never click "Ingresar" more than once (Business Rule 22).
        const rutInput = ${RUT_INPUT_SELECTOR};
        rutInput.value = ${rutLiteral};
        rutInput.dispatchEvent(new Event('input', { bubbles: true }));
        rutInput.dispatchEvent(new Event('blur', { bubbles: true }));
        rutInput.dispatchEvent(new Event('change', { bubbles: true }));

        const passwordInput = ${PASSWORD_INPUT_SELECTOR};
        passwordInput.value = ${passwordLiteral};
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('blur', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

        const submitButton = ${SUBMIT_BUTTON_SELECTOR};
        sendTrace({ logGroup: '${LOG_GROUP}', message: 'Step completed', data: { stepName: 'submit-form', attempts: 1 } });
        submitButton.click();

        // A single bounded wait, then one check — not wrapped in the retry step function.
        // Finding no rejection banner is treated as success (the engine advances once the next
        // page loads and the home script reports get-products-start); this is not a "retry of a
        // failed submission" in the Business Rule 22 sense, just giving the bank's page a moment
        // to render a rejection before concluding there is none.
        await wait(1000);
        const errorElement = document.querySelector('[role="alert"]');
        if (errorElement && errorElement.textContent && errorElement.textContent.trim()) {
          sendLoginInvalidCredentialsError();
        }
      })().then(function () {
        sendTrace({ logGroup: '${LOG_GROUP}', message: 'Login script finished' });
      }).catch(function (error) {
        sendTrace({ logGroup: '${LOG_GROUP}', type: 'error', message: 'Login script failed: ' + error.message });
      });
    })();
  `;
}
