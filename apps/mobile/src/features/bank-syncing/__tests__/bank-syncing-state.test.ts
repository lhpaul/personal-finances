import type { ScraperStepId } from '@finanzas/bank-scraper';

import {
  PROGRESS_FLOOR,
  resolveBankSyncingState,
  resolvePreviewBankSyncingState,
  resolveProgressValue,
  resolveStepStatuses,
  STEP_TO_STATE,
  type BankSyncingState,
} from '../bank-syncing-state';

/** Testing Strategy scenarios 1-5 (implementation plan, issue #11). */
describe('STEP_TO_STATE / resolveBankSyncingState (scenarios 1-2; brief AC1; Decision 2)', () => {
  it.each([
    ['load-start', 'login'],
    ['login-start', 'login'],
    ['get-products-start', 'products'],
    ['get-transactions-start', 'transactions'],
    ['ready', 'transactions'],
  ] satisfies [ScraperStepId, BankSyncingState][])('%s -> %s', (stepId, expected) => {
    expect(STEP_TO_STATE[stepId]).toBe(expected);
    expect(resolveBankSyncingState({ phase: 'reading', stepId })).toBe(expected);
  });

  it('STEP_TO_STATE is total over exactly the five ScraperStepId values', () => {
    expect(Object.keys(STEP_TO_STATE).sort()).toEqual(
      ['load-start', 'login-start', 'get-products-start', 'get-transactions-start', 'ready'].sort(),
    );
  });

  it.each(['load-start', 'login-start', 'get-products-start', 'get-transactions-start', 'ready'] as ScraperStepId[])(
    'resolveBankSyncingState returns "error" for phase "failed" whatever the step id is (%s)',
    (stepId) => {
      expect(resolveBankSyncingState({ phase: 'failed', stepId })).toBe('error');
    },
  );

  it.each(['load-start', 'login-start', 'get-products-start', 'get-transactions-start', 'ready'] as ScraperStepId[])(
    'resolveBankSyncingState returns "error" for phase "refused" whatever the step id is (%s)',
    (stepId) => {
      expect(resolveBankSyncingState({ phase: 'refused', stepId })).toBe('error');
    },
  );
});

describe('resolveProgressValue (scenarios 3-4; brief AC1; Decision 3)', () => {
  it('floors at the mockup widths and passes a larger scraper value through unchanged', () => {
    expect(resolveProgressValue('login', 0)).toBeCloseTo(0.25);
    expect(resolveProgressValue('products', 0)).toBeCloseTo(0.6);
    expect(resolveProgressValue('transactions', 0)).toBeCloseTo(0.9);
    expect(resolveProgressValue('login', 0.5)).toBeCloseTo(0.5);
    expect(resolveProgressValue('transactions', 0.97)).toBeCloseTo(0.97);
  });

  it('PROGRESS_FLOOR is non-decreasing along the scraper step order (login -> products -> transactions)', () => {
    expect(PROGRESS_FLOOR.login).toBeLessThan(PROGRESS_FLOOR.products);
    expect(PROGRESS_FLOOR.products).toBeLessThan(PROGRESS_FLOOR.transactions);
  });

  it('a step sequence where the scraper stays below every floor never decreases (floors drive the bar)', () => {
    const steps: { state: BankSyncingState; scraperProgress: number }[] = [
      { state: 'login', scraperProgress: 0 },
      { state: 'login', scraperProgress: 0 },
      { state: 'products', scraperProgress: 0.1 },
      { state: 'transactions', scraperProgress: 0.2 },
    ];
    const values = steps.map(({ state, scraperProgress }) => resolveProgressValue(state, scraperProgress));
    expect(values).toEqual([0.25, 0.25, 0.6, 0.9]);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] as number);
    }
  });

  it('a step sequence where the scraper runs ahead of every floor never decreases (scraper drives the bar past 0.9)', () => {
    const steps: { state: BankSyncingState; scraperProgress: number }[] = [
      { state: 'login', scraperProgress: 0.1 },
      { state: 'login', scraperProgress: 0.3 },
      { state: 'products', scraperProgress: 0.95 },
      { state: 'transactions', scraperProgress: 0.97 },
    ];
    const values = steps.map(({ state, scraperProgress }) => resolveProgressValue(state, scraperProgress));
    expect(values).toEqual([0.25, 0.3, 0.95, 0.97]);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] as number);
    }
  });
});

describe('resolveStepStatuses (scenario 5; non-negotiable 6; Assumption A3)', () => {
  it('login: row 1 is ✅/in_progress (Assumption A3), rows 2-3 are ⏳/pending', () => {
    const rows = resolveStepStatuses('login');
    expect(rows.login).toEqual({ icon: '✅', status: 'in_progress' });
    expect(rows.products).toEqual({ icon: '⏳', status: 'pending' });
    expect(rows.transactions).toEqual({ icon: '⏳', status: 'pending' });
  });

  it('products: row 1 is ✅/done, row 2 is ✅/in_progress, row 3 is ⏳/pending', () => {
    const rows = resolveStepStatuses('products');
    expect(rows.login).toEqual({ icon: '✅', status: 'done' });
    expect(rows.products).toEqual({ icon: '✅', status: 'in_progress' });
    expect(rows.transactions).toEqual({ icon: '⏳', status: 'pending' });
  });

  it('transactions: rows 1-2 are ✅/done, row 3 is ✅/in_progress (no "done" badge is ever drawn for row 3)', () => {
    const rows = resolveStepStatuses('transactions');
    expect(rows.login).toEqual({ icon: '✅', status: 'done' });
    expect(rows.products).toEqual({ icon: '✅', status: 'done' });
    expect(rows.transactions).toEqual({ icon: '✅', status: 'in_progress' });
  });
});

describe('resolvePreviewBankSyncingState (Decision 12)', () => {
  it.each(['login', 'products', 'transactions', 'error'] as BankSyncingState[])(
    'accepts %s',
    (state) => {
      expect(resolvePreviewBankSyncingState(state)).toBe(state);
    },
  );

  it('falls back to "login" for null (no ?fidelityState= param)', () => {
    expect(resolvePreviewBankSyncingState(null)).toBe('login');
  });

  it('falls back to "login" for an unrecognised value', () => {
    expect(resolvePreviewBankSyncingState('not-a-real-state')).toBe('login');
  });
});
