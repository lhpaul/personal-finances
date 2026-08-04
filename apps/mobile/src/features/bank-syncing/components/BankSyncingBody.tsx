import { View } from 'react-native';

import { Button, Text } from '../../../components/ui';
import { screenMetrics, theme } from '../../../theme';
import type { BankSyncingState } from '../bank-syncing-state';
import { SyncErrorState } from './SyncErrorState';
import { SyncProgressCard } from './SyncProgressCard';

/** Decorative glyph, not user-facing copy (mockup literal). */
const PROGRESS_ICON_GLYPH = '🔄';

/** Every visible string, pre-resolved by the caller (the route) — this component calls no hook,
 * so it stays directly callable for a renderer-free element-tree assertion (Decision 8
 * precedent — `BankPickerResults.tsx`, `ConnectedBankSummaryList.tsx`). Not itself named in the
 * implementation plan's Layer-by-Layer list; added during implementation as the one composition
 * point `bank-syncing-screen.test.tsx` needs so all four states are assertable without a
 * renderer, mirroring the same split every other connect-bank/onboarding screen already uses
 * between its (untested) hook-driven route and its (directly tested) presentational body. */
export interface BankSyncingBodyCopy {
  progressHeadline: string;
  progressBody: string;
  progressAccessibilityLabel: string;
  stepLoginLabel: string;
  stepProductsLabel: string;
  stepTransactionsLabel: string;
  badgePendingLabel: string;
  badgeInProgressLabel: string;
  badgeDoneLabel: string;
  viewResultCta: string;
  errorHeadline: string;
  /** `FAILURE_BODY_KEY[failureKind]`, already resolved (Decision 7). */
  errorBody: string;
  errorDangerNote: string;
  retryCta: string;
  chooseOtherBankCta: string;
}

export interface BankSyncingBodyProps {
  state: BankSyncingState;
  /** The already-floored value (Decision 3) — ignored in `error` (no bar is drawn there). */
  progressValue: number;
  /** Phase `starting` (Decision 3) — ignored in `error`. */
  indeterminate: boolean;
  /** `phase === 'succeeded'` (Assumption A2) — ignored outside `transactions`. */
  ctaEnabled: boolean;
  onViewResult: () => void;
  onRetry: () => void;
  onChooseOtherBank: () => void;
  copy: BankSyncingBodyCopy;
}

/**
 * The whole visible composition for every one of the four manifest states
 * (`#screen=bank-syncing`). `error` renders {@link SyncErrorState} alone; the other three share
 * the headline block (🔄 + title + body) above {@link SyncProgressCard}, with the *Ver
 * resultado* CTA appearing only in `transactions` (Assumption A2).
 */
export function BankSyncingBody({
  state,
  progressValue,
  indeterminate,
  ctaEnabled,
  onViewResult,
  onRetry,
  onChooseOtherBank,
  copy,
}: BankSyncingBodyProps) {
  if (state === 'error') {
    return (
      <SyncErrorState
        copy={{
          headline: copy.errorHeadline,
          body: copy.errorBody,
          dangerNote: copy.errorDangerNote,
          retryCta: copy.retryCta,
          chooseOtherBankCta: copy.chooseOtherBankCta,
        }}
        onRetry={onRetry}
        onChooseOtherBank={onChooseOtherBank}
      />
    );
  }

  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <Text center style={{ fontSize: screenMetrics.bankSyncing.headlineIconFontSize }}>
          {PROGRESS_ICON_GLYPH}
        </Text>
        <Text variant="h2" center style={{ marginTop: theme.space['4'] }}>
          {copy.progressHeadline}
        </Text>
        <Text variant="body" center style={{ marginTop: theme.space['2'] }}>
          {copy.progressBody}
        </Text>
      </View>

      <View style={{ marginTop: theme.space['6'] }}>
        <SyncProgressCard
          state={state}
          progressValue={progressValue}
          indeterminate={indeterminate}
          copy={{
            progressAccessibilityLabel: copy.progressAccessibilityLabel,
            stepLoginLabel: copy.stepLoginLabel,
            stepProductsLabel: copy.stepProductsLabel,
            stepTransactionsLabel: copy.stepTransactionsLabel,
            badgePendingLabel: copy.badgePendingLabel,
            badgeInProgressLabel: copy.badgeInProgressLabel,
            badgeDoneLabel: copy.badgeDoneLabel,
          }}
        />
      </View>

      {state === 'transactions' && (
        <View style={{ marginTop: theme.space['6'] }}>
          <Button label={copy.viewResultCta} onPress={onViewResult} disabled={!ctaEnabled} />
        </View>
      )}
    </View>
  );
}
