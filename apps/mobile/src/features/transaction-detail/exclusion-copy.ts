import type { Transaction } from '../../db/types';

/** Derived from `Transaction['exclusionReason']` (`db/types.ts`) rather than redeclared — the
 * same fix already applied to #13's `StageExclusionReason` (CodeRabbit finding on PR #79). */
export type DetailExclusionReason = NonNullable<Transaction['exclusionReason']>;

/**
 * `transaction-detail` (#16) implementation plan Decision 5: the detail sheet offers exactly the
 * **four** reasons `#screen=transaction-detail&state=exclude-sheet` draws, in the drawn order —
 * one fewer than #13's own sheet, which also offers `cash_withdrawal`. `cash_withdrawal` stays
 * reachable only from the categorization flow (Assumption A3); a movement excluded there with
 * that reason still opens and still **displays** it correctly here, through
 * {@link exclusionReasonKey}, which covers all five stored values.
 */
export const DETAIL_EXCLUSION_REASONS: readonly DetailExclusionReason[] = [
  'personal_transfer',
  'shared_expense',
  'not_relevant',
  'other',
];

/**
 * Maps all **five** stored `exclusion_reason` values to their `transaction_detail.reason_*`
 * catalogue key (Decision 5) — used by `ExclusionNote` to render the excluded warning note's
 * *"Motivo: …"* sentence, which must render a sensible reason regardless of which screen made the
 * exclusion.
 */
export function exclusionReasonKey(reason: DetailExclusionReason): string {
  switch (reason) {
    case 'personal_transfer':
      return 'transaction_detail.reason_personal_transfer';
    case 'shared_expense':
      return 'transaction_detail.reason_shared_expense';
    case 'not_relevant':
      return 'transaction_detail.reason_not_relevant';
    case 'cash_withdrawal':
      return 'transaction_detail.reason_cash_withdrawal';
    case 'other':
      return 'transaction_detail.reason_other';
  }
}
