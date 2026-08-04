import type { CategorySuggestion } from '@finanzas/shared-domain';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Sheet, Text } from '../../../components/ui';
import { theme } from '../../../theme';
import type { Category } from '../../../db/types';
import type { CategoryChoice } from '../../categorization/category-choices';
import { CategoryGrid, type CategoryGridQuestion } from '../../categorization/components/CategoryGrid';

export interface CategoryPickerSheetProps {
  visible: boolean;
  question: CategoryGridQuestion;
  /** The curated (at most seven) chip list — #13's own `buildCategoryChoices` output
   * (implementation plan Decision 7). */
  categoryChoices: CategoryChoice[];
  /** The movement's own direction's full taxonomy, for "Elegir otra". */
  taxonomy: Category[];
  suggestion: CategorySuggestion | null;
  onCancel: () => void;
  onConfirm: (categoryId: string) => void;
}

/**
 * A local sheet composed from #13's own chip surfaces (implementation plan Decision 7):
 * `CategoryGrid` fed by `buildCategoryChoices`, with the same "Elegir otra" two-tier expansion
 * `CategorizeScreen` already offers. Not a manifest state and therefore not a fidelity target
 * (Assumption A4) — no mockup exists for this sheet's own visual details, so tapping a chip
 * confirms immediately rather than requiring a separate confirm step: there is exactly one
 * useful action per chip, and a same-tap confirm avoids an unmotivated extra tap.
 */
export function CategoryPickerSheet({
  visible,
  question,
  categoryChoices,
  taxonomy,
  suggestion,
  onCancel,
  onConfirm,
}: CategoryPickerSheetProps) {
  const { t } = useTranslation();
  const [showFullTaxonomy, setShowFullTaxonomy] = useState(false);

  useEffect(() => {
    if (visible) setShowFullTaxonomy(false);
  }, [visible]);

  const choices = showFullTaxonomy
    ? taxonomy.map((category) => ({ category, suggested: category.id === suggestion?.transactionCategoryId }))
    : categoryChoices;

  return (
    <Sheet visible={visible} onRequestClose={onCancel}>
      <Text variant="h3">{t('transaction_detail.picker_title')}</Text>
      <CategoryGrid
        question={question}
        choices={choices}
        selectedCategoryId={null}
        onSelect={onConfirm}
        showChooseOther={!showFullTaxonomy}
        onChooseOther={() => setShowFullTaxonomy(true)}
      />
      <View style={{ marginTop: theme.space['5'] }}>
        <Button variant="outline" label={t('transaction_detail.picker_cancel')} onPress={onCancel} />
      </View>
    </Sheet>
  );
}
