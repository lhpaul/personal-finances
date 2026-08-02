import { join } from 'node:path';
import { BANCO_DE_CHILE_CONFIG } from '../configs/cl/banco-de-chile/banco-de-chile.config';
import { homeScript } from '../configs/cl/banco-de-chile/banco-de-chile.home.script';
import { ScrapeSession } from '../engine/scrape-session';
import { loadFixtureHtml, renderFixture } from '../test-utils/load-fixture';
import { FakeWebViewPort } from '../test-utils/fake-webview-port';
import { resetScriptGlobals, runInjectedScript } from '../test-utils/run-injected-script';
import type { ScrapeResult } from '../types/scrape-result.types';

/**
 * The named test that proves Business Rule 4 (spec AC2; implementation plan Decision 5): drives
 * a real read — the login routine executed against a real fixture, its output fed into a real
 * `ScrapeSession` — with recognisable sentinel credentials, and asserts the sentinels appear in
 * **none** of the result, its traces, or any console call, in any form. Also asserts the read
 * produced **real** diagnostics: a check that blanked every trace would pass the leak half
 * trivially and be useless (implementation plan Decision 5, "does not over-fire").
 */

const FIXTURES_DIR = join(__dirname, '..', 'configs', 'cl', 'banco-de-chile', 'fixtures');
const SENTINEL_RUT = 'ZZSENTINELRUTZZ';
const SENTINEL_PASSWORD = 'ZZSENTINELPASSZZ';
const PUNCTUATION_PASSWORD = 'ZZ"\\\'<>&ZZ';

interface ConsoleSpies {
  log: jest.SpyInstance;
  warn: jest.SpyInstance;
  error: jest.SpyInstance;
  info: jest.SpyInstance;
  debug: jest.SpyInstance;
}

function installConsoleSpies(): ConsoleSpies {
  return {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
  };
}

function consoleCallsContain(spies: ConsoleSpies, needle: string): boolean {
  // Compare against the JSON-escaped form of the needle too (CodeRabbit finding #32): a
  // punctuation-bearing needle (PUNCTUATION_PASSWORD below contains a literal '"' and '\')
  // would never appear as a raw substring of a JSON.stringify'd console argument — JSON.stringify
  // escapes both characters — which silently made this assertion vacuous for exactly the
  // credential shape AC4 cares most about testing.
  const escapedNeedle = JSON.stringify(needle).slice(1, -1);
  return Object.values(spies).some((spy) =>
    spy.mock.calls.some((call: unknown[]) =>
      call.some((arg) => {
        const serialized = JSON.stringify(arg);
        return serialized.includes(needle) || serialized.includes(escapedNeedle);
      }),
    ),
  );
}

/** Drives login (real fixture) + home (real fixture) through a real ScrapeSession, replaying the
 * generated login/home script output as if a real WebView had posted it. */
async function driveFullRead(credentials: { rut: string; password: string }): Promise<ScrapeResult> {
  const port = new FakeWebViewPort();
  const results: ScrapeResult[] = [];
  const session = new ScrapeSession(BANCO_DE_CHILE_CONFIG, port, {
    countryCode: 'cl',
    credentials,
    onResult: (result) => results.push(result),
  });
  session.start();

  resetScriptGlobals();
  renderFixture(loadFixtureHtml(FIXTURES_DIR, 'login.html'));
  const loginRun = await runInjectedScript(
    BANCO_DE_CHILE_CONFIG.scripts.login?.script(credentials) as string,
  );
  for (const message of loginRun.messages) {
    session.handleWebViewMessage(JSON.stringify(message));
  }

  resetScriptGlobals();
  renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
  const homeRun = await runInjectedScript(homeScript());
  for (const message of homeRun.messages) {
    session.handleWebViewMessage(JSON.stringify(message));
  }

  session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));

  const result = results[0];
  if (!result) throw new Error('driveFullRead: no result was emitted');
  return result;
}

describe('credential-leak', () => {
  it('no sentinel credential value appears anywhere, in any form, for a plain password', async () => {
    const spies = installConsoleSpies();
    try {
      const result = await driveFullRead({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });
      const serializedResult = JSON.stringify(result);
      const serializedTraces = JSON.stringify(result.traces);
      const serializedReadFailure = JSON.stringify(result.readFailure);
      const serializedProductFailures = JSON.stringify(result.productFailures);

      for (const needle of [SENTINEL_RUT, SENTINEL_PASSWORD]) {
        expect(serializedResult).not.toContain(needle);
        expect(serializedTraces).not.toContain(needle);
        expect(serializedReadFailure ?? '').not.toContain(needle);
        expect(serializedProductFailures).not.toContain(needle);
        expect(consoleCallsContain(spies, needle)).toBe(false);
      }
    } finally {
      Object.values(spies).forEach((spy) => spy.mockRestore());
    }
  });

  it('no sentinel credential value appears anywhere for a password containing quotes, backslashes and angle brackets (AC4)', async () => {
    const spies = installConsoleSpies();
    try {
      const result = await driveFullRead({ rut: SENTINEL_RUT, password: PUNCTUATION_PASSWORD });
      const serialized = JSON.stringify(result);
      // The JSON-escaped form too (CodeRabbit finding #13): JSON.stringify renders a leaked
      // PUNCTUATION_PASSWORD as ZZ\"\\'<>&ZZ, not the raw needle — checking only the raw form
      // made this assertion unable to detect the leak it targets, mirroring finding #32's fix to
      // consoleCallsContain.
      const escapedPassword = JSON.stringify(PUNCTUATION_PASSWORD).slice(1, -1);
      expect(serialized).not.toContain(PUNCTUATION_PASSWORD);
      expect(serialized).not.toContain(escapedPassword);
      expect(serialized).not.toContain(SENTINEL_RUT);
      expect(consoleCallsContain(spies, PUNCTUATION_PASSWORD)).toBe(false);
    } finally {
      Object.values(spies).forEach((spy) => spy.mockRestore());
    }
  });

  it('does not over-fire: the same read produces real, substantive diagnostics', async () => {
    const result = await driveFullRead({ rut: SENTINEL_RUT, password: SENTINEL_PASSWORD });
    expect(result.traces.length).toBeGreaterThanOrEqual(5);
    expect(
      result.traces.some(
        (t) => t.message === 'Step completed' && (t.data as { stepName?: string } | undefined)?.stepName === 'submit-form',
      ),
    ).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.products)).toContain('••••1111');
    expect(result.outcome).toBe('complete');
  });

  it('consoleCallsContain detects a punctuation-bearing needle even after JSON.stringify escapes it (CodeRabbit finding #32)', () => {
    const spies = installConsoleSpies();
    try {
      // Simulate a real leak: the punctuation password reaches a console call nested inside an
      // object, exactly as an accidental console.log(payload) would produce. Calls the installed
      // spy directly (not a literal console.log(...) call) — this package's own lint fence
      // treats a stray console.log as a credential-leak vector (no-console: 'error').
      (spies.log as unknown as (arg: unknown) => void)({ leaked: PUNCTUATION_PASSWORD });
      expect(consoleCallsContain(spies, PUNCTUATION_PASSWORD)).toBe(true);
    } finally {
      Object.values(spies).forEach((spy) => spy.mockRestore());
    }
  });

  it('credentials are cleared once the read ends, regardless of the outcome (CodeRabbit finding #21: observes CredentialHolder.isCleared(), not isFinalized())', async () => {
    const port = new FakeWebViewPort();
    let cleared = false;
    const session = new ScrapeSession(BANCO_DE_CHILE_CONFIG, port, {
      countryCode: 'cl',
      credentials: { rut: SENTINEL_RUT, password: SENTINEL_PASSWORD },
      onResult: () => {
        cleared = session.areCredentialsCleared();
      },
    });
    session.start();
    session.cancel();
    expect(cleared).toBe(true);
  });
});
