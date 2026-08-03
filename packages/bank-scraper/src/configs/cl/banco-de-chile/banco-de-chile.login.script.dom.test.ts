import { join } from 'node:path';
import { MAX_SUBMIT_ATTEMPTS } from '../../../engine/constants';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN } from './banco-de-chile.constants';
import { loginScript } from './banco-de-chile.login.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');
// The login script includes one real, unmocked wait(1000) before checking for a rejection
// banner (see banco-de-chile.login.script.ts) — runInjectedScript awaits it for real.
const TEST_TIMEOUT_MS = 10000;

function getRutInput(): HTMLInputElement {
  return document.getElementById('ppriv_per-login-click-input-rut') as HTMLInputElement;
}
function getPasswordInput(): HTMLInputElement {
  return document.getElementById('ppriv_per-login-click-input-password') as HTMLInputElement;
}
function getSubmitButton(): HTMLButtonElement {
  return document.getElementById('ppriv_per-login-click-ingresar-login') as HTMLButtonElement;
}

describe('loginScript — against login.html (AC1, AC6)', () => {
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
      await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));

      expect(getRutInput().value).toBe('12.345.678-5');
      expect(getPasswordInput().value).toBe('clave1234');
      expect(clickCount).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'a password containing quotes, backslashes and angle brackets reaches the form unchanged (AC4)',
    async () => {
      const punctuationPassword = `ZZ"\\'<>&ZZ`;
      await runInjectedScript(loginScript({ rut: '12.345.678-5', password: punctuationPassword }));
      expect(getPasswordInput().value).toBe(punctuationPassword);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'does not post invalid_credentials when no rejection banner is present',
    async () => {
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'ignores an unrelated [role="alert"] outside the login form (CodeRabbit finding #16: scoped selector)',
    async () => {
      const unrelatedBanner = document.createElement('div');
      unrelatedBanner.setAttribute('role', 'alert');
      unrelatedBanner.textContent = 'Este sitio usa cookies';
      document.body.appendChild(unrelatedBanner);

      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages).toEqual([]);
    },
    TEST_TIMEOUT_MS,
  );
});

describe('loginScript — against login-invalid-credentials.html (AC14)', () => {
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
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));

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
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
      expect(JSON.stringify(messages)).not.toContain('datos ingresados no son correctos');
    },
    TEST_TIMEOUT_MS,
  );
});

describe('loginScript — MAX_SUBMIT_ATTEMPTS (Decision 8, AC19)', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login.html'));
  });

  it(
    'posts a parse_failed ERROR with attempts equal to MAX_SUBMIT_ATTEMPTS when the submit button is missing, instead of hanging silently',
    async () => {
      // Only the rut input is awaited before this step (waitForRutInputElement); removing the
      // submit button instead lets that wait succeed and fails specifically inside the
      // submit-form step, isolating this proof from wait-for-page-to-be-ready's own retry step.
      getSubmitButton().remove();
      const { messages } = await runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));

      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0]?.data).toMatchObject({
        code: 'parse_failed',
        step: 'submit-form',
        attempts: MAX_SUBMIT_ATTEMPTS,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it('pins MAX_SUBMIT_ATTEMPTS at 1 (CodeRabbit finding #15): raising it would let a flaky submit resubmit the login form', () => {
    // The submit-form step above is wrapped with { maxRetries: MAX_SUBMIT_ATTEMPTS } — Business
    // Rule 22's "never click Ingresar twice" guarantee holds only because this constant is 1.
    // This test exists so a future change to the constant fails CI immediately, rather than
    // silently reintroducing the repeated-sign-in-attempt defect Decision 8 fixes.
    expect(MAX_SUBMIT_ATTEMPTS).toBe(1);
  });
});

describe('loginScript — Decision 4 checkpoint 3 (in-page origin gate)', () => {
  it('the generated source checks window.location.origin against the exact credential-entry origin before touching any input', () => {
    const source = loginScript({ rut: 'r', password: 'p' });
    const originCheckIndex = source.indexOf('window.location.origin');
    const rutAssignmentIndex = source.indexOf('rutInput.value');
    expect(originCheckIndex).toBeGreaterThan(-1);
    expect(originCheckIndex).toBeLessThan(rutAssignmentIndex);
    expect(source).toContain(BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN);
  });

  it('posts a network failure and returns before reaching the credential-entry code, on a mismatched origin', async () => {
    // Directly verifies the mismatch branch without depending on jsdom's real window.location
    // (Jest does not support per-test jsdom URLs within one file) — see jest.config.js.
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login.html'));
    const source = loginScript({ rut: 'r', password: 'p' });
    const mismatchedSource = source.replace(
      'window.location.origin !==',
      "'https://evil.example' !==",
    );
    const { messages } = await runInjectedScript(mismatchedSource);
    expect(messages).toEqual([{ eventType: 'error', data: { code: 'network' } }]);
    expect(getRutInput().value).toBe('');
  });
});
