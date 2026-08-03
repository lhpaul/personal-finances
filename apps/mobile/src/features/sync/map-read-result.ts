import type { FailureReasonCode, ScrapedMovement, ScrapedProduct, ScrapeResult } from '@finanzas/bank-scraper';
import { canonicalInstantForDateLocal } from '@finanzas/shared-utils';

import { canonicalizeCurrencyCode } from '../../db/money';
import type { ConnectionSyncRecord } from '../../db/repositories/institutions';
import type { BankProductInput } from '../../db/repositories/products';
import type { SyncMovementInput, SyncWriteInput } from '../../db/repositories/sync';

/**
 * Pure mapping from a `ScrapeResult` to a `SyncWriteInput`, plus the failure-precedence and
 * connection-record logic the sync engine needs (implementation plan Decisions 8, 9, 14, issue
 * #10; spec Business Rules 16-17, 23-25; AC10, AC11, AC22, AC23, AC30).
 *
 * Nothing here touches the database, `Date.now()` or the host clock — every function is a pure
 * transformation of its arguments, independently unit-testable.
 */

/**
 * `selectFailureReason` (Decision 9): a read-level failure outranks any product-level one — it
 * means the read never got started. `invalid_credentials` leads deliberately: it is the one code
 * that suspends automatic syncing (Business Rule 24), and losing it behind an unrelated product's
 * `parse_failed` would silently re-enable sign-in attempts against a bank that just rejected the
 * credential.
 */
export const SYNC_FAILURE_PRECEDENCE: readonly FailureReasonCode[] = [
  'invalid_credentials',
  'session_closed',
  'network',
  'parse_failed',
];

export function selectFailureReason(result: Pick<ScrapeResult, 'readFailure' | 'productFailures'>): FailureReasonCode | null {
  if (result.readFailure) return result.readFailure.reasonCode;
  if (result.productFailures.length === 0) return null;

  const codes = new Set(result.productFailures.map((failure) => failure.reasonCode));
  for (const code of SYNC_FAILURE_PRECEDENCE) {
    if (codes.has(code)) return code;
  }
  return null;
}

/**
 * A total function from the four-value failure enum to the four fixed catalogue keys (Decision
 * 9). Its input is a code, never a `ScraperTrace`, never a caught error's message — AC30 is true
 * by construction, because the set of values this can return is exactly these four literals. The
 * catalogue entry that renders these keys belongs to the bank detail screen item; this engine
 * only writes the key.
 */
export function composeFailureMessageKey(code: FailureReasonCode): string {
  switch (code) {
    case 'invalid_credentials':
      return 'sync.errors.invalid_credentials';
    case 'session_closed':
      return 'sync.errors.session_closed';
    case 'network':
      return 'sync.errors.network';
    case 'parse_failed':
      return 'sync.errors.parse_failed';
  }
}

function mapProduct(product: ScrapedProduct): BankProductInput {
  return {
    externalId: product.instanceId,
    type: product.kind,
    name: product.displayName,
    currencyCode: product.currencyCode,
    mask: product.maskedIdentifier,
    balanceMinorUnits: product.balanceMinorUnits,
    creditLimitMinorUnits: product.creditLimitMinorUnits,
    availableCreditMinorUnits: product.availableCreditMinorUnits,
    cardBrand: product.cardBrand,
    cardCategory: product.cardCategory,
    cardLast4: product.cardLast4,
  };
}

/** `occurred_at` is derived from the bank-stated calendar day (Decision 14, Business Rule 16,
 * AC23) — never from the device clock, never from the device's time zone. `date_local` itself is
 * copied verbatim from the read. `extras` becomes `metadata` only when non-empty, so a movement
 * with none does not grow an empty `{}` column. */
function mapMovement(movement: ScrapedMovement): SyncMovementInput {
  const hasExtras = Object.keys(movement.extras).length > 0;
  return {
    productExternalId: movement.productInstanceId,
    externalId: movement.bankSuppliedId,
    amount: movement.amountMinorUnits,
    type: movement.direction,
    currencyCode: canonicalizeCurrencyCode(movement.currencyCode),
    occurredAt: canonicalInstantForDateLocal(movement.dateLocal),
    dateLocal: movement.dateLocal,
    rawDescription: movement.rawDescription,
    metadata: hasExtras ? { ...movement.extras } : undefined,
  };
}

/**
 * The connection record one read outcome implies (Decision 8's exit table). `complete` and
 * `cancelled` carry no error fields; `failed` and `partial` resolve a failure reason through
 * {@link selectFailureReason} and compose its message key. A `'failed'`/`'partial'` result with
 * neither a `readFailure` nor a `productFailures` entry is a contract violation the scraper
 * should never produce; this falls back to `parse_failed` rather than throwing, because a
 * completed read must always be storable and recordable.
 */
export function buildConnectionSyncRecord(result: ScrapeResult): ConnectionSyncRecord {
  if (result.outcome === 'complete') return { outcome: 'complete' };
  if (result.outcome === 'cancelled') return { outcome: 'cancelled' };

  const errorCode = selectFailureReason(result) ?? 'parse_failed';
  return {
    outcome: result.outcome,
    errorCode,
    errorMessage: composeFailureMessageKey(errorCode),
  };
}

/**
 * Every movement in the read whose currency is not the peso — a plain count, independent of
 * storage (Decision 15, Deferral Note 3). Lets a caller tell a non-peso movement arrived without
 * consulting the store. Compares through {@link canonicalizeCurrencyCode}, the same
 * canonicalization `writeBankTransactionsInTx` applies before storing — a differently-cased or
 * padded `'CLP'` (e.g. `' clp '`) must count as peso here exactly as it will once stored, never
 * as foreign.
 */
export function countForeignCurrencyMovements(result: Pick<ScrapeResult, 'movements'>): number {
  return result.movements.filter((movement) => canonicalizeCurrencyCode(movement.currencyCode) !== 'CLP').length;
}

/** The whole pure mapping this feature needs before calling `applySyncWrite`. */
export function mapScrapeResultToSyncWriteInput(
  userFinancialInstitutionId: string,
  result: ScrapeResult,
): SyncWriteInput {
  return {
    userFinancialInstitutionId,
    products: result.products.map(mapProduct),
    movements: result.movements.map(mapMovement),
    connectionRecord: buildConnectionSyncRecord(result),
  };
}
