import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { listInstitutions } from '../../db/repositories/institutions';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, PickerInstitution } from '../../db/types';
import { sortForPicker } from './institution-search';

export type InstitutionsState =
  | { status: 'pending' }
  | { status: 'ready'; institutions: PickerInstitution[] }
  | { status: 'error'; error: unknown };

export interface LoadInstitutionsArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  isCancelled: () => boolean;
}

/** The cancellation-guarded read, mirroring `home`'s `loadHomeData` split (Decision 17). */
export async function loadInstitutions({
  getAppDatabase,
  isCancelled,
}: LoadInstitutionsArgs): Promise<InstitutionsState | undefined> {
  try {
    const db = await getAppDatabase();
    if (isCancelled()) return undefined;
    return { status: 'ready', institutions: sortForPicker(listInstitutions(db)) };
  } catch (error: unknown) {
    if (isCancelled()) return undefined;
    return { status: 'error', error };
  }
}

/** `bank-picker`'s catalogue read (implementation plan Layer-by-Layer, Decision 17). Refreshes on
 * focus, matching `useHomeData`'s pattern. */
export function useInstitutions(): InstitutionsState {
  const [state, setState] = useState<InstitutionsState>({ status: 'pending' });
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
    loadInstitutions({ getAppDatabase, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (state.status === 'error') throw state.error;
  return state;
}
