import type { AppDatabase } from '../../../db/types';
import {
  applyOrderedIds,
  attemptWrite,
  guardAndCloseOverlay,
  loadCategoriesSettingsRows,
  type CategoriesOverlay,
} from '../use-categories-settings';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist`, so this applies
// to `loadCategoriesSettingsRows`'s import above regardless of source order — the same
// `loadHomeData`/`readHomeData` stubbing precedent (`use-home-data.test.ts`): this suite exercises
// the cancellation guard and the failure path, not `readCategoriesSettings`'s own SQL composition
// (that is `categories-settings.db.test.ts`, against a real store), so it is stubbed rather than
// given a fake `AppDatabase` it would otherwise throw against.
jest.mock('../read-categories', () => ({
  readCategoriesSettings: jest.fn(() => [{ stubbed: true }]),
}));

/**
 * Scenarios 15-16 of the implementation plan for issue #21's Testing Strategy, plus the
 * write-path error-handling weak spot named for this item: every write (create, rename, reorder,
 * delete) goes through {@link attemptWrite}, so testing it once here covers all four call sites.
 * Exercised as plain async functions with no renderer (Decision 6's hook/pure split precedent,
 * `useWipeLocalData`'s `attemptConfirmDelete` convention).
 */
describe('guardAndCloseOverlay (Decision 8 — overlay transitions and re-entrancy)', () => {
  it('is a no-op and returns null when the overlay does not match', () => {
    let overlay: CategoriesOverlay = { kind: 'none' };
    const setOverlay = jest.fn((next: CategoriesOverlay) => {
      overlay = next;
    });

    const result = guardAndCloseOverlay(overlay, 'delete-confirm', setOverlay);

    expect(result).toBeNull();
    expect(setOverlay).not.toHaveBeenCalled();
  });

  it('closes the overlay and returns the matched member when it matches', () => {
    let overlay: CategoriesOverlay = { kind: 'delete-confirm', categoryId: 'comida' };
    const setOverlay = jest.fn((next: CategoriesOverlay) => {
      overlay = next;
    });

    const result = guardAndCloseOverlay(overlay, 'delete-confirm', setOverlay);

    expect(result).toEqual({ kind: 'delete-confirm', categoryId: 'comida' });
    expect(overlay).toEqual({ kind: 'none' });
    expect(setOverlay).toHaveBeenCalledTimes(1);
  });

  it('confirmDelete() called twice in a row runs the guarded action once — the second call reads the already-closed overlay', () => {
    // Mirrors the real hook's overlayRef: a plain mutable variable updated synchronously by
    // setOverlay, standing in for the ref that avoids the stale-closure problem a React state
    // variable would have across two calls in the same tick.
    let overlayRef: CategoriesOverlay = { kind: 'delete-confirm', categoryId: 'comida' };
    const setOverlay = jest.fn((next: CategoriesOverlay) => {
      overlayRef = next;
    });

    const first = guardAndCloseOverlay(overlayRef, 'delete-confirm', setOverlay);
    const second = guardAndCloseOverlay(overlayRef, 'delete-confirm', setOverlay);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(setOverlay).toHaveBeenCalledTimes(1);
  });

  it('saveEditor() is a no-op when the overlay is none', () => {
    const setOverlay = jest.fn();
    const result = guardAndCloseOverlay({ kind: 'none' }, 'editor', setOverlay);
    expect(result).toBeNull();
    expect(setOverlay).not.toHaveBeenCalled();
  });
});

describe('attemptWrite (Decision 11 — write-path error handling, safe retry)', () => {
  function makeDeps(freshRows: unknown[] = []) {
    const setRows = jest.fn();
    const setError = jest.fn();
    const setRetry = jest.fn();
    const reloadRows = jest.fn(async () => freshRows as never);
    return { reloadRows, setRows, setError, setRetry };
  }

  it('on success: re-reads fresh rows, clears the error, and clears the retry', async () => {
    const deps = makeDeps([{ id: 'comida' }]);
    const action = jest.fn(async () => undefined);

    await attemptWrite('save', action, deps);

    expect(action).toHaveBeenCalledTimes(1);
    expect(deps.reloadRows).toHaveBeenCalledTimes(1);
    expect(deps.setRows).toHaveBeenCalledWith([{ id: 'comida' }]);
    expect(deps.setError).toHaveBeenCalledWith(null);
    expect(deps.setRetry).toHaveBeenCalledWith(null);
  });

  it('on a rejecting write (the write REJECTS): restores fresh rows, sets the closed-union error key — never the exception text — and sets a retry function', async () => {
    const deps = makeDeps([{ id: 'comida', sortOrder: 1 }]);
    const action = jest.fn(async () => {
      throw new Error('SQLITE_CONSTRAINT: leaking a raw db identifier');
    });

    await attemptWrite('reorder', action, deps);

    expect(deps.setRows).toHaveBeenCalledWith([{ id: 'comida', sortOrder: 1 }]);
    expect(deps.setError).toHaveBeenCalledWith('reorder');
    // The error union carries no exception text anywhere in this call.
    for (const call of deps.setError.mock.calls) {
      for (const arg of call) {
        expect(String(arg)).not.toMatch(/SQLITE|leaking/);
      }
    }
    expect(deps.setRetry).toHaveBeenCalledTimes(1);
    expect(typeof deps.setRetry.mock.calls[0]?.[0]).toBe('function');
  });

  /** Found in review, PR #97 (CodeRabbit): `makeDeps` always resolved `reloadRows`, so the
   * unguarded reload path was never exercised by this suite. */
  function makeRejectingReloadDeps() {
    const setRows = jest.fn();
    const setError = jest.fn();
    const setRetry = jest.fn();
    const reloadRows = jest.fn(async () => {
      throw new Error('SQLITE_BUSY: leaking a raw db identifier');
    });
    return { reloadRows, setRows, setError, setRetry };
  }

  it('when the write rejects AND the confirmation reload also rejects: still resolves (never throws), still sets the closed-union error key and a retry function, and never calls setRows', async () => {
    const deps = makeRejectingReloadDeps();
    const action = jest.fn(async () => {
      throw new Error('write failed');
    });

    await expect(attemptWrite('save', action, deps)).resolves.toBeUndefined();

    expect(deps.setRows).not.toHaveBeenCalled();
    expect(deps.setError).toHaveBeenCalledWith('save');
    expect(deps.setRetry).toHaveBeenCalledTimes(1);
    expect(typeof deps.setRetry.mock.calls[0]?.[0]).toBe('function');
  });

  it('when the write SUCCEEDS but the confirmation reload rejects: still resolves, sets the error key and a retry — and that retry re-runs only the reload, never the write again (replaying a create would duplicate the category)', async () => {
    let reloadShouldFail = true;
    const setRows = jest.fn();
    const setError = jest.fn();
    const setRetry = jest.fn();
    const reloadRows = jest.fn(async () => {
      if (reloadShouldFail) throw new Error('transient read failure');
      return [{ id: 'mascotas' }] as never;
    });
    const deps = { reloadRows, setRows, setError, setRetry };
    const action = jest.fn(async () => undefined);

    await expect(attemptWrite('save', action, deps)).resolves.toBeUndefined();

    expect(action).toHaveBeenCalledTimes(1);
    expect(setRows).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('save');
    expect(setRetry).toHaveBeenCalledTimes(1);

    // Invoke the retry: the reload now succeeds.
    const retryFn = setRetry.mock.calls[0]?.[0] as () => void;
    reloadShouldFail = false;
    retryFn();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // The write is never replayed — only the reload retried.
    expect(action).toHaveBeenCalledTimes(1);
    expect(reloadRows).toHaveBeenCalledTimes(2);
    expect(setRows).toHaveBeenCalledWith([{ id: 'mascotas' }]);
    expect(setError).toHaveBeenLastCalledWith(null);
    expect(setRetry).toHaveBeenLastCalledWith(null);
  });

  it('the retry function re-runs the same action, and a subsequent success clears the error', async () => {
    const deps = makeDeps([{ id: 'comida' }]);
    let shouldFail = true;
    const action = jest.fn(async () => {
      if (shouldFail) throw new Error('transient failure');
    });

    await attemptWrite('delete', action, deps);
    expect(deps.setError).toHaveBeenLastCalledWith('delete');

    // `setRetry` receives the retry function directly, as a plain value (never React's
    // updater-form double-wrapping — that concern is isolated inside the real hook's own
    // `setRetry` wrapper, not in `attemptWrite`'s dependency contract).
    const retryFn = deps.setRetry.mock.calls[0]?.[0] as () => void;
    shouldFail = false;
    retryFn();
    // The retry kicks off attemptWrite again asynchronously — flush enough microtask turns for
    // its two sequential awaits (action(), then reloadRows()) to settle.
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(action).toHaveBeenCalledTimes(2);
    expect(deps.setError).toHaveBeenLastCalledWith(null);
    expect(deps.setRetry).toHaveBeenLastCalledWith(null);
  });
});

describe('loadCategoriesSettingsRows (found in review, PR #97 — the initial-load effect previously had no catch at all)', () => {
  it('resolves to a ready state carrying the db and the rows when getAppDatabase resolves and isCancelled never flips', async () => {
    const fakeDb = {} as AppDatabase;
    const getAppDatabase = jest.fn().mockResolvedValue(fakeDb);

    const result = await loadCategoriesSettingsRows({
      getAppDatabase,
      direction: 'expense',
      locale: 'es',
      isCancelled: () => false,
    });

    expect(result).toEqual({ status: 'ready', db: fakeDb, rows: [{ stubbed: true }] });
  });

  it('returns undefined (never a ready state) once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true; // simulates teardown racing the in-flight promise
      return Promise.resolve({} as AppDatabase);
    });

    const result = await loadCategoriesSettingsRows({
      getAppDatabase,
      direction: 'expense',
      locale: 'es',
      isCancelled: () => cancelled,
    });

    expect(result).toBeUndefined();
  });

  it('resolves to an error state — never rejects — when getAppDatabase rejects', async () => {
    const getAppDatabase = jest.fn().mockRejectedValue(new Error('bootstrap failed'));

    await expect(
      loadCategoriesSettingsRows({ getAppDatabase, direction: 'expense', locale: 'es', isCancelled: () => false }),
    ).resolves.toEqual({ status: 'error' });
  });

  it('returns undefined for a rejected getAppDatabase once cancelled — a discarded failure has no side effect', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true;
      return Promise.reject(new Error('bootstrap failed'));
    });

    const result = await loadCategoriesSettingsRows({
      getAppDatabase,
      direction: 'expense',
      locale: 'es',
      isCancelled: () => cancelled,
    });

    expect(result).toBeUndefined();
  });
});

describe('applyOrderedIds (Decision 11 — optimistic reorder)', () => {
  const rows = [
    { id: 'comida', sortOrder: 1 },
    { id: 'supermercado', sortOrder: 2 },
    { id: 'transporte', sortOrder: 3 },
    { id: 'otros-gasto', sortOrder: 4 },
  ] as never[];

  it('reorders the movable rows in the given order and keeps the untouched (fallback) row where it was', () => {
    const result = applyOrderedIds(rows, ['transporte', 'comida', 'supermercado']);
    expect(result.map((r: { id: string }) => r.id)).toEqual([
      'transporte',
      'comida',
      'supermercado',
      'otros-gasto',
    ]);
  });

  it('does not mutate its input', () => {
    const before = rows.map((r: { id: string }) => r.id);
    applyOrderedIds(rows, ['transporte', 'comida', 'supermercado']);
    expect(rows.map((r: { id: string }) => r.id)).toEqual(before);
  });
});
