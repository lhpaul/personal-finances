import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { Note, Text } from '../../../components/ui';
import { fontWeight } from '../../../components/ui/_internal/font-weight';
import { theme } from '../../../theme';
import type { DetailExclusionReason } from '../exclusion-copy';

/**
 * Every branch calls `t` with a literal key argument — the pattern `ExcludeSheet.tsx`'s own
 * `reasonLabel` (and, before it, `ready.tsx`'s `translateReminderDayKey`) already established.
 * `exclusion-copy.ts`'s `exclusionReasonKey` maps the same five values to the same keys as a
 * pure, independently-testable function (Scenario 16); this switch is the literal-call render
 * side the static catalogue-key scan requires (Scenario 17).
 */
function reasonLabel(t: TFunction, reason: DetailExclusionReason): string {
  switch (reason) {
    case 'personal_transfer':
      return t('transaction_detail.reason_personal_transfer');
    case 'shared_expense':
      return t('transaction_detail.reason_shared_expense');
    case 'not_relevant':
      return t('transaction_detail.reason_not_relevant');
    case 'cash_withdrawal':
      return t('transaction_detail.reason_cash_withdrawal');
    case 'other':
      return t('transaction_detail.reason_other');
  }
}

export interface ExclusionNoteProps {
  reason: DetailExclusionReason;
}

/**
 * The `excluded` state's warning note (implementation plan Decision 4, Layer-by-Layer). Renders
 * whichever of the five stored reasons the movement actually carries — including
 * `cash_withdrawal`, which this screen's own sheet never offers but must still display correctly
 * for a movement excluded elsewhere (Decision 5, Assumption A3).
 */
export function ExclusionNote({ reason }: ExclusionNoteProps) {
  const { t } = useTranslation();

  return (
    <Note tone="warn" icon={t('transaction_detail.excluded_note_icon')}>
      <Text
        variant="small"
        tone="primary"
        style={{ fontWeight: fontWeight(theme.typography.weight.bold) }}
      >
        {t('transaction_detail.excluded_note_strong')}
      </Text>{' '}
      {t('transaction_detail.excluded_note_body', { reason: reasonLabel(t, reason) })}
    </Note>
  );
}
