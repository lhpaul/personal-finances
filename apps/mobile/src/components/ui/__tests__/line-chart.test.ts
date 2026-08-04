import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { LineChart } from '../LineChart';

/**
 * Scenario 20 of the dashboard implementation plan's Testing Strategy (issue #17, Decision 8) —
 * `LineChart`'s additive widening (`additionalSeries`). `LineChart` is wrapped in `React.memo`
 * (brief AC4), so — following `home`'s `memoization.test.ts` precedent for memoized components —
 * this calls the memoized wrapper's own `.type` (the underlying, hookless function component),
 * the same renderer-free style `TopBar.test.tsx` uses for a non-memoized primitive.
 */
const renderLineChart = LineChart.type;

function polylines(tree: ReturnType<typeof renderLineChart>) {
  return collectElements(tree, (el) => elementTypeName(el) === 'Polyline');
}

const BASE_PROPS = {
  points: '0,0 10,10',
  seriesColor: '#f59e0b',
  gridLineCount: 3,
  viewBoxWidth: 300,
  viewBoxHeight: 120,
  accessibilityLabel: 'Tendencia',
};

describe("LineChart — pre-#17 call sites (no additionalSeries) render unchanged", () => {
  it('renders exactly the comparison and primary polylines, comparison first', () => {
    const tree = renderLineChart({ ...BASE_PROPS, comparisonPoints: '0,5 10,15' });
    const lines = polylines(tree);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.props.points).toBe('0,5 10,15'); // comparison painted first (behind)
    expect(lines[1]?.props.points).toBe('0,0 10,10'); // primary painted last (in front)
  });

  it('renders only the primary polyline when there is no comparison series', () => {
    const tree = renderLineChart({ ...BASE_PROPS });
    const lines = polylines(tree);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.props.points).toBe('0,0 10,10');
  });
});

describe('LineChart — additionalSeries (issue #17 dashboard trend card)', () => {
  it('paints primary, then each additional series, then the comparison series last', () => {
    const tree = renderLineChart({
      ...BASE_PROPS,
      additionalSeries: [{ id: 'expense', points: '0,20 10,30', color: '#f59e0b' }],
      comparisonPoints: '0,40 10,50',
    });
    const lines = polylines(tree);
    expect(lines).toHaveLength(3);
    expect(lines[0]?.props.points).toBe('0,0 10,10'); // primary (income)
    expect(lines[1]?.props.points).toBe('0,20 10,30'); // additional series (expense)
    expect(lines[2]?.props.points).toBe('0,40 10,50'); // comparison (average) — on top
  });

  it('renders no comparison line when additionalSeries is present but comparisonPoints is omitted', () => {
    const tree = renderLineChart({
      ...BASE_PROPS,
      additionalSeries: [{ id: 'expense', points: '0,20 10,30', color: '#f59e0b' }],
    });
    const lines = polylines(tree);
    expect(lines).toHaveLength(2);
  });

  /** Found in CodeRabbit review, PR #88: `series.color` used to be the React key, which collides
   * when two series legitimately share a colour. Two series with equal colours, reordered between
   * renders, must still resolve to the correct `points` per series — proven here via `id`, not
   * `color`. */
  it('keys each additional series by its stable id, not its (possibly duplicate) colour', () => {
    const sameColor = '#f59e0b';
    const firstOrder = renderLineChart({
      ...BASE_PROPS,
      additionalSeries: [
        { id: 'a', points: '0,1 1,1', color: sameColor },
        { id: 'b', points: '0,2 1,2', color: sameColor },
      ],
    });
    const firstLines = polylines(firstOrder);
    expect(firstLines[1]?.key).toBe('a');
    expect(firstLines[2]?.key).toBe('b');

    const reordered = renderLineChart({
      ...BASE_PROPS,
      additionalSeries: [
        { id: 'b', points: '0,2 1,2', color: sameColor },
        { id: 'a', points: '0,1 1,1', color: sameColor },
      ],
    });
    const reorderedLines = polylines(reordered);
    expect(reorderedLines[1]?.key).toBe('b');
    expect(reorderedLines[1]?.props.points).toBe('0,2 1,2');
    expect(reorderedLines[2]?.key).toBe('a');
    expect(reorderedLines[2]?.props.points).toBe('0,1 1,1');
  });
});
