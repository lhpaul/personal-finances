import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listSettingsBankConnections } from '../../db/repositories/institutions';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, BankConnectionSummary } from '../../db/types';

export type BankConnectionsState =
  | { status: 'pending' }
  | { status: 'ready'; connections: BankConnectionSummary[] }
  | { status: 'error'; error: unknown };

export interface LoadBankConnectionsArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable without
 * a renderer (implementation plan for issue #20, Decision 3; mirrors item #12's
 * `loadHomeData`/`useHomeData` split). Returns `undefined` once `isCancelled()` flips true, so
 * the caller never `setState`s a superseded run's result.
 */
export async function loadBankConnections({
  getAppDatabase,
  isCancelled,
}: LoadBankConnectionsArgs): Promise<BankConnectionsState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined;
    return { status: 'ready', connections: listSettingsBankConnections(db) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

export interface BankConnectionsHandle {
  state: BankConnectionsState;
  /** Re-reads the list immediately. The focus-driven reload below only fires when the screen
   * loses and regains focus — an in-place mutation with no navigation (a confirmed disconnect,
   * issue #111) needs this explicit trigger or the list keeps showing the pre-mutation rows. */
  reload: () => void;
}

/**
 * `settings-banks`'s single feature hook (Decision 3). Re-reads when `useFocusEffect` bumps its
 * `reloadToken` — this is what makes AC3 true end to end: after a credential update the person
 * returns from item #11's syncing screen to `/settings/banks`, and the list re-reads on focus, so
 * the row's sync state is the one the sync just wrote. No TanStack Query, no provider. `reload`
 * bumps the same token for mutations that happen without a focus change (issue #111).
 *
 * A stored rejection is re-thrown **during render**, not inside the async callback, so it reaches
 * the route's `ErrorBoundary` instead of becoming an unhandled rejection.
 */
export function useBankConnections(): BankConnectionsHandle {
  const [state, setState] = useState<BankConnectionsState>({ status: 'pending' });
  const [reloadToken, setReloadToken] = useState(0);
  const hasFocusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      setReloadToken((token) => token + 1);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    loadBankConnections({ getAppDatabase, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  if (state.status === 'error') throw state.error;
  return { state, reload };
}
