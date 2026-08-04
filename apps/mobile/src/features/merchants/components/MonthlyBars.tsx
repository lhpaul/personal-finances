import { View } from 'react-native';

import { Text } from '../../../components/ui';
import type { MerchantMonthTotal } from '../../../db/types';
import { screenMetrics, theme } from '../../../theme';

export interface MonthlyBarsProps {
  /** Exactly three entries, oldest to newest, left to right (Decision 12). */
  months: MerchantMonthTotal[];
}

/** Each month's total over the largest of the three, as a percentage string — never a numeric
 * style literal (`no-style-literals.test.ts` Scanner B). All-zero renders three zero-height bars
 * (Decision 12). */
function barHeightPercent(total: number, max: number): `${number}%` {
  if (max <= 0) return '0%';
  return `${Math.round((total / max) * 100)}%`;
}

/**
 * The "Estadísticas de gasto" bar chart (implementation plan Decision 11) — three `View`s with
 * percentage heights, colours and radii read from `theme.ts` / `screenMetrics.merchants`, no
 * literal hex or spacing. Screen-local: `.mu-bars*` is `deferred` to #17 (Dashboard charts) in
 * `mu-class-map.ts`. The rightmost bar (the current month) is the highlighted one; the two before
 * it are muted (runbook Step 8).
 */
export function MonthlyBars({ months }: MonthlyBarsProps) {
  const max = Math.max(0, ...months.map((month) => month.total));
  const lastIndex = months.length - 1;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: screenMetrics.merchants.barsGap,
        height: screenMetrics.merchants.barsHeight,
      }}
    >
      {months.map((month, index) => (
        <View
          key={`${month.monthLabel}-${index}`}
          style={{
            flex: 1,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: screenMetrics.merchants.barsGap,
          }}
        >
          <View
            style={{
              width: '100%',
              height: barHeightPercent(month.total, max),
              borderTopLeftRadius: screenMetrics.merchants.barRadiusTop,
              borderTopRightRadius: screenMetrics.merchants.barRadiusTop,
              borderBottomLeftRadius: screenMetrics.merchants.barRadiusBottom,
              borderBottomRightRadius: screenMetrics.merchants.barRadiusBottom,
              backgroundColor: index === lastIndex ? theme.colors.brandPrimary : theme.colors.palette.slate['300'],
            }}
          />
          <Text tone="tertiary" style={{ fontSize: screenMetrics.merchants.barLabelFontSize }}>
            {month.monthLabel}
          </Text>
        </View>
      ))}
    </View>
  );
}
