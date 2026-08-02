import { FakeWebViewPort } from '../test-utils/fake-webview-port';
import type { BankConfig } from '../types/bank-config.types';
import { WebViewDriverService } from './webview-driver.service';

function buildConfig(overrides: Partial<BankConfig> = {}): BankConfig {
  return {
    id: 'fake-bank',
    name: 'Fake Bank',
    url: 'https://fake-bank.example/login',
    allowedOrigins: ['https://fake-bank.example'],
    credentialEntryOrigin: 'https://fake-bank.example',
    fields: [],
    scripts: {
      login: { path: '/login', script: () => 'login-script', singleExecution: true },
      home: { path: '/home', script: () => 'home-script', singleExecution: false },
      details: { path: '/details', script: () => 'details-script', singleExecution: false, delay: 500 },
    },
    normalizer: {
      mapProductKind: () => null,
      mapMovementDirection: () => 'debit',
      mapMovementExtras: () => ({}),
    },
    ...overrides,
  };
}

describe('WebViewDriverService', () => {
  it('start() navigates to the bank URL', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    driver.start();
    expect(port.navigatedUrls).toEqual(['https://fake-bank.example/login']);
  });

  it('about:blank load-end is a no-op bootstrap decision', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    expect(driver.handleLoadEnd('about:blank')).toEqual({ kind: 'bootstrap' });
  });

  it('matches a script by URL path and returns an inject decision', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    const decision = driver.handleLoadEnd('https://fake-bank.example/login?x=1');
    expect(decision).toEqual({ kind: 'inject', scriptKey: 'login', delay: undefined });
  });

  it('carries the configured delay through the inject decision', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    const decision = driver.handleLoadEnd('https://fake-bank.example/details');
    expect(decision).toEqual({ kind: 'inject', scriptKey: 'details', delay: 500 });
  });

  it('returns no_script for a URL matching no configured path', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    expect(driver.handleLoadEnd('https://fake-bank.example/unmapped')).toEqual({ kind: 'no_script' });
  });

  it('a single-execution script does not fire twice for the same URL family', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    expect(driver.handleLoadEnd('https://fake-bank.example/login').kind).toBe('inject');
    // A different login URL still matches the 'login' scriptKey by path, but singleExecution
    // has already fired once.
    expect(driver.handleLoadEnd('https://fake-bank.example/login?retry=1')).toEqual({ kind: 'no_script' });
  });

  it('a re-fired onLoadEnd for the exact same already-loaded URL is a no-op (Angular hash-route dedup)', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    driver.handleLoadEnd('https://fake-bank.example/home');
    expect(driver.handleLoadEnd('https://fake-bank.example/home')).toEqual({ kind: 'already_loaded' });
  });

  it('a non-single-execution script CAN fire again after navigating away and back (home is re-visited per product)', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    expect(driver.handleLoadEnd('https://fake-bank.example/home').kind).toBe('inject');
    // Navigate away to a different page (e.g. a product's detail page)...
    driver.handleLoadStart('https://fake-bank.example/details');
    driver.handleLoadEnd('https://fake-bank.example/details');
    // ...then back to home (history.back()): a fresh load-start/load-end cycle for the same URL
    // is a genuinely new visit, not a duplicate onLoadEnd for a page already marked loaded.
    driver.handleLoadStart('https://fake-bank.example/home');
    expect(driver.handleLoadEnd('https://fake-bank.example/home').kind).toBe('inject');
  });

  it('inject() calls buildSource at injection time and injects its result with no delay', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    let built = false;
    driver.inject(() => {
      built = true;
      return 'the-script';
    });
    expect(built).toBe(true);
    expect(port.injectedSources).toEqual(['the-script']);
  });

  it('inject() with a delay defers buildSource until the timer fires (Jest fake timers)', () => {
    jest.useFakeTimers();
    try {
      const port = new FakeWebViewPort();
      const driver = new WebViewDriverService(port, buildConfig());
      let built = false;
      driver.inject(() => {
        built = true;
        return 'delayed-script';
      }, 1000);
      expect(built).toBe(false);
      expect(port.injectedSources).toEqual([]);
      jest.advanceTimersByTime(1000);
      expect(built).toBe(true);
      expect(port.injectedSources).toEqual(['delayed-script']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('teardown() clears a pending injection timer, stops loading, and navigates to about:blank', () => {
    jest.useFakeTimers();
    try {
      const port = new FakeWebViewPort();
      const driver = new WebViewDriverService(port, buildConfig());
      let built = false;
      driver.inject(() => {
        built = true;
        return 'never-runs';
      }, 5000);
      driver.teardown();
      jest.advanceTimersByTime(10000);
      expect(built).toBe(false); // the pending timer was cleared, not merely delayed
      expect(port.calls.some((c) => c.method === 'stopLoading')).toBe(true);
      expect(port.navigatedUrls[port.navigatedUrls.length - 1]).toBe('about:blank');
    } finally {
      jest.useRealTimers();
    }
  });

  it('teardown() resets residual page-load and single-execution state (AC32)', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    driver.handleLoadEnd('https://fake-bank.example/login');
    expect(driver.hasResidualState()).toBe(true);
    driver.teardown();
    expect(driver.hasResidualState()).toBe(false);
  });

  it('does not over-fire: a fresh driver has no residual state before anything happens', () => {
    const port = new FakeWebViewPort();
    const driver = new WebViewDriverService(port, buildConfig());
    expect(driver.hasResidualState()).toBe(false);
  });
});
