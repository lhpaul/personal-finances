import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { suggestCategory } from '@finanzas/shared-domain';

import { Button, Note } from '../../components/ui';
import { useFidelityPreview } from '../../lib/fidelity-preview';
import { resolveDeviceLocale } from '../../i18n/locale';
import { theme } from '../../theme';
import { buildCategoryChoices } from './category-choices';
import { CategoryGrid } from './components/CategoryGrid';
import { ExcludeSheet } from './components/ExcludeSheet';
import { MovementCard } from './components/MovementCard';
import { NotSureDisclosure } from './components/NotSureDisclosure';
import { StageProgress } from './components/StageProgress';
import { StageTopBar } from './components/StageTopBar';
import { buildStageBatch, type PreviewDirection } from './stage-batch';
import type { StageExclusionReason } from './use-stage-actions';
import { useStageActions } from './use-stage-actions';
import { useStageData } from './use-stage-data';

/** `#screen=categorize` fidelity states this screen owns, and the preview direction each one
 * captures against (Decision 14, Assumption P6). */
function previewDirectionFor(state: string | null): PreviewDirection | null {
  if (state === 'income') return 'income';
  if (state === 'expense' || state === 'not-sure' || state === 'exclude-sheet') return 'expense';
  return null;
}

export interface CategorizeScreenProps {
  /** `fidelityTestId('categorize')` — computed and passed down by the route file
   * (`app/categorize/index.tsx`); see `StageIntroScreenProps.testID`'s doc comment for why. */
  testID?: string;
}

/**
 * `#screen=categorize` (spec Use Cases 2-7, UX Rules → Categorization). The stage session — the
 * batch, the index, the pending selection and the resolved counter — is `useState` here
 * (implementation plan Decision 2); nothing is persisted, so leaving the flow loses only the
 * unconfirmed selection on the current movement (AC16).
 */
export function CategorizeScreen({ testID }: CategorizeScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [locale] = useState(() => resolveDeviceLocale());
  const stageData = useStageData({ locale });
  const stageActions = useStageActions();
  const preview = useFidelityPreview();

  const [index, setIndex] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [pendingAtStart, setPendingAtStart] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [notSureOpen, setNotSureOpen] = useState(false);
  const [excludeSheetOpen, setExcludeSheetOpen] = useState(false);
  const [showFullTaxonomy, setShowFullTaxonomy] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (stageData.status === 'ready' && pendingAtStart === null) {
      setPendingAtStart(stageData.data.pendingCount);
    }
  }, [stageData, pendingAtStart]);

  const previewDirection = preview.active ? previewDirectionFor(preview.state) : null;
  const batch = useMemo(() => {
    if (stageData.status !== 'ready') return [];
    return buildStageBatch(stageData.data.batch, { previewDirection });
  }, [stageData, previewDirection]);

  useEffect(() => {
    if (!preview.active) return;
    setNotSureOpen(preview.state === 'not-sure' || preview.state === 'exclude-sheet');
    setExcludeSheetOpen(preview.state === 'exclude-sheet');
  }, [preview.active, preview.state]);

  if (stageData.status !== 'ready' || batch.length === 0) {
    // spec UX Rules → Loading: never a half-populated card.
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }

  const maybeMovement = batch[index];
  if (!maybeMovement) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} />;
  }
  // Narrowed once, here, and used everywhere below — `batch[index]` on its own stays
  // `StageMovement | undefined` to TypeScript inside every nested closure declared further down.
  const movement = maybeMovement;

  const isExpense = movement.type === 'debit';
  const taxonomy = isExpense ? stageData.data.expenseCategories : stageData.data.incomeCategories;
  const used = isExpense ? stageData.data.usedExpenseCategories : stageData.data.usedIncomeCategories;
  const suggestion = suggestCategory({
    currentCategorySource: movement.categorySource,
    merchant: movement.merchant,
  });
  const curatedChoices = buildCategoryChoices({ suggestion, used, taxonomy });
  const choices = showFullTaxonomy
    ? taxonomy.map((category) => ({ category, suggested: category.id === suggestion?.transactionCategoryId }))
    : curatedChoices;

  function resetPerMovementState(): void {
    setSelectedCategoryId(null);
    setNotSureOpen(false);
    setExcludeSheetOpen(false);
    setShowFullTaxonomy(false);
    setWriteFailed(false);
  }

  function advance(resolved: boolean): void {
    const nextResolved = resolved ? resolvedCount + 1 : resolvedCount;
    const nextIndex = index + 1;
    resetPerMovementState();
    if (nextIndex >= batch.length) {
      router.replace({
        pathname: '/categorize/complete',
        params: { resolved: String(nextResolved), pendingAtStart: String(pendingAtStart ?? 0) },
      });
      return;
    }
    setResolvedCount(nextResolved);
    setIndex(nextIndex);
  }

  async function withWriteGuard(run: () => Promise<void>, onSuccess: () => void): Promise<void> {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await run();
      onSuccess();
    } catch {
      setWriteFailed(true);
    } finally {
      submittingRef.current = false;
    }
  }

  function handleSkip(): void {
    // Skip records nothing at all (AC13) — no write, so no guard is needed.
    advance(false);
  }

  function handleConfirm(): void {
    if (selectedCategoryId === null) return; // inert until a selection exists (AC12).
    if (stageActions.status !== 'ready') return;
    const categoryId = selectedCategoryId;
    void withWriteGuard(
      () => stageActions.actions.confirmCategory(movement.id, categoryId),
      () => advance(true),
    );
  }

  function handleReviewLater(): void {
    if (stageActions.status !== 'ready') return;
    void withWriteGuard(
      () => stageActions.actions.markReviewLater(movement.id),
      () => advance(false),
    );
  }

  function handleUncertain(): void {
    if (stageActions.status !== 'ready') return;
    void withWriteGuard(
      () => stageActions.actions.markUncertain(movement.id),
      () => advance(false),
    );
  }

  function handleExcludeConfirm(input: { reason: StageExclusionReason; note: string }): void {
    if (stageActions.status !== 'ready') return;
    void withWriteGuard(
      () => stageActions.actions.excludeMovement(movement.id, { reason: input.reason, note: input.note }),
      () => advance(true),
    );
  }

  function handleMerchantPress(): void {
    if (!movement.merchant) return;
    router.push({
      pathname: '/categorize/merchant/[merchantId]',
      params: {
        merchantId: movement.merchant.id,
        ...(selectedCategoryId ? { categoryId: selectedCategoryId } : {}),
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} edges={['top', 'bottom']} testID={testID}>
      <StageTopBar
        title={t('categorize.topbar_title')}
        backA11yLabel={t('categorize.back_a11y')}
        onBack={() => router.back()}
        closeA11yLabel={t('categorize.close_a11y')}
        onClose={() => router.replace('/(tabs)/home')}
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: theme.space['5'], paddingBottom: theme.space['5'] }}
      >
        <StageProgress current={index + 1} total={batch.length} />

        <MovementCard
          direction={isExpense ? 'expense' : 'income'}
          amountMinorUnits={movement.amount}
          dateLocal={movement.dateLocal}
          occurredAt={movement.occurredAt}
          rawDescription={movement.rawDescription}
          merchantName={movement.merchant?.name}
          onMerchantPress={handleMerchantPress}
          locale={locale}
        />

        <CategoryGrid
          question={isExpense ? 'expense' : 'income'}
          choices={choices}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          showChooseOther={!showFullTaxonomy}
          onChooseOther={() => setShowFullTaxonomy(true)}
        />

        <NotSureDisclosure
          open={notSureOpen}
          onToggle={() => setNotSureOpen((open) => !open)}
          onReviewLater={handleReviewLater}
          onUncertain={handleUncertain}
          onExclude={() => setExcludeSheetOpen(true)}
        />

        {writeFailed && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note tone="danger" icon={t('categorize.write_failed_icon')}>
              {t('categorize.write_failed')}
            </Note>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: theme.space['3'], marginTop: theme.space['5'] }}>
          <View style={{ flex: 1 }}>
            <Button variant="outline" label={t('categorize.skip')} onPress={handleSkip} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('categorize.next')}
              onPress={handleConfirm}
              disabled={selectedCategoryId === null}
            />
          </View>
        </View>
      </ScrollView>

      <ExcludeSheet
        visible={excludeSheetOpen}
        onCancel={() => setExcludeSheetOpen(false)}
        onConfirm={handleExcludeConfirm}
      />
    </SafeAreaView>
  );
}
