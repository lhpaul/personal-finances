import { View } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { CategoryChip, Text } from '../../../components/ui';
import { theme } from '../../../theme';
import type { CategoryChoice } from '../category-choices';

const GRID_COLUMN_WIDTH = '48%';

export type CategoryGridQuestion = 'expense' | 'income';

export interface CategoryGridProps {
  question: CategoryGridQuestion;
  choices: CategoryChoice[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  /** `true` for the curated (at most seven) grid, which always ends in "Elegir otra"; `false`
   * once the full taxonomy is already shown (spec AC9). */
  showChooseOther: boolean;
  onChooseOther?: () => void;
}

/** Calls the translation function with a literal key argument in every branch — the pattern
 * `ready.tsx`'s `translateReminderDayKey` already established — required by the static
 * catalogue-key scan (`copy-contract.test.ts`) and `i18next.d.ts`'s compile-time key union.
 * Takes `t: TFunction`, not `ReturnType<typeof useTranslation>['t']` (found in review, item #21 —
 * see AGENTS.md's troubleshooting entry for the `TS2589` this avoids). */
function questionLabel(t: TFunction, question: CategoryGridQuestion): string {
  switch (question) {
    case 'expense':
      return t('categorize.question_expense');
    case 'income':
      return t('categorize.question_income');
  }
}

/**
 * The two-column category chip grid (spec UX Rules → Categorization, "Category grid"; AC7, AC8,
 * AC9). Purely presentational — `CategorizeScreen` decides whether `choices` is the curated
 * seven-chip list (Decision 6) or the full taxonomy for "Elegir otra".
 */
export function CategoryGrid({
  question,
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
        {questionLabel(t, question)}
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
