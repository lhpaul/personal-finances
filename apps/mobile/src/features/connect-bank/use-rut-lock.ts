import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { resolveLockedRut } from './rut-lock';

export type RutLockState =
  | { status: 'pending' }
  | { status: 'unlocked' }
  | { status: 'locked'; rut: string };

export interface LoadRutLockArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  secureStore: SecureStorePort;
  isCancelled: () => boolean;
}

/** The cancellation-guarded read, mirroring `home`'s `loadHomeData` split (Decision 17). A
 * resolution failure degrades to `unlocked` rather than surfacing an error state — the union this
 * hook returns has no error variant by design (spec Decision 3 only ever asks "is there a stored
 * entry", never "did reading it fail"). */
export async function loadRutLock({
  getAppDatabase,
  secureStore,
  isCancelled,
}: LoadRutLockArgs): Promise<RutLockState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined;
    const rut = await resolveLockedRut(db, secureStore);
    if (isCancelled()) return undefined;
    return rut === null ? { status: 'unlocked' } : { status: 'locked', rut };
  } catch {
    if (isCancelled()) return undefined;
    return { status: 'unlocked' };
  }
}

/** `bank-credentials`'s RUT-lock read (implementation plan Decision 6, Layer-by-Layer). */
export function useRutLock(): RutLockState {
  const [state, setState] = useState<RutLockState>({ status: 'pending' });
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
    loadRutLock({
      getAppDatabase,
      secureStore: expoSecureStoreAdapter,
      isCancelled: () => cancelled,
    }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return state;
}
