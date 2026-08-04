import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, CategoryChip, Sheet, Text, TextField } from '../../../components/ui';
import { theme } from '../../../theme';
import type { CategoryDirection } from '../direction';

export type CategoryEditorSheetProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  direction: CategoryDirection;
  name: string;
  emoji: string | undefined;
  palette: readonly string[];
  canSave: boolean;
  onRequestClose: () => void;
  onChangeName: (name: string) => void;
  onChangeEmoji: (emoji: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onRequestDelete: () => void;
};

/**
 * `Sheet` + `TextField` (*Nombre*) + the emoji grid of `CategoryChip`s + `Cancelar`/`Guardar` +
 * the ghost danger *Eliminar categoría* button, rendered only in `mode: 'edit'` (implementation
 * plan for issue #21, Decisions 8, 9; Assumption A3). No direction control — direction is the
 * tab, never a field (Decision 7).
 */
export function CategoryEditorSheet({
  visible,
  mode,
  direction,
  name,
  emoji,
  palette,
  canSave,
  onRequestClose,
  onChangeName,
  onChangeEmoji,
  onCancel,
  onSave,
  onRequestDelete,
}: CategoryEditorSheetProps) {
  const { t } = useTranslation();

  const title =
    mode === 'edit'
      ? t('settings.categories.editor_edit_title')
      : direction === 'expense'
        ? t('settings.categories.editor_create_expense_title')
        : t('settings.categories.editor_create_income_title');

  return (
    <Sheet visible={visible} onRequestClose={onRequestClose}>
      <Text variant="h3">{title}</Text>

      <TextField label={t('settings.categories.name_label')} value={name} onChangeText={onChangeName} />

      <View style={{ marginTop: theme.space['4'] }}>
        <Text variant="label">{t('settings.categories.icon_label')}</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.space['2'],
            marginTop: theme.space['2'],
          }}
        >
          {palette.map((candidate, index) => (
            // Composite key (implementation plan for issue #21, Pass 2 finding): `candidate`
            // alone is not a structurally-guaranteed-unique React key — it depends on every
            // seeded emoji in one direction's `design/tokens.json` palette being visually
            // distinct, a data-authoring convention, not a type-level guarantee. Prefixing with
            // the (stable, non-reordering) index removes that assumption.
            <View key={`${index}:${candidate}`} style={{ width: '31%' }}>
              <CategoryChip
                emoji={candidate}
                state={candidate === emoji ? 'selected' : 'default'}
                onPress={() => onChangeEmoji(candidate)}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" label={t('settings.categories.cancel')} onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('settings.categories.save')} onPress={onSave} disabled={!canSave} />
        </View>
      </View>

      {mode === 'edit' && (
        <View style={{ marginTop: theme.space['3'] }}>
          <Button
            variant="ghostDanger"
            label={t('settings.categories.delete_cta')}
            onPress={onRequestDelete}
          />
        </View>
      )}
    </Sheet>
  );
}
