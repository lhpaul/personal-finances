import { memo } from 'react';
import Svg, { Line, Polyline } from 'react-native-svg';

import { componentMetrics, theme } from '../../theme';

/** One extra series drawn between the primary series and the dashed comparison series
 * (dashboard implementation plan for issue #17, Decision 8). `id` is a stable identity used as
 * the React key (found in CodeRabbit review, PR #88): `color` alone is not unique — two series
 * legitimately sharing a colour would collide as React keys and could misassociate a `Polyline`
 * with the wrong series data across a reorder. */
export type LineChartSeries = {
  id: string;
  points: string;
  color: string;
};

export type LineChartProps = {
  /** Already-computed `"x,y x,y …"` polyline points — this primitive owns no aggregation
   * (implementation plan for issue #12, Decision 6, Layer-by-Layer). */
  points: string;
  /** Zero or more extra series, rendered in order after the primary series and before the
   * comparison series (implementation plan for issue #17, Decision 8) — e.g. the dashboard's
   * trend card passes income as `points` and `[expense]` here, reproducing the mockup's
   * income-under, expense-over, average-on-top z-order. Existing call sites omit this prop (or
   * pass an empty array) and render pixel-for-pixel unchanged: only when at least one additional
   * series is present does the comparison series move to the top of the paint order (below). */
  additionalSeries?: readonly LineChartSeries[];
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
 * `.mu-line` (home-screen implementation plan for issue #12, Decision 5, Decision 6; widened
 * additively by the dashboard implementation plan for issue #17, Decision 8).
 * `react-native-svg`-backed, matching `docs/best-practices/stack/expo-react-native.md`
 * ("Charts are `react-native-svg`, memoized on their data"). Wrapped in `React.memo` — the
 * points strings are the only prop that should ever change between renders (brief AC4).
 */
function LineChartComponent({
  points,
  additionalSeries = [],
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
      {/* No additional series (every pre-#17 call site): unchanged paint order — the comparison
       * line paints first (behind), the primary series paints last (in front). With at least one
       * additional series (#17's dashboard trend card): the primary series paints first, then
       * each additional series, then the comparison series last — the mockup's income-under,
       * expense-over, dashed-average-on-top z-order (Decision 8). */}
      {additionalSeries.length === 0 && comparisonPoints !== undefined && (
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
      {additionalSeries.map((series) => (
        <Polyline
          key={series.id}
          points={series.points}
          fill="none"
          stroke={series.color}
          strokeWidth={componentMetrics.lineChart.seriesStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {additionalSeries.length > 0 && comparisonPoints !== undefined && (
        <Polyline
          points={comparisonPoints}
          fill="none"
          stroke={comparisonColor}
          strokeWidth={componentMetrics.lineChart.comparisonStrokeWidth}
          strokeDasharray={componentMetrics.lineChart.comparisonDashArray}
        />
      )}
    </Svg>
  );
}

export const LineChart = memo(LineChartComponent);
