import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ComponentType, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import RNWebView from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation, WebViewProps } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';
// Deep import: `ShouldStartLoadRequest` is defined here but not re-exported from the package
// root (verified against the installed react-native-webview version, Decision 13).
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { ScrapeSession } from '../engine/scrape-session';
import type { BankConfig, WebViewPort } from '../types/bank-config.types';
import type { ScraperStepId } from '../types/protocol.types';
import type { ScrapeResult } from '../types/scrape-result.types';

/**
 * The hidden `<WebView>` and its `WebViewPort` implementation (implementation plan Decision 14,
 * Decision 13). This file is **not** re-exported from `src/index.ts` (Decision 3) — it imports
 * `react`, `react-native` and `react-native-webview`, which `apps/mobile` does not currently
 * depend on (follow-up F1).
 *
 * **Unverified against a real device** (flagged per `REVIEW.md`, implementation plan Decision
 * 13): every prop name below is checked against the `react-native-webview` version this package
 * declares (`^13.16.0`, resolved in Step 1) by reading its own `.d.ts`, not against a running
 * app — this component itself has no test in this item's suite. Every acceptance criterion is
 * exercised through `WebViewPort` and `FakeWebViewPort`, never through this component.
 */

const ABOUT_BLANK_URL = 'about:blank';

/**
 * `WebView`'s exported class type is `class WebView<P = undefined> extends Component<WebViewProps
 * & P>` — used without an explicit type argument in JSX, `WebViewProps & undefined` collapses to
 * a props type nothing can satisfy. Casting to a plain `ComponentType` with the real prop/ref
 * shape sidesteps that generic-default quirk without changing any runtime behavior.
 */
type WebViewInstance = InstanceType<typeof RNWebView>;
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewInstance> }>;

export interface BankScraperProps {
  config: BankConfig;
  credentials: Record<string, string>;
  priorMonths?: number;
  readDeadlineMs?: number;
  onResult: (result: ScrapeResult) => void;
  onProgress?: (progress: { stepId: ScraperStepId; progress: number }) => void;
  /** Renders the WebView on-screen for local debugging only. Never true in a shipped build. */
  debugVisible?: boolean;
}

export interface BankScraperHandle {
  cancel: () => void;
}

export const BankScraperComponent = forwardRef<BankScraperHandle, BankScraperProps>(function BankScraperComponent(
  { config, credentials, priorMonths, readDeadlineMs, onResult, onProgress, debugVisible = false },
  ref,
) {
  const webViewRef = useRef<WebViewInstance>(null);
  const [sourceUri, setSourceUri] = useState(ABOUT_BLANK_URL);

  const port: WebViewPort = useMemo(
    () => ({
      navigateTo: (url: string) => setSourceUri(url),
      injectJavaScript: (source: string) => webViewRef.current?.injectJavaScript(source),
      stopLoading: () => webViewRef.current?.stopLoading(),
      getCurrentUrl: () => sourceUri,
    }),
    [sourceUri],
  );

  const sessionRef = useRef<ScrapeSession | null>(null);
  // Session creation and startup moved into an effect (CodeRabbit findings #4, #5): creating and
  // starting a ScrapeSession directly in the render body is a side effect during render, and —
  // more importantly — had no unmount cleanup at all. If this component unmounted before the
  // read finished, the session's deadline timer, WebView driver state, and cleared credentials
  // would never happen; cancel() now runs as the effect's cleanup. Deliberately mount-only ([]):
  // ScrapeSession is a one-shot object for a single read, not meant to be recreated if a prop
  // (e.g. onProgress) changes identity mid-read.
  useEffect(() => {
    const session = new ScrapeSession(config, port, {
      countryCode: 'cl',
      credentials,
      priorMonths,
      readDeadlineMs,
      onResult,
      onProgress,
    });
    sessionRef.current = session;
    session.start();
    return () => {
      session.cancel();
      sessionRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    cancel: () => sessionRef.current?.cancel(),
  }));

  const handleShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    return sessionRef.current?.handleShouldStartLoadWithRequest(request.url, request.isTopFrame) ?? false;
  }, []);

  const handleLoadStart = useCallback((event: { nativeEvent: WebViewNavigation }) => {
    sessionRef.current?.handleLoadStart(event.nativeEvent.url);
  }, []);

  const handleLoadEnd = useCallback((event: WebViewNavigationEvent | WebViewErrorEvent) => {
    sessionRef.current?.handleLoadEnd(event.nativeEvent.url);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    sessionRef.current?.handleWebViewMessage(event.nativeEvent.data);
  }, []);

  return (
    <View style={debugVisible ? styles.visibleContainer : styles.hiddenContainer}>
      <WebView
        ref={webViewRef}
        style={debugVisible ? styles.visibleWebView : styles.hiddenWebView}
        source={{ uri: sourceUri }}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        originWhitelist={config.allowedOrigins as unknown as string[]}
        // Selects the bank's mobile page layout, which every ported selector and fixture was
        // written against (implementation plan Decision 13) — not bot-detection evasion.
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        webviewDebuggingEnabled={__DEV__}
        incognito
        cacheEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        domStorageEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="never"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
  visibleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  visibleWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
