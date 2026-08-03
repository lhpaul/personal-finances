import { useCallback, useEffect, useState } from 'react';

import type { AliasCandidate } from '@finanzas/shared-domain';
import type { DateLocal } from '@finanzas/shared-utils';

import { groupAliasIntoMerchant, readMerchantEditor, saveMerchantProfile } from '../../db/repositories/merchants';
import { getAppDatabase } from '../../db/runtime';
import type { AppDatabase, Category, MerchantEditorSnapshot } from '../../db/types';
import { resolveDeviceLocale, type SupportedLocale } from '../../i18n/locale';
import { newId, now } from '../../lib/app-ports';
import type { MerchantEditorState, MerchantEditorStatus, UseMerchantEditorResult } from './types';

export interface MerchantEditorLoadParams {
  merchantId: string;
  today: DateLocal;
  locale: SupportedLocale;
}

export type MerchantEditorLoadResult =
  | { status: 'ready'; snapshot: MerchantEditorSnapshot }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown };

/**
 * The async load, factored out of the hook so it can be exercised as a plain function over a
 * stubbed `getAppDatabase` and a stubbed `readMerchantEditor` — item #13's
 * `loadStageData`/`use-stage-data.test.ts` precedent (this repository has no React
 * hook-testing renderer installed).
 */
export async function loadMerchantEditor(
  params: MerchantEditorLoadParams,
  deps: {
    getAppDatabase: () => Promise<AppDatabase>;
    readMerchantEditor: (db: AppDatabase, params: MerchantEditorLoadParams) => MerchantEditorSnapshot | undefined;
  } = { getAppDatabase, readMerchantEditor },
): Promise<MerchantEditorLoadResult> {
  try {
    const db = await deps.getAppDatabase();
    const snapshot = deps.readMerchantEditor(db, params);
    return snapshot ? { status: 'ready', snapshot } : { status: 'not-found' };
  } catch (error: unknown) {
    return { status: 'error', error };
  }
}

/**
 * The `categoryId` route param (Decision 3, A9 seam) wins as the draft default only when it
 * resolves to a real category of the merchant's own picker taxonomy; otherwise the draft starts
 * at the merchant's stored default. A pure function so the A9 seam is testable without a
 * renderer (Testing Strategy Scenario 8).
 */
export function resolveCarriedCategoryId(
  categories: readonly Category[],
  storedCategoryId: string | null,
  initialCategoryId: string | undefined,
): string | null {
  if (initialCategoryId !== undefined && categories.some((category) => category.id === initialCategoryId)) {
    return initialCategoryId;
  }
  return storedCategoryId;
}

/**
 * The disclosure row's count — aliases plus candidates, read from one snapshot (Testing Strategy
 * Scenario 6, non-negotiable #6). A pure function so the invariant "the count is always
 * aliases.length + candidates.length" cannot silently drift between the disclosure row and the
 * suggestions card, which both call this instead of each restating the sum.
 */
export function computeDisclosureCount(snapshot: MerchantEditorSnapshot): number {
  return snapshot.aliases.length + snapshot.candidates.length;
}

export interface UseMerchantEditorParams {
  merchantId: string;
  /** The `categoryId` route param (Decision 3) — offered, not persisted, until "Guardar". */
  initialCategoryId?: string;
  today: DateLocal;
  /** Seeded from `useFidelityPreview().state` in `__DEV__` (implementation plan for issue #47,
   * Decision 9); falls back to `'default'`. */
  initialState?: MerchantEditorState;
}

/**
 * `#screen=merchant-edit`'s feature hook (implementation plan Decision 1, Layer-by-Layer).
 * Awaits `getAppDatabase()`, calls `readMerchantEditor`, and owns every piece of draft/UI state
 * the screen renders from. Never imports Drizzle, `expo-sqlite` or `better-sqlite3` —
 * `src/db/__tests__/db-access-boundary.test.ts` enforces that mechanically.
 */
export function useMerchantEditor(params: UseMerchantEditorParams): UseMerchantEditorResult {
  const [locale] = useState<SupportedLocale>(() => resolveDeviceLocale());
  const [status, setStatus] = useState<MerchantEditorStatus>('pending');
  const [snapshot, setSnapshot] = useState<MerchantEditorSnapshot | null>(null);
  const [state, setState] = useState<MerchantEditorState>(params.initialState ?? 'default');
  const [draftName, setDraftName] = useState('');
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const applySnapshot = useCallback(
    (next: MerchantEditorSnapshot) => {
      setSnapshot(next);
      setDraftName(next.merchant.name);
      setDraftCategoryId(
        resolveCarriedCategoryId(next.categories, next.merchant.transactionCategoryId, params.initialCategoryId),
      );
    },
    [params.initialCategoryId],
  );

  useEffect(() => {
    let cancelled = false;

    void loadMerchantEditor({ merchantId: params.merchantId, today: params.today, locale }).then((result) => {
      if (cancelled) return;
      if (result.status === 'ready') {
        applySnapshot(result.snapshot);
        setStatus('ready');
      } else {
        setStatus(result.status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.merchantId, params.today, locale, reloadToken, applySnapshot]);

  function setName(name: string): void {
    setDraftName(name);
  }

  function openCategoryPicker(): void {
    setState('category-picker');
  }

  function selectCategory(categoryId: string): void {
    setDraftCategoryId(categoryId);
  }

  function confirmCategory(): void {
    setState('default');
  }

  function openSuggestions(): void {
    setState('suggestions');
  }

  function closeSuggestions(): void {
    setState('default');
  }

  async function groupCandidate(candidate: AliasCandidate): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const db = await getAppDatabase();
      groupAliasIntoMerchant(db, { merchantId: params.merchantId, rawPattern: candidate.rawPattern, newId, now });
      setReloadToken((token) => token + 1);
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const db = await getAppDatabase();
      saveMerchantProfile(db, {
        merchantId: params.merchantId,
        name: draftName,
        transactionCategoryId: draftCategoryId,
      });
    } finally {
      setBusy(false);
    }
  }

  return {
    status,
    state,
    snapshot,
    draftName,
    draftCategoryId,
    busy,
    setName,
    openCategoryPicker,
    selectCategory,
    confirmCategory,
    openSuggestions,
    closeSuggestions,
    groupCandidate,
    save,
  };
}
