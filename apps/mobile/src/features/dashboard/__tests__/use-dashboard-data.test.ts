import type { AppDatabase } from '../../../db/types';
import type { DashboardDataParams } from '../read-dashboard-data';
import { loadDashboardData } from '../use-dashboard-data';

// `jest.mock` calls are hoisted above every import by `babel-plugin-jest-hoist` — mirrors item
// #12's `use-home-data.test.ts` precedent. `loadDashboardData` calls `readDashboardData(db,
// params)` synchronously once the handle resolves; this suite exercises the cancellation race,
// not the four-repository-call composition (that is Scenario 5, against a real store), so
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
