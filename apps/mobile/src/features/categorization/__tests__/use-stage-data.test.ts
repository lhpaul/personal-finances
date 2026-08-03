import { loadStageData } from '../use-stage-data';
import type { StageData } from '../read-stage-data';

/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 22. Exercises
 * `loadStageData` — the async load extracted from `useStageData` — as a plain function over a
 * stubbed `getAppDatabase` and a stubbed `readStageData` (item #2's no-renderer precedent; see
 * `use-stage-data.ts`'s doc comment for why the hook's own cancellation-guard mechanics are not
 * independently tested).
 */
const EMPTY_SNAPSHOT: StageData = {
  batch: [],
  pendingCount: 0,
  expenseCategories: [],
  incomeCategories: [],
  usedExpenseCategories: [],
  usedIncomeCategories: [],
};

describe('loadStageData', () => {
  it('resolves to "ready" carrying whatever readStageData produced from the resolved handle', async () => {
    const fakeDb = { marker: 'fake-db' } as never;
    const result = await loadStageData(
      { locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve(fakeDb),
        readStageData: (db) => {
          expect(db).toBe(fakeDb);
          return EMPTY_SNAPSHOT;
        },
      },
    );
    expect(result).toEqual({ status: 'ready', data: EMPTY_SNAPSHOT });
  });

  it('becomes "error" when getAppDatabase rejects, without throwing', async () => {
    const boom = new Error('bootstrap failed');
    const result = await loadStageData(
      { locale: 'es' },
      {
        getAppDatabase: () => Promise.reject(boom),
        readStageData: () => EMPTY_SNAPSHOT,
      },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });

  it('becomes "error" when readStageData itself throws, without throwing', async () => {
    const boom = new Error('a repository call failed');
    const result = await loadStageData(
      { locale: 'es' },
      {
        getAppDatabase: () => Promise.resolve({} as never),
        readStageData: () => {
          throw boom;
        },
      },
    );
    expect(result).toEqual({ status: 'error', error: boom });
  });

  it('never resolves to "pending" — that state exists only before the first load completes', async () => {
    const result = await loadStageData(
      { locale: 'es' },
      { getAppDatabase: () => Promise.reject(new Error('any failure')), readStageData: () => EMPTY_SNAPSHOT },
    );
    expect(result.status).not.toBe('pending');
  });
});
