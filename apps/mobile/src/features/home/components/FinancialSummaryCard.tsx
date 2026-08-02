import { formatClpAbbreviated } from '@finanzas/shared-utils';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Amount, Badge, Card, StatTile, Text } from '../../../components/ui';
import { componentMetrics, theme } from '../../../theme';
import type { FinancialSummary } from '../summary';

/** Decorative glyph, not user-facing copy — the `‹ ›` month-nav glyph is inert (Decision 14,
 * Assumption A4). */
const MONTH_NAV_GLYPH = '‹ ›';

export interface FinancialSummaryCardProps {
  summary: FinancialSummary;
  monthLabel: string;
}

function movementCountLabel(t: TFunction, count: number): string {
  return count === 1
    ? t('home.summary_movement_count_single', { count })
    : t('home.summary_movement_count_plural', { count });
}

/**
 * "Resumen financiero" (implementation plan Decision 9 / D2 — abbreviated amounts). Every value
 * comes from `buildFinancialSummary`'s already-SQL-aggregated totals; this component performs no
 * money arithmetic.
 */
export function FinancialSummaryCard({ summary, monthLabel }: FinancialSummaryCardProps) {
  const { t } = useTranslation();

  const incomeValue = formatClpAbbreviated(summary.incomeTotal, {
    withCurrencySymbol: false,
    signDisplay: 'never',
  });
  const expenseValue = formatClpAbbreviated(summary.expenseTotal, {
    withCurrencySymbol: false,
    signDisplay: 'never',
  });
  const balanceValue = formatClpAbbreviated(summary.balance, {
    withCurrencySymbol: false,
    direction: summary.balance >= 0 ? 'in' : 'out',
  });

  return (
    <Card
      title={t('home.summary_title')}
      headerRight={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] }}>
          <Badge tone="warn" label={monthLabel} />
          <Text variant="xs">{MONTH_NAV_GLYPH}</Text>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: theme.space['3'] }}>
        <View style={{ flex: 1 }}>
          <StatTile
            tone="income"
            label={t('home.summary_income_label')}
            value={incomeValue}
            sub={movementCountLabel(t, summary.incomeMovementCount)}
            arrow="up"
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile
            tone="expense"
            label={t('home.summary_expense_label')}
            value={expenseValue}
            sub={movementCountLabel(t, summary.expenseMovementCount)}
            arrow="down"
          />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: theme.space['4'],
          paddingTop: theme.space['3'],
          borderTopWidth: componentMetrics.borderWidth.hairline,
          borderTopColor: theme.colors.border,
        }}
      >
        <Text variant="body">{t('home.summary_balance_label')}</Text>
        <Amount size="lg" tone={summary.balance >= 0 ? 'in' : 'out'} formatted={balanceValue} />
      </View>
    </Card>
  );
}
