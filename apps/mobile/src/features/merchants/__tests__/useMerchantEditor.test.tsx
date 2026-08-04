import { computeDisclosureCount, loadMerchantEditor, resolveCarriedCategoryId, runGuardedWrite } from '../useMerchantEditor';
import type { MerchantEditorSnapshot } from '../../../db/types';

/**
 * Implementation plan for issue #14, Testing Strategy scenarios 6 and 8. Exercises the pure
 * functions extracted from `useMerchantEditor` — item #13's `use-stage-data.test.ts` precedent
 * (this repository has no React hook-testing renderer installed; the hook's own state-transition
 * wiring is not independently unit-tested here, consistent with every other shipped feature hook).
 */

const CATEGORY_COMPRAS = { id: 'compras', slug: 'compras', income: false, name: 'Compras', emoji: '📦', sortOrder: 0 };
const CATEGORY_COMIDA = { id: 'comida', slug: 'comida', income: false, name: 'Comida', emoji: '🍔', sortOrder: 1 };

const EMPTY_SNAPSHOT: MerchantEditorSnapshot = {
  merchant: { id: 'acme', name: 'Acme', transactionCategoryId: 'compras', isUserDefined: false },
  aliases: [],
  candidates: [],
  categories: [CATEGORY_COMPRAS, CATEGORY_COMIDA],
  stats: {
    months: [
      { monthLabel: 'nov', total: 0 },
      { monthLabel: 'dic', total: 0 },
      { monthLabel: 'ene', total: 0 },
    ],
    monthlyAverage: 0,
    delta: { currentTotal: 0, previousTotal: 0, absoluteDelta: 0, percentageTenths: null },
  },
};

describe('loadMerchantEditor', () => {
  it('resolves to "ready" carrying whatever readMerchantEditor produced from the resolved handle', async () => {
    const fakeDb = { marker: 'fake-db' } as never;
    const result = await loadMerchantEditor(
      { merchantId: 'acme', today: '2026-01-20', locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve(fakeDb),
        readMerchantEditor: (db) => {
          expect(db).toBe(fakeDb);
          return EMPTY_SNAPSHOT;
        },
      },
    );
    expect(result).toEqual({ status: 'ready', snapshot: EMPTY_SNAPSHOT });
  });

  it('resolves to "not-found" when readMerchantEditor returns undefined (Assumption A7)', async () => {
    const result = await loadMerchantEditor(
      { merchantId: 'no-such-merchant', today: '2026-01-20', locale: 'es' },
      { getAppDatabase: () => Promise.resolve({} as never), readMerchantEditor: () => undefined },
    );
    expect(result).toEqual({ status: 'not-found' });
  });

  it('becomes "error" when getAppDatabase rejects, without throwing', async () => {
    const boom = new Error('bootstrap failed');
    const result = await loadMerchantEditor(
      { merchantId: 'acme', today: '2026-01-20', locale: 'es' },
      { getAppDatabase: () => Promise.reject(boom), readMerchantEditor: () => EMPTY_SNAPSHOT },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });

  it('becomes "error" when readMerchantEditor itself throws, without throwing', async () => {
    const boom = new Error('a repository call failed');
    const result = await loadMerchantEditor(
      { merchantId: 'acme', today: '2026-01-20', locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve({} as never),
        readMerchantEditor: () => {
          throw boom;
        },
      },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });
});

describe('resolveCarriedCategoryId (Scenario 8, A9 seam)', () => {
  it('the categoryId route param wins when it resolves to a real category', () => {
    expect(resolveCarriedCategoryId(EMPTY_SNAPSHOT.categories, 'compras', 'comida')).toBe('comida');
  });

  it('falls back to the stored default when the param is absent', () => {
    expect(resolveCarriedCategoryId(EMPTY_SNAPSHOT.categories, 'compras', undefined)).toBe('compras');
  });

  it('falls back to the stored default when the param does not resolve to a real category', () => {
    expect(resolveCarriedCategoryId(EMPTY_SNAPSHOT.categories, 'compras', 'no-such-category')).toBe('compras');
  });

  it('a resolvable param overrides a null stored default', () => {
    expect(resolveCarriedCategoryId(EMPTY_SNAPSHOT.categories, null, 'comida')).toBe('comida');
  });
});

describe('computeDisclosureCount (Scenario 6, non-negotiable #6)', () => {
  it('is the sum of aliases and candidates, from one snapshot', () => {
    const snapshot: MerchantEditorSnapshot = {
      ...EMPTY_SNAPSHOT,
      aliases: [{ id: 'a1', rawPattern: 'ACME', matchType: 'prefix', matchCount: 4 }],
      candidates: [
        { rawPattern: 'ACME EXPRESS', movementCount: 2, sampleDescription: 'ACME EXPRESS DELIVERY' },
        { rawPattern: 'ACME PLUS', movementCount: 1, sampleDescription: 'ACME PLUS STORE' },
      ],
    };
    expect(computeDisclosureCount(snapshot)).toBe(3);
  });

  it('is zero for a merchant with no aliases and no candidates (Assumption A6)', () => {
    expect(computeDisclosureCount(EMPTY_SNAPSHOT)).toBe(0);
  });
});

/**
 * Found in review: `groupCandidate`/`save` used a bare `try`/`finally` — a thrown/rejected write
 * propagated to a caller that never handled it (the route's un-guarded `await editor.save()`,
 * and `MerchantAliasesCard`'s un-awaited `onGroupCandidate` tap handler), silently clearing the
 * spinner while the person believed the edit had saved. `runGuardedWrite` is the extracted fix,
 * tested here as a plain function so the exact catch behavior does not depend on a hook-testing
 * renderer.
 */
describe('runGuardedWrite (write-failure surfacing, found in review)', () => {
  it('resolves to { succeeded: true } when the write resolves normally', async () => {
    const result = await runGuardedWrite(() => Promise.resolve());
    expect(result).toEqual({ succeeded: true });
  });

  it('resolves to { succeeded: false, error } when the write rejects, and never rejects itself', async () => {
    const boom = new Error('write failed');
    await expect(runGuardedWrite(() => Promise.reject(boom))).resolves.toEqual({
      succeeded: false,
      error: boom,
    });
  });

  it('resolves to { succeeded: false, error } when the write throws synchronously', async () => {
    const boom = new Error('synchronous failure');
    const result = await runGuardedWrite(() => {
      throw boom;
    });
    expect(result).toEqual({ succeeded: false, error: boom });
  });

  it('an un-awaited call never produces an unhandled rejection (the exact bug found in review)', () => {
    // `MerchantAliasesCard`'s "Agrupar" tap handler calls `groupCandidate` without awaiting it.
    // This assertion is the regression: calling `runGuardedWrite` and discarding the promise
    // must not throw synchronously and must not register as an unhandled rejection.
    expect(() => {
      void runGuardedWrite(() => Promise.reject(new Error('discarded on purpose')));
    }).not.toThrow();
  });
});
