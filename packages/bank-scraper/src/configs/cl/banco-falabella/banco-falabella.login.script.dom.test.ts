/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.bancofalabella.cl/"}
 */
import { join } from 'node:path';
import { MAX_SUBMIT_ATTEMPTS } from '../../../engine/constants';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { FALABELLA_CREDENTIAL_ENTRY_ORIGIN } from './banco-falabella.constants';
import { loginScript } from './banco-falabella.login.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const TEST_TIMEOUT_MS = 10000;

function getRutInput(): HTMLInputElement {
  return Array.from(document.querySelectorAll('input[placeholder="RUT"]'))[0] as HTMLInputElement;
}
function getPasswordInput(): HTMLInputElement {
  return Array.from(document.querySelectorAll('input[type="password"]'))[0] as HTMLInputElement;
}
function getSubmitButton(): HTMLButtonElement {
  return document.getElementById('desktop-login') as HTMLButtonElement;
}

describe('loginScript — against login.html', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login.html'));
  });

  it(
    'fills the rut and password inputs unchanged and clicks submit exactly once',
    async () => {
      let clickCount = 0;
      getSubmitButton().addEventListener('click', () => {
        clickCount += 1;
      });
      await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1' }));

      expect(getRutInput().value).toBe('12.345.678-5');
      expect(getPasswordInput().value).toBe('clave1');
      expect(clickCount).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'a password containing quotes, backslashes and angle brackets reaches the form unchanged',
    async () => {
      const punctuationPassword = `Z"\\'<>&`;
      await runInjectedScript(loginScript({ rut: '12.345.678-5', password: punctuationPassword }));
      expect(getPasswordInput().value).toBe(punctuationPassword);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('loginScript — against login-invalid-credentials.html', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login-invalid-credentials.html'));
  });

  it(
    'posts invalid_credentials with no message field, and clicks submit exactly once',
    async () => {
      let clickCount = 0;
      getSubmitButton().addEventListener('click', () => {
        clickCount += 1;
      });
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1' }));

      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0]?.data).toEqual({ code: 'invalid_credentials', step: 'check-for-login-errors' });
      expect(clickCount).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "never attaches the bank's own rejection text anywhere in the posted messages",
    async () => {
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1' }));
      expect(JSON.stringify(messages)).not.toContain('datos ingresados no son correctos');
    },
    TEST_TIMEOUT_MS,
  );
});

describe('loginScript — MAX_SUBMIT_ATTEMPTS', () => {
  it('pins MAX_SUBMIT_ATTEMPTS at 1', () => {
    expect(MAX_SUBMIT_ATTEMPTS).toBe(1);
  });
});

describe('loginScript — in-page origin gate', () => {
  it('the generated source checks window.location.origin against the exact credential-entry origin before touching any input', () => {
    const source = loginScript({ rut: 'r', password: 'p' });
    const originCheckIndex = source.indexOf('window.location.origin');
    const rutAssignmentIndex = source.indexOf('nativeSetter.call(rutInput');
    expect(originCheckIndex).toBeGreaterThan(-1);
    expect(originCheckIndex).toBeLessThan(rutAssignmentIndex);
    expect(source).toContain(FALABELLA_CREDENTIAL_ENTRY_ORIGIN);
  });
});
