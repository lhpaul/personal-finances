import { MAX_SUBMIT_ATTEMPTS } from '../../../engine/constants';
import { toJsStringLiteral } from '../../../security/js-string-literal';
import {
  commonHelperFunctions,
  generateExecutableStepFunction,
  generateLoginInvalidCredentialsErrorFunction,
  generateWaitForElementHelperFunctions,
} from '../../../scripts/script-utils';
import { FALABELLA_CREDENTIAL_ENTRY_ORIGIN } from './banco-falabella.constants';

const AUTH_BUTTON_LABEL = 'AuthButton';
const AUTH_BUTTON_SELECTOR = "document.getElementById('btn-auth-normal')";
const RUT_INPUT_LABEL = 'RutInput';
const RUT_INPUT_SELECTOR =
  "Array.from(document.querySelectorAll('input[placeholder=\"RUT\"]')).find(function (input) { return input.placeholder === 'RUT'; })";
const PASSWORD_INPUT_SELECTOR =
  "Array.from(document.querySelectorAll('input[type=\"password\"]')).find(function (input) { return input.placeholder === 'Clave Internet'; })";
const SUBMIT_BUTTON_SELECTOR = "document.getElementById('desktop-login')";
const REJECTION_BANNER_SELECTOR =
  "Array.from(document.querySelectorAll('[role=\"alert\"]')).find(function (el) { return el.textContent && el.textContent.trim(); })";
const REJECTION_CHECK_DELAY_MS = 1000;
const LOG_GROUP = 'login';

export function loginScript(credentials: { rut: string; password: string }): string {
  const rutLiteral = toJsStringLiteral(credentials.rut);
  const passwordLiteral = toJsStringLiteral(credentials.password);
  return `
    (function () {
      if (window.location.origin !== ${toJsStringLiteral(FALABELLA_CREDENTIAL_ENTRY_ORIGIN)}) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: 'error',
          data: { code: 'network' },
        }));
        return;
      }

      ${commonHelperFunctions()}
      ${generateWaitForElementHelperFunctions({ label: AUTH_BUTTON_LABEL, selector: AUTH_BUTTON_SELECTOR })}
      ${generateWaitForElementHelperFunctions({ label: RUT_INPUT_LABEL, selector: RUT_INPUT_SELECTOR })}
      ${generateLoginInvalidCredentialsErrorFunction()}

      return (async function () {
        sendTrace({ logGroup: '${LOG_GROUP}', message: 'Starting login script' });

        ${generateExecutableStepFunction({
          stepName: 'wait-for-page-to-be-ready',
          logGroup: LOG_GROUP,
          code: `
            await waitForPageToBeReady('${LOG_GROUP}');
            await waitFor${AUTH_BUTTON_LABEL}Element();
          `,
        })}

        ${generateExecutableStepFunction({
          stepName: 'click-authentication-button',
          logGroup: LOG_GROUP,
          code: `
            const authButton = ${AUTH_BUTTON_SELECTOR};
            authButton.click();
            await waitFor${RUT_INPUT_LABEL}Element();
          `,
        })}

        ${generateExecutableStepFunction(
          {
            stepName: 'submit-form',
            logGroup: LOG_GROUP,
            code: `
              const rutInput = ${RUT_INPUT_SELECTOR};
              const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeSetter.call(rutInput, ${rutLiteral});
              rutInput.dispatchEvent(new Event('input', { bubbles: true }));
              rutInput.dispatchEvent(new Event('change', { bubbles: true }));
              rutInput.dispatchEvent(new Event('blur', { bubbles: true }));

              const passwordInput = ${PASSWORD_INPUT_SELECTOR};
              nativeSetter.call(passwordInput, ${passwordLiteral});
              passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
              passwordInput.dispatchEvent(new Event('blur', { bubbles: true }));

              const submitButton = ${SUBMIT_BUTTON_SELECTOR};
              submitButton.click();
            `,
          },
          { maxRetries: MAX_SUBMIT_ATTEMPTS },
        )}

        await wait(${REJECTION_CHECK_DELAY_MS});
        const errorElement = ${REJECTION_BANNER_SELECTOR};
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
