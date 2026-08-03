import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatClp, formatShortDate, formatTimeOfDay } from '@finanzas/shared-utils';

import { Amount, Badge, Card, Text } from '../../../components/ui';
import { theme } from '../../../theme';
import type { SupportedLocale } from '../../../i18n/locale';

export type MovementDirection = 'expense' | 'income';

export interface MovementCardProps {
  direction: MovementDirection;
  amountMinorUnits: number;
  dateLocal: string;
  occurredAt: string;
  rawDescription: string;
  /** `undefined` when no merchant resolved for this movement (spec A8) — the bank's description
   * stands in for a merchant name and no edit affordance is offered. */
  merchantName?: string;
  onMerchantPress?: () => void;
  locale: SupportedLocale;
}

/**
 * The movement card (spec UX Rules → Categorization, `expense` / `income`). Presentational and
 * data-free beyond its props — `CategorizeScreen` supplies the resolved values.
 */
export function MovementCard({
  direction,
  amountMinorUnits,
  dateLocal,
  occurredAt,
  rawDescription,
  merchantName,
  onMerchantPress,
  locale,
}: MovementCardProps) {
  const { t } = useTranslation();
  const isExpense = direction === 'expense';

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'] }}>
        <Text style={{ fontSize: theme.typography.size.lg }}>
          {isExpense ? t('categorize.icon_expense') : t('categorize.icon_income')}
        </Text>
        <Badge
          tone={isExpense ? 'warn' : 'ok'}
          label={isExpense ? t('categorize.badge_expense') : t('categorize.badge_income')}
        />
        <View style={{ flex: 1 }} />
        <Text variant="small">
          {t('categorize.datetime', {
            date: formatShortDate(dateLocal, locale),
            time: formatTimeOfDay(new Date(occurredAt)),
          })}
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: theme.space['4'] }}>
        <Amount
          size="hero"
          tone={isExpense ? 'out' : 'in'}
          minorUnits={amountMinorUnits}
          format={(minorUnits) => formatClp(minorUnits, { direction: isExpense ? 'out' : 'in', signDisplay: 'never' })}
        />
        {merchantName !== undefined && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={merchantName}
              accessibilityHint={t('categorize.merchant_edit_hint')}
              onPress={onMerchantPress}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['2'], marginTop: theme.space['3'] }}
            >
              <Text variant="h3">{merchantName}</Text>
              <Text tone="brand">{t('categorize.merchant_edit_icon')}</Text>
            </Pressable>
            <Text variant="xs" tone="brand">
              {t('categorize.merchant_edit_hint')}
            </Text>
          </>
        )}
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('categorize.description_label')}</Text>
        <Card variant="flat">
          <Text variant="mono">{rawDescription}</Text>
        </Card>
      </View>
    </Card>
  );
}
