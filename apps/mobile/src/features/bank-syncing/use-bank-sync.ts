import type { ScraperStepId } from '@finanzas/bank-scraper';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { getConnection as getConnectionFromDb } from '../../db/repositories/institutions';
import { createRuntimePorts, getAppDatabase } from '../../db/runtime';
import { consumePendingSyncHandoff, type ConnectHandoff } from '../connect-bank/sync-handoff';
import { runSync as runSyncFn } from '../sync';
import { resolveBankSyncingState, type BankSyncingState, type SyncPhase } from './bank-syncing-state';
import type { SyncFailureKind } from './failure-copy';
import { resolveRetryDecision, runAttempt, type AttemptOutcome } from './sync-attempt';
import { useScraperRunner } from './use-scraper-runner';

/**
 * `use-bank-sync.ts`'s single feature hook (implementation plan Decisions 6, 8, 9; V15's
 * "screens call neither `getAppDatabase()` nor a repository directly" pattern). Awaits
 * `getAppDatabase()`, calls `runSync(deps, request)` with the `ConnectHandoff` item #9 left in
 * its module-scoped pending-handoff slot, maps `SyncRunResult` + `getConnection` onto a
 * `SyncPhase` via `runAttempt` / `resolveRetryDecision` (Decisions 6, 8 — both in
 * `./sync-attempt.ts`, a React-free module so a `.db.test.ts` file can drive `runAttempt`
 * directly), and is cancellation-guarded on unmount (Decision 9).
 */

export type { AttemptOutcome, RetryDecision, RunAttemptDeps } from './sync-attempt';
export { resolveRetryDecision, runAttempt } from './sync-attempt';

export interface UseBankSyncResult {
  /** The hidden `<WebView>` (or scripted-run placeholder), or `null` when idle. Must be rendered
   * by the route — this is the app's only WebView host (Decision 1). */
  element: ReactNode;
  state: BankSyncingState;
  phase: SyncPhase;
  /** 0..1, the scraper's own raw progress — the caller applies `resolveProgressValue` (Decision
   * 3). `null` before the first `onProgress` event (phase `starting`). */
  rawProgress: number | null;
  failure: { reasonCode: SyncFailureKind } | null;
  /** `true` once a `ConnectHandoff` failed to resolve at mount (a stale deep link, or a reset
   * module store) — the route redirects rather than stranding the person on a screen with
   * nothing to sync (mirrors `bank-credentials.tsx`'s own `institution === undefined` guard). */
  handoffMissing: boolean;
  retry: () => void;
}

export interface UseBankSyncOptions {
  /** `false` under a fidelity preview capture (Decision 12): the hook still mounts — Rules of
   * Hooks forbids calling it conditionally — but its mount effect never consumes the pending
   * handoff and never starts an attempt, so `element` stays `null` (no WebView), no keychain is
   * read and no `runSync` call happens. Defaults to `true`. */
  enabled?: boolean;
}

export function useBankSync({ enabled = true }: UseBankSyncOptions = {}): UseBankSyncResult {
  const router = useRouter();
  const [progress, setProgress] = useState<{ stepId: ScraperStepId; progress: number } | null>(null);
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null);
  const [handoffMissing, setHandoffMissing] = useState(false);

  const handoffRef = useRef<ConnectHandoff | null>(null);
  const inFlightRef = useRef(false);
  // Guards a `setState` that resolves after unmount (item #12's `cancelled` pattern) — database
  // writes from an in-flight `runSync` are unaffected; only this hook's own state is discarded.
  const unmountedRef = useRef(false);

  const handleProgress = useCallback((next: { stepId: ScraperStepId; progress: number }) => {
    if (unmountedRef.current) return;
    setProgress(next);
  }, []);

  const { element, runner, cancel } = useScraperRunner(handleProgress);

  const startAttempt = useCallback(
    async (handoff: ConnectHandoff) => {
      if (inFlightRef.current) return; // synchronous re-entrancy guard (scenario 18)
      inFlightRef.current = true;
      setProgress(null);
      setOutcome(null);
      try {
        const db = await getAppDatabase();
        if (unmountedRef.current) return;
        // `runAttempt` never throws (it catches its own unexpected errors — see
        // `sync-attempt.ts`), but `getAppDatabase()` above can still reject (e.g. bootstrap
        // failure); that path is also mapped rather than left as an unhandled rejection from
        // this fire-and-forget call.
        const result = await runAttempt(
          { db, ports: createRuntimePorts(), runner, runSync: runSyncFn, getConnection: getConnectionFromDb },
          { connectionId: handoff.connectionId },
        );
        if (unmountedRef.current) return;
        setOutcome(result);
      } catch {
        if (!unmountedRef.current) setOutcome({ phase: 'failed', failure: { reasonCode: 'parse_failed' } });
      } finally {
        inFlightRef.current = false;
      }
    },
    [runner],
  );

  useEffect(() => {
    if (!enabled) return undefined; // Decision 12: a fidelity preview starts no read at all
    unmountedRef.current = false;
    const handoff = consumePendingSyncHandoff();
    handoffRef.current = handoff;
    if (handoff === null) {
      setHandoffMissing(true);
    } else {
      void startAttempt(handoff);
    }
    return () => {
      unmountedRef.current = true;
      // Cancel before unmount, never after (concurrency addendum) — `cancel()` runs
      // synchronously while the runner's port is still alive (Decision 9, Assumption A1).
      cancel();
    };
    // Runs once on mount only (plus once more if `enabled` itself flips, which a given screen
    // instance never does in practice — mirrors `useFidelityPreview()`'s own fixed-per-mount
    // contract) — the handoff is consumed exactly once (Decision 5); a retry reuses
    // `handoffRef.current` instead of calling `consumePendingSyncHandoff()` again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const retry = useCallback(() => {
    const decision = resolveRetryDecision(outcome);
    const handoff = handoffRef.current;
    if (decision.kind === 'noop' || handoff === null) return; // scenario 18: no-op unless terminally failed/refused
    if (decision.kind === 'reenter_credentials') {
      router.replace('/(onboarding)/bank-credentials'); // scenario 17: no read starts here
      return;
    }
    void startAttempt(handoff); // scenario 16: re-reads the same stored credential, no prompt
  }, [outcome, router, startAttempt]);

  const phase: SyncPhase = outcome !== null ? outcome.phase : progress === null ? 'starting' : 'reading';
  const stepId: ScraperStepId = progress?.stepId ?? 'load-start';
  const state = resolveBankSyncingState({ phase, stepId });

  return {
    element,
    state,
    phase,
    rawProgress: progress?.progress ?? null,
    failure: outcome?.failure ?? null,
    handoffMissing,
    retry,
  };
}
