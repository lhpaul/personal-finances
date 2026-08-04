import { View } from 'react-native';
import { formatClp, formatPercentTenths } from '@finanzas/shared-utils';
import { useTranslation } from 'react-i18next';

import { Amount, Card, Text } from '../../../components/ui';
import type { MerchantSpendingStats } from '../../../db/types';
import { theme } from '../../../theme';
import { MonthlyBars } from './MonthlyBars';

export interface MerchantSpendingStatsCardProps {
  stats: MerchantSpendingStats;
}

/**
 * "Estadísticas de gasto" (implementation plan Decision 12; brief Scope "Spending statistics over
 * the last three months"). States `default` and `suggestions`. `percentageTenths` is `null` when
 * the previous month had no spending at all (`computePeriodDelta` — "no percentage change from
 * nothing"); this card falls back to `0` in that case rather than leaving the line blank, since
 * the mockup draws no empty variant for it.
 */
export function MerchantSpendingStatsCard({ stats }: MerchantSpendingStatsCardProps) {
  const { t } = useTranslation();
  const { delta } = stats;
  const percentText = formatPercentTenths(delta.percentageTenths ?? 0);
  // Spending less than the previous month reads as good news (green); more reads as a caution
  // (red). The mockup only draws the "less" case (`−55%`, `color:var(--success)`) — this is a
  // small UI polish decision for the "more" case, not one of the plan's enumerated assumptions.
  const deltaColor = delta.absoluteDelta <= 0 ? theme.colors.success : theme.colors.danger;

  return (
    <Card title={t('merchant.edit.stats_title')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: theme.space['3'],
        }}
      >
        <View>
          <Text variant="small">{t('merchant.edit.stats_average_label')}</Text>
          <Text variant="xs" style={{ color: deltaColor }}>
            {t('merchant.edit.stats_delta', { percent: percentText })}
          </Text>
        </View>
        <Amount
          size="lg"
          minorUnits={stats.monthlyAverage}
          format={(minorUnits) => formatClp(minorUnits, { signDisplay: 'never' })}
        />
      </View>
      <View style={{ marginTop: theme.space['4'] }}>
        <MonthlyBars months={stats.months} />
      </View>
    </Card>
  );
}
