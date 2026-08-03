import { canonicalInstantForDateLocal, getMonthPeriod, parseDateLocal, shiftMonthPeriod, toDateLocal } from '@finanzas/shared-utils';

import type { BankTransactionInput } from '../db/repositories/transactions';

/**
 * The dev sample-data panel's second dataset (implementation plan for issue #15, Decision 14).
 * The committed fixture (`store-v1.sql`) has 13 movements, all `debit`, all in one month — not
 * enough to exercise month grouping, the *Ingresos* filter or pagination. This generator is pure
 * (no I/O, no `Date.now()`, no randomness): the same `productIds` input always produces the same
 * 240-movement output, spread over four months and both directions, and persisting it through
 * the existing `upsertBankTransactions` is idempotent (Business Rule 5) — running the panel
 * action twice never duplicates a row.
 */

const DEMO_ANCHOR_MONTH_START = '2026-01-01';
const DEMO_MONTHS_BACK = 4;
const DEMO_MOVEMENTS_PER_MONTH = 60;
const DEMO_TOTAL_MOVEMENTS = DEMO_MONTHS_BACK * DEMO_MOVEMENTS_PER_MONTH;
/** Every fifth movement in a month is a credit — a realistic bias (mostly expenses, a handful of
 * income events), not a randomly chosen fraction. */
const CREDIT_EVERY_NTH = 5;
/** Every generated day-of-month stays within 1-28, so the same index arithmetic is valid for
 * every one of the four generated months regardless of its real length. */
const DAYS_PER_GENERATED_MONTH = 28;

const DEBIT_DESCRIPTIONS = [
  'UBER *TRIP',
  'LIDER SUPERMERCADO',
  'NETFLIX.COM',
  'FARMACIAS AHUMADA',
  'COPEC ESTACION',
  'STARBUCKS COFFEE',
  'FALABELLA RETAIL',
  'CINE HOYTS',
  'MERPAGO*FERIA',
  'RESTAURANT DON POLLO',
];
const CREDIT_DESCRIPTIONS = [
  'TRANSFERENCIA RECIBIDA',
  'PAYROLL INC',
  'DEVOLUCION COMPRA',
  'REEMBOLSO SERVICIO',
];

export interface DemoMovementBatch {
  userFinancialProductId: string;
  rows: BankTransactionInput[];
}

/**
 * Builds the 240-movement demo dataset, round-robined across `productIds` (Decision 14 —
 * "spread over both products", generalized to however many the caller has). Returns `[]` when
 * `productIds` is empty: the caller is expected to have already loaded the base fixture ("Cargar
 * datos de ejemplo") so there is a product to attach movements to.
 */
export function buildDemoMovements(productIds: string[]): DemoMovementBatch[] {
  if (productIds.length === 0) return [];

  const rowsByProduct = new Map<string, BankTransactionInput[]>(productIds.map((id) => [id, []]));
  const anchorPeriod = getMonthPeriod(DEMO_ANCHOR_MONTH_START);

  for (let i = 0; i < DEMO_TOTAL_MOVEMENTS; i += 1) {
    const monthsBack = Math.floor(i / DEMO_MOVEMENTS_PER_MONTH);
    const indexInMonth = i % DEMO_MOVEMENTS_PER_MONTH;

    const monthStart = shiftMonthPeriod(anchorPeriod, -monthsBack).start;
    const { year, month } = parseDateLocal(monthStart);
    const dateLocal = toDateLocal({ year, month, day: 1 + (indexInMonth % DAYS_PER_GENERATED_MONTH) });

    const isCredit = indexInMonth % CREDIT_EVERY_NTH === 0;
    const type: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';
    const descriptions = isCredit ? CREDIT_DESCRIPTIONS : DEBIT_DESCRIPTIONS;
    const rawDescription = descriptions[i % descriptions.length] as string;
    const amount = isCredit ? 50_000 + (i % 12) * 75_000 : 1_500 + (i % 37) * 2_300;

    const productId = productIds[i % productIds.length] as string;
    rowsByProduct.get(productId)?.push({
      amount,
      type,
      occurredAt: canonicalInstantForDateLocal(dateLocal),
      dateLocal,
      rawDescription,
    });
  }

  return [...rowsByProduct.entries()].map(([userFinancialProductId, rows]) => ({ userFinancialProductId, rows }));
}
