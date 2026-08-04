import { transactions } from '../../../db/schema';
import { createTestConnection, createTestProduct } from '../../../db/testing/product-fixture';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import * as transactionsRepo from '../../../db/repositories/transactions';
import { totalForCategoryInPeriod } from '../../../db/repositories/transactions';
import { readDashboardData } from '../read-dashboard-data';

/**
 * Scenarios 3-5 of the dashboard implementation plan's Testing Strategy (brief AC1, BR4,
 * Decisions 1-2, 12). Routed to the `db` Jest project by its `.db.test.ts` suffix
 * (jest.config.js — item #12's Infrastructure change, reused unchanged by this item).
 */
describe('readDashboardData (issue #17)', () => {
  const period = { start: '2026-02-01', end: '2026-02-28' };
  const previousPeriod = { start: '2026-01-01', end: '2026-01-31' };
  const trendWindow = { start: '2025-09-01', end: '2026-02-28' };

  it('equals a hand-derived literal AND an independent aggregate (totalForCategoryInPeriod) — Scenario 3', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values([
          {
            id: 'full-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'full-comida',
            amount: 42000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-05',
            rawDescription: 'LIDER SUPERMERCADO',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            // Partially included: the person set includedAmount lower than amount (e.g. a
            // split bill) — the dashboard total must use includedAmount, not amount.
            id: 'partial-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'partial-comida',
            amount: 20000,
            includedAmount: 8000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-06',
            rawDescription: 'Split dinner',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'excluded-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'excluded-comida',
            amount: 15000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-07',
            rawDescription: 'Excluded expense',
            transactionCategoryId: 'comida',
            excludedAt: now,
            exclusionReason: 'not_relevant',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            // Planted-violation proof for the peso guard (issue #86/#10, Decision 4): a
            // foreign-currency movement, included and not excluded, must still be absent from
            // every peso total this screen composes.
            id: 'foreign-currency-comida',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'foreign-currency-comida',
            amount: 999999,
            type: 'debit',
            currencyCode: 'USD',
            occurredAt: now,
            dateLocal: '2026-02-08',
            rawDescription: 'USD movement',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const data = readDashboardData(db, { period, previousPeriod, trendWindow, locale: 'es' });

      const comidaTotal = data.currentCategoryTotals.find(
        (row) => row.type === 'debit' && row.transactionCategoryId === 'comida',
      );

      // Hand-derived literal: 42000 (full) + 8000 (partial's includedAmount) = 50000. The
      // excluded row and the foreign-currency row contribute nothing.
      expect(comidaTotal).toEqual({
        type: 'debit',
        transactionCategoryId: 'comida',
        total: 50000,
        movementCount: 2,
      });

      // Independent aggregate: totalForCategoryInPeriod must report the same figure.
      expect(totalForCategoryInPeriod(db, 'comida', { startDateLocal: period.start, endDateLocal: period.end })).toBe(
        50000,
      );
    } finally {
      sqlite.close();
    }
  });

  it('issues exactly the four Decision-1 calls and no row-level read — Scenario 4', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      const dayTotalsSpy = jest.spyOn(transactionsRepo, 'sumIncludedByDirectionAndDay');
      const categoryTotalsSpy = jest.spyOn(transactionsRepo, 'sumIncludedByDirectionAndCategory');
      const listMonthSpy = jest.spyOn(transactionsRepo, 'listMonth');
      const listRecentMovementsSpy = jest.spyOn(transactionsRepo, 'listRecentMovements');
      const listByMerchantSpy = jest.spyOn(transactionsRepo, 'listByMerchant');

      readDashboardData(db, { period, previousPeriod, trendWindow, locale: 'es' });

      // sumIncludedByDirectionAndDay: once, over the trend window.
      expect(dayTotalsSpy).toHaveBeenCalledTimes(1);
      expect(dayTotalsSpy).toHaveBeenCalledWith(db, {
        startDateLocal: trendWindow.start,
        endDateLocal: trendWindow.end,
      });
      // sumIncludedByDirectionAndCategory: twice — current period, then previous period.
      expect(categoryTotalsSpy).toHaveBeenCalledTimes(2);
      expect(categoryTotalsSpy).toHaveBeenNthCalledWith(1, db, {
        startDateLocal: period.start,
        endDateLocal: period.end,
      });
      expect(categoryTotalsSpy).toHaveBeenNthCalledWith(2, db, {
        startDateLocal: previousPeriod.start,
        endDateLocal: previousPeriod.end,
      });

      expect(listMonthSpy).not.toHaveBeenCalled();
      expect(listRecentMovementsSpy).not.toHaveBeenCalled();
      expect(listByMerchantSpy).not.toHaveBeenCalled();
    } finally {
      sqlite.close();
    }
  });

  it('returns one internally consistent snapshot — Scenario 5', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      const productId = createTestProduct(db, ports, connectionId);
      const now = ports.now();

      db.insert(transactions)
        .values([
          {
            id: 'snap-debit',
            userFinancialProductId: productId,
            externalId: null,
            dedupHash: 'snap-debit',
            amount: 30000,
            type: 'debit',
            occurredAt: now,
            dateLocal: '2026-02-05',
            rawDescription: 'Expense',
            transactionCategoryId: 'comida',
            isManual: 0,
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const data = readDashboardData(db, { period, previousPeriod, trendWindow, locale: 'es' });

      const categoryDebitTotal = data.currentCategoryTotals
        .filter((row) => row.type === 'debit')
        .reduce((sum, row) => sum + row.total, 0);
      const windowDebitTotalForFebruary = data.windowDailyTotals
        .filter((row) => row.type === 'debit' && row.dateLocal >= period.start && row.dateLocal <= period.end)
        .reduce((sum, row) => sum + row.total, 0);

      expect(categoryDebitTotal).toBe(30000);
      expect(windowDebitTotalForFebruary).toBe(30000);
      expect(categoryDebitTotal).toBe(windowDebitTotalForFebruary);

      expect(data.categories.some((category) => category.income)).toBe(true);
      expect(data.categories.some((category) => !category.income)).toBe(true);
    } finally {
      sqlite.close();
    }
  });
});
