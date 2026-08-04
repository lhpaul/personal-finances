import { formatLongDate, formatTimeOfDay } from '@finanzas/shared-utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Note, Text } from '../../components/ui';
import { resolveDeviceLocale } from '../../i18n/locale';
import { useFidelityPreview } from '../../lib/fidelity-preview';
import { theme } from '../../theme';
import { ExcludeSheet } from '../categorization/components/ExcludeSheet';
import { CategoryPickerSheet } from './components/CategoryPickerSheet';
import { DetailActions } from './components/DetailActions';
import { DetailHeroCard } from './components/DetailHeroCard';
import { DetailInfoCard } from './components/DetailInfoCard';
import { DetailNoteField } from './components/DetailNoteField';
import { DetailTopBar } from './components/DetailTopBar';
import { ExclusionNote } from './components/ExclusionNote';
import { resolveActionSet, resolveDetailState, showsAutoSuggestionCaption } from './detail-state';
import { DETAIL_EXCLUSION_REASONS, type DetailExclusionReason } from './exclusion-copy';
import { formatProductLabel } from './product-label';
import { useTransactionDetail, type UseTransactionDetailResult } from './use-transaction-detail';
import { useTransactionDetailActions } from './use-transaction-detail-actions';

export interface TransactionDetailScreenProps {
  transactionId: string;
  /** `fidelityTestId('transaction-detail')` — computed and passed down by the route file
   * (`app/transactions/[transactionId].tsx`); see #13's `StageIntroScreenProps.testID`'s doc
   * comment for why. */
  testID?: string;
}

/**
 * `#screen=transaction-detail` (implementation plan for issue #16). Composes the bank's own
 * immutable facts, the editable note, a category change, the merchant shortcut, the exclusion
 * sheet and re-inclusion — all four MVP states (`categorized`, `uncategorized`, `excluded`,
 * `exclude-sheet`).
 */
export function TransactionDetailScreen({ transactionId, testID }: TransactionDetailScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [locale] = useState(() => resolveDeviceLocale());
  const preview = useFidelityPreview();

  const { state: detailState, reload }: UseTransactionDetailResult = useTransactionDetail({
    transactionId,
    locale,
  });
  const actionsState = useTransactionDetailActions(transactionId);

  const [noteDraft, setNoteDraft] = useState('');
  const [excludeSheetOpen, setExcludeSheetOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  // Refs so the teardown flush (below) and the focus-effect cleanup always read the latest
  // values, regardless of which render's closure last ran (concurrent-event-source addendum).
  const syncedTransactionIdRef = useRef<string | null>(null);
  const noteDraftRef = useRef('');
  const storedNoteRef = useRef<string | null>(null);
  const actionsRef = useRef(actionsState);

  useEffect(() => {
    noteDraftRef.current = noteDraft;
  }, [noteDraft]);

  useEffect(() => {
    actionsRef.current = actionsState;
  }, [actionsState]);

  useEffect(() => {
    if (detailState.status !== 'ready') return;
    const currentId = detailState.data.context.transaction.id;
    // Only sync the draft from the store on the *first* ready load of a given transaction — a
    // reload triggered by an unrelated write (a category change, an exclusion) must never
    // clobber an in-progress note edit (Decision 9).
    if (syncedTransactionIdRef.current !== currentId) {
      setNoteDraft(detailState.data.context.transaction.note ?? '');
      syncedTransactionIdRef.current = currentId;
    }
    storedNoteRef.current = detailState.data.context.transaction.note;
  }, [detailState]);

  useEffect(() => {
    if (!preview.active) return;
    setExcludeSheetOpen(preview.state === 'exclude-sheet');
  }, [preview.active, preview.state]);

  /** Issues the note write only when the trimmed draft actually differs from the stored value
   * (Decision 9). Returns `undefined` when there is nothing to save. */
  function flushNote(): Promise<void> | undefined {
    if (actionsRef.current.status !== 'ready') return undefined;
    const trimmedDraft = noteDraftRef.current.trim();
    const storedTrimmed = (storedNoteRef.current ?? '').trim();
    if (trimmedDraft === storedTrimmed) return undefined;
    const valueToSave = trimmedDraft ? trimmedDraft : null;
    return actionsRef.current.actions.saveNote(valueToSave).then(() => {
      storedNoteRef.current = valueToSave;
    });
  }

  // The one write this feature issues during teardown (Decision 9) — fire-and-forget by design:
  // the decision is the person's, the write has already been issued, and the screen is gone
  // before its resolution could be shown anywhere.
  useFocusEffect(
    useCallback(() => {
      return () => {
        flushNote()?.catch(() => {
          /* swallowed after being recorded via flushNote's own .then() update — no surface left
             to show it on, and no-console keeps it out of the log (concurrency addendum). */
        });
      };
    }, []),
  );

  function handleNoteBlur(): void {
    const pending = flushNote();
    if (!pending) return;
    pending.then(() => setWriteFailed(false)).catch(() => setWriteFailed(true));
  }

  async function withWriteGuard(run: () => Promise<void>): Promise<void> {
    try {
      await run();
      setWriteFailed(false);
      reload();
    } catch {
      setWriteFailed(true);
    }
  }

  function handleChangeCategory(categoryId: string): void {
    if (actionsState.status !== 'ready') return;
    setCategoryPickerOpen(false);
    void withWriteGuard(() => actionsState.actions.changeCategory(categoryId));
  }

  function handleExcludeConfirm(input: { reason: DetailExclusionReason; note: string }): void {
    if (actionsState.status !== 'ready') return;
    setExcludeSheetOpen(false);
    void withWriteGuard(() => actionsState.actions.excludeMovement({ reason: input.reason }));
  }

  function handleReinclude(): void {
    if (actionsState.status !== 'ready') return;
    void withWriteGuard(() => actionsState.actions.reincludeMovement());
  }

  function handleMerchantPress(merchantId: string): void {
    router.push({ pathname: '/categorize/merchant/[merchantId]', params: { merchantId } });
  }

  // spec UX Rules → Loading: never a half-populated card. `error` gets the same blank render as
  // `pending` — there is no dedicated error surface, the same treatment every other
  // `getAppDatabase()`-awaiting screen in this codebase gives a rejected bootstrap.
  if (detailState.status === 'pending' || detailState.status === 'error') {
    return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} testID={testID} />;
  }

  if (detailState.status === 'missing') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} testID={testID}>
        <DetailTopBar
          title={t('transaction_detail.topbar_title')}
          backA11yLabel={t('transaction_detail.back_a11y')}
          onBack={() => router.back()}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space['5'] }}>
          <Text variant="body" center>
            {t('transaction_detail.not_found')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { context, category, categoryChoices, taxonomy, suggestion } = detailState.data;
  const { transaction, merchantName, product, merchant } = context;
  const state = resolveDetailState(transaction);
  const hasMerchant = merchant !== null;
  const actionSet = resolveActionSet(state, hasMerchant);
  const direction: 'expense' | 'income' = transaction.type === 'credit' ? 'income' : 'expense';

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={testID}
    >
      <DetailTopBar
        title={t('transaction_detail.topbar_title')}
        backA11yLabel={t('transaction_detail.back_a11y')}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ padding: theme.space['5'] }}>
        <DetailHeroCard
          state={state}
          direction={direction}
          amountMinorUnits={transaction.amount}
          merchantName={merchantName}
          categoryEmoji={category?.emoji}
        />

        <View style={{ marginTop: theme.space['4'] }}>
          <DetailInfoCard
            merchantLabel={merchantName ?? t('transaction_detail.info_missing')}
            dateLabel={formatLongDate(transaction.dateLocal, locale)}
            timeLabel={formatTimeOfDay(new Date(transaction.occurredAt))}
            productLabel={product ? formatProductLabel(product) : t('transaction_detail.info_missing')}
            categoryEmoji={category?.emoji}
            categoryName={category?.name}
            showAutoSuggestionCaption={showsAutoSuggestionCaption(transaction)}
            bankDescription={context.bankDescription}
          >
            <DetailNoteField value={noteDraft} onChangeText={setNoteDraft} onBlur={handleNoteBlur} />
          </DetailInfoCard>
        </View>

        {state === 'excluded' && transaction.exclusionReason !== null && (
          <View style={{ marginTop: theme.space['4'] }}>
            <ExclusionNote reason={transaction.exclusionReason} />
          </View>
        )}

        {writeFailed && (
          <View style={{ marginTop: theme.space['4'] }}>
            <Note tone="danger" icon={t('transaction_detail.write_failed_icon')}>
              {t('transaction_detail.write_failed')}
            </Note>
          </View>
        )}

        <DetailActions
          actions={actionSet}
          onCategorize={() => setCategoryPickerOpen(true)}
          onChangeCategory={() => setCategoryPickerOpen(true)}
          onMerchant={() => merchant && handleMerchantPress(merchant.id)}
          onExclude={() => setExcludeSheetOpen(true)}
          onReinclude={handleReinclude}
        />
      </ScrollView>

      <ExcludeSheet
        visible={excludeSheetOpen}
        onCancel={() => setExcludeSheetOpen(false)}
        onConfirm={handleExcludeConfirm}
        reasons={DETAIL_EXCLUSION_REASONS}
        showNote={false}
      />

      <CategoryPickerSheet
        visible={categoryPickerOpen}
        question={direction}
        categoryChoices={categoryChoices}
        taxonomy={taxonomy}
        suggestion={suggestion}
        onCancel={() => setCategoryPickerOpen(false)}
        onConfirm={handleChangeCategory}
      />
    </SafeAreaView>
  );
}
