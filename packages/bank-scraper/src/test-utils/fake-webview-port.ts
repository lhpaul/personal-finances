import type { WebViewPort } from '../types/bank-config.types';

/**
 * Records every call and lets a test feed `onLoadEnd`/`onMessage` synchronously — this is how the
 * engine is exercised with no phone, no simulator and no network (implementation plan Decision
 * 14, AC30).
 */
export class FakeWebViewPort implements WebViewPort {
  readonly calls: Array<
    | { method: 'navigateTo'; url: string }
    | { method: 'injectJavaScript'; source: string }
    | { method: 'stopLoading' }
  > = [];

  #currentUrl: string | null = null;

  navigateTo(url: string): void {
    this.calls.push({ method: 'navigateTo', url });
    this.#currentUrl = url;
  }

  injectJavaScript(source: string): void {
    this.calls.push({ method: 'injectJavaScript', source });
  }

  stopLoading(): void {
    this.calls.push({ method: 'stopLoading' });
  }

  getCurrentUrl(): string | null {
    return this.#currentUrl;
  }

  /** Test helper: the list of script sources injected so far, in order. */
  get injectedSources(): string[] {
    return this.calls
      .filter((call): call is { method: 'injectJavaScript'; source: string } => call.method === 'injectJavaScript')
      .map((call) => call.source);
  }

  /** Test helper: every URL passed to navigateTo, in order. */
  get navigatedUrls(): string[] {
    return this.calls
      .filter((call): call is { method: 'navigateTo'; url: string } => call.method === 'navigateTo')
      .map((call) => call.url);
  }
}
