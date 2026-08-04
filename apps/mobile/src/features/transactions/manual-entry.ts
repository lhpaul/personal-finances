import { assertPositiveMinorUnits } from '../../db/money';
import type { ManualTransactionInput } from '../../db/types';

/**
 * The manual-entry sheet's draft, before validation (implementation plan for issue #15, Decision
 * 12). `amountText` is the raw numeric-keyboard input — digits only, never pre-parsed by the
 * component. Fecha is not part of the draft: it is stamped at write time
 * (`insertManualTransaction`), and Categoría is not asked (left `null` at write time).
 */
export interface ManualEntryDraft {
  amountText: string;
  description: string;
  type: 'debit' | 'credit';
  productId: string | null;
}

/** Which control failed, so the sheet can render its inline message against the right field. */
export type ManualEntryError = { field: 'amount' | 'description' | 'product' };

const DIGITS_ONLY_PATTERN = /^[0-9]+$/;

/**
 * Pure: digits-only amount parsed to a positive integer of minor units, non-empty description, a
 * selected product (Decision 12). `assertPositiveMinorUnits` is the backstop the repository would
 * otherwise throw on — validated here first so the sheet never opens a write with input the
 * repository would reject.
 */
export function validateManualEntry(draft: ManualEntryDraft): ManualTransactionInput | ManualEntryError {
  const trimmedDescription = draft.description.trim();
  if (trimmedDescription === '') return { field: 'description' };

  if (draft.productId === null) return { field: 'product' };

  const trimmedAmount = draft.amountText.trim();
  if (!DIGITS_ONLY_PATTERN.test(trimmedAmount)) return { field: 'amount' };

  const amount = Number.parseInt(trimmedAmount, 10);
  try {
    assertPositiveMinorUnits(amount, 'transactions.amount');
  } catch {
    return { field: 'amount' };
  }

  return {
    userFinancialProductId: draft.productId,
    type: draft.type,
    amount,
    rawDescription: trimmedDescription,
  };
}
