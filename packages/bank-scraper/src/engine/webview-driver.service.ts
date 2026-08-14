import type { BankConfig, WebViewPort } from '../types/bank-config.types';

/**
 * Navigation, injection and teardown (implementation plan Layer-by-Layer Changes → engine;
 * Decision 14). This service owns page-lifecycle bookkeeping only — the exact-origin gates
 * (Decision 4) live one layer up in `ScrapeSession`, which is the only place that also knows
 * whether the login step has already succeeded (`sessionEstablished`).
 *
 * `#pageLoadedState` drops a duplicate `onLoadEnd` for a URL already marked loaded — a
 * single-page Angular app fires `onLoadEnd` repeatedly as the hash route changes. Script keys
 * marked `singleExecution` are additionally guarded by `#executedScripts` so a re-fired
 * `onLoadEnd` for the same URL cannot inject twice.
 */

const ABOUT_BLANK_URL = 'about:blank';

export type LoadEndDecision =
  | { kind: 'bootstrap' }
  | { kind: 'already_loaded' }
  | { kind: 'no_script' }
  | { kind: 'inject'; scriptKey: string; delay?: number };

/**
 * Match a configured script path against the URL's pathname + hash (never the host).
 * Root path `/` is exact-only so it cannot starve more specific routes. When several paths
 * match, the longest wins.
 */
export function matchScriptPath(url: string, path: string): boolean {
  let location: string;
  try {
    const parsed = new URL(url);
    location = `${parsed.pathname}${parsed.hash}`;
  } catch {
    return false;
  }
  if (path === '/') {
    const pathname = location.split('#')[0] ?? location;
    return pathname === '/' || pathname === '';
  }
  return location.includes(path);
}

export class WebViewDriverService {
  readonly #port: WebViewPort;
  readonly #config: BankConfig;
  #pageLoadedState: { url: string; loaded: boolean } = { url: '', loaded: false };
  #executedScripts: Record<string, boolean> = {};
  #pendingInjectionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(port: WebViewPort, config: BankConfig) {
    this.#port = port;
    this.#config = config;
  }

  start(): void {
    this.#port.navigateTo(this.#config.url);
  }

  handleLoadStart(url: string): void {
    if (url === ABOUT_BLANK_URL) return;
    if (this.#pageLoadedState.url === url) return;
    this.#pageLoadedState = { url, loaded: false };
  }

  /**
   * Decides whether, and which, script should be injected for this load-end URL. The caller
   * (`ScrapeSession`) is responsible for the origin re-check (checkpoint 2) **before** calling
   * this method — this method assumes the URL has already been cleared.
   */
  handleLoadEnd(url: string): LoadEndDecision {
    if (url === ABOUT_BLANK_URL) {
      this.#pageLoadedState = { url: '', loaded: false };
      return { kind: 'bootstrap' };
    }
    if (this.#pageLoadedState.url === url && this.#pageLoadedState.loaded) {
      return { kind: 'already_loaded' };
    }
    this.#pageLoadedState = { url, loaded: true };

    let scriptKey: string | undefined;
    let bestPathLength = -1;
    for (const key of Object.keys(this.#config.scripts)) {
      const path = this.#config.scripts[key]?.path;
      if (path === undefined || !matchScriptPath(url, path)) continue;
      if (path.length > bestPathLength) {
        bestPathLength = path.length;
        scriptKey = key;
      }
    }
    if (!scriptKey) return { kind: 'no_script' };

    const scriptConfig = this.#config.scripts[scriptKey];
    if (!scriptConfig) return { kind: 'no_script' };
    if (scriptConfig.singleExecution && this.#executedScripts[scriptKey]) {
      return { kind: 'no_script' };
    }
    if (scriptConfig.singleExecution) {
      this.#executedScripts[scriptKey] = true;
    }
    return { kind: 'inject', scriptKey, delay: scriptConfig.delay };
  }

  /**
   * Injects the script `buildSource()` produces. `buildSource` is called **at** injection time,
   * never earlier — this is what lets a caller build a credential-bearing script string inside
   * `CredentialHolder.consume(...)` and hand it straight to this method in one expression,
   * without this service ever seeing, storing, or tracing the source (Decision 5, control 2).
   */
  inject(buildSource: () => string, delay?: number): void {
    // `#pendingInjectionTimer` holds only one handle. Without clearing it first, a second call
    // to `inject()` with `delay` before the first scheduled timeout fires would overwrite the
    // field and lose the first handle — `teardown()` can then only clear the *second* timer, so
    // the first keeps running after teardown and still calls `buildSource()` and
    // `injectJavaScript()` on a session that has already finalized (CodeRabbit finding #28).
    if (this.#pendingInjectionTimer !== null) {
      clearTimeout(this.#pendingInjectionTimer);
      this.#pendingInjectionTimer = null;
    }
    if (delay) {
      this.#pendingInjectionTimer = setTimeout(() => {
        this.#pendingInjectionTimer = null;
        this.#port.injectJavaScript(buildSource());
      }, delay);
    } else {
      this.#port.injectJavaScript(buildSource());
    }
  }

  /**
   * The single teardown path (Decision 5, 9): clears the pending injection-delay timer, stops
   * loading, navigates to `about:blank` (destroying the page's JavaScript context so an
   * in-flight injected script's context is gone and its late responses cannot be delivered), and
   * resets the single-execution / page-loaded bookkeeping so nothing from this session is carried
   * into a later read (AC32).
   */
  teardown(): void {
    if (this.#pendingInjectionTimer !== null) {
      clearTimeout(this.#pendingInjectionTimer);
      this.#pendingInjectionTimer = null;
    }
    this.#port.stopLoading();
    this.#port.navigateTo(ABOUT_BLANK_URL);
    this.#executedScripts = {};
    this.#pageLoadedState = { url: '', loaded: false };
  }

  /** Test/diagnostic seam: whether anything is still tracked as "loaded" or "executed". */
  hasResidualState(): boolean {
    return this.#pageLoadedState.url !== '' || Object.keys(this.#executedScripts).length > 0;
  }
}
