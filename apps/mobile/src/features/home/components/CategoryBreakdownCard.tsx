import { formatClpAbbreviated, formatPercentTenths } from '@finanzas/shared-utils';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, CategoryRow } from '../../../components/ui';
import type { Category } from '../../../db/types';
import { componentMetrics, theme } from '../../../theme';
import { HOME_CATEGORY_ROW_LIMIT } from '../constants';
import type { CategoryBucket } from '../summary';

export interface CategoryBreakdownCardProps {
  /** Every bucket (unsliced) — the subtitle counts all of them (Assumption A5); only the top
   * `HOME_CATEGORY_ROW_LIMIT` render as rows. */
  buckets: CategoryBucket[];
  categories: Category[];
  monthLabel: string;
  onPressViewFull: () => void;
}

/** "Análisis por categorías" (implementation plan Decision 5, Assumption A5-A6). Memoized:
 * `buckets`/`categories` only change when `readHomeData` re-reads on focus (Scenario 23). */
export const CategoryBreakdownCard = memo(function CategoryBreakdownCard({
  buckets,
  categories,
  monthLabel,
  onPressViewFull,
}: CategoryBreakdownCardProps) {
  const { t } = useTranslation();
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const visibleBuckets = buckets.slice(0, HOME_CATEGORY_ROW_LIMIT);

  const subtitle =
    buckets.length === 1
      ? t('home.category_subtitle_single', { count: 1, month: monthLabel })
      : t('home.category_subtitle_plural', { count: buckets.length, month: monthLabel });

  return (
    <Card title={t('home.category_title')} subtitle={subtitle}>
      {visibleBuckets.map((bucket, index) => {
        const category =
          bucket.transactionCategoryId === null ? undefined : categoryById.get(bucket.transactionCategoryId);
        const emoji = category?.emoji ?? theme.categoryIcons.uncategorized;
        const label = category?.name ?? t('home.category_uncategorized_label');
        const amountFormatted = formatClpAbbreviated(bucket.total, {
          withCurrencySymbol: true,
          signDisplay: 'never',
        });
        const percent = formatPercentTenths(bucket.percentTenths);
        const meta =
          bucket.movementCount === 1
            ? t('home.category_meta_single', { count: 1, percent })
            : t('home.category_meta_plural', { count: bucket.movementCount, percent });

        return (
          <View
            key={bucket.transactionCategoryId ?? 'uncategorized'}
            style={
              index > 0
                ? { borderTopWidth: componentMetrics.borderWidth.hairline, borderTopColor: theme.colors.border }
                : undefined
            }
          >
            <CategoryRow
              emoji={emoji}
              label={label}
              amountFormatted={amountFormatted}
              ratio={bucket.ratio}
              fillColor={bucket.fillColor}
              meta={meta}
            />
          </View>
        );
      })}
      <View style={{ marginTop: theme.space['3'] }}>
        <Button variant="ghost" label={t('home.cta_view_full_analysis')} onPress={onPressViewFull} />
      </View>
    </Card>
  );
});
