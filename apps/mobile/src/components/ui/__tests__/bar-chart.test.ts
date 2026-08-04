import { collectElements, elementTypeName } from '../../../test-utils/element-tree';
import { findNakedText } from '../../../test-utils/naked-text-scan';
import { BarChart, type BarChartProps } from '../BarChart';
import { Text } from '../Text';

/** `BarChart` (dashboard implementation plan for issue #17, Decision 8, Scenario 19). Wrapped
 * in `React.memo` — the same `.type` renderer-free style `line-chart.test.ts` uses. */
const renderBarChart = BarChart.type;

describe('BarChart', () => {
  const props: BarChartProps = {
    columns: [
      { key: 'previous', heightRatio: 0.78, color: '#cbd5e1', label: 'dic' },
      { key: 'current', heightRatio: 0.68, color: '#f59e0b', label: 'ene' },
    ],
  };

  it('renders one column per entry, each with a label', () => {
    const tree = renderBarChart(props);
    const labels = collectElements(tree, (el) => el.type === Text).map((el) => el.props.children);
    expect(labels).toEqual(['dic', 'ene']);
  });

  it('clamps an out-of-range heightRatio into [0, 1]', () => {
    const tree = renderBarChart({
      columns: [
        { key: 'over', heightRatio: 1.5, color: '#f59e0b', label: 'over' },
        { key: 'under', heightRatio: -0.5, color: '#f59e0b', label: 'under' },
      ],
    });
    const bars = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.borderTopLeftRadius !== undefined,
    );
    expect(bars.map((el) => el.props.style.height)).toEqual(['100%', '0%']);
  });

  it('never lands a label string as a bare child of a non-text host (Scenario 19)', () => {
    expect(findNakedText(renderBarChart(props), new Set([Text]))).toEqual([]);
  });
});
