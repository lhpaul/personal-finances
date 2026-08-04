import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Pill, Sheet, Text } from '../../../components/ui';
import { withMinTarget } from '../../../components/ui/_internal/touch-metrics';
import type { TransactionListFilters, UserProduct } from '../../../db/types';
import { screenMetrics, theme } from '../../../theme';
import { DEFAULT_TRANSACTION_FILTERS } from '../filters';
import { FilterToggleRow } from './FilterToggleRow';

const CLOSE_TOUCH_METRICS = withMinTarget({
  width: screenMetrics.transactions.closeButtonSize,
  height: screenMetrics.transactions.closeButtonSize,
});

/** Decorative glyph, not user-facing copy (Decision 10). */
const CLOSE_GLYPH = '✕';

export interface TransactionsFilterSheetProps {
  visible: boolean;
  activeFilters: TransactionListFilters;
  products: UserProduct[];
  onApply: (next: TransactionListFilters) => void;
  onDismiss: () => void;
}

/**
 * `.mu-overlay` + `.mu-sheet` (implementation plan for issue #15, Decision 7). The `Sheet`
 * primitive's children fully unmount while `visible` is `false` (`_internal/Overlay` returns
 * `null`), which is what gives the draft its "fresh copy every time the sheet opens, discarded on
 * dismiss" behaviour for free — `FilterSheetContent`'s `useState` below re-initializes from
 * `activeFilters` on every mount.
 */
export function TransactionsFilterSheet({
  visible,
  activeFilters,
  products,
  onApply,
  onDismiss,
}: TransactionsFilterSheetProps) {
  return (
    <Sheet visible={visible} onRequestClose={onDismiss}>
      <FilterSheetContent activeFilters={activeFilters} products={products} onApply={onApply} onDismiss={onDismiss} />
    </Sheet>
  );
}

function FilterSheetContent({
  activeFilters,
  products,
  onApply,
  onDismiss,
}: Omit<TransactionsFilterSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TransactionListFilters>(activeFilters);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3">{t('transactions.filters_title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('transactions.filters_close_action')}
          onPress={onDismiss}
          hitSlop={CLOSE_TOUCH_METRICS.hitSlop}
          style={{
            width: screenMetrics.transactions.closeButtonSize,
            height: screenMetrics.transactions.closeButtonSize,
            borderRadius: theme.radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: screenMetrics.transactions.closeButtonFontSize }}>{CLOSE_GLYPH}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transactions.filter_type_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          <Pill
            label={t('transactions.filter_type_all')}
            active={draft.direction === 'all'}
            onPress={() => setDraft({ ...draft, direction: 'all' })}
          />
          <Pill
            label={t('transactions.filter_type_expense')}
            active={draft.direction === 'debit'}
            onPress={() => setDraft({ ...draft, direction: 'debit' })}
          />
          <Pill
            label={t('transactions.filter_type_income')}
            active={draft.direction === 'credit'}
            onPress={() => setDraft({ ...draft, direction: 'credit' })}
          />
        </View>
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transactions.filter_status_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          <Pill
            label={t('transactions.filter_status_all')}
            active={draft.categorization === 'all'}
            onPress={() => setDraft({ ...draft, categorization: 'all' })}
          />
          <Pill
            label={t('transactions.filter_status_uncategorized')}
            active={draft.categorization === 'uncategorized'}
            onPress={() => setDraft({ ...draft, categorization: 'uncategorized' })}
          />
          <Pill
            label={t('transactions.filter_status_categorized')}
            active={draft.categorization === 'categorized'}
            onPress={() => setDraft({ ...draft, categorization: 'categorized' })}
          />
        </View>
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transactions.filter_product_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          <Pill
            label={t('transactions.filter_product_all')}
            active={draft.productId === null}
            onPress={() => setDraft({ ...draft, productId: null })}
          />
          {products.map((product) => (
            <Pill
              key={product.id}
              label={product.name}
              active={draft.productId === product.id}
              onPress={() => setDraft({ ...draft, productId: product.id })}
            />
          ))}
        </View>
      </View>

      <FilterToggleRow
        value={draft.showExcluded}
        onValueChange={(value) => setDraft({ ...draft, showExcluded: value })}
      />

      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            label={t('transactions.filter_clear')}
            onPress={() => setDraft(DEFAULT_TRANSACTION_FILTERS)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={t('transactions.filter_apply')}
            onPress={() => {
              onApply(draft);
              onDismiss();
            }}
          />
        </View>
      </View>
    </View>
  );
}
