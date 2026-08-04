import { useCallback, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';

import { countCategoriesByDirection } from '../../db/repositories/categories';
import { listConnectedBankSummaries } from '../../db/repositories/institutions';
import { readReminderSettings } from '../../db/repositories/settings';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, SettingsHubRow } from '../../db/types';
import { expoSecureStoreAdapter } from '../../lib/secure-store/expo-secure-store.adapter';
import { resolveLockedRut } from '../connect-bank/rut-lock';
import { resolveAppVersion } from './about';
import { formatRutOrRaw } from './local-profile';

export type SettingsHubState = { status: 'pending' } | { status: 'ready'; row: SettingsHubRow };

export interface LoadSettingsHubArgs {
  getAppDatabase: () => Promise<AppDatabase>;
  isCancelled: () => boolean;
}

/**
 * The cancellation-guarded read, extracted from the hook so the guard itself is testable without
 * a renderer (implementation plan for issue #19, Decision 6 — the same hook/pure split item #8
 * established between `use-home-data.ts` and `read-home-data.ts`). Reads the hub's five live
 * subtitle sources (Decision 15): the RUT through the secure store (via `resolveLockedRut`), the
 * fully-synced connection and product counts, reminder settings, category counts and the app
 * version.
 */
export async function loadSettingsHub({
  getAppDatabase,
  isCancelled,
}: LoadSettingsHubArgs): Promise<SettingsHubState | undefined> {
  const db = await getAppDatabase();
  if (isCancelled()) return undefined;

  const rawRut = await resolveLockedRut(db, expoSecureStoreAdapter);
  if (isCancelled()) return undefined;

  const banks = listConnectedBankSummaries(db);
  const bankCount = banks.length;
  const productCount = banks.reduce((sum, bank) => sum + bank.productCount, 0);

  const row: SettingsHubRow = {
    rut: formatRutOrRaw(rawRut),
    bankCount,
    productCount,
    reminders: readReminderSettings(db),
    categories: countCategoriesByDirection(db),
    appVersion: resolveAppVersion(Constants),
  };

  return { status: 'ready', row };
}

/**
 * `#screen=settings`'s single feature hook (implementation plan for issue #19, Decision 6). No
 * TanStack Query — `getAppDatabase()` plus repository functions, exactly like every other screen
 * item in this campaign (item #8's binding decision).
 */
export function useSettingsHub(): SettingsHubState {
  const [state, setState] = useState<SettingsHubState>({ status: 'pending' });
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
    loadSettingsHub({ getAppDatabase, isCancelled: () => cancelled }).then((next) => {
      if (next !== undefined) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return state;
}
