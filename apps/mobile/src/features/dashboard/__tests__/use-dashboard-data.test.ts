import type { AppDatabase } from '../../../db/types';
import type { DashboardDataParams } from '../read-dashboard-data';
import { dashboardDataParamsKey, loadDashboardData, selectDashboardDataState } from '../use-dashboard-data';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist` — mirrors item
// #12's `use-home-data.test.ts` precedent. `loadDashboardData` calls `readDashboardData(db,
// params)` synchronously once the handle resolves; this suite exercises the cancellation race,
// not the five-repository-call composition (that is Scenario 5, against a real store), so
// `readDashboardData` is stubbed rather than given a fake `AppDatabase` it would otherwise throw
// against.
jest.mock('../read-dashboard-data', () => ({
  readDashboardData: jest.fn(() => ({ stubbed: true })),
}));

/**
 * Scenario 26 of the dashboard implementation plan's Testing Strategy (Concurrent-event-source
 * addendum). `loadDashboardData` is called directly with a stubbed `getAppDatabase` and a
 * manually-flipped `isCancelled`, so the cancellation guard is exercised as a plain async
 * function with no renderer.
 */
describe('loadDashboardData', () => {
  const params: DashboardDataParams = {
    period: { start: '2026-02-01', end: '2026-02-28' },
    previousPeriod: { start: '2026-01-01', end: '2026-01-31' },
    trendWindow: { start: '2025-09-01', end: '2026-02-28' },
    locale: 'es',
  };

  it('resolves to a ready state when getAppDatabase resolves and isCancelled never flips', async () => {
    const fakeDb = {} as AppDatabase;
    const getAppDatabase = jest.fn().mockResolvedValue(fakeDb);

    const result = await loadDashboardData({ getAppDatabase, params, isCancelled: () => false });

    expect(result?.status).toBe('ready');
  });

  it('returns undefined (never a ready state) once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true; // simulates teardown racing the in-flight promise
      return Promise.resolve({} as AppDatabase);
    });

    const result = await loadDashboardData({ getAppDatabase, params, isCancelled: () => cancelled });

    expect(result).toBeUndefined();
  });

  it('resolves to an error state when getAppDatabase rejects and isCancelled never flips', async () => {
    const rejection = new Error('bootstrap failed');
    const getAppDatabase = jest.fn().mockRejectedValue(rejection);

    const result = await loadDashboardData({ getAppDatabase, params, isCancelled: () => false });

    expect(result).toEqual({ status: 'error', error: rejection });
  });

  it('returns undefined for a rejected getAppDatabase once cancelled — a discarded failure has no side effect', async () => {
    const rejection = new Error('bootstrap failed');
    const getAppDatabase = jest.fn().mockRejectedValue(rejection);

    const result = await loadDashboardData({ getAppDatabase, params, isCancelled: () => true });

    expect(result).toBeUndefined();
  });

  it('a second call with a fresh isCancelled models a second focus event superseding an in-flight read', async () => {
    const fakeDb = {} as AppDatabase;
    const firstIsCancelled = jest.fn().mockReturnValue(true); // the first run was superseded
    const secondIsCancelled = jest.fn().mockReturnValue(false); // the second run is the live one

    const [first, second] = await Promise.all([
      loadDashboardData({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        isCancelled: firstIsCancelled,
      }),
      loadDashboardData({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        isCancelled: secondIsCancelled,
      }),
    ]);

    expect(first).toBeUndefined();
    expect(second?.status).toBe('ready');
  });
});

/**
 * Found in CodeRabbit review (PR #88): a mid-flight `month`/`week` toggle or locale change must
 * not expose a completed read's result under the newer params. `dashboardDataParamsKey` and
 * `selectDashboardDataState` are the pure, renderer-free-testable pieces of that guard —
 * `useDashboardData` itself calls no hook this suite can exercise without a renderer (Decision
 * 11's established no-renderer precedent), so the gating *logic* is proven here directly instead.
 */
describe('dashboardDataParamsKey', () => {
  const params: DashboardDataParams = {
    period: { start: '2026-02-01', end: '2026-02-28' },
    previousPeriod: { start: '2026-01-01', end: '2026-01-31' },
    trendWindow: { start: '2025-09-01', end: '2026-02-28' },
    locale: 'es',
  };

  it('produces the same key for value-equal params built from separate object literals', () => {
    const cloned: DashboardDataParams = JSON.parse(JSON.stringify(params));
    expect(dashboardDataParamsKey(cloned)).toBe(dashboardDataParamsKey(params));
  });

  it('produces a different key when the period changes (e.g. a month/week toggle)', () => {
    const weekParams: DashboardDataParams = {
      ...params,
      period: { start: '2026-02-09', end: '2026-02-15' },
    };
    expect(dashboardDataParamsKey(weekParams)).not.toBe(dashboardDataParamsKey(params));
  });

  it('produces a different key when only the locale changes', () => {
    expect(dashboardDataParamsKey({ ...params, locale: 'en' })).not.toBe(dashboardDataParamsKey(params));
  });
});

describe('selectDashboardDataState', () => {
  const readyResult = {
    status: 'ready' as const,
    data: { windowDailyTotals: [], currentCategoryTotals: [], previousCategoryTotals: [], categories: [] },
  };

  it('returns the stored result when the stored key matches the current key', () => {
    expect(selectDashboardDataState({ key: 'a', result: readyResult }, 'a')).toEqual(readyResult);
  });

  it('returns pending — discarding a stale ready result — when the keys differ (a period/locale change is in flight)', () => {
    expect(selectDashboardDataState({ key: 'a', result: readyResult }, 'b')).toEqual({ status: 'pending' });
  });

  it('returns pending — discarding a stale error result — when the keys differ', () => {
    const errorResult = { status: 'error', error: new Error('boom') } as const;
    expect(selectDashboardDataState({ key: 'a', result: errorResult }, 'b')).toEqual({ status: 'pending' });
  });

  it('is a no-op pass-through of pending when the stored result is itself pending', () => {
    expect(selectDashboardDataState({ key: 'a', result: { status: 'pending' } }, 'a')).toEqual({
      status: 'pending',
    });
  });
});
