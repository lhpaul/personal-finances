import { formatShortDate } from '@finanzas/shared-utils';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { TransactionRow } from '../../../components/ui';
import type { SupportedLocale } from '../../../db/labels';
import type { TransactionListRow } from '../../../db/types';
import type { MovementMetaDescriptor } from '../movement-presentation';
import { describeMovement } from '../movement-presentation';

/** One literal `t()` call per reason, mirroring item #12's `lastSuccessLabel` switch — a
 * `Record<key, string>` lookup would type `t()`'s argument as a plain `string`, defeating
 * i18next's generated literal-key typing. */
function exclusionReasonLabel(t: TFunction, reason: NonNullable<TransactionListRow['exclusionReason']>): string {
  switch (reason) {
    case 'personal_transfer':
      return t('transactions.exclusion_reason_personal_transfer');
    case 'shared_expense':
      return t('transactions.exclusion_reason_shared_expense');
    case 'not_relevant':
      return t('transactions.exclusion_reason_not_relevant');
    case 'cash_withdrawal':
      return t('transactions.exclusion_reason_cash_withdrawal');
    case 'other':
      return t('transactions.exclusion_reason_other');
  }
}

/** Resolves {@link MovementMetaDescriptor} into the drawn meta string (implementation plan for
 * issue #15, Assumptions A10-A11) — mirrors item #12's `SyncErrorNote`/`lastSuccessLabel` split:
 * the pure module returns a translation-free descriptor, this helper calls `t()`. */
function resolveMetaText(t: TFunction, meta: MovementMetaDescriptor, locale: SupportedLocale): string {
  switch (meta.kind) {
    case 'pending':
      return t('transactions.row_meta_pending');
    case 'excluded':
      return t('transactions.row_meta_excluded', {
        date: formatShortDate(meta.dateLocal, locale),
        reason: exclusionReasonLabel(t, meta.reason),
      });
    case 'plain': {
      const date = formatShortDate(meta.dateLocal, locale);
      if (meta.categoryName !== undefined && meta.note !== undefined) {
        return t('transactions.row_meta_category_note', { date, category: meta.categoryName, note: meta.note });
      }
      if (meta.categoryName !== undefined) {
        return t('transactions.row_meta_category_only', { date, category: meta.categoryName });
      }
      if (meta.note !== undefined) {
        return t('transactions.row_meta_note_only', { date, note: meta.note });
      }
      return date;
    }
  }
}

export interface MovementRowProps {
  row: TransactionListRow;
  locale: SupportedLocale;
  onPress: (transactionId: string) => void;
}

/** One `TransactionRow` from one `TransactionListRow` (implementation plan for issue #15,
 * Layer-by-Layer). */
export function MovementRow({ row, locale, onPress }: MovementRowProps) {
  const { t } = useTranslation();
  const presentation = describeMovement(row);

  return (
    <TransactionRow
      icon={presentation.icon}
      name={presentation.name}
      meta={resolveMetaText(t, presentation.meta, locale)}
      amount={presentation.amount}
      direction={presentation.direction}
      state={presentation.state}
      metaTone={presentation.state === 'pending' ? 'warn' : 'default'}
      onPress={() => onPress(row.id)}
    />
  );
}
