import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankSyncingBody, type BankSyncingBodyCopy } from '../../src/features/bank-syncing/components/BankSyncingBody';
import { resolveProgressValue, type BankSyncingState } from '../../src/features/bank-syncing/bank-syncing-state';
import { FAILURE_BODY_KEY, type SyncFailureKind } from '../../src/features/bank-syncing/failure-copy';
import { useBankSync } from '../../src/features/bank-syncing/use-bank-sync';
import { fidelityTestId, useFidelityPreview } from '../../src/lib/fidelity-preview';
import { theme } from '../../src/theme';

const PREVIEW_STATES: readonly BankSyncingState[] = ['login', 'products', 'transactions', 'error'];

/** Decision 12's fallback instance for a preview capture of `error` — the mockup itself only
 * draws one failure body (`session_closed`, Assumption A4), so that is what a static capture
 * compares against. */
const PREVIEW_FAILURE_KIND: SyncFailureKind = 'session_closed';

function resolvePreviewState(raw: string | null): BankSyncingState {
  const match = PREVIEW_STATES.find((candidate) => candidate === raw);
  return match ?? 'login';
}

/**
 * `#screen=bank-syncing` (`login`, `products`, `transactions`, `error`) — implementation plan
 * Implementation Order step 8. **The app's only WebView host** (Decision 1): renders
 * `useBankSync()`'s `element` (the hidden `<WebView>`, mounted only while a real read is in
 * flight) alongside the visible composition. Under a fidelity preview capture
 * (`useFidelityPreview()`, Decision 12), renders the named state from a fixed presentation —
 * the bar sits exactly on `PROGRESS_FLOOR[state]` — and calls `useBankSync({ enabled: false })`,
 * which starts no read at all: no WebView, no keychain access, no `runSync` call.
 */
export default function BankSyncing() {
  const { t } = useTranslation();
  const router = useRouter();
  const preview = useFidelityPreview();

  const bankSync = useBankSync({ enabled: !preview.active });

  const state: BankSyncingState = preview.active ? resolvePreviewState(preview.state) : bankSync.state;
  const progressValue = preview.active
    ? resolveProgressValue(state, 0)
    : resolveProgressValue(state, bankSync.rawProgress ?? 0);
  const indeterminate = preview.active ? false : bankSync.phase === 'starting';
  const ctaEnabled = preview.active ? true : bankSync.phase === 'succeeded';
  const failureKind: SyncFailureKind = preview.active
    ? PREVIEW_FAILURE_KIND
    : (bankSync.failure?.reasonCode ?? 'parse_failed');

  function viewResult(): void {
    if (!ctaEnabled) return;
    router.replace('/(onboarding)/bank-connected');
  }

  function chooseOtherBank(): void {
    router.replace('/(onboarding)/bank-picker');
  }

  const copy: BankSyncingBodyCopy = {
    progressHeadline: t('bank_syncing.progress_headline'),
    progressBody: t('bank_syncing.progress_body'),
    progressAccessibilityLabel: t('bank_syncing.progress_accessibility_label'),
    stepLoginLabel: t('bank_syncing.step_login'),
    stepProductsLabel: t('bank_syncing.step_products'),
    stepTransactionsLabel: t('bank_syncing.step_transactions'),
    badgePendingLabel: t('bank_syncing.badge_pending'),
    badgeInProgressLabel: t('bank_syncing.badge_in_progress'),
    badgeDoneLabel: t('bank_syncing.badge_done'),
    viewResultCta: t('bank_syncing.view_result_cta'),
    errorHeadline: t('bank_syncing.error_headline'),
    errorBody: t(FAILURE_BODY_KEY[failureKind]),
    errorDangerNote: t('bank_syncing.error_danger_note'),
    retryCta: t('bank_syncing.retry_cta'),
    chooseOtherBankCta: t('bank_syncing.choose_other_bank_cta'),
  };

  if (!preview.active && bankSync.handoffMissing) {
    return <Redirect href={'/(onboarding)/bank-picker' as never} />;
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.surface0 }}
      edges={['top', 'bottom']}
      testID={fidelityTestId('bank-syncing')}
    >
      {bankSync.element}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.space['5'],
          paddingBottom: theme.space['8'],
        }}
      >
        <BankSyncingBody
          state={state}
          progressValue={progressValue}
          indeterminate={indeterminate}
          ctaEnabled={ctaEnabled}
          onViewResult={viewResult}
          onRetry={bankSync.retry}
          onChooseOtherBank={chooseOtherBank}
          copy={copy}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
