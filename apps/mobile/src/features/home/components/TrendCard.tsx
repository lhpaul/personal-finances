import type { Period } from '@finanzas/shared-utils';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Badge, Button, Card, Legend, LineChart, Segment } from '../../../components/ui';
import type { DirectionDayTotal } from '../../../db/types';
import { screenMetrics, theme } from '../../../theme';
import { buildCumulativeSeries, maxCumulativeTotal, toPolylinePoints } from '../trend-series';

type TrendDirection = 'debit' | 'credit';

const SERIES_COLOR_BY_DIRECTION: Record<TrendDirection, string> = {
  debit: theme.chart.series[1] as string,
  credit: theme.chart.series[2] as string,
};

export interface TrendCardProps {
  dailyTotals: DirectionDayTotal[];
  previousDailyTotals: DirectionDayTotal[];
  period: Period;
  previousPeriod: Period;
  monthLabel: string;
  previousMonthLabel: string;
  onPressViewFull: () => void;
}

/**
 * "Análisis de tendencias" (implementation plan Decision 6, brief AC4). Memoized: switching the
 * segment redraws only this card's own chart, and every derived array (`useMemo`) is stable
 * across an unrelated parent re-render (Scenario 23).
 */
export const TrendCard = memo(function TrendCard({
  dailyTotals,
  previousDailyTotals,
  period,
  previousPeriod,
  monthLabel,
  previousMonthLabel,
  onPressViewFull,
}: TrendCardProps) {
  const { t } = useTranslation();
  const [direction, setDirection] = useState<TrendDirection>('debit');

  const currentSeries = useMemo(
    () => buildCumulativeSeries(dailyTotals, period, direction),
    [dailyTotals, period, direction],
  );
  const previousSeries = useMemo(
    () => buildCumulativeSeries(previousDailyTotals, previousPeriod, direction),
    [previousDailyTotals, previousPeriod, direction],
  );
  const sharedMax = useMemo(
    () => Math.max(maxCumulativeTotal(currentSeries), maxCumulativeTotal(previousSeries)),
    [currentSeries, previousSeries],
  );
  const viewBox = useMemo(
    () => ({
      width: screenMetrics.home.chartViewBoxWidth,
      height: screenMetrics.home.chartViewBoxHeight,
    }),
    [],
  );
  const points = useMemo(
    () => toPolylinePoints(currentSeries, viewBox, sharedMax),
    [currentSeries, viewBox, sharedMax],
  );
  const comparisonPoints = useMemo(
    () => toPolylinePoints(previousSeries, viewBox, sharedMax),
    [previousSeries, viewBox, sharedMax],
  );

  return (
    <Card
      title={t('home.trend_title')}
      headerRight={<Badge label={monthLabel} />}
    >
      <Segment
        options={[
          { value: 'debit', label: t('home.trend_segment_expense') },
          { value: 'credit', label: t('home.trend_segment_income') },
        ]}
        value={direction}
        onChange={(value) => setDirection(value as TrendDirection)}
      />
      <View style={{ marginTop: theme.space['3'] }}>
        <LineChart
          points={points}
          comparisonPoints={comparisonPoints}
          seriesColor={SERIES_COLOR_BY_DIRECTION[direction]}
          gridLineCount={screenMetrics.home.chartGridLineCount}
          viewBoxWidth={viewBox.width}
          viewBoxHeight={viewBox.height}
          accessibilityLabel={
            direction === 'debit'
              ? t('home.trend_chart_label_expense')
              : t('home.trend_chart_label_income')
          }
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space['4'],
          marginTop: theme.space['3'],
        }}
      >
        <Legend
          items={[
            { color: SERIES_COLOR_BY_DIRECTION[direction], label: t('home.trend_legend_current') },
            { color: theme.chart.comparison, label: previousMonthLabel },
          ]}
        />
        <View style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size="sm"
          label={t('home.cta_view_full_analysis')}
          onPress={onPressViewFull}
        />
      </View>
    </Card>
  );
});
