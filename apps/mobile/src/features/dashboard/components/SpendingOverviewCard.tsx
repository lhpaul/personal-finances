import { formatClp } from '@finanzas/shared-utils';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Amount, BarChart, Badge, Card, EmptyState, Legend, Text } from '../../../components/ui';
import { theme } from '../../../theme';
import type { DashboardPeriodType } from '../dashboard-period';
import type { SpendingOverview } from '../spending-overview';

export interface SpendingOverviewCardProps {
  overview: SpendingOverview;
  periodType: DashboardPeriodType;
  /** `formatMonthAbbreviation(period.start, locale)` for the previous and current period — the
   * `month` state's bar labels (`dic`, `ene`). Ignored in the `week` state, whose labels are
   * positional (Assumption A8). */
  previousMonthLabel: string;
  currentMonthLabel: string;
}

const BADGE_TONE = { down: 'ok', up: 'warn', flat: 'neutral' } as const;

/** "Resumen de gastos" (implementation plan Decision 16; brief AC3, AC4). `React.memo` — every
 * derived value is a plain read of `overview`, already computed by the pure
 * `buildSpendingOverview` (Scenario 23). */
export const SpendingOverviewCard = memo(function SpendingOverviewCard({
  overview,
  periodType,
  previousMonthLabel,
  currentMonthLabel,
}: SpendingOverviewCardProps) {
  const { t } = useTranslation();
  const { columns, currentTotal, delta } = overview;

  const barLabels = useMemo(
    () =>
      periodType === 'month'
        ? { previous: previousMonthLabel, current: currentMonthLabel }
        : {
            previous: t('dashboard.spending_bar_label_previous_week'),
            current: t('dashboard.spending_bar_label_current_week'),
          },
    [periodType, previousMonthLabel, currentMonthLabel, t],
  );

  const barColumns = useMemo(
    () => [
      {
        key: 'previous',
        heightRatio: columns[0]?.heightRatio ?? 0,
        color: theme.chart.comparison,
        label: barLabels.previous,
      },
      {
        key: 'current',
        heightRatio: columns[1]?.heightRatio ?? 0,
        color: theme.colors.warning,
        label: barLabels.current,
      },
    ],
    [columns, barLabels],
  );

  const deltaLabel =
    delta === null
      ? null
      : t(
          delta.direction === 'down'
            ? 'dashboard.spending_delta_down'
            : delta.direction === 'up'
              ? 'dashboard.spending_delta_up'
              : 'dashboard.spending_delta_flat',
          { percent: delta.percentWhole },
        );

  // Decision 11(a): the current period's expense total is 0.
  const isEmpty = currentTotal === 0;

  return (
    <Card title={t('dashboard.spending_title')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="xs">{t('dashboard.spending_total_label')}</Text>
          <View style={{ marginTop: theme.space['1'] }}>
            <Amount
              size="lg"
              minorUnits={currentTotal}
              format={(v) => formatClp(v, { signDisplay: 'never' })}
            />
          </View>
        </View>
        {!isEmpty && delta !== null && deltaLabel !== null && (
          <Badge tone={BADGE_TONE[delta.direction]} label={deltaLabel} />
        )}
      </View>

      {isEmpty ? (
        <View style={{ marginTop: theme.space['4'] }}>
          <EmptyState
            icon={t('dashboard.spending_empty_icon')}
            title={t('dashboard.spending_empty_title')}
            description={t('dashboard.spending_empty_body')}
          />
        </View>
      ) : (
        <>
          <View style={{ marginTop: theme.space['5'] }}>
            <BarChart columns={barColumns} />
          </View>
          <View style={{ marginTop: theme.space['3'] }}>
            <Legend
              items={[
                { color: theme.chart.comparison, label: t('dashboard.spending_legend_previous') },
                { color: theme.colors.warning, label: t('dashboard.spending_legend_current') },
              ]}
            />
          </View>
        </>
      )}
    </Card>
  );
});
