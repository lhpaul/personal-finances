import { formatClp, formatPercentTenths } from '@finanzas/shared-utils';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { Amount, DonutChart, EmptyState, Legend, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { componentMetrics, theme } from '../../../theme';
import type { DonutReport } from '../category-report';

export interface DonutSectionProps {
  direction: 'debit' | 'credit';
  report: DonutReport;
  label: string;
  accessibilityLabel: string;
  emptyIcon: string;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * One direction's block inside "Reporte por categorías" — the total line, the donut and its
 * legend (implementation plan Decisions 6, 7, 8, 11; brief AC2, AC3, AC4). `React.memo` — the
 * donut segments and legend items are `useMemo`-stabilised (Scenario 23).
 */
export const DonutSection = memo(function DonutSection({
  direction,
  report,
  label,
  accessibilityLabel,
  emptyIcon,
  emptyTitle,
  emptyBody,
}: DonutSectionProps) {
  const tone = direction === 'credit' ? 'in' : 'out';

  const segments = useMemo(
    () =>
      report.segments.map((segment) => ({
        key: segment.key,
        tenths: segment.tenths,
        color: theme.chart.series[segment.colorIndex] as string,
      })),
    [report.segments],
  );

  const legendItems = useMemo(
    () =>
      report.segments.map((segment) => ({
        color: theme.chart.series[segment.colorIndex] as string,
        label: `${segment.emoji} ${segment.label}`,
        value: formatPercentTenths(segment.tenths),
      })),
    [report.segments],
  );

  // Decision 11(a): this direction has no buckets in the selected period.
  const isEmpty = report.segments.length === 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="small" style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}>
          {label}
        </Text>
        <Amount tone={tone} formatted={formatClp(report.total, { direction: tone, signDisplay: 'never' })} />
      </View>

      {isEmpty ? (
        <View style={{ marginTop: theme.space['4'] }}>
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyBody} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['4'], marginTop: theme.space['3'] }}>
          <DonutChart
            segments={segments}
            trackColor={theme.colors.surface3}
            strokeWidth={componentMetrics.donutChart.strokeWidth}
            accessibilityLabel={accessibilityLabel}
          />
          <Legend items={legendItems} />
        </View>
      )}
    </View>
  );
});
