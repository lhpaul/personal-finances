import type { FailureReasonCode, ScrapeResult, ScraperStepId } from '@finanzas/bank-scraper';

/**
 * `__DEV__`-only scripted `ScraperRunner` support (implementation plan Decision 10, issue #11).
 * Makes every `bank-syncing` state reachable without a real bank: three of the four manifest
 * states flash past in seconds with a real read, and `error` needs the bank to actually fail.
 *
 * Never imports `expo-secure-store` and never imports `@finanzas/bank-scraper/src/component`
 * (`no-secure-store-import.test.ts` asserts both) — a script fabricates a `ScrapeResult`
 * directly, so the fixture surface cannot become a credential path or mount a WebView.
 *
 * `src/features/bank-syncing/use-scraper-runner.tsx` (a production, always-bundled module)
 * reaches this file only through a `require()` behind an explicit `if (__DEV__)` guard —
 * mirroring `app/(dev)/*.tsx`'s own guard — so Metro's dead-code elimination drops this module,
 * and everything it imports, from a release bundle. {@link runInstalledScript} repeats the
 * `__DEV__` check at runtime (returning `null` unconditionally when it is false) as a second,
 * directly-testable guarantee that survives a caller-side guard regression.
 */

export type SyncFixtureScriptId =
  | 'hold_login'
  | 'hold_products'
  | 'hold_transactions'
  | 'play_full'
  | 'complete'
  | 'fail_invalid_credentials'
  | 'fail_session_closed'
  | 'fail_network'
  | 'fail_parse_failed';

let installedScript: SyncFixtureScriptId | null = null;

export function installScript(scriptId: SyncFixtureScriptId): void {
  installedScript = scriptId;
}

export function clearScript(): void {
  installedScript = null;
}

export function getInstalledScript(): SyncFixtureScriptId | null {
  return installedScript;
}

/** A fresh, empty, mutable-shaped base every call — `ScrapeResult`'s array fields are not
 * `readonly`, and sharing one frozen literal across every fabricated result would also let one
 * caller's accidental mutation leak into the next. */
function resultBase(): Pick<
  ScrapeResult,
  'countryCode' | 'bankId' | 'products' | 'movements' | 'productFailures' | 'skippedProductKinds' | 'traces'
> {
  return {
    countryCode: 'cl',
    bankId: 'banco-de-chile',
    products: [],
    movements: [],
    productFailures: [],
    skippedProductKinds: [],
    traces: [],
  };
}

function completeResult(): ScrapeResult {
  return { ...resultBase(), outcome: 'complete', readFailure: null };
}

function cancelledResult(): ScrapeResult {
  return { ...resultBase(), outcome: 'cancelled', readFailure: null };
}

function failureResult(reasonCode: FailureReasonCode): ScrapeResult {
  return { ...resultBase(), outcome: 'failed', readFailure: { reasonCode } };
}

const HOLD_STEP: Record<'hold_login' | 'hold_products' | 'hold_transactions', ScraperStepId> = {
  hold_login: 'login-start',
  hold_products: 'get-products-start',
  hold_transactions: 'get-transactions-start',
};

const FAILURE_CODE: Record<
  'fail_invalid_credentials' | 'fail_session_closed' | 'fail_network' | 'fail_parse_failed',
  FailureReasonCode
> = {
  fail_invalid_credentials: 'invalid_credentials',
  fail_session_closed: 'session_closed',
  fail_network: 'network',
  fail_parse_failed: 'parse_failed',
};

export interface ScriptRunHandle {
  cancel: () => void;
}

export interface ScriptRunCallbacks {
  onProgress: (progress: { stepId: ScraperStepId; progress: number }) => void;
  onResult: (result: ScrapeResult) => void;
}

/**
 * Starts the installed script (if any) against the given callbacks and returns a cancel handle.
 * Returns `null` when `__DEV__` is false or no script is installed — the caller falls through to
 * the real WebView-backed path in both cases. `cancel()` mirrors the real runner's own
 * cancel-is-a-value contract (Decision 9): it clears every pending timer and settles with the
 * `'cancelled'` outcome, so leaving the screen mid-script behaves the same as leaving mid-read.
 */
export function runInstalledScript(callbacks: ScriptRunCallbacks): ScriptRunHandle | null {
  if (!__DEV__) return null;
  const script = installedScript;
  if (script === null) return null;

  const timers: ReturnType<typeof setTimeout>[] = [];
  let settled = false;

  // Settle-once (found in review — CodeRabbit PR #85): `cancel()` can otherwise fire after a
  // scheduled `complete` / `play_full` / failure result has already delivered, emitting a second,
  // contradictory result for the same attempt. Every `onResult` call — scheduled or from
  // `cancel()` — funnels through this one function.
  function settle(result: ScrapeResult): void {
    if (settled) return;
    settled = true;
    callbacks.onResult(result);
  }

  function after(ms: number, fn: () => void): void {
    timers.push(setTimeout(fn, ms));
  }
  function cancel(): void {
    if (settled) return;
    for (const timer of timers) clearTimeout(timer);
    settle(cancelledResult());
  }

  if (script === 'hold_login' || script === 'hold_products' || script === 'hold_transactions') {
    callbacks.onProgress({ stepId: HOLD_STEP[script], progress: 0 });
    return { cancel }; // never settles on its own — mirrors a stuck read
  }

  if (script === 'complete') {
    after(0, () => settle(completeResult()));
    return { cancel };
  }

  if (script === 'play_full') {
    const STEP_MS = 400;
    after(STEP_MS * 0, () => callbacks.onProgress({ stepId: 'login-start', progress: 0.1 }));
    after(STEP_MS * 1, () => callbacks.onProgress({ stepId: 'login-start', progress: 0.2 }));
    // Deliberately replays an earlier step with a lower number (runbook step 4) — the screen
    // must absorb this without moving backwards. `resolveProgressValue`'s `Math.max` is what
    // guarantees that, not this script.
    after(STEP_MS * 2, () => callbacks.onProgress({ stepId: 'login-start', progress: 0.05 }));
    after(STEP_MS * 3, () => callbacks.onProgress({ stepId: 'get-products-start', progress: 0.5 }));
    after(STEP_MS * 4, () => callbacks.onProgress({ stepId: 'get-transactions-start', progress: 0.95 }));
    after(STEP_MS * 5, () => settle(completeResult()));
    return { cancel };
  }

  const reasonCode = FAILURE_CODE[script];
  after(300, () => settle(failureResult(reasonCode)));
  return { cancel };
}

/** Test-only escape hatch, mirroring `connect-fixtures-store.ts`'s reset hooks. */
export function __resetScriptedRunnerForTests(): void {
  installedScript = null;
}
