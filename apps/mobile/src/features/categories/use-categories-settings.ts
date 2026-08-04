import { useCallback, useEffect, useRef, useState } from 'react';
import { deriveDateLocal } from '@finanzas/shared-utils';
import { useFocusEffect } from 'expo-router';

import {
  createUserCategory,
  deleteCategory as deleteCategoryRepo,
  renameCategory as renameCategoryRepo,
  reorderCategories,
} from '../../db/repositories/categories';
import type { SupportedLocale } from '../../db/labels';
import { createRuntimePorts, getAppDatabase } from '../../db/runtime';
import type { AppDatabase, CategoryWithUsage } from '../../db/types';
import { incomeFlagFor, type CategoryDirection } from './direction';
import { readCategoriesSettings } from './read-categories';

/**
 * The screen's overlay union (implementation plan for issue #21, Decision 8) — `editor` renders
 * the sheet (manifest state `edit`), `delete-confirm` renders the modal. Neither is a route; both
 * are `state_id`s of `settings-categories`. Also the re-entrancy guard: `saveEditor`/
 * `confirmDelete` return immediately unless the overlay matches, via {@link guardAndCloseOverlay}.
 */
export type CategoriesOverlay =
  | { kind: 'none' }
  | { kind: 'editor'; mode: 'create' | 'edit'; categoryId: string | null }
  | { kind: 'delete-confirm'; categoryId: string };

/** A closed union of catalogue keys, never an exception message (Decision 11) — a raw SQLite
 * error string in a UI surface is how internal identifiers leak into screenshots. */
export type CategoriesSettingsErrorKey = 'reorder' | 'save' | 'delete';

export interface CategoriesSettingsState {
  status: 'pending' | 'ready';
  direction: CategoryDirection;
  rows: CategoryWithUsage[];
  overlay: CategoriesOverlay;
  error: CategoriesSettingsErrorKey | null;
  /** Set only alongside a non-null `error` — re-runs the exact write that just failed (systemic
   * write-path error handling: every write surfaces a visible error state with a safe retry). */
  retry: (() => void) | null;
}

// ---------------------------------------------------------------------------------------------
// Pure, dependency-injected core (implementation plan Decision 6's hook/pure split precedent,
// applied to a write-with-retry state machine). Unit-tested as plain functions, no renderer.
// ---------------------------------------------------------------------------------------------

/** A no-op unless `overlay.kind === kind` (re-entrancy guard) — otherwise closes the overlay
 * synchronously (before the first `await` anywhere downstream) and returns the matched overlay
 * member, narrowed. */
export function guardAndCloseOverlay<K extends CategoriesOverlay['kind']>(
  overlay: CategoriesOverlay,
  kind: K,
  setOverlay: (overlay: CategoriesOverlay) => void,
): Extract<CategoriesOverlay, { kind: K }> | null {
  if (overlay.kind !== kind) return null;
  setOverlay({ kind: 'none' });
  return overlay as Extract<CategoriesOverlay, { kind: K }>;
}

export interface AttemptWriteDeps {
  reloadRows: () => Promise<CategoryWithUsage[]>;
  setRows: (rows: CategoryWithUsage[]) => void;
  setError: (key: CategoriesSettingsErrorKey | null) => void;
  setRetry: (retry: (() => void) | null) => void;
}

/**
 * Runs `action`, then always re-reads authoritative rows from a fresh read (Decision 11: "the
 * hook restores the last persisted state from a fresh read"). On success, clears the error and
 * the retry. On failure, sets `error` to `kind` (never the caught exception) and sets `retry` to
 * a closure that re-runs this same `attemptWrite` call — the safe-retry path every write (create,
 * rename, reorder, delete) shares.
 */
export async function attemptWrite(
  kind: CategoriesSettingsErrorKey,
  action: () => Promise<void>,
  deps: AttemptWriteDeps,
): Promise<void> {
  try {
    await action();
    const rows = await deps.reloadRows();
    deps.setRows(rows);
    deps.setError(null);
    deps.setRetry(null);
  } catch {
    const rows = await deps.reloadRows();
    deps.setRows(rows);
    deps.setError(kind);
    deps.setRetry(() => {
      void attemptWrite(kind, action, deps);
    });
  }
}

/** Applies a persisted-reorder result to the in-memory row list, optimistically, without waiting
 * for a fresh read (Decision 11) — the fallback (any row not named in `orderedIds`) keeps its
 * existing position, which is always last for a valid reorder. */
export function applyOrderedIds(
  rows: readonly CategoryWithUsage[],
  orderedIds: readonly string[],
): CategoryWithUsage[] {
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const reorderedMovable = orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is CategoryWithUsage => row !== undefined);
  const untouched = rows.filter((row) => !orderedIds.includes(row.id));
  return [...reorderedMovable, ...untouched];
}

// ---------------------------------------------------------------------------------------------
// The hook.
// ---------------------------------------------------------------------------------------------

export interface UseCategoriesSettingsResult extends CategoriesSettingsState {
  setDirection: (direction: CategoryDirection) => void;
  openCreate: () => void;
  openEdit: (categoryId: string) => void;
  closeOverlay: () => void;
  saveEditor: (values: { name: string; emoji: string }) => void;
  requestDelete: (categoryId: string) => void;
  confirmDelete: () => void;
  commitReorder: (orderedIds: readonly string[]) => void;
}

/**
 * `#screen=settings-categories`'s single feature hook (implementation plan for issue #21,
 * Layer-by-Layer). Awaits `getAppDatabase()` (item #8's memoized runtime handle), holds
 * `{ status, direction, rows, overlay, error, retry }`, and re-reads on focus via
 * `useFocusEffect` bumping a `reloadToken` (matching `useHomeData`). No TanStack Query.
 *
 * Every value read inside an event-handler closure that must never see a stale React state
 * snapshot (`overlay`, `direction`, `rows`) is mirrored in a `useRef` alongside its `useState`,
 * the same pattern `useWipeLocalData`'s `phaseRef` established — a double-tap of *Guardar* or
 * *Eliminar categoría* is handled by the ref read, not by the closed-over state variable, which
 * would still show the pre-update value across two synchronous calls in the same tick.
 */
export function useCategoriesSettings(locale: SupportedLocale): UseCategoriesSettingsResult {
  const [direction, setDirectionState] = useState<CategoryDirection>('expense');
  const directionRef = useRef(direction);

  const [status, setStatus] = useState<'pending' | 'ready'>('pending');
  const [rows, setRowsState] = useState<CategoryWithUsage[]>([]);
  const rowsRef = useRef(rows);

  const [overlay, setOverlayState] = useState<CategoriesOverlay>({ kind: 'none' });
  const overlayRef = useRef(overlay);

  const [error, setError] = useState<CategoriesSettingsErrorKey | null>(null);
  const [retry, setRetryState] = useState<(() => void) | null>(null);
  // React's `useState` setter treats a *function* argument as an updater, so storing a function
  // as the state *value* needs the `() => value` wrapping form. Isolated here so `attemptWrite`'s
  // `deps.setRetry` contract stays a plain `(retry) => void` — no React-specific wrapping leaks
  // into the pure core (found while wiring this up: passing the retry function straight through
  // to `setRetryState` would have React call it immediately instead of storing it).
  const setRetry = useCallback((next: (() => void) | null) => {
    setRetryState(() => next);
  }, []);

  const [reloadToken, setReloadToken] = useState(0);
  const dbRef = useRef<AppDatabase | null>(null);
  const writingRef = useRef(false);
  const hasFocusedOnce = useRef(false);

  const setDirection = useCallback((next: CategoryDirection) => {
    directionRef.current = next;
    setDirectionState(next);
  }, []);
  const setRows = useCallback((next: CategoryWithUsage[]) => {
    rowsRef.current = next;
    setRowsState(next);
  }, []);
  const setOverlay = useCallback((next: CategoriesOverlay) => {
    overlayRef.current = next;
    setOverlayState(next);
  }, []);

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
    (async () => {
      const db = await getAppDatabase();
      if (cancelled) return;
      dbRef.current = db;
      const todayDateLocal = deriveDateLocal(new Date());
      const nextRows = readCategoriesSettings(db, { direction, locale, todayDateLocal });
      if (cancelled) return;
      setRows(nextRows);
      setStatus('ready');
      setError(null);
      setRetry(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [direction, locale, reloadToken, setRows]);

  const reloadRows = useCallback(async (): Promise<CategoryWithUsage[]> => {
    const db = dbRef.current ?? (await getAppDatabase());
    dbRef.current = db;
    const todayDateLocal = deriveDateLocal(new Date());
    return readCategoriesSettings(db, { direction: directionRef.current, locale, todayDateLocal });
  }, [locale]);

  const openCreate = useCallback(() => {
    setOverlay({ kind: 'editor', mode: 'create', categoryId: null });
  }, [setOverlay]);

  const openEdit = useCallback(
    (categoryId: string) => {
      setOverlay({ kind: 'editor', mode: 'edit', categoryId });
    },
    [setOverlay],
  );

  const closeOverlay = useCallback(() => {
    setOverlay({ kind: 'none' });
  }, [setOverlay]);

  const requestDelete = useCallback(
    (categoryId: string) => {
      setOverlay({ kind: 'delete-confirm', categoryId });
    },
    [setOverlay],
  );

  const writeDeps = useCallback(
    (): AttemptWriteDeps => ({ reloadRows, setRows, setError, setRetry }),
    [reloadRows, setRows],
  );

  const saveEditor = useCallback(
    (values: { name: string; emoji: string }) => {
      const active = guardAndCloseOverlay(overlayRef.current, 'editor', setOverlay);
      if (active === null) return;

      void attemptWrite(
        'save',
        async () => {
          const db = dbRef.current ?? (await getAppDatabase());
          dbRef.current = db;
          if (active.mode === 'create') {
            createUserCategory(
              db,
              { income: incomeFlagFor(directionRef.current), name: values.name, emoji: values.emoji },
              createRuntimePorts(),
            );
          } else if (active.categoryId !== null) {
            renameCategoryRepo(db, active.categoryId, values);
          }
        },
        writeDeps(),
      );
    },
    [setOverlay, writeDeps],
  );

  const confirmDelete = useCallback(() => {
    const active = guardAndCloseOverlay(overlayRef.current, 'delete-confirm', setOverlay);
    if (active === null) return;

    void attemptWrite(
      'delete',
      async () => {
        const db = dbRef.current ?? (await getAppDatabase());
        dbRef.current = db;
        deleteCategoryRepo(db, active.categoryId);
      },
      writeDeps(),
    );
  }, [setOverlay, writeDeps]);

  const commitReorder = useCallback(
    (orderedIds: readonly string[]) => {
      if (writingRef.current) return;
      writingRef.current = true;

      setRows(applyOrderedIds(rowsRef.current, orderedIds));

      void attemptWrite(
        'reorder',
        async () => {
          const db = dbRef.current ?? (await getAppDatabase());
          dbRef.current = db;
          reorderCategories(db, { income: incomeFlagFor(directionRef.current), orderedIds });
        },
        writeDeps(),
      ).finally(() => {
        writingRef.current = false;
      });
    },
    [setRows, writeDeps],
  );

  return {
    status,
    direction,
    rows,
    overlay,
    error,
    retry,
    setDirection,
    openCreate,
    openEdit,
    closeOverlay,
    saveEditor,
    requestDelete,
    confirmDelete,
    commitReorder,
  };
}
