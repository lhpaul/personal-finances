import { formatClp } from '@finanzas/shared-utils';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Amount, Card, EmptyState, Legend, LineChart, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import type { DashboardPeriodType } from '../dashboard-period';
import { toPeriodPolylinePoints, type TrendReport, type TrendSeriesPoint } from '../trend-report';

export interface TrendCardProps {
  report: TrendReport;
  periodType: DashboardPeriodType;
}

function maxOf(...series: readonly (readonly TrendSeriesPoint[])[]): number {
  return series.reduce(
    (max, points) => points.reduce((innerMax, point) => Math.max(innerMax, point.total), max),
    0,
  );
}

/** "Tendencia" (implementation plan Decisions 2, 5, 7, 8, 11, 15; brief AC1, AC3, AC4).
 * `React.memo` — the derived polylines are `useMemo`-stabilised (Scenario 23). */
export const TrendCard = memo(function TrendCard({ report, periodType }: TrendCardProps) {
  const { t } = useTranslation();
  const { incomeSeries, expenseSeries, averageSeries, currentIncomeTotal, currentExpenseTotal } = report;

  const viewBox = useMemo(
    () => ({
      width: screenMetrics.dashboard.chartViewBoxWidth,
      height: screenMetrics.dashboard.chartViewBoxHeight,
    }),
    [],
  );
  const sharedMax = useMemo(
    () => maxOf(incomeSeries, expenseSeries, averageSeries),
    [incomeSeries, expenseSeries, averageSeries],
  );
  const incomePoints = useMemo(
    () => toPeriodPolylinePoints(incomeSeries, viewBox, sharedMax),
    [incomeSeries, viewBox, sharedMax],
  );
  const expensePoints = useMemo(
    () => toPeriodPolylinePoints(expenseSeries, viewBox, sharedMax),
    [expenseSeries, viewBox, sharedMax],
  );
  const averagePoints = useMemo(
    () => toPeriodPolylinePoints(averageSeries, viewBox, sharedMax),
    [averageSeries, viewBox, sharedMax],
  );
  const additionalSeries = useMemo(
    () => [{ points: expensePoints, color: theme.colors.warning }],
    [expensePoints],
  );

  // Decision 11(a): every one of the six period totals is 0 for both directions.
  const isEmpty =
    incomeSeries.every((point) => point.total === 0) && expenseSeries.every((point) => point.total === 0);

  return (
    <Card
      title={t('dashboard.trend_title')}
      subtitle={
        periodType === 'month' ? t('dashboard.trend_subtitle_month') : t('dashboard.trend_subtitle_week')
      }
    >
      <View style={{ flexDirection: 'row', gap: theme.space['3'] }}>
        <View style={{ flex: 1 }}>
          <Card variant="flat-tight">
            <Text variant="xs">{t('dashboard.label_income')}</Text>
            <View style={{ marginTop: theme.space['1'] }}>
              <Amount tone="in" minorUnits={currentIncomeTotal} format={(v) => formatClp(v, { direction: 'in', signDisplay: 'never' })} />
            </View>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card variant="flat-tight">
            <Text variant="xs">{t('dashboard.label_expense')}</Text>
            <View style={{ marginTop: theme.space['1'] }}>
              <Amount tone="out" minorUnits={currentExpenseTotal} format={(v) => formatClp(v, { direction: 'out', signDisplay: 'never' })} />
            </View>
          </Card>
        </View>
      </View>

      {isEmpty ? (
        <View style={{ marginTop: theme.space['4'] }}>
          <EmptyState icon={t('dashboard.trend_empty_icon')} title={t('dashboard.trend_empty_title')} description={t('dashboard.trend_empty_body')} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: theme.space['4'] }}>
            <LineChart
              points={incomePoints}
              additionalSeries={additionalSeries}
              comparisonPoints={averagePoints}
              seriesColor={theme.colors.success}
              comparisonColor={theme.chart.comparison}
              gridLineCount={screenMetrics.dashboard.chartGridLineCount}
              viewBoxWidth={viewBox.width}
              viewBoxHeight={viewBox.height}
              accessibilityLabel={t('dashboard.trend_chart_label')}
            />
          </View>
          <View style={{ marginTop: theme.space['3'] }}>
            <Legend
              items={[
                { color: theme.colors.success, label: t('dashboard.label_income') },
                { color: theme.colors.warning, label: t('dashboard.label_expense') },
                { color: theme.chart.comparison, label: t('dashboard.trend_legend_average') },
              ]}
            />
          </View>
        </>
      )}
    </Card>
  );
});
