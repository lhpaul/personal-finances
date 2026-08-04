import type { AliasCandidate } from '@finanzas/shared-domain';

import type { MerchantEditorSnapshot } from '../../db/types';

/** `#screen=merchant-edit`'s three MVP manifest states (implementation plan Decision 1). */
export type MerchantEditorState = 'default' | 'suggestions' | 'category-picker';

/** `useMerchantEditor`'s load status. `'pending'` covers the initial load; `'not-found'` is
 * Assumption A7 (an unresolvable `merchantId`); `'error'` is `getAppDatabase()` rejecting. */
export type MerchantEditorStatus = 'pending' | 'ready' | 'not-found' | 'error';

/** The screen's public surface over the hook (implementation plan Layer-by-Layer). */
export interface UseMerchantEditorResult {
  status: MerchantEditorStatus;
  state: MerchantEditorState;
  /** `null` until `status` is `'ready'`. */
  snapshot: MerchantEditorSnapshot | null;
  /** The draft merchant name — persists only on `save()` (Decision 4). */
  draftName: string;
  /** The draft default category — persists only on `save()`; pre-selected but never written by
   * `selectCategory` alone (Decision 3, Decision 4). */
  draftCategoryId: string | null;
  /** `true` while `groupCandidate` or `save` has a write in flight — disables the corresponding
   * affordance so a double tap cannot start two transactions (concurrent-event-source addendum). */
  busy: boolean;
  /** `true` after the most recent `groupCandidate` or `save` call threw — surfaced so a failed
   * write is never silently swallowed (found in review: a bare `try`/`finally` cleared the
   * spinner but left the person believing an edit had saved). Cleared at the start of the next
   * attempt. */
  writeFailed: boolean;
  setName: (name: string) => void;
  openCategoryPicker: () => void;
  /** Updates the draft category directly — the picker has no separate "pending selection"; the
   * whole card was already a draft, so a chip tap and "Guardar categoría" only differ in whether
   * the picker stays open (implementation plan Decision 4). */
  selectCategory: (categoryId: string) => void;
  /** "Guardar categoría" — closes the picker. Writes nothing (Decision 4). */
  confirmCategory: () => void;
  openSuggestions: () => void;
  closeSuggestions: () => void;
  /** "Agrupar" — writes immediately (Decision 4, AC1, AC3). Never rejects — a failure sets
   * `writeFailed` instead, so an un-awaited call from a tap handler cannot produce an unhandled
   * rejection. */
  groupCandidate: (candidate: AliasCandidate) => Promise<void>;
  /** The bottom "Guardar" — the screen's single write of name + default category (Decision 4,
   * AC2). Resolves to whether the write actually succeeded; the caller must check this before
   * navigating away — leaving on a failed save would lose the edit without the person knowing. */
  save: () => Promise<boolean>;
}
