import type { BankConfig } from '../types/bank-config.types';

export const ABOUT_BLANK_URL = 'about:blank';

const BLANK_DOCUMENT = '<html><body></body></html>';

export type WebViewSource = { html: string; baseUrl?: string } | { uri: string };

/**
 * Maps the engine's navigation URL to a `react-native-webview` `source` prop.
 *
 * `{ uri: 'about:blank' }` crashes iOS WKWebView: `RNCWebViewImpl visitSource` treats a URL
 * without a host as a file URL and calls `loadFileURL`, which throws
 * `NSInvalidArgumentException: about:blank is not a file URL`. A blank HTML document is the
 * same bootstrap/teardown the old lab used (`source={{ html: '…' }}`).
 */
export function resolveWebViewSource(
  sourceUri: string,
  config: Pick<BankConfig, 'url' | 'inlineHtml'>,
): WebViewSource {
  if (sourceUri === ABOUT_BLANK_URL) {
    return { html: BLANK_DOCUMENT };
  }
  if (config.inlineHtml) {
    return { html: config.inlineHtml, baseUrl: config.url };
  }
  return { uri: sourceUri };
}
