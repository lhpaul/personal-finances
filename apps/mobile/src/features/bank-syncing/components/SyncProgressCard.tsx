import { View } from 'react-native';

import { Card, Progress } from '../../../components/ui';
import { theme } from '../../../theme';
import { resolveStepStatuses, type BankSyncingState, type StepBadgeStatus } from '../bank-syncing-state';
import { SyncStepRow } from './SyncStepRow';

/** Every visible string, pre-resolved by the caller — this component calls no hook, so it stays
 * directly callable for a renderer-free element-tree assertion (Decision 8 precedent). */
export interface SyncProgressCardCopy {
  progressAccessibilityLabel: string;
  stepLoginLabel: string;
  stepProductsLabel: string;
  stepTransactionsLabel: string;
  badgePendingLabel: string;
  badgeInProgressLabel: string;
  badgeDoneLabel: string;
}

export interface SyncProgressCardProps {
  state: Extract<BankSyncingState, 'login' | 'products' | 'transactions'>;
  /** The already-floored value (Decision 3's `resolveProgressValue`) — this component does no
   * flooring of its own. */
  progressValue: number;
  /** Phase `starting`, before the first `onProgress` event (Decision 3). */
  indeterminate: boolean;
  copy: SyncProgressCardCopy;
}

function statusLabelOf(copy: SyncProgressCardCopy, status: StepBadgeStatus): string {
  switch (status) {
    case 'pending':
      return copy.badgePendingLabel;
    case 'in_progress':
      return copy.badgeInProgressLabel;
    case 'done':
      return copy.badgeDoneLabel;
  }
}

/** `.mu-card` with `.mu-progress` and the three step rows
 * (`#screen=bank-syncing&state=login|products|transactions`). */
export function SyncProgressCard({ state, progressValue, indeterminate, copy }: SyncProgressCardProps) {
  const rows = resolveStepStatuses(state);

  return (
    <Card>
      <Progress
        value={progressValue}
        indeterminate={indeterminate}
        accessibilityLabel={copy.progressAccessibilityLabel}
      />
      <View style={{ marginTop: theme.space['4'] }}>
        <SyncStepRow
          icon={rows.login.icon}
          label={copy.stepLoginLabel}
          status={rows.login.status}
          statusLabel={statusLabelOf(copy, rows.login.status)}
        />
      </View>
      <View style={{ marginTop: theme.space['3'] }}>
        <SyncStepRow
          icon={rows.products.icon}
          label={copy.stepProductsLabel}
          status={rows.products.status}
          statusLabel={statusLabelOf(copy, rows.products.status)}
        />
      </View>
      <View style={{ marginTop: theme.space['3'] }}>
        <SyncStepRow
          icon={rows.transactions.icon}
          label={copy.stepTransactionsLabel}
          status={rows.transactions.status}
          statusLabel={statusLabelOf(copy, rows.transactions.status)}
        />
      </View>
    </Card>
  );
}
