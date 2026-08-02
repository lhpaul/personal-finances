import type { AppDatabase } from '../../../db/types';
import type { HomeDataParams } from '../read-home-data';

// `loadHomeData` calls `readHomeData(db, params)` synchronously once the handle resolves; this
// suite is exercising the cancellation race, not the six-repository-call composition (that is
// Scenario 25, against a real store), so `readHomeData` is stubbed rather than given a fake
// `AppDatabase` it would otherwise throw against.
jest.mock('../read-home-data', () => ({
  readHomeData: jest.fn(() => ({ stubbed: true })),
}));

import { loadHomeData } from '../use-home-data';

/**
 * Scenario 26 of the home-screen implementation plan's Testing Strategy (concurrency addendum).
 * `loadHomeData` is called directly with a stubbed `getAppDatabase` and a manually-flipped
 * `isCancelled`, so the cancellation guard is exercised as a plain async function with no
 * renderer — item #2's no-renderer precedent for what can be asserted without one.
 */
describe('loadHomeData', () => {
  const params: HomeDataParams = {
    period: { start: '2026-02-01', end: '2026-02-28' },
    previousPeriod: { start: '2026-01-01', end: '2026-01-31' },
    locale: 'es',
  };

  it('resolves to a ready state when getAppDatabase resolves and isCancelled never flips', async () => {
    const fakeDb = {} as AppDatabase;
    const getAppDatabase = jest.fn().mockResolvedValue(fakeDb);

    const result = await loadHomeData({ getAppDatabase, params, isCancelled: () => false });

    expect(result?.status).toBe('ready');
  });

  it('returns undefined (never a ready state) once isCancelled flips true before the handle resolves', async () => {
    let cancelled = false;
    const getAppDatabase = jest.fn().mockImplementation(() => {
      cancelled = true; // simulates teardown racing the in-flight promise
      return Promise.resolve({} as AppDatabase);
    });

    const result = await loadHomeData({ getAppDatabase, params, isCancelled: () => cancelled });

    expect(result).toBeUndefined();
  });

  it('resolves to an error state when getAppDatabase rejects and isCancelled never flips', async () => {
    const rejection = new Error('bootstrap failed');
    const getAppDatabase = jest.fn().mockRejectedValue(rejection);

    const result = await loadHomeData({ getAppDatabase, params, isCancelled: () => false });

    expect(result).toEqual({ status: 'error', error: rejection });
  });

  it('returns undefined for a rejected getAppDatabase once cancelled — a discarded failure has no side effect', async () => {
    const rejection = new Error('bootstrap failed');
    const getAppDatabase = jest.fn().mockRejectedValue(rejection);

    const result = await loadHomeData({ getAppDatabase, params, isCancelled: () => true });

    expect(result).toBeUndefined();
  });

  it('a second call with a fresh isCancelled models a second focus event superseding an in-flight read', async () => {
    const fakeDb = {} as AppDatabase;
    const firstIsCancelled = jest.fn().mockReturnValue(true); // the first run was superseded
    const secondIsCancelled = jest.fn().mockReturnValue(false); // the second run is the live one

    const [first, second] = await Promise.all([
      loadHomeData({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        isCancelled: firstIsCancelled,
      }),
      loadHomeData({
        getAppDatabase: () => Promise.resolve(fakeDb),
        params,
        isCancelled: secondIsCancelled,
      }),
    ]);

    expect(first).toBeUndefined();
    expect(second?.status).toBe('ready');
  });
});
