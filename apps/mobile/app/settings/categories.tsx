import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isOtrosSlug } from '../../src/db/repositories/categories';
import { Button, Note, Segment, TopBar } from '../../src/components/ui';
import { CategoryEditorSheet } from '../../src/features/categories/components/CategoryEditorSheet';
import { CategoryReorderList } from '../../src/features/categories/components/CategoryReorderList';
import { DeleteCategoryModal } from '../../src/features/categories/components/DeleteCategoryModal';
import type { CategoryDirection } from '../../src/features/categories/direction';
import { initialEditorForm, validateEditorForm } from '../../src/features/categories/editor-form';
import { emojiPaletteFor, paletteWithCurrent } from '../../src/features/categories/emoji-palette';
import {
  useCategoriesSettings,
  type CategoriesOverlay,
  type CategoriesSettingsErrorKey,
} from '../../src/features/categories/use-categories-settings';
import { toSupportedLocale } from '../../src/i18n/locale';
import { fidelityTestId, useFidelityPreview } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

// `TFunction` (i18next's own exported type), not `ReturnType<typeof useTranslation>['t']` (found
// in review: with ~740+ flat catalogue keys, extracting the type this way triggers
// `TS2589: Type instantiation is excessively deep and possibly infinite` at every call site that
// reuses it as a parameter type — see AGENTS.md's troubleshooting entry).
type Translate = TFunction;

/** Every branch below calls the translate function with its own literal key (never a variable
 * key), mirroring the discipline `settings/index.tsx`'s `resolveSubtitle` established for a
 * closed union. */
function errorCopy(t: Translate, error: CategoriesSettingsErrorKey): string {
  switch (error) {
    case 'reorder':
      return t('settings.categories.error_reorder');
    case 'save':
      return t('settings.categories.error_save');
    case 'delete':
      return t('settings.categories.error_delete');
    case 'load':
      return t('settings.categories.error_load');
  }
}

/**
 * `#screen=settings-categories` (`expense`, `income`, `edit`, `delete-confirm` — implementation
 * plan for issue #21). Composition-only: `TopBar` (item #19's `mu-topbar*` owner — the plan
 * assumed a component named `ScreenTopBar`; the merged primitive is `TopBar`, same role and
 * ownership), the `Segment` tabs, `CategoryReorderList`, the two create buttons, the inline error
 * `Note`, the editor `Sheet` and the delete `Modal`. Deletion is entirely `deleteCategory` (item
 * #3's BR7 cascade) — this route adds no re-parenting logic of its own (Decision 1).
 */
export default function SettingsCategories() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = toSupportedLocale(i18n.language);
  const state = useCategoriesSettings(locale);
  const preview = useFidelityPreview();

  const [dragging, setDragging] = useState(false);
  const [form, setForm] = useState(() => initialEditorForm(null));

  // Deterministic fidelity states (Decision 14, R3-contingent): the preview only *opens* an
  // overlay for `edit`/`delete-confirm`, targeting the first non-fallback category of the
  // (preview-forced) expense tab by sort order — with the bundled seed, that is Comida. It never
  // writes.
  const previewCategoryId = state.rows[0]?.id;
  const direction: CategoryDirection =
    preview.active && preview.state === 'income' ? 'income' : preview.active ? 'expense' : state.direction;
  const overlay: CategoriesOverlay =
    preview.active && preview.state === 'edit' && previewCategoryId !== undefined
      ? { kind: 'editor', mode: 'edit', categoryId: previewCategoryId }
      : preview.active && preview.state === 'delete-confirm' && previewCategoryId !== undefined
        ? { kind: 'delete-confirm', categoryId: previewCategoryId }
        : state.overlay;

  // Found in review, PR #97: `direction` above is a *render-only* derivation — it drove the
  // Segment and the create-button label, but `state.rows` still came from the hook's own
  // `state.direction`, which only changes via `state.setDirection` (the real Segment's
  // `onChange`). Under the `income` preview state, the Segment showed the income tab while
  // `CategoryReorderList` still rendered expense rows. Drive the hook's direction from the
  // preview so the loaded rows actually match what is rendered.
  useEffect(() => {
    if (!preview.active) return;
    if (state.direction !== direction) state.setDirection(direction);
    // `state` is a fresh object every render (the hook returns a plain object literal, not a
    // stable ref), so depending on it would re-run this effect every render for no reason; the
    // two members this effect actually reads (`state.direction`, `state.setDirection`) are
    // listed explicitly instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.active, direction, state.direction, state.setDirection]);

  const overlayKey = overlay.kind === 'editor' ? `${overlay.mode}:${overlay.categoryId ?? ''}` : null;
  useEffect(() => {
    if (overlay.kind !== 'editor') return;
    const category =
      overlay.categoryId !== null ? state.rows.find((row) => row.id === overlay.categoryId) : undefined;
    setForm(initialEditorForm(category ? { name: category.name, emoji: category.emoji } : null));
    // The form resets only when the overlay's identity (mode + which category) changes, not on
    // every unrelated row refresh while the sheet stays open — `overlayKey` is that identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayKey]);

  const { canSave, normalizedName } = validateEditorForm(form);
  const rawPalette = emojiPaletteFor(direction);
  const palette = paletteWithCurrent(rawPalette, form.emoji);

  const deletingCategory =
    overlay.kind === 'delete-confirm' ? state.rows.find((row) => row.id === overlay.categoryId) : undefined;
  const fallbackCategory = state.rows.find((row) => isOtrosSlug(row.slug));

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top']}
      testID={fidelityTestId('settings-categories')}
    >
      <TopBar
        title={t('settings.categories.title')}
        onBack={() => router.push('/settings')}
        backAccessibilityLabel={t('settings.back_label')}
      />

      <ScrollView
        style={{ flex: 1 }}
        scrollEnabled={!dragging}
        contentContainerStyle={{
          paddingHorizontal: theme.space['5'],
          paddingTop: theme.space['4'],
          paddingBottom: theme.space['8'],
        }}
      >
        <Segment
          options={[
            { value: 'expense', label: t('settings.categories.tab_expense') },
            { value: 'income', label: t('settings.categories.tab_income') },
          ]}
          value={direction}
          onChange={(value) => state.setDirection(value as CategoryDirection)}
        />

        {state.error !== null && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note
              tone="danger"
              icon={t('settings.categories.error_icon')}
              action={
                state.retry !== null
                  ? { label: t('settings.categories.retry_label'), onPress: state.retry }
                  : undefined
              }
            >
              {errorCopy(t, state.error)}
            </Note>
          </View>
        )}

        <CategoryReorderList
          direction={direction}
          rows={state.rows}
          onRowPress={state.openEdit}
          onReorder={state.commitReorder}
          onDragStateChange={setDragging}
        />

        <View style={{ marginTop: theme.space['4'] }}>
          <Button
            variant="outline"
            label={
              direction === 'expense'
                ? t('settings.categories.create_expense')
                : t('settings.categories.create_income')
            }
            onPress={state.openCreate}
          />
        </View>
      </ScrollView>

      <CategoryEditorSheet
        visible={overlay.kind === 'editor'}
        mode={overlay.kind === 'editor' ? overlay.mode : 'create'}
        direction={direction}
        name={form.name}
        emoji={form.emoji}
        palette={palette}
        canSave={canSave}
        onRequestClose={state.closeOverlay}
        onChangeName={(name) => setForm((prev) => ({ ...prev, name }))}
        onChangeEmoji={(emoji) => setForm((prev) => ({ ...prev, emoji }))}
        onCancel={state.closeOverlay}
        onSave={() => {
          if (!canSave || form.emoji === undefined) return;
          // `normalizedName`, not `form.name` (found in review, PR #97): the raw field value can
          // carry leading/trailing whitespace the person typed but never intended to persist.
          state.saveEditor({ name: normalizedName, emoji: form.emoji });
        }}
        onRequestDelete={() => {
          if (overlay.kind === 'editor' && overlay.categoryId !== null) {
            state.requestDelete(overlay.categoryId);
          }
        }}
      />

      <DeleteCategoryModal
        visible={overlay.kind === 'delete-confirm'}
        categoryLabel={
          deletingCategory !== undefined ? `${deletingCategory.emoji ?? ''} ${deletingCategory.name}`.trim() : ''
        }
        fallbackLabel={
          fallbackCategory !== undefined ? `${fallbackCategory.emoji ?? ''} ${fallbackCategory.name}`.trim() : ''
        }
        totalCount={deletingCategory?.totalCount ?? 0}
        onRequestClose={state.closeOverlay}
        onCancel={state.closeOverlay}
        onConfirm={state.confirmDelete}
      />
    </SafeAreaView>
  );
}
