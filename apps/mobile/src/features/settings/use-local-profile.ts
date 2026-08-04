import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupportedLocale } from '@finanzas/shared-utils';
import { useFocusEffect } from 'expo-router';

import { countTransactions } from '../../db/repositories/transactions';
import { readFirstLaunchAt } from '../../db/repositories/settings';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase } from '../../db/types';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { resolveLockedRut } from '../connect-bank/rut-lock';
import { buildLocalProfile, type LocalProfileView } from './local-profile';

export type LocalProfileState = { status: 'pending' } | { status: 'ready'; profile: LocalProfileView };

export interface LoadLocalProfileArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  locale: SupportedLocale;
  isCancelled: () => boolean;
}

export async function loadLocalProfile({
  getAppDatabase,
  locale,
  isCancelled,
}: LoadLocalProfileArgs): Promise<LocalProfileState | undefined> {
  const db = await getAppDatabase();
  if (isCancelled()) return undefined;

  const rawRut = await resolveLockedRut(db, expoSecureStoreAdapter);
  if (isCancelled()) return undefined;

  const profile = buildLocalProfile({
    rawRut,
    firstLaunchAt: readFirstLaunchAt(db),
    transactionCount: countTransactions(db),
    locale,
  });

  return { status: 'ready', profile };
}

/** `#screen=settings-account`'s read hook (implementation plan for issue #19, Decision 6). */
export function useLocalProfile(locale: SupportedLocale): LocalProfileState {
  const [state, setState] = useState<LocalProfileState>({ status: 'pending' });
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
    loadLocalProfile({ getAppDatabase, locale, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, reloadToken]);

  return state;
}
