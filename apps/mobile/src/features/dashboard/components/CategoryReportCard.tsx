import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card, Segment } from '../../../components/ui';
import type { Category, DirectionCategoryTotal } from '../../../db/types';
import { componentMetrics, theme } from '../../../theme';
import { buildDonutReport } from '../category-report';
import type { DashboardPeriodType } from '../dashboard-period';
import { DonutSection } from './DonutSection';

export interface CategoryReportCardProps {
  currentCategoryTotals: DirectionCategoryTotal[];
  previousCategoryTotals: DirectionCategoryTotal[];
  categories: Category[];
  periodType: DashboardPeriodType;
}

type SelectedPeriod = 'current' | 'previous';

/**
 * "Reporte por categorías" (implementation plan Decisions 6-8, 11, 13; brief AC2, AC3, AC4). The
 * inner *Este mes* / *Mes anterior* segment toggles between two already-read bucket sets — no
 * database access (Decision 13). `React.memo` — every derived report is `useMemo`-stabilised
 * (Scenario 23).
 */
export const CategoryReportCard = memo(function CategoryReportCard({
  currentCategoryTotals,
  previousCategoryTotals,
  categories,
  periodType,
}: CategoryReportCardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<SelectedPeriod>('current');

  const totals = selected === 'current' ? currentCategoryTotals : previousCategoryTotals;
  const uncategorized = useMemo(
    () => ({ label: t('dashboard.category_uncategorized_label'), emoji: theme.categoryIcons.uncategorized }),
    [t],
  );

  const expenseReport = useMemo(
    () => buildDonutReport(totals, 'debit', categories, uncategorized),
    [totals, categories, uncategorized],
  );
  const incomeReport = useMemo(
    () => buildDonutReport(totals, 'credit', categories, uncategorized),
    [totals, categories, uncategorized],
  );

  const segmentOptions =
    periodType === 'month'
      ? [
          { value: 'current', label: t('dashboard.category_segment_current_month') },
          { value: 'previous', label: t('dashboard.category_segment_previous_month') },
        ]
      : [
          { value: 'current', label: t('dashboard.category_segment_current_week') },
          { value: 'previous', label: t('dashboard.category_segment_previous_week') },
        ];

  return (
    <Card title={t('dashboard.category_title')}>
      <Segment
        options={segmentOptions}
        value={selected}
        onChange={(value) => setSelected(value as SelectedPeriod)}
      />

      <View style={{ marginTop: theme.space['5'] }}>
        <DonutSection
          direction="debit"
          report={expenseReport}
          label={t('dashboard.label_expense')}
          accessibilityLabel={t('dashboard.category_donut_label_expense')}
          emptyIcon={t('dashboard.category_empty_expense_icon')}
          emptyTitle={t('dashboard.category_empty_expense_title')}
          emptyBody={t('dashboard.category_empty_expense_body')}
        />
      </View>

      <View
        style={{
          marginTop: theme.space['6'],
          paddingTop: theme.space['4'],
          borderTopWidth: componentMetrics.borderWidth.hairline,
          borderTopColor: theme.colors.border,
        }}
      >
        <DonutSection
          direction="credit"
          report={incomeReport}
          label={t('dashboard.label_income')}
          accessibilityLabel={t('dashboard.category_donut_label_income')}
          emptyIcon={t('dashboard.category_empty_income_icon')}
          emptyTitle={t('dashboard.category_empty_income_title')}
          emptyBody={t('dashboard.category_empty_income_body')}
        />
      </View>
    </Card>
  );
});
