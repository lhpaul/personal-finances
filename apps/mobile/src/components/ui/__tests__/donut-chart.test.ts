import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { DonutChart, type DonutChartProps } from '../DonutChart';

/** `DonutChart` (dashboard implementation plan for issue #17, Decision 6, Decision 8). Wrapped
 * in `React.memo` — the same `.type` renderer-free style `line-chart.test.ts` uses. */
const renderDonutChart = DonutChart.type;

describe('DonutChart', () => {
  const props: DonutChartProps = {
    segments: [
      { key: 'a', tenths: 500, color: '#6366f1' },
      { key: 'b', tenths: 500, color: '#f59e0b' },
    ],
    trackColor: '#f1f5f9',
    strokeWidth: 7,
    accessibilityLabel: 'Distribución de gastos por categoría',
  };

  it('renders one track circle plus one arc circle per segment', () => {
    const tree = renderDonutChart(props);
    const circles = collectElements(tree, (el) => elementTypeName(el) === 'Circle');
    expect(circles).toHaveLength(3); // track + 2 segments
    expect(circles[0]?.props.stroke).toBe('#f1f5f9');
  });

  it("two 50% segments close the circle: their dasharray lengths sum to the circumference unit (100)", () => {
    const tree = renderDonutChart(props);
    const arcs = collectElements(tree, (el) => elementTypeName(el) === 'Circle').slice(1);
    const lengths = arcs.map((el) => Number(String(el.props.strokeDasharray).split(' ')[0]));
    expect(lengths).toEqual([50, 50]);
    expect(lengths.reduce((sum, length) => sum + length, 0)).toBe(100);
  });

  it('renders no arc for an empty segment list — just the track', () => {
    const tree = renderDonutChart({ ...props, segments: [] });
    const circles = collectElements(tree, (el) => elementTypeName(el) === 'Circle');
    expect(circles).toHaveLength(1);
  });

  it('every strokeDashoffset stays within [0, 100)', () => {
    const tree = renderDonutChart({
      segments: [
        { key: 'a', tenths: 206, color: '#6366f1' },
        { key: 'b', tenths: 174, color: '#f59e0b' },
        { key: 'c', tenths: 143, color: '#10b981' },
      ],
      trackColor: '#f1f5f9',
      strokeWidth: 7,
      accessibilityLabel: 'label',
    });
    const arcs = collectElements(tree, (el) => elementTypeName(el) === 'Circle').slice(1);
    for (const arc of arcs) {
      expect(arc.props.strokeDashoffset).toBeGreaterThanOrEqual(0);
      expect(arc.props.strokeDashoffset).toBeLessThan(100);
    }
  });
});
