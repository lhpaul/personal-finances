import { theme } from '../../../theme';
import { DONUT_SERIES_ORDER, resolveDonutColorIndex } from '../dashboard-palette';

/** Scenario 12 of the dashboard implementation plan's Testing Strategy (brief AC3, Decision 7). */
describe('resolveDonutColorIndex', () => {
  it('maps the expense donut ranks to theme.chart.series[0..4] in order, reproducing the mockup', () => {
    const colors = [0, 1, 2, 3, 4].map((rank) => theme.chart.series[resolveDonutColorIndex('debit', rank)]);
    expect(colors).toEqual(['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']);
  });

  it("maps the income donut's rank 0 to theme.colors.success and rank 1 to theme.chart.series[0]", () => {
    expect(theme.chart.series[resolveDonutColorIndex('credit', 0)]).toBe(theme.colors.success);
    expect(theme.chart.series[resolveDonutColorIndex('credit', 1)]).toBe(theme.chart.series[0]);
  });

  it('never renders an income at rank 0 in the warning (amber) colour — AC3', () => {
    expect(theme.chart.series[resolveDonutColorIndex('credit', 0)]).not.toBe(theme.colors.warning);
  });

  it('DONUT_SERIES_ORDER has exactly five ranks per direction', () => {
    expect(DONUT_SERIES_ORDER.debit).toHaveLength(5);
    expect(DONUT_SERIES_ORDER.credit).toHaveLength(5);
  });
});
