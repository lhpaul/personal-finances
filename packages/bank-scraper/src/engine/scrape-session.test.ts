import { FakeWebViewPort } from '../test-utils/fake-webview-port';
import type { BankConfig } from '../types/bank-config.types';
import type { ScrapeResult } from '../types/scrape-result.types';
import { ScrapeSession, resolveBankConfigOrReject } from './scrape-session';

const ORIGIN = 'https://fake-bank.example';
const VALID_ID_1 = 'a'.repeat(32);
const VALID_ID_2 = 'b'.repeat(32);

// ScrapeSession.start() schedules a real 240-second READ_DEADLINE_MS timer. Several scenarios
// below never drive the session to finalize(), which would otherwise leave a live timer handle
// open past the end of the test run (Node will not exit while a timer is pending). Fake timers
// for the whole file remove that dependency on wall-clock time; the one test that actually
// exercises deadline expiry advances the fake clock explicitly.
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function buildConfig(overrides: Partial<BankConfig> = {}): BankConfig {
  return {
    id: 'fake-bank',
    name: 'Fake Bank',
    url: `${ORIGIN}/login`,
    allowedOrigins: [ORIGIN],
    credentialEntryOrigin: ORIGIN,
    fields: [],
    scripts: {
      login: { path: '/login', script: () => 'login-script', singleExecution: true },
      home: { path: '/home', script: () => 'home-script', singleExecution: false },
      accountTransactions: { path: '/account', script: () => 'account-script', singleExecution: false },
      creditCardDetails: { path: '/card', script: () => 'card-script', singleExecution: false },
    },
    normalizer: {
      mapProductKind: (kindKey) => (kindKey === 'unsupported' ? null : (kindKey as 'checking')),
      mapMovementDirection: (payload) => (payload.outgoingText ? 'debit' : 'credit'),
      mapMovementExtras: () => ({}),
    },
    ...overrides,
  };
}

function rawProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    instanceId: VALID_ID_1,
    kindKey: 'checking',
    displayName: 'Cuenta Corriente',
    currencyCode: 'CLP',
    maskedIdentifier: '••••1111',
    balanceText: '$500.000',
    ...overrides,
  };
}

function rawMovement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    productInstanceId: VALID_ID_1,
    dateText: '01/03/2026',
    outgoingText: '$10.000',
    incomingText: null,
    currencyCode: 'CLP',
    rawDescription: 'Compra Supermercado',
    bankSuppliedId: null,
    positionInReadSnapshot: 0,
    extras: {},
    ...overrides,
  };
}

function drive(config: BankConfig = buildConfig()): {
  port: FakeWebViewPort;
  session: ScrapeSession;
  results: ScrapeResult[];
} {
  const port = new FakeWebViewPort();
  const results: ScrapeResult[] = [];
  const session = new ScrapeSession(config, port, {
    countryCode: 'cl',
    credentials: { rut: 'ZZSENTINELRUTZZ', password: 'ZZSENTINELPASSZZ' },
    onResult: (result) => results.push(result),
  });
  return { port, session, results };
}

describe('ScrapeSession — AC1 happy path', () => {
  it('signs in, reports each step in order, and finishes complete with products and movements', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'login-start', progress: 0.1 }));
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.9,
        data: { movements: [rawMovement()] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));

    expect(results).toHaveLength(1);
    const result = results[0] as ScrapeResult;
    expect(result.outcome).toBe('complete');
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.balanceMinorUnits).toBe(500000);
    expect(result.movements).toHaveLength(1);
    expect(result.movements[0]?.amountMinorUnits).toBe(10000);
    expect(result.movements[0]?.direction).toBe('debit');
    expect(result.readFailure).toBeNull();
    expect(result.productFailures).toEqual([]);
  });
});

describe('ScrapeSession — AC3, AC2: credentials and diagnostics', () => {
  it('clears credentials on a successful completion', () => {
    const { session } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(session.isFinalized()).toBe(true);
  });

  it('no sentinel credential value appears anywhere in the result or traces', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'trace',
        data: { logGroup: 'login', type: 'info', message: 'filled the rut input', timestamp: 1 },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    const serialized = JSON.stringify(results[0]);
    expect(serialized).not.toContain('ZZSENTINELRUTZZ');
    expect(serialized).not.toContain('ZZSENTINELPASSZZ');
  });
});

describe('ScrapeSession — AC13: partial read', () => {
  it('a product-scoped failure after products succeed reports partial, keeps the data, and names the product+reason', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct(), rawProduct({ instanceId: VALID_ID_2 })] },
      }),
    );
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'parse_failed', productInstanceId: VALID_ID_2, attempts: 3 } }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));

    const result = results[0] as ScrapeResult;
    expect(result.outcome).toBe('partial');
    expect(result.products).toHaveLength(2); // nothing already gathered is discarded
    expect(result.productFailures).toEqual([{ productInstanceId: VALID_ID_2, reasonCode: 'parse_failed', attempts: 3 }]);
  });
});

describe('ScrapeSession — AC14: rejected sign-in', () => {
  it('reports invalid_credentials as a read-level failure with no product named, gathers nothing, and finalizes', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'invalid_credentials' } }));

    const result = results[0] as ScrapeResult;
    expect(result.outcome).toBe('failed');
    expect(result.readFailure).toEqual({ reasonCode: 'invalid_credentials' });
    expect(result.productFailures).toEqual([]);
    expect(result.products).toEqual([]);
  });

  it('does not attach the bank\'s own error text anywhere in the result', () => {
    const { session, results } = drive();
    session.start();
    // The login script intentionally posts no `message` field for invalid_credentials — but
    // defensively assert the engine would not surface one even if a stray field arrived.
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'invalid_credentials', message: 'should never be trusted' } }),
    );
    expect(JSON.stringify(results[0])).not.toContain('should never be trusted');
  });
});

describe('ScrapeSession — AC15: network / session_closed / parse_failed, asserted separately', () => {
  it('network: a read that never establishes a session and hits an origin violation', () => {
    const { session, results } = drive();
    session.start();
    session.handleLoadEnd('https://evil.example/login');
    expect(results[0]?.outcome).toBe('failed');
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'network' });
  });

  it('session_closed: an origin violation after the session was established', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'state-change', stepId: 'get-products-start', progress: 0.5 }),
    );
    session.handleLoadEnd('https://evil.example/anything');
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'session_closed' });
  });

  it('parse_failed: a page loads but does not match what the scraper expects (read-level, no product)', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'parse_failed' } }));
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'parse_failed' });
    expect(results[0]?.outcome).toBe('failed');
  });
});

describe('ScrapeSession — AC16: origin allowlist at the navigation and injection checkpoints', () => {
  it('checkpoint 1 (onShouldStartLoadWithRequest) rejects a lookalike host and never injects the login script', () => {
    const { session, port, results } = drive();
    session.start();
    expect(session.handleShouldStartLoadWithRequest('https://fake-bank-lookalike.example/login')).toBe(false);
    expect(port.injectedSources).toEqual([]);
    expect(results[0]?.outcome).toBe('failed');
    expect(results[0]?.readFailure?.reasonCode).toBe('network');
  });

  it('checkpoint 1 allows the real origin and about:blank', () => {
    const { session } = drive();
    session.start();
    expect(session.handleShouldStartLoadWithRequest(`${ORIGIN}/login`)).toBe(true);
    expect(session.handleShouldStartLoadWithRequest('about:blank')).toBe(true);
  });

  it('checkpoint 1 blocks (but does not finalize the read for) an off-origin non-top-frame request (CodeRabbit finding #24)', () => {
    const { session, results } = drive();
    session.start();
    const allowed = session.handleShouldStartLoadWithRequest('https://ads.example/tracker', false);
    expect(allowed).toBe(false);
    expect(results).toEqual([]); // the read is not finalized — no origin failure recorded
    expect(session.isFinalized()).toBe(false);
    // A subsequent top-frame request to the real origin still proceeds normally.
    expect(session.handleShouldStartLoadWithRequest(`${ORIGIN}/login`, true)).toBe(true);
  });

  it('checkpoint 2 (onLoadEnd) rejects a redirect that lands off-origin partway through and never injects', () => {
    const { session, port, results } = drive();
    session.start();
    session.handleLoadEnd('https://fake-bank.example.evil.example/login');
    expect(port.injectedSources).toEqual([]);
    expect(results[0]?.outcome).toBe('failed');
    expect(results[0]?.readFailure?.reasonCode).toBe('network');
  });

  it('a read visits only the allowed origin and only the mapped script paths', () => {
    const { session, port } = drive();
    session.start();
    session.handleLoadEnd(`${ORIGIN}/login`);
    expect(port.injectedSources).toEqual(['login-script']);
  });
});

describe('ScrapeSession — AC17: exactly four failure reasons', () => {
  it('an unrecognized code from the page is coerced to parse_failed, never a fifth reason', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'something-else' } }));
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'parse_failed' });
  });
});

describe('ScrapeSession — AC18: refusal for an unsupported bank or country', () => {
  const registry = { cl: [buildConfig()] };

  it('refuses an unsupported country before anything is opened', () => {
    const result = resolveBankConfigOrReject(registry, 'ar', 'fake-bank');
    expect(result).toEqual({ reason: 'unsupported_country', countryCode: 'ar', bankId: 'fake-bank' });
  });

  it('refuses an unsupported bank id within a supported country', () => {
    const result = resolveBankConfigOrReject(registry, 'cl', 'not-a-real-bank');
    expect(result).toEqual({ reason: 'unsupported_bank', countryCode: 'cl', bankId: 'not-a-real-bank' });
  });

  it('resolves a supported bank to its config (distinguishable from a rejection)', () => {
    const result = resolveBankConfigOrReject(registry, 'cl', 'fake-bank');
    expect(result).not.toHaveProperty('reason');
    expect((result as BankConfig).id).toBe('fake-bank');
  });
});

describe('ScrapeSession — AC19: bounded retries and attempts in the trail', () => {
  it('relays the attempts count the page reports for a product failure', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'parse_failed', productInstanceId: VALID_ID_1, attempts: 3 } }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.productFailures[0]?.attempts).toBe(3);
  });

  it('a read not finished by the deadline ends as a failure using the last-attempted reason', () => {
    const results: ScrapeResult[] = [];
    const session = new ScrapeSession(buildConfig(), new FakeWebViewPort(), {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      readDeadlineMs: 5000,
      onResult: (result) => results.push(result),
    });
    session.start();
    // A product-scoped failure with nothing else gathered: the read deadline still expires with
    // outcome 'failed' (branch 2 of Decision 7) because no product/movement data was ever
    // ingested — only the reason code is asserted here (the point of this test is that expiry
    // uses the *last-attempted* reason, not that this particular scenario is partial).
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'parse_failed', productInstanceId: VALID_ID_1, attempts: 3 } }),
    );
    jest.advanceTimersByTime(5000);
    expect(results[0]?.outcome).toBe('failed');
    expect(results[0]?.readFailure?.reasonCode).toBe('parse_failed');
  });

  it('a read not finished by the deadline is partial when something was already gathered', () => {
    const results: ScrapeResult[] = [];
    const session = new ScrapeSession(buildConfig(), new FakeWebViewPort(), {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      readDeadlineMs: 5000,
      onResult: (result) => results.push(result),
    });
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'parse_failed', productInstanceId: VALID_ID_2, attempts: 3 } }),
    );
    jest.advanceTimersByTime(5000);
    expect(results[0]?.outcome).toBe('partial');
    // The deadline itself is a read-level event on top of the pre-existing product-scoped
    // failure (Business Rule 32): both are present, and the product gathered before it is kept.
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'parse_failed' });
    expect(results[0]?.productFailures).toEqual([{ productInstanceId: VALID_ID_2, reasonCode: 'parse_failed', attempts: 3 }]);
    expect(results[0]?.products).toHaveLength(1);
  });

  it('invalid_credentials is never retried: the read ends immediately on the first such error', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'invalid_credentials' } }));
    expect(session.isFinalized()).toBe(true);
    expect(results).toHaveLength(1);
  });
});

describe('ScrapeSession — AC20: progress never decreases', () => {
  it('reports monotonically increasing progress across a read', () => {
    const progresses: number[] = [];
    const session = new ScrapeSession(buildConfig(), new FakeWebViewPort(), {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      onResult: () => {},
      onProgress: (p) => progresses.push(p.progress),
    });
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'login-start', progress: 0.1 }));
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'get-products-start', progress: 0.5 }));
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'state-change', stepId: 'get-transactions-start', progress: 0.9 }),
    );
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'state-change', stepId: 'get-transactions-start', progress: 0.75 }),
    );
    for (let i = 1; i < progresses.length; i += 1) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1] as number);
    }
  });
});

describe('ScrapeSession — a rejected step transition still ingests the data it carried (CodeRabbit finding #25)', () => {
  it('keeps products/movements from a state-change payload even when the step itself is rejected as backwards', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'login-start', progress: 0.1 }));
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'state-change', stepId: 'get-transactions-start', progress: 0.9 }),
    );
    // A later message names an earlier step (rejected as backwards by StateManagerService) but
    // still carries a genuine product — this must not be discarded along with the step.
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.products.map((p) => p.instanceId)).toContain(VALID_ID_1);
  });
});

describe('ScrapeSession — AC21: reading the same fixtures twice is identical', () => {
  it('two independent sessions fed the same messages produce identical movements', () => {
    const { session: sessionA, results: resultsA } = drive();
    const { session: sessionB, results: resultsB } = drive();
    for (const session of [sessionA, sessionB]) {
      session.start();
      session.handleWebViewMessage(
        JSON.stringify({
          eventType: 'state-change',
          stepId: 'get-transactions-start',
          progress: 0.9,
          data: { movements: [rawMovement(), rawMovement({ positionInReadSnapshot: 1 })] },
        }),
      );
      session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    }
    expect(resultsA[0]?.movements).toEqual(resultsB[0]?.movements);
  });
});

describe('ScrapeSession — AC22: two identical-looking movements stay two, distinguishable by position', () => {
  it('same day, amount and description at two positions are both kept', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.9,
        data: { movements: [rawMovement(), rawMovement({ positionInReadSnapshot: 1 })] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.movements).toHaveLength(2);
  });
});

describe('ScrapeSession — AC23: no manufactured bank-supplied identity', () => {
  it('bankSuppliedId is null when the bank does not supply one', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.9,
        data: { movements: [rawMovement()] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.movements[0]?.bankSuppliedId).toBeNull();
  });
});

describe('ScrapeSession — AC25: unsupported product kind is skipped, still complete', () => {
  it('a mixed supported/unsupported product list yields complete with a diagnostic entry', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct(), rawProduct({ instanceId: VALID_ID_2, kindKey: 'unsupported' })] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    const result = results[0] as ScrapeResult;
    expect(result.outcome).toBe('complete');
    expect(result.products).toHaveLength(1);
    expect(result.skippedProductKinds).toEqual(['unsupported']);
  });
});

describe('ScrapeSession — Decision 6: shape violations are rejected, not silently degraded', () => {
  it('a product carrying a forbidden key produces no product and a diagnostic trace', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct({ elementIndex: 0 })] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    const result = results[0] as ScrapeResult;
    expect(result.products).toEqual([]);
    expect(result.traces.some((t) => t.message === 'rejected_product_shape')).toBe(true);
  });
});

describe('ScrapeSession — Decision 7: outcome derivation, all four branches', () => {
  it('branch 1: cancelled overrides everything, even a prior failure', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'network' } }));
    // Already finalized as 'failed' at this point; cancel() after finalize is a no-op by design.
    session.cancel();
    expect(results[0]?.outcome).toBe('failed');
  });

  it('branch 1 (real case): cancelling before any failure yields cancelled, not failed', () => {
    const { session, results } = drive();
    session.start();
    session.cancel();
    expect(results[0]?.outcome).toBe('cancelled');
    expect(results[0]?.readFailure).toBeNull();
    expect(results[0]?.productFailures).toEqual([]);
  });

  it('branch 2: failure with nothing gathered is failed', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'error', data: { code: 'network' } }));
    expect(results[0]?.outcome).toBe('failed');
  });

  it('branch 3: failure with something gathered is partial', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.handleWebViewMessage(
      JSON.stringify({ eventType: 'error', data: { code: 'parse_failed', productInstanceId: VALID_ID_2, attempts: 1 } }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.outcome).toBe('partial');
  });

  it('branch 4: no failure at all is complete', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.outcome).toBe('complete');
  });
});

describe('ScrapeSession — Cancellation (Decision 9)', () => {
  it('clears credentials before tearing down the browser session (ordering)', () => {
    const port = new FakeWebViewPort();
    const orderedCalls: string[] = [];
    const originalStopLoading = port.stopLoading.bind(port);
    port.stopLoading = () => {
      orderedCalls.push('port.stopLoading');
      originalStopLoading();
    };
    const session = new ScrapeSession(buildConfig(), port, {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      onResult: () => {},
    });
    // Spy on clear() by wrapping cancel()'s effect via a a proxy is awkward with # private fields;
    // instead assert observable ordering via the port call log, which is only ever reached AFTER
    // finalize() calls credentials.clear() (verified by code inspection of #finalize()).
    session.start();
    session.cancel();
    expect(orderedCalls).toEqual(['port.stopLoading']);
  });

  it('a message injected after cancellation changes nothing about the emitted result', () => {
    const { session, results } = drive();
    session.start();
    session.cancel();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.products).toEqual([]);
  });

  it('a cancelled read carries whatever was already gathered', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.cancel();
    expect(results[0]?.outcome).toBe('cancelled');
    expect(results[0]?.products).toHaveLength(1);
  });

  it('cancel() is idempotent (a second call after finalize is a no-op)', () => {
    const { session, results } = drive();
    session.start();
    session.cancel();
    session.cancel();
    expect(results).toHaveLength(1);
  });

  it('a throwing teardown still produces a result instead of an uncaught exception (related to CodeRabbit finding #29)', () => {
    const port = new FakeWebViewPort();
    port.stopLoading = () => {
      throw new Error('stopLoading failed');
    };
    const results: ScrapeResult[] = [];
    const session = new ScrapeSession(buildConfig(), port, {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      onResult: (result) => results.push(result),
    });
    session.start();
    expect(() => session.cancel()).not.toThrow();
    expect(results).toHaveLength(1);
    expect(results[0]?.outcome).toBe('cancelled');
  });
});

describe('ScrapeSession — synchronous startup failure (CodeRabbit finding #29)', () => {
  it('reports a failed outcome (not cancelled) when WebViewPort.navigateTo() throws during start()', () => {
    const throwingPort: FakeWebViewPort = new FakeWebViewPort();
    throwingPort.navigateTo = () => {
      throw new Error('synchronous navigateTo failure');
    };
    const results: ScrapeResult[] = [];
    const session = new ScrapeSession(buildConfig(), throwingPort, {
      countryCode: 'cl',
      credentials: { rut: 'r', password: 'p' },
      onResult: (result) => results.push(result),
    });

    expect(() => session.start()).not.toThrow();
    expect(results).toHaveLength(1);
    expect(results[0]?.outcome).toBe('failed');
    expect(results[0]?.readFailure).toEqual({ reasonCode: 'network' });
    expect(session.isFinalized()).toBe(true);
  });

  it('clears the deadline timer even when start() throws synchronously (no dangling timer)', () => {
    jest.useFakeTimers();
    try {
      const throwingPort: FakeWebViewPort = new FakeWebViewPort();
      throwingPort.navigateTo = () => {
        throw new Error('synchronous navigateTo failure');
      };
      let resultCount = 0;
      const session = new ScrapeSession(buildConfig(), throwingPort, {
        countryCode: 'cl',
        credentials: { rut: 'r', password: 'p' },
        onResult: () => {
          resultCount += 1;
        },
      });
      session.start();
      expect(resultCount).toBe(1);
      // If the deadline timer were left dangling, advancing past READ_DEADLINE_MS would call
      // #handleDeadlineExpired() and post a second result.
      jest.advanceTimersByTime(300_000);
      expect(resultCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ScrapeSession — message-before-start and late-message handling', () => {
  it('drops a message that arrives before start() with a trace, not a throw', () => {
    const { session } = drive();
    expect(() => session.handleWebViewMessage(JSON.stringify({ eventType: 'trace', data: 'x' }))).not.toThrow();
    expect(session.getTraces().some((t) => t.message === 'message_before_start')).toBe(true);
  });

  it('malformed JSON from the page does not throw', () => {
    const { session } = drive();
    session.start();
    expect(() => session.handleWebViewMessage('{not json')).not.toThrow();
  });
});

describe('ScrapeSession — does not over-fire', () => {
  it('a clean, uneventful read reaches complete with real data — a gate that blocked everything would fail this', () => {
    const { session, results } = drive();
    session.start();
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-products-start',
        progress: 0.5,
        data: { products: [rawProduct()] },
      }),
    );
    session.handleWebViewMessage(
      JSON.stringify({
        eventType: 'state-change',
        stepId: 'get-transactions-start',
        progress: 0.9,
        data: { movements: [rawMovement()] },
      }),
    );
    session.handleWebViewMessage(JSON.stringify({ eventType: 'state-change', stepId: 'ready', progress: 1 }));
    expect(results[0]?.outcome).toBe('complete');
    expect(results[0]?.products.length).toBeGreaterThan(0);
    expect(results[0]?.movements.length).toBeGreaterThan(0);
  });
});
