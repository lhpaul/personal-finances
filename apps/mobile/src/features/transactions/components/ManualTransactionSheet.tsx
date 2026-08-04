import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Button, Pill, Sheet, Text, TextField } from '../../../components/ui';
import { withMinTarget } from '../../../components/ui/_internal/touch-metrics';
import type { UserProduct } from '../../../db/types';
import { screenMetrics, theme } from '../../../theme';
import type { ManualEntryDraft, ManualEntryError } from '../manual-entry';

const CLOSE_TOUCH_METRICS = withMinTarget({
  width: screenMetrics.transactions.closeButtonSize,
  height: screenMetrics.transactions.closeButtonSize,
});

/** Decorative glyph, not user-facing copy (Decision 10). */
const CLOSE_GLYPH = '✕';

/** One literal `t()` call per field — a `Record<key, string>` lookup would type `t()`'s
 * argument as a plain `string`, defeating i18next's generated literal-key typing. */
function errorLabel(t: TFunction, field: ManualEntryError['field']): string {
  switch (field) {
    case 'amount':
      return t('transactions.manual.error_amount');
    case 'description':
      return t('transactions.manual.error_description');
    case 'product':
      return t('transactions.manual.error_product');
  }
}

export interface ManualTransactionSheetProps {
  visible: boolean;
  products: UserProduct[];
  onSubmit: (draft: ManualEntryDraft) => Promise<ManualEntryError | null>;
  onDismiss: () => void;
}

/**
 * The manual-entry sheet (implementation plan for issue #15, Decision 12) — composed only from
 * this same screen's own drawn vocabulary (`Sheet` + grab handle + title + ✕ +
 * `TextField`/`Pill`/`Button`). Excluded from fidelity comparison: it has no manifest state. The
 * `Sheet` primitive's children fully unmount while `visible` is `false`, so `SheetContent`'s
 * local state is fresh every time the sheet opens.
 */
export function ManualTransactionSheet({ visible, products, onSubmit, onDismiss }: ManualTransactionSheetProps) {
  return (
    <Sheet visible={visible} onRequestClose={onDismiss}>
      <SheetContent products={products} onSubmit={onSubmit} onDismiss={onDismiss} />
    </Sheet>
  );
}

function SheetContent({
  products,
  onSubmit,
  onDismiss,
}: Omit<ManualTransactionSheetProps, 'visible'>) {
  const { t } = useTranslation();
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [productId, setProductId] = useState<string | null>(products[0]?.id ?? null);
  const [error, setError] = useState<ManualEntryError | null>(null);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(): Promise<void> {
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const result = await onSubmit({ amountText, description, type, productId });
      if (result !== null) {
        setError(result);
        return;
      }
      setError(null);
      onDismiss();
    } catch {
      // Found in review on PR #82: a rejected `onSubmit` (e.g. a storage failure) must not
      // leave the sheet silently stuck with a disabled Save button — surface it and let the
      // person retry, matching item #13's `categorize.write_failed` precedent for a write
      // failure with a visible surface.
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="h3">{t('transactions.manual.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('transactions.manual.close_action')}
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
        <TextField
          label={t('transactions.manual.amount_label')}
          value={amountText}
          onChangeText={setAmountText}
          placeholder={t('transactions.manual.amount_placeholder')}
          keyboardType="numeric"
          error={error?.field === 'amount' ? errorLabel(t, 'amount') : null}
        />
      </View>

      <View style={{ marginTop: theme.space['2'] }}>
        <TextField
          label={t('transactions.manual.description_label')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('transactions.manual.description_placeholder')}
          error={error?.field === 'description' ? errorLabel(t, 'description') : null}
        />
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transactions.manual.type_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          <Pill label={t('transactions.manual.type_expense')} active={type === 'debit'} onPress={() => setType('debit')} />
          <Pill label={t('transactions.manual.type_income')} active={type === 'credit'} onPress={() => setType('credit')} />
        </View>
      </View>

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('transactions.manual.product_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space['2'] }}>
          {products.map((product) => (
            <Pill
              key={product.id}
              label={product.name}
              active={productId === product.id}
              onPress={() => setProductId(product.id)}
            />
          ))}
        </View>
        {error?.field === 'product' && (
          <Text variant="hint" tone="danger">
            {errorLabel(t, 'product')}
          </Text>
        )}
      </View>

      {submitFailed && (
        <Text variant="hint" tone="danger" style={{ marginTop: theme.space['4'] }}>
          {t('transactions.manual.error_submit')}
        </Text>
      )}

      <View style={{ marginTop: theme.space['5'] }}>
        <Button label={t('transactions.manual.save_action')} onPress={handleSave} disabled={submitting} />
      </View>
    </View>
  );
}
