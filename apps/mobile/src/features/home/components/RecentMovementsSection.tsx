import { formatClp, formatShortDate } from '@finanzas/shared-utils';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text, TransactionRow } from '../../../components/ui';
import type { SupportedLocale } from '../../../db/labels';
import type { RecentMovement } from '../../../db/types';
import { theme } from '../../../theme';

/** Decorative glyphs, not user-facing copy — the fallback icon when neither the merchant nor the
 * category carries an emoji (Assumption A9, Decision 10). */
const FALLBACK_CREDIT_ICON = '💰';
const FALLBACK_DEBIT_ICON = '💳';

function resolveIcon(movement: RecentMovement): string {
  if (movement.merchantEmoji !== undefined) return movement.merchantEmoji;
  if (movement.categoryEmoji !== undefined) return movement.categoryEmoji;
  return movement.type === 'credit' ? FALLBACK_CREDIT_ICON : FALLBACK_DEBIT_ICON;
}

export interface RecentMovementsSectionProps {
  movements: RecentMovement[];
  locale: SupportedLocale;
  onPressViewAll: () => void;
  onPressMovement: (transactionId: string) => void;
}

/**
 * "Transacciones recientes" (implementation plan Decision 2, Assumptions A8-A10). An excluded
 * movement still renders, dimmed — it left the analysis, it was not deleted (Business Rule 3).
 */
export function RecentMovementsSection({
  movements,
  locale,
  onPressViewAll,
  onPressMovement,
}: RecentMovementsSectionProps) {
  const { t } = useTranslation();

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3">{t('home.recent_title')}</Text>
        <Button variant="ghost" size="sm" label={t('home.recent_cta')} onPress={onPressViewAll} />
      </View>
      <View style={{ marginTop: theme.space['3'], gap: theme.space['2'] }}>
        {movements.map((movement) => {
          // Assumption A10: an uncategorized, non-excluded debit is the "needs categorization"
          // warn state; every other row (categorized, credit, or excluded) renders plainly.
          const isPending =
            !movement.excluded && movement.type === 'debit' && movement.categoryName === undefined;
          const state = movement.excluded ? 'excluded' : isPending ? 'pending' : 'default';
          const meta = isPending
            ? t('home.recent_meta_warn')
            : movement.categoryName === undefined
              ? t('home.recent_meta_uncategorized', {
                  date: formatShortDate(movement.dateLocal, locale),
                })
              : t('home.recent_meta_categorized', {
                  date: formatShortDate(movement.dateLocal, locale),
                  category: movement.categoryName,
                });

          return (
            <TransactionRow
              key={movement.id}
              icon={resolveIcon(movement)}
              name={movement.merchantName ?? movement.rawDescription}
              meta={meta}
              amount={formatClp(movement.amount, { direction: movement.type === 'credit' ? 'in' : 'out' })}
              direction={movement.type === 'credit' ? 'in' : 'out'}
              state={state}
              metaTone={isPending ? 'warn' : 'default'}
              onPress={() => onPressMovement(movement.id)}
            />
          );
        })}
      </View>
    </View>
  );
}
