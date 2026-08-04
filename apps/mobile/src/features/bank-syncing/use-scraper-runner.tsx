import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { BANK_CONFIGS, resolveBankConfigOrReject, type BankConfig, type ScraperStepId } from '@finanzas/bank-scraper';
// The only file in the app allowed to import the deep, headless-barrel-excluded component
// (implementation plan Decision 1, V8; `no-secure-store-import.test.ts` asserts this is the one
// hit for this specifier in `apps/mobile`).
import { BankScraperComponent, type BankScraperHandle } from '@finanzas/bank-scraper/src/component';

import { readCredentials } from '../../lib/secure-store/credential-store';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import type { ScraperRunner, ScraperRunRequest } from '../sync';
import {
  ScraperAttemptController,
  type ScraperAttemptControllerDeps,
  type ScriptRunCallbacks,
  type ScriptRunHandle,
} from './scraper-attempt-controller';

export { ScraperRunError, type ScraperRunErrorReason } from './scraper-attempt-controller';

export type ScraperRunnerHost = {
  /** The hidden `<WebView>`, or `null` when no real (non-scripted) read is in flight. */
  element: ReactNode;
  /** Item #10's port. Resolves exactly once per call, on the attempt's single settlement. */
  runner: ScraperRunner;
  /** Stops the in-flight read (real or scripted); safe to call when there is none. */
  cancel: () => void;
};

function resolveBankConfig(countryCode: string, bankId: string): BankConfig | null {
  const resolved = resolveBankConfigOrReject(BANK_CONFIGS, countryCode, bankId);
  return 'reason' in resolved ? null : resolved;
}

/**
 * Reaches `src/dev/scripted-runner.ts` only behind this explicit `if (__DEV__)` guard, mirroring
 * `app/(dev)/*.tsx`'s own guard — so Metro's dead-code elimination drops that module, and
 * everything it imports, from a release bundle (Decision 10).
 */
function runInstalledScriptIfDev(callbacks: ScriptRunCallbacks): ScriptRunHandle | null {
  if (!__DEV__) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see doc comment above
  const { runInstalledScript } = require('../../dev/scripted-runner') as typeof import('../../dev/scripted-runner');
  return runInstalledScript(callbacks);
}

/**
 * The `ScraperRunner` port over `BankScraperComponent` (Decisions 1, 4, 5, 9). Mounts the hidden
 * WebView **only** while a real (non-scripted) read is in flight, keyed by an internally-owned
 * `attemptId` bumped once per `run()` call — `run()` itself is only ever invoked once per
 * `runSync` call, and `runSync` is only ever called once per user-initiated attempt (the initial
 * mount, or the one *Reintentar* handler in `use-bank-sync.ts`), so the "bumped by exactly one
 * action" guarantee (Decision 4) holds without a second explicit trigger.
 *
 * `onProgress` is the feature hook's own live-progress sink (Decision 3's UI driver) — it is not
 * part of item #10's `ScraperRunner` interface, so it is accepted as a parameter here rather
 * than smuggled through `ScrapeResult`. All the settle-once, credential-clearing and
 * scripted/real branching logic lives in {@link ScraperAttemptController}, which is fully
 * testable without a renderer; this hook is a thin, largely untested binding, the same posture
 * item #6's plan already accepts for `BankScraperComponent` itself.
 */
export function useScraperRunner(
  onProgress: (progress: { stepId: ScraperStepId; progress: number }) => void,
): ScraperRunnerHost {
  const [, forceRender] = useState(0);

  // Stable identity: captured into the controller once, read through a ref, so an unstable
  // `onProgress` identity from the caller never goes stale (Decision 4).
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const controllerRef = useRef<ScraperAttemptController | null>(null);
  if (controllerRef.current === null) {
    const deps: ScraperAttemptControllerDeps = {
      resolveBankConfig,
      readCredentials: (bankId) => readCredentials(expoSecureStoreAdapter, bankId),
      runScript: runInstalledScriptIfDev,
      onProgress: (progress) => onProgressRef.current(progress),
    };
    controllerRef.current = new ScraperAttemptController(deps, () => forceRender((n) => n + 1));
  }
  const controller = controllerRef.current;

  const run = useCallback((request: ScraperRunRequest) => controller.run(request), [controller]);
  const cancel = useCallback(() => controller.cancel(), [controller]);
  const runner = useMemo<ScraperRunner>(() => ({ run }), [run]);

  const setRealCancelHandle = useCallback(
    (handle: BankScraperHandle | null) => controller.setRealCancelHandle(handle ? () => handle.cancel() : null),
    [controller],
  );

  const mountRequest = controller.getMountRequest();
  const element =
    mountRequest !== null ? (
      <BankScraperComponent
        key={mountRequest.attemptId}
        ref={setRealCancelHandle}
        config={mountRequest.config}
        credentials={mountRequest.credentials}
        onResult={controller.handleResult}
        onProgress={controller.handleProgress}
      />
    ) : null;

  return { element, runner, cancel };
}
