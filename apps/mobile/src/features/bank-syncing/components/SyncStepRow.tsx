import { View } from 'react-native';

import { Badge, Text, type BadgeTone } from '../../../components/ui';
import { theme } from '../../../theme';
import type { StepBadgeStatus, StepIcon } from '../bank-syncing-state';

export interface SyncStepRowProps {
  icon: StepIcon;
  label: string;
  status: StepBadgeStatus;
  /** Already resolved by the caller (Decision 8 precedent — `BankPickerResults.tsx`,
   * `ConnectedBankSummaryList.tsx`): this component calls no hook, not even `useTranslation`,
   * so it stays directly callable for a renderer-free element-tree assertion. */
  statusLabel: string;
}

const STATUS_TONE: Record<StepBadgeStatus, BadgeTone> = {
  pending: 'neutral',
  in_progress: 'info',
  done: 'ok',
};

/** One `.mu-row` inside `#s-bank-syncing`'s card: icon, label, `.mu-spacer`, one `.mu-badge`
 * variant per status (implementation plan Decision 2; `resolveStepStatuses`). */
export function SyncStepRow({ icon, label, status, statusLabel }: SyncStepRowProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space['3'] }}>
      <Text>{icon}</Text>
      <Text variant="small">{label}</Text>
      <View style={{ flex: 1 }} />
      <Badge tone={STATUS_TONE[status]} label={statusLabel} />
    </View>
  );
}
