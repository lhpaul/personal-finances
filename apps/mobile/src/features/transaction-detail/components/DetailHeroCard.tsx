import { formatClp } from '@finanzas/shared-utils';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Amount, Badge, Card, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import type { DetailState } from '../detail-state';

export interface DetailHeroCardProps {
  state: DetailState;
  direction: 'expense' | 'income';
  amountMinorUnits: number;
  /** `undefined` when no merchant resolved — the hero title is omitted in that case, the same
   * treatment #13's `MovementCard` gives a merchant-less movement's name line. */
  merchantName: string | null;
  /** The resolved category's own emoji (`getCategory`), rendered only in the `categorized` state
   * (Decision 4). The mockup's `uncategorized` / `excluded` glyphs are catalogue values instead
   * (`transaction_detail.icon_uncategorized` / `icon_excluded`) — data has no bearing on them. */
  categoryEmoji: string | undefined;
}

/**
 * `#screen=transaction-detail`'s hero card: the badge, the state glyph, the hero amount and the
 * merchant name (implementation plan Decision 4, Layer-by-Layer). Presentational; the screen
 * resolves `state`, `categoryEmoji` and the direction.
 */
export function DetailHeroCard({ state, direction, amountMinorUnits, merchantName, categoryEmoji }: DetailHeroCardProps) {
  const { t } = useTranslation();
  const isExpense = direction === 'expense';

  const glyph =
    state === 'excluded'
      ? t('transaction_detail.icon_excluded')
      : state === 'uncategorized'
        ? t('transaction_detail.icon_uncategorized')
        : (categoryEmoji ?? '');

  return (
    <Card>
      <View style={{ alignItems: 'center' }}>
        {state === 'excluded' ? (
          <Badge label={t('transaction_detail.badge_excluded')} />
        ) : (
          <Badge
            tone={isExpense ? 'warn' : 'ok'}
            label={isExpense ? t('transaction_detail.badge_expense') : t('transaction_detail.badge_income')}
          />
        )}
        <Text style={{ fontSize: screenMetrics.transactionDetail.heroGlyphSize, marginTop: theme.space['3'] }}>
          {glyph}
        </Text>
        <View style={{ marginTop: theme.space['2'] }}>
          <Amount
            size="hero"
            tone={isExpense ? 'out' : 'in'}
            minorUnits={amountMinorUnits}
            format={(minorUnits) => formatClp(minorUnits, { direction: isExpense ? 'out' : 'in', signDisplay: 'never' })}
          />
        </View>
        {merchantName !== null && (
          <Text variant="h3" center style={{ marginTop: theme.space['2'] }}>
            {merchantName}
          </Text>
        )}
      </View>
    </Card>
  );
}
