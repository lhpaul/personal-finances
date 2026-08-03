import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, CategoryChip } from '../../../components/ui';
import type { Category } from '../../../db/types';
import { theme } from '../../../theme';

const GRID_COLUMN_WIDTH = '48%';

export interface MerchantCategoryPickerCardProps {
  /** The full taxonomy for the merchant's observed direction (Assumption A5) — not the curated,
   * suggestion-first grid the categorization flow (#13) draws; there is no suggestion here and no
   * "Elegir otra" affordance. */
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onConfirm: () => void;
}

/**
 * "Elige una categoría" (implementation plan Layer-by-Layer). State `category-picker` only — the
 * `Categoría por defecto` card, the stats card and the disclosure row are not on screen while
 * this one is (mockup `data-states`). Tapping a chip updates the draft directly; "Guardar
 * categoría" only closes the picker (Decision 4) — the draft was already the source of truth for
 * what the chip grid shows as selected, so there is nothing left to write here.
 */
export function MerchantCategoryPickerCard({
  categories,
  selectedCategoryId,
  onSelect,
  onConfirm,
}: MerchantCategoryPickerCardProps) {
  const { t } = useTranslation();

  return (
    <Card title={t('merchant.edit.picker_title')}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.space['3'],
          marginTop: theme.space['3'],
        }}
      >
        {categories.map((category) => (
          <View key={category.id} style={{ width: GRID_COLUMN_WIDTH }}>
            <CategoryChip
              emoji={category.emoji ?? ''}
              label={category.name}
              state={selectedCategoryId === category.id ? 'selected' : 'default'}
              onPress={() => onSelect(category.id)}
            />
          </View>
        ))}
      </View>
      <View style={{ marginTop: theme.space['4'] }}>
        <Button variant="outline" label={t('merchant.edit.picker_save')} onPress={onConfirm} />
      </View>
    </Card>
  );
}
