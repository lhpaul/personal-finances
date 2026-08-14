/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://pelotillehue.test/"}
 */
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { PELOTILLEHUE_INVALID_RUT } from './banco-pelotillehue.constants';
import { loginScript } from './banco-pelotillehue.login.script';

describe('loginScript — synthetic bank', () => {
  beforeEach(() => {
    resetScriptGlobals();
  });

  it('a successful read posts products and movements and never embeds the credential values', async () => {
    const password = 'secret-clave';
    const source = loginScript({ rut: '11.111.111-k', password });
    expect(source).not.toContain(password);
    expect(source).not.toContain('11.111.111-k');

    const { messages } = await runInjectedScript(source);
    const steps = messages.filter((m) => m.eventType === 'state-change').map((m) => m.stepId);
    expect(steps[0]).toBe('get-products-start');
    expect(steps).toContain('get-transactions-start');
    expect(steps[steps.length - 1]).toBe('ready');
  });

  it('the invalid-RUT sentinel posts invalid_credentials with no message and no credential bytes', async () => {
    const password = 'secret-clave';
    const source = loginScript({ rut: PELOTILLEHUE_INVALID_RUT, password });
    expect(source).not.toContain(password);
    expect(source).not.toContain(PELOTILLEHUE_INVALID_RUT);

    const { messages } = await runInjectedScript(source);
    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]?.data).toEqual({ code: 'invalid_credentials', step: 'check-for-login-errors' });
  });
});
