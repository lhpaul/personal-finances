import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deriveDateLocal } from '@finanzas/shared-utils';

import { Button, EmptyState, Text } from '../../../src/components/ui';
import { MerchantAliasesCard, MerchantAliasesDisclosure } from '../../../src/features/merchants/components/MerchantAliasesCard';
import { MerchantCategoryPickerCard } from '../../../src/features/merchants/components/MerchantCategoryPickerCard';
import { MerchantDefaultCategoryCard } from '../../../src/features/merchants/components/MerchantDefaultCategoryCard';
import { MerchantNameCard } from '../../../src/features/merchants/components/MerchantNameCard';
import { MerchantSpendingStatsCard } from '../../../src/features/merchants/components/MerchantSpendingStatsCard';
import type { MerchantEditorState } from '../../../src/features/merchants/types';
import { useMerchantEditor } from '../../../src/features/merchants/useMerchantEditor';
import { fidelityTestId, useFidelityPreview } from '../../../src/lib/fidelity-preview';
import { screenMetrics, theme } from '../../../src/theme';

/** Decorative glyphs, not user-facing copy — see `StageTopBar`'s `BACK_GLYPH` precedent. */
const BACK_GLYPH = '←';
const NOT_FOUND_ICON = '🔍';

/** Narrows the `fidelityState` preview param to a real `MerchantEditorState`, falling back to
 * `undefined` (which `useMerchantEditor` itself defaults to `'default'`) — implementation plan
 * for issue #47, Decision 9. */
function resolveInitialState(previewState: string | null): MerchantEditorState | undefined {
  if (previewState === 'default' || previewState === 'suggestions' || previewState === 'category-picker') {
    return previewState;
  }
  return undefined;
}

/**
 * `#screen=merchant-edit` (implementation plan for issue #14). Reads `merchantId` and the
 * optional `categoryId` route param (Decision 3, the A9 seam with #13), delegates every read and
 * write to `useMerchantEditor`, and renders the top bar, the name card, the state-dependent cards
 * and the always-present "Guardar" — a draft form; only "Agrupar" writes immediately
 * (Decision 4). Not-found and error both render the same defensive empty state (Assumption A7) —
 * the mockup draws no distinct UI for a load failure, and the runbook's Step 10 is the only
 * scenario this branch needs to cover.
 */
export default function MerchantEdit() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ merchantId: string; categoryId?: string }>();
  const preview = useFidelityPreview();
  const today = useMemo(() => deriveDateLocal(new Date()), []);

  const editor = useMerchantEditor({
    merchantId: params.merchantId,
    initialCategoryId: params.categoryId,
    today,
    initialState: preview.active ? resolveInitialState(preview.state) : undefined,
  });

  if (editor.status === 'pending') {
    // spec UX Rules → Loading: never a half-populated card.
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }

  if (editor.status !== 'ready' || editor.snapshot === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} testID={fidelityTestId('merchant-edit')}>
        <EmptyState
          icon={NOT_FOUND_ICON}
          title={t('merchant.edit.not_found_title')}
          action={{ label: t('merchant.edit.not_found_action'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  const snapshot = editor.snapshot;
  const selectedCategory = snapshot.categories.find((category) => category.id === editor.draftCategoryId);
  const disclosureCount = snapshot.aliases.length + snapshot.candidates.length;

  async function handleSave(): Promise<void> {
    await editor.save();
    router.back();
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('merchant-edit')}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space['3'],
          paddingHorizontal: theme.space['4'],
          paddingVertical: theme.space['3'],
          backgroundColor: theme.colors.surface1,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('merchant.edit.back_a11y')}
          onPress={() => router.back()}
          style={{
            width: screenMetrics.merchants.topBarButtonSize,
            height: screenMetrics.merchants.topBarButtonSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: screenMetrics.merchants.topBarButtonGlyphSize }}>{BACK_GLYPH}</Text>
        </Pressable>
        <Text variant="h3" center style={{ flexShrink: 1 }}>
          {t('merchant.edit.title')}
        </Text>
        <View style={{ width: screenMetrics.merchants.topBarButtonSize, height: screenMetrics.merchants.topBarButtonSize }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.space['5'], paddingBottom: theme.space['8'], gap: theme.space['4'] }}
      >
        <MerchantNameCard name={editor.draftName} onChangeName={editor.setName} />

        {editor.state === 'category-picker' ? (
          <MerchantCategoryPickerCard
            categories={snapshot.categories}
            selectedCategoryId={editor.draftCategoryId}
            onSelect={editor.selectCategory}
            onConfirm={editor.confirmCategory}
          />
        ) : (
          <>
            <MerchantDefaultCategoryCard category={selectedCategory} onChangePress={editor.openCategoryPicker} />
            <MerchantSpendingStatsCard stats={snapshot.stats} />
            {editor.state === 'default' ? (
              <MerchantAliasesDisclosure count={disclosureCount} onPress={editor.openSuggestions} />
            ) : (
              <MerchantAliasesCard
                aliases={snapshot.aliases}
                candidates={snapshot.candidates}
                onGroupCandidate={editor.groupCandidate}
                onClose={editor.closeSuggestions}
              />
            )}
          </>
        )}

        <Button label={t('merchant.edit.save')} onPress={() => void handleSave()} disabled={editor.busy} />
      </ScrollView>
    </SafeAreaView>
  );
}
