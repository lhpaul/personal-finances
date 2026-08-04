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

  /** Found in CodeRabbit review, PR #88: at `heightRatio: 1`, a bar sized as a percentage of the
   * *whole* column (rather than of a `flex: 1` track carved out above the label) claims 100% of
   * the column's own height, leaving the label and the inter-item `gap` no room and overflowing
   * the fixed-height chart upward. Asserts the fix's structural shape: the percentage-height bar
   * View is nested one level inside a `flex: 1` track, not a direct child of the column. */
  it('reserves label space by nesting the ratio-scaled bar inside a flex: 1 track', () => {
    const tree = renderBarChart({
      columns: [{ key: 'max', heightRatio: 1, color: '#f59e0b', label: 'max' }],
    });

    const bar = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.style?.borderTopLeftRadius !== undefined,
    )[0];
    expect(bar?.props.style.height).toBe('100%');

    const track = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && el.props.children === bar,
    )[0];
    expect(track?.props.style.flex).toBe(1);

    // The column itself no longer sizes the bar directly: it is not a direct parent of `bar`.
    const column = collectElements(
      tree,
      (el) => elementTypeName(el) === 'View' && Array.isArray(el.props.children) && el.props.children.includes(track),
    )[0];
    expect(column).toBeDefined();
    expect(column?.props.style.height).toBe('100%');
  });
});
