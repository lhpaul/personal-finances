import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryChip, Text } from '../../../components/ui';
import { theme } from '../../../theme';
import type { CategoryChoice } from '../category-choices';

const GRID_COLUMN_WIDTH = '48%';

export interface CategoryGridProps {
  questionKey: 'categorize.question_expense' | 'categorize.question_income';
  choices: CategoryChoice[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  /** `true` for the curated (at most seven) grid, which always ends in "Elegir otra"; `false`
   * once the full taxonomy is already shown (spec AC9). */
  showChooseOther: boolean;
  onChooseOther?: () => void;
}

/**
 * The two-column category chip grid (spec UX Rules → Categorization, "Category grid"; AC7, AC8,
 * AC9). Purely presentational — `CategorizeScreen` decides whether `choices` is the curated
 * seven-chip list (Decision 6) or the full taxonomy for "Elegir otra".
 */
export function CategoryGrid({
  questionKey,
  choices,
  selectedCategoryId,
  onSelect,
  showChooseOther,
  onChooseOther,
}: CategoryGridProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Text variant="h3" style={{ marginTop: theme.space['5'] }}>
        {t(questionKey)}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.space['3'],
          marginTop: theme.space['3'],
        }}
      >
        {choices.map(({ category, suggested }) => (
          <View key={category.id} style={{ width: GRID_COLUMN_WIDTH }}>
            <CategoryChip
              emoji={category.emoji ?? ''}
              label={category.name}
              hint={suggested ? t('categorize.suggested_hint') : undefined}
              state={
                selectedCategoryId === category.id ? 'selected' : suggested ? 'suggested' : 'default'
              }
              onPress={() => onSelect(category.id)}
            />
          </View>
        ))}
        {showChooseOther && (
          <View style={{ width: GRID_COLUMN_WIDTH }}>
            <CategoryChip
              emoji={t('categorize.choose_other_emoji')}
              label={t('categorize.choose_other')}
              onPress={onChooseOther}
            />
          </View>
        )}
      </View>
    </View>
  );
}
