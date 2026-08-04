import { memo } from 'react';
import { View } from 'react-native';

import { componentMetrics, theme } from '../../theme';
import { Text } from './Text';

/** One column (dashboard implementation plan for issue #17, Decision 8). `heightRatio` is
 * clamped to `[0, 1]` by this primitive — a caller-side division guard (Decision 11b) may still
 * hand this `NaN`-free but out-of-range values (e.g. a future bar taller than the window's own
 * maximum), and clamping here is cheaper than asking every caller to re-derive the guard. */
export type BarChartColumn = {
  key: string;
  heightRatio: number;
  color: string;
  label: string;
};

export type BarChartProps = {
  columns: readonly BarChartColumn[];
};

function clampRatio(ratio: number): number {
  return Math.min(1, Math.max(0, ratio));
}

/**
 * `.mu-bars`, `__col`, `__bar`, `__bar--muted`, `__bar--warm`, `__lbl` (dashboard implementation
 * plan for issue #17, Decision 8). The mockup draws these as plain CSS boxes, not SVG, so this
 * primitive is `View`-backed: each column is a fixed-height track
 * (`componentMetrics.barChart.height`) with a bottom-anchored, ratio-scaled bar and a label
 * underneath. Owns no arithmetic beyond the `[0, 1]` clamp above — every `heightRatio` and
 * `color` arrives already computed by `src/features/dashboard/spending-overview.ts`.
 * `React.memo` — `columns` is the only prop expected to change between renders.
 */
function BarChartComponent({ columns }: BarChartProps) {
  const { height, gap, barRadiusTop, barRadiusBottom } = componentMetrics.barChart;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap,
        height,
        paddingTop: theme.space['2'],
      }}
    >
      {columns.map((column) => (
        <View
          key={column.key}
          style={{
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            gap,
            height: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              width: '100%',
              height: `${clampRatio(column.heightRatio) * 100}%`,
              borderTopLeftRadius: barRadiusTop,
              borderTopRightRadius: barRadiusTop,
              borderBottomLeftRadius: barRadiusBottom,
              borderBottomRightRadius: barRadiusBottom,
              backgroundColor: column.color,
            }}
          />
          <Text
            style={{
              fontSize: componentMetrics.barChart.labelFontSize,
              color: theme.colors.textTertiary,
            }}
          >
            {column.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const BarChart = memo(BarChartComponent);
