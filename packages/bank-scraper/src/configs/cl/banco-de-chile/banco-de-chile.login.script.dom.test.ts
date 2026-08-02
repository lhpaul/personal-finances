import { join } from 'node:path';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { BANCO_DE_CHILE_CREDENTIAL_ENTRY_ORIGIN } from './banco-de-chile.constants';
import { loginScript } from './banco-de-chile.login.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');

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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fills the rut and password inputs unchanged and clicks submit exactly once', async () => {
    let clickCount = 0;
    getSubmitButton().addEventListener('click', () => {
      clickCount += 1;
    });
    const resultPromise = runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
    await jest.advanceTimersByTimeAsync(2000);
    await resultPromise;

    expect(getRutInput().value).toBe('12.345.678-5');
    expect(getPasswordInput().value).toBe('clave1234');
    expect(clickCount).toBe(1);
  });

  it('a password containing quotes, backslashes and angle brackets reaches the form unchanged (AC4)', async () => {
    const punctuationPassword = `ZZ"\\'<>&ZZ`;
    const resultPromise = runInjectedScript(loginScript({ rut: '12.345.678-5', password: punctuationPassword }));
    await jest.advanceTimersByTimeAsync(2000);
    await resultPromise;
    expect(getPasswordInput().value).toBe(punctuationPassword);
  });

  it('does not post invalid_credentials when no rejection banner is present', async () => {
    const resultPromise = runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
    await jest.advanceTimersByTimeAsync(2000);
    const { messages } = await resultPromise;
    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages).toEqual([]);
  });
});

describe('loginScript — against login-invalid-credentials.html (AC14)', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login-invalid-credentials.html'));
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('posts invalid_credentials with no message field, and clicks submit exactly once', async () => {
    let clickCount = 0;
    getSubmitButton().addEventListener('click', () => {
      clickCount += 1;
    });
    const resultPromise = runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
    await jest.advanceTimersByTimeAsync(2000);
    const { messages } = await resultPromise;

    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]?.data).toEqual({ code: 'invalid_credentials', step: 'check-for-login-errors' });
    expect(clickCount).toBe(1);
  });

  it('never attaches the bank\'s own rejection text anywhere in the posted messages', async () => {
    const resultPromise = runInjectedScript(loginScript({ rut: '12.345.678-5', password: 'clave1234' }));
    await jest.advanceTimersByTimeAsync(2000);
    const { messages } = await resultPromise;
    expect(JSON.stringify(messages)).not.toContain('datos ingresados no son correctos');
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
