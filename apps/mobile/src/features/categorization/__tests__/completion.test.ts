import { buildCompletionView, dailyAverage, formatMonthOverMonthChange } from '../completion';

/** Categorization flow (#13) implementation plan Testing Strategy, Scenarios 16-17. */

describe('buildCompletionView (AC28, AC30, P5)', () => {
  it('resolves "done" when the live pending count is zero, with a full bar over the categorized total', () => {
    const view = buildCompletionView({ pendingNow: 0, resolved: 3, pendingAtStart: 4, totalCategorized: 57 });
    expect(view).toEqual({ outcome: 'done', resolved: 57, total: 57, ratio: 1 });
  });

  it('resolves "partial" when movements remain pending, with the resolved/pendingAtStart ratio', () => {
    const view = buildCompletionView({ pendingNow: 13, resolved: 7, pendingAtStart: 20, totalCategorized: 57 });
    expect(view.outcome).toBe('partial');
    expect(view.resolved).toBe(7);
    expect(view.total).toBe(20);
    expect(view.ratio).toBeCloseTo(0.35);
  });

  it('the paramless fallback (0 / pendingAtStart) never divides by zero', () => {
    const view = buildCompletionView({ pendingNow: 4, resolved: 0, pendingAtStart: 0, totalCategorized: 0 });
    expect(view.outcome).toBe('partial');
    expect(view.ratio).toBe(0);
  });

  it('clamps the ratio to at most 1 even if resolved exceeds pendingAtStart', () => {
    const view = buildCompletionView({ pendingNow: 1, resolved: 25, pendingAtStart: 20, totalCategorized: 25 });
    expect(view.ratio).toBe(1);
  });
});

describe('dailyAverage', () => {
  it('rounds half-up and never divides by zero elapsed days', () => {
    expect(dailyAverage(100, 0)).toBe(100);
    expect(dailyAverage(1000, 3)).toBe(333);
  });

  it('never returns a negative value for a non-negative total', () => {
    expect(dailyAverage(0, 5)).toBe(0);
  });
});

describe('formatMonthOverMonthChange (AC31, P2)', () => {
  it('renders the mockup\'s own minus sign for a decrease', () => {
    const change = formatMonthOverMonthChange(88000, 100000);
    expect(change.direction).toBe('less');
    expect(change.percentLabel).toBe('−12%');
  });

  it('renders a plus sign for an increase', () => {
    const change = formatMonthOverMonthChange(120000, 100000);
    expect(change.direction).toBe('more');
    expect(change.percentLabel).toBe('+20%');
  });

  it('renders 0% when the two totals are equal', () => {
    const change = formatMonthOverMonthChange(50000, 50000);
    expect(change).toEqual({ direction: 'same', percentLabel: '0%' });
  });

  it('renders the no-previous-month branch when there is nothing to compare against', () => {
    const change = formatMonthOverMonthChange(20000, 0);
    expect(change).toEqual({ direction: 'unknown', percentLabel: null });
  });

  it('renders "same" when both totals are zero', () => {
    const change = formatMonthOverMonthChange(0, 0);
    expect(change).toEqual({ direction: 'same', percentLabel: '0%' });
  });
});
