import { memo } from 'react';
import Svg, { Line, Polyline } from 'react-native-svg';

import { componentMetrics, theme } from '../../theme';

export type LineChartProps = {
  /** Already-computed `"x,y x,y …"` polyline points — this primitive owns no aggregation
   * (implementation plan for issue #12, Decision 6, Layer-by-Layer). */
  points: string;
  /** The dashed comparison series' points, when there is a previous period to compare against. */
  comparisonPoints?: string;
  seriesColor: string;
  comparisonColor?: string;
  gridLineCount: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  accessibilityLabel: string;
};

/**
 * `.mu-line` (home-screen implementation plan for issue #12, Decision 5, Decision 6).
 * `react-native-svg`-backed, matching `docs/best-practices/stack/expo-react-native.md`
 * ("Charts are `react-native-svg`, memoized on their data"). Wrapped in `React.memo` — the
 * points strings are the only prop that should ever change between renders (brief AC4).
 */
function LineChartComponent({
  points,
  comparisonPoints,
  seriesColor,
  comparisonColor = theme.chart.comparison,
  gridLineCount,
  viewBoxWidth,
  viewBoxHeight,
  accessibilityLabel,
}: LineChartProps) {
  const gridLines = Array.from({ length: gridLineCount }, (_, index) => {
    const position = index + 1;
    return (viewBoxHeight * position) / (gridLineCount + 1);
  });

  return (
    <Svg
      width="100%"
      height={componentMetrics.lineChart.height}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {gridLines.map((y) => (
        <Line
          key={y}
          x1={0}
          y1={y}
          x2={viewBoxWidth}
          y2={y}
          stroke={theme.chart.grid}
          strokeWidth={componentMetrics.lineChart.gridStrokeWidth}
        />
      ))}
      {comparisonPoints !== undefined && (
        <Polyline
          points={comparisonPoints}
          fill="none"
          stroke={comparisonColor}
          strokeWidth={componentMetrics.lineChart.comparisonStrokeWidth}
          strokeDasharray={componentMetrics.lineChart.comparisonDashArray}
        />
      )}
      <Polyline
        points={points}
        fill="none"
        stroke={seriesColor}
        strokeWidth={componentMetrics.lineChart.seriesStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const LineChart = memo(LineChartComponent);
