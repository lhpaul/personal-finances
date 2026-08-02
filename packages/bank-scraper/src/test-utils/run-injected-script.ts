import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util';

/**
 * Executes a generated injected-script string against the current jsdom document and captures
 * every message it posts via `window.ReactNativeWebView.postMessage` (implementation plan
 * Testing Strategy — the four `*.script.dom.test.ts` files). Test-only: never used by shipped
 * code.
 *
 * jsdom does not implement `window.crypto.subtle` or `window.TextEncoder` (unlike every real
 * mobile WebView, where both are present — the bank origin is HTTPS and therefore a secure
 * context, and `TextEncoder` is a standard Web API every mobile browser engine ships). Polyfill
 * both from Node's own implementations so a DOM test can exercise the normal, successful
 * instance-id path (`computeInstanceId` needs both); `withoutCryptoSubtle()` below lets the one
 * test that must exercise Risk R4's fallback (`crypto.subtle` unavailable -> `parse_failed` for
 * that product, never a raw-number or index fallback) remove it again for that single call.
 */
// Installed once per jsdom window (one per test file) rather than re-checked on every call —
// `runInjectedScript` calls `ensureWebPlatformPolyfills()` on every invocation, and re-checking
// "is subtle undefined" on each call would silently re-install the polyfill in the middle of
// `withoutCryptoSubtle()`'s deliberate removal window below.
let webPlatformPolyfillsInstalled = false;

function ensureWebPlatformPolyfills(): void {
  if (webPlatformPolyfillsInstalled) return;
  webPlatformPolyfillsInstalled = true;
  const cryptoObject = window.crypto as Crypto | undefined;
  if (cryptoObject && cryptoObject.subtle === undefined) {
    Object.defineProperty(cryptoObject, 'subtle', {
      value: webcrypto.subtle,
      configurable: true,
    });
  }
  const globalWithEncoders = window as unknown as { TextEncoder?: unknown; TextDecoder?: unknown };
  if (globalWithEncoders.TextEncoder === undefined) {
    globalWithEncoders.TextEncoder = NodeTextEncoder;
  }
  if (globalWithEncoders.TextDecoder === undefined) {
    globalWithEncoders.TextDecoder = NodeTextDecoder;
  }
}

/** Test-only: temporarily removes `window.crypto.subtle` for the duration of `fn`. */
export async function withoutCryptoSubtle<T>(fn: () => Promise<T>): Promise<T> {
  ensureWebPlatformPolyfills(); // guarantees subtle exists to remove, without this call re-adding it later
  const cryptoObject = window.crypto as Crypto;
  const original = cryptoObject.subtle;
  Object.defineProperty(cryptoObject, 'subtle', { value: undefined, configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(cryptoObject, 'subtle', { value: original, configurable: true });
  }
}

export interface ScriptRunResult {
  messages: Array<{ eventType: string; data?: unknown; stepId?: string; progress?: number }>;
  thrown: unknown;
}

type ScriptGlobalWindow = typeof window & {
  ReactNativeWebView?: { postMessage: (data: string) => void };
  globalVariables?: unknown;
  productId?: string;
  finalProgress?: number;
};

/** Deletes the implicit-global bookkeeping the source's scripts thread across injections. */
export function resetScriptGlobals(): void {
  const win = window as ScriptGlobalWindow;
  delete win.globalVariables;
  delete win.productId;
  delete win.finalProgress;
}

// Indirect eval — calling `eval` via a property access (`window.eval(...)`) is indirect eval per
// spec, so it always executes in the global scope, exactly like `WebView.injectJavaScript`. Unlike
// `new Function(...)`, indirect eval's completion value is the last top-level statement's
// expression value. Every generated script's last statement is
// `(async function () { ... })().then(...).catch(...);` — a fire-and-forget promise chain, since
// `injectJavaScript` gives the native side no way to await a script's completion either (a real
// WebView only ever observes the messages a script posts over time). Capturing that completion
// value and awaiting it is what lets this harness wait for the *whole* chain — including a real
// `setTimeout`-based wait and a genuinely async `crypto.subtle.digest` call — without needing
// fake timers or arbitrary polling.
function runIndirectEval(source: string): unknown {
  return window.eval(source);
}

/**
 * Runs `source` (a string produced by a `*.script.ts` generator) against the current `document`,
 * with `globals` pre-assigned on `window` first (mirroring how the source's scripts thread
 * `productId` / `finalProgress` as implicit globals across separate `injectJavaScript` calls into
 * the same page). Waits for the script's own fire-and-forget promise chain to fully settle before
 * returning.
 */
export async function runInjectedScript(
  source: string,
  globals: Record<string, unknown> = {},
): Promise<ScriptRunResult> {
  ensureWebPlatformPolyfills();
  const win = window as ScriptGlobalWindow;
  const messages: ScriptRunResult['messages'] = [];
  win.ReactNativeWebView = {
    postMessage: (data: string) => {
      messages.push(JSON.parse(data));
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    (win as unknown as Record<string, unknown>)[key] = value;
  }

  let thrown: unknown = null;
  try {
    const completionValue: unknown = runIndirectEval(source);
    if (completionValue && typeof (completionValue as Promise<unknown>).then === 'function') {
      await completionValue;
    }
  } catch (error) {
    thrown = error;
  }
  return { messages, thrown };
}
