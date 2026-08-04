import { memo } from 'react';
import Svg, { Circle } from 'react-native-svg';

import { componentMetrics } from '../../theme';

/** One arc — already-apportioned tenths of a percent and a resolved colour (dashboard
 * implementation plan for issue #17, Decision 8). This primitive owns no apportionment, no
 * sorting and no category lookup: `key`/`tenths`/`color` all come from
 * `src/features/dashboard/category-report.ts`'s `buildDonutReport`. */
export type DonutChartSegment = {
  key: string;
  tenths: number;
  color: string;
};

export type DonutChartProps = {
  /** Pre-sorted, already capped at the display limit (`DASHBOARD_DONUT_SEGMENT_LIMIT`) by the
   * caller — this primitive renders exactly the segments it is given, in order. */
  segments: readonly DonutChartSegment[];
  trackColor: string;
  strokeWidth: number;
  accessibilityLabel: string;
};

/** The mockup's donuts use a radius (`componentMetrics.donutChart.radius`) chosen so the circle's
 * circumference is close enough to 100 that a segment's angular share can be expressed directly
 * in percent-of-100 units for `strokeDasharray`/`strokeDashoffset`, instead of true arc length —
 * see `theme.ts`'s `donutChart.radius` doc comment. */
const CIRCUMFERENCE_UNITS = 100;

/** Rotates the first segment's start from SVG's default (3 o'clock, `stroke-dashoffset: 0`) to
 * 12 o'clock — a quarter turn of the `CIRCUMFERENCE_UNITS` unit circle, matching every
 * `stroke-dashoffset="25"` first-arc value the mockup draws. */
const STARTING_OFFSET = 25;

/** Keeps a dash offset within `[0, CIRCUMFERENCE_UNITS)` — JavaScript's `%` can return a
 * negative result for a negative dividend, which `stroke-dashoffset` would still render
 * correctly, but a positive, wrapped value is what the mockup's own literals use. */
function wrapOffset(offset: number): number {
  return ((offset % CIRCUMFERENCE_UNITS) + CIRCUMFERENCE_UNITS) % CIRCUMFERENCE_UNITS;
}

/**
 * `.mu-donut` (dashboard implementation plan for issue #17, Decision 6, Decision 8).
 * `react-native-svg`-backed: one background `Circle` (the "remainder" track) plus one `Circle`
 * per segment, each a `strokeDasharray`/`strokeDashoffset` arc. Owns no arithmetic beyond the
 * segment-to-arc-geometry conversion below (the same kind of presentation-only math
 * `LineChart` already performs for its gridlines) — every `tenths` value arrives
 * pre-apportioned. `React.memo` — `segments` is the only prop expected to change between
 * renders.
 */
function DonutChartComponent({ segments, trackColor, strokeWidth, accessibilityLabel }: DonutChartProps) {
  const { size, viewBoxSize, radius } = componentMetrics.donutChart;
  const center = viewBoxSize / 2;

  let cumulativePercent = 0;
  const arcs = segments.map((segment) => {
    const percent = segment.tenths / 10;
    const offset = wrapOffset(STARTING_OFFSET - cumulativePercent);
    cumulativePercent += percent;
    return { key: segment.key, color: segment.color, percent, offset };
  });

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      {arcs.map((arc) => (
        <Circle
          key={arc.key}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.percent} ${CIRCUMFERENCE_UNITS - arc.percent}`}
          strokeDashoffset={arc.offset}
        />
      ))}
    </Svg>
  );
}

export const DonutChart = memo(DonutChartComponent);
