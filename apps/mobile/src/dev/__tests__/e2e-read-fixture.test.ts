import { deriveDateLocal } from '@finanzas/shared-utils';

import { __resetE2eReadFixtureForTests, buildE2eScrapeResult } from '../e2e-read-fixture';

/**
 * Maestro E2E flows (implementation plan for issue #22, Implementation Order step 2, D9).
 * `2026-08-31T12:00:00.000Z` — day 31 of a 31-day month, in the Santiago time zone (UTC-4 in
 * August, so still 31 August locally) — gives every offset in `e2e-read-fixture.ts`'s
 * `MOVEMENT_SEEDS` (0 through -32 days) enough room to land in either August (current month) or
 * July (previous month), never further back, so this frozen clock proves D9's "current and
 * previous local month" claim without depending on which day the suite is actually run.
 */
const FROZEN_INSTANT = '2026-08-31T15:00:00.000Z';

describe('e2e-read-fixture', () => {
  beforeEach(() => {
    __resetE2eReadFixtureForTests();
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
    jest.setSystemTime(new Date(FROZEN_INSTANT));
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetE2eReadFixtureForTests();
  });

  it('returns a complete outcome for banco-de-chile with 2 products and 6 movements (5 debit, 1 credit)', () => {
    const result = buildE2eScrapeResult();

    expect(result.outcome).toBe('complete');
    expect(result.bankId).toBe('banco-de-chile');
    expect(result.readFailure).toBeNull();
    expect(result.products).toHaveLength(2);
    expect(result.movements).toHaveLength(6);
    expect(result.movements.filter((movement) => movement.direction === 'debit')).toHaveLength(5);
    expect(result.movements.filter((movement) => movement.direction === 'credit')).toHaveLength(1);
  });

  it('is bit-identical across repeated calls within one session (D9 — the property flow 06 asserts)', () => {
    const first = buildE2eScrapeResult();
    const second = buildE2eScrapeResult();

    expect(second).toEqual(first);
  });

  it("every movement's dateLocal falls in the current or previous local month for a frozen clock", () => {
    const result = buildE2eScrapeResult();
    const currentMonth = deriveDateLocal(new Date(FROZEN_INSTANT)).slice(0, 7);
    const previousMonthAnchor = new Date(new Date(FROZEN_INSTANT).getTime() - 32 * 86_400_000);
    const previousMonth = deriveDateLocal(previousMonthAnchor).slice(0, 7);

    const months = new Set(result.movements.map((movement) => movement.dateLocal.slice(0, 7)));
    for (const month of months) {
      expect([currentMonth, previousMonth]).toContain(month);
    }
    // Both months are actually represented, not just "not disallowed" (D9's whole point).
    expect(months.has(currentMonth)).toBe(true);
    expect(months.has(previousMonth)).toBe(true);
  });

  it('never produces a future dateLocal relative to the frozen anchor', () => {
    const result = buildE2eScrapeResult();
    const today = deriveDateLocal(new Date(FROZEN_INSTANT));
    for (const movement of result.movements) {
      expect(movement.dateLocal <= today).toBe(true);
    }
  });

  it('a test-only reset clears the memoised anchor, so a later call can re-anchor to a new frozen time', () => {
    const first = buildE2eScrapeResult();

    __resetE2eReadFixtureForTests();
    jest.setSystemTime(new Date('2026-09-05T15:00:00.000Z'));
    const second = buildE2eScrapeResult();

    expect(second.movements[0]?.dateLocal).not.toBe(first.movements[0]?.dateLocal);
  });
});
