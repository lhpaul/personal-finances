/**
 * Executes a generated injected-script string against the current jsdom document and captures
 * every message it posts via `window.ReactNativeWebView.postMessage` (implementation plan
 * Testing Strategy — the four `*.script.dom.test.ts` files). Test-only: never used by shipped
 * code.
 */

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

/**
 * Runs `source` (a string produced by a `*.script.ts` generator) as an async IIFE against the
 * current `document`, with `globals` pre-assigned on `window` first (mirroring how the source's
 * scripts thread `productId` / `finalProgress` as implicit globals across separate
 * `injectJavaScript` calls into the same page).
 */
export async function runInjectedScript(
  source: string,
  globals: Record<string, unknown> = {},
): Promise<ScriptRunResult> {
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
    const runner = new Function(`return (async () => { ${source} \n})();`) as () => Promise<unknown>;
    await runner();
  } catch (error) {
    thrown = error;
  }
  return { messages, thrown };
}
