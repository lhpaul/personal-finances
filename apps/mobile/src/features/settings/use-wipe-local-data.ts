import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';

import { getAppDatabase, resetAppDatabase } from '../../db/runtime';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { wipeLocalData, type WipeResult } from './wipe-local-data';

/**
 * `#screen=settings-account`'s `delete-confirm` state (implementation plan for issue #19,
 * Decision 7). `'confirming'` is the modal's visibility; `'wiping'` disables the confirm button
 * and re-entrancy guards a double tap. The two failure states are split (found in review) because
 * they are not interchangeable outcomes: by construction, `'failed_credentials'` means **nothing**
 * was touched — every credential is still in the keychain, the database is untouched, and the
 * value-free "no se borró nada" copy is accurate. `'failed_store'` is reachable **only after**
 * every credential key has already been confirmed deleted (`wipeLocalData`'s step 3 passed) and
 * only the file-deletion step failed — so "no se borró nada" would be false there; it needs its
 * own copy that reflects the credentials being gone and the retry being safe (`resetAppDatabase`
 * has already deleted the file's own directory entry or not at all — either way idempotent).
 */
export type WipePhase = 'idle' | 'confirming' | 'wiping' | 'failed_credentials' | 'failed_store';

export interface ConfirmDeleteDeps {
  getPhase: () => WipePhase;
  setPhase: (phase: WipePhase) => void;
  wipe: () => Promise<WipeResult>;
  /** Called only on `{ status: 'ok' }` — the real hook navigates here. */
  onSuccess: () => void;
}

/**
 * The phase transition extracted from the hook (implementation plan Decision 6's hook/pure split
 * precedent, applied to a state machine rather than a data read) — testable as a plain async
 * function with no renderer. A no-op unless `getPhase() === 'confirming'` (Decision 7's
 * re-entrancy guard, concurrency checklist item 2): a second call arriving before the first
 * `await` resolves reads `'wiping'`, not `'confirming'`, and returns immediately.
 *
 * `deps.wipe()` is awaited inside its own `try`/`catch` (found in review): the real `wipe`
 * closure also awaits `getAppDatabase()` *before* calling `wipeLocalData` (see
 * `useWipeLocalData` below), and that call can reject on its own (a bootstrap failure) — outside
 * `wipeLocalData`'s own internal guard, which never rejects (Decision 1, hardened below). Without
 * this catch, that rejection would escape as an unhandled rejection and leave `phase` stuck at
 * `'wiping'` forever, with both modal buttons disabled and no way to retry. Because
 * `getAppDatabase()` runs strictly *before* `wipeLocalData` is ever called, a rejection here means
 * **no credential delete and no store reset ever started** — the identical untouched, safe-to-
 * retry state as `{ status: 'credentials_failed' }`, so it maps to `'failed_credentials'`, not
 * `'failed_store'`.
 */
export async function attemptConfirmDelete(deps: ConfirmDeleteDeps): Promise<void> {
  if (deps.getPhase() !== 'confirming') return;
  deps.setPhase('wiping');

  let result: WipeResult;
  try {
    result = await deps.wipe();
  } catch {
    deps.setPhase('failed_credentials');
    return;
  }

  if (result.status === 'ok') {
    deps.onSuccess();
    return;
  }

  deps.setPhase(result.status === 'credentials_failed' ? 'failed_credentials' : 'failed_store');
}

export interface UseWipeLocalDataResult {
  phase: WipePhase;
  /** Opens the confirmation modal (`'idle'`, `'failed_credentials'` or `'failed_store'` ->
   * `'confirming'`). */
  requestDelete: () => void;
  /** Closes the confirmation modal without deleting anything. A no-op unless the modal is open. */
  cancelDelete: () => void;
  /** Runs the wipe. A no-op unless the modal is open (Decision 7). On success, dismisses the
   * settings stack and replaces the route with onboarding — the caller never returns here via
   * the back gesture (Decision 4). */
  confirmDelete: () => void;
}

/**
 * The React wrapper that assembles the real ports (implementation plan for issue #19, Decision
 * 17): `getAppDatabase()` for `db`, `expoSecureStoreAdapter` for `secureStore`, and
 * `resetAppDatabase` for `resetStore`. This is the **only** file in `src/features/settings/` that
 * imports `expo-router`, `src/lib/secure-store/expo-secure-store.adapter.ts` or
 * `src/db/runtime.ts`'s `resetAppDatabase` — every other file in this feature takes them as
 * arguments.
 */
export function useWipeLocalData(): UseWipeLocalDataResult {
  const [phase, setPhaseState] = useState<WipePhase>('idle');
  const phaseRef = useRef<WipePhase>('idle');
  const router = useRouter();

  const setPhase = useCallback((next: WipePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const requestDelete = useCallback(() => setPhase('confirming'), [setPhase]);

  const cancelDelete = useCallback(() => {
    if (phaseRef.current !== 'confirming') return;
    setPhase('idle');
  }, [setPhase]);

  const confirmDelete = useCallback(() => {
    void attemptConfirmDelete({
      getPhase: () => phaseRef.current,
      setPhase,
      wipe: async () => {
        const db = await getAppDatabase();
        return wipeLocalData({ db, secureStore: expoSecureStoreAdapter, resetStore: resetAppDatabase });
      },
      onSuccess: () => {
        router.dismissAll();
        router.replace('/(onboarding)/intro');
      },
    });
  }, [router, setPhase]);

  return { phase, requestDelete, cancelDelete, confirmDelete };
}
