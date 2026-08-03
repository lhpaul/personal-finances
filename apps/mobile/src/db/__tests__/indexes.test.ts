import Database from 'better-sqlite3';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';

import { includedAmount, isIncluded, isPesoDenominated } from '../fragments';
import { financialInstitutions, transactionCategories, transactions } from '../schema';
import { openMigratedMemoryDb } from '../testing/memory-db';

/**
 * Scenario 23 (AC23), per the Testing Strategy's test-file table: `EXPLAIN QUERY PLAN` for each
 * of the six questions in the spec's "Questions the store must be able to answer efficiently"
 * table. Every plan is printed to test output so a reviewer can read it, not merely trust the
 * assertion.
 */

interface PlanRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

function explain(sqlite: Database.Database, sqlObj: { sql: string; params: unknown[] }): PlanRow[] {
  return sqlite
    .prepare<unknown[], PlanRow>(`EXPLAIN QUERY PLAN ${sqlObj.sql}`)
    .all(...(sqlObj.params as never[]));
}

function assertUsesIndexNotScan(label: string, rows: PlanRow[]): void {
  const detail = rows.map((r) => r.detail).join(' | ');
  // eslint-disable-next-line no-console
  console.log(`EXPLAIN QUERY PLAN — ${label}:\n  ${detail}`);
  expect(detail).toMatch(/USING (COVERING )?INDEX/);
  expect(detail).not.toMatch(/SCAN transactions\b/);
}

describe('index-backed questions (AC23)', () => {
  it('"How many movements still need a category?" uses transactions_uncategorized_idx (home)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      const query = db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(sql`${transactions.transactionCategoryId} is null`, isIncluded));
      assertUsesIndexNotScan('countUncategorized', explain(sqlite, query.toSQL()));
    } finally {
      sqlite.close();
    }
  });

  it('"What are this month\'s movements, newest first?" uses transactions_date_local_idx (transactions)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      const query = db
        .select()
        .from(transactions)
        .where(and(gte(transactions.dateLocal, '2026-02-01'), lte(transactions.dateLocal, '2026-02-28')))
        .orderBy(desc(transactions.dateLocal));
      assertUsesIndexNotScan('listMonth', explain(sqlite, query.toSQL()));
    } finally {
      sqlite.close();
    }
  });

  it('"What is the total for this category over this period?" uses transactions_category_id_idx (dashboard)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      // Mirrors totalForCategoryInPeriod's WHERE exactly, including the issue #10 currency guard
      // (Decision 15) — this test reconstructs the query by hand for EXPLAIN QUERY PLAN, so it
      // must be kept in sync with the repository function or it would silently plan a different
      // query than production runs. src/db/checks/peso-total-scan.ts's own guard catches a drift
      // here (an unguarded sum(includedAmount) in this file) — see the PR description's
      // planted-defect proof.
      const query = db
        .select({ total: sql<number>`coalesce(sum(${includedAmount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.transactionCategoryId, 'comida'),
            isIncluded,
            isPesoDenominated,
            gte(transactions.dateLocal, '2026-02-01'),
            lte(transactions.dateLocal, '2026-02-28'),
          ),
        );
      assertUsesIndexNotScan('totalForCategoryInPeriod', explain(sqlite, query.toSQL()));
    } finally {
      sqlite.close();
    }
  });

  it('"Which movements belong to this merchant?" uses transactions_merchant_id_idx (merchant-edit)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      const query = db
        .select()
        .from(transactions)
        .where(eq(transactions.merchantId, 'lider'))
        .orderBy(desc(transactions.dateLocal));
      assertUsesIndexNotScan('listByMerchant', explain(sqlite, query.toSQL()));
    } finally {
      sqlite.close();
    }
  });

  it('"Which banks can be connected right now?" uses financial_institutions_scraper_status_idx (bank-picker)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      const query = db
        .select()
        .from(financialInstitutions)
        .where(eq(financialInstitutions.scraperStatus, 'available'));
      const rows = explain(sqlite, query.toSQL());
      const detail = rows.map((r) => r.detail).join(' | ');
      // eslint-disable-next-line no-console
      console.log(`EXPLAIN QUERY PLAN — listConnectableInstitutions:\n  ${detail}`);
      expect(detail).toMatch(/USING (COVERING )?INDEX/);
      expect(detail).not.toMatch(/SCAN financial_institutions\b/);
    } finally {
      sqlite.close();
    }
  });

  it('"What are my categories, in my chosen order, for this direction?" uses transaction_categories_income_sort_order_idx (settings-categories)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      const query = db
        .select()
        .from(transactionCategories)
        .where(eq(transactionCategories.income, 0))
        .orderBy(asc(transactionCategories.sortOrder));
      const rows = explain(sqlite, query.toSQL());
      const detail = rows.map((r) => r.detail).join(' | ');
      // eslint-disable-next-line no-console
      console.log(`EXPLAIN QUERY PLAN — listCategories:\n  ${detail}`);
      expect(detail).toMatch(/USING (COVERING )?INDEX/);
      expect(detail).not.toMatch(/SCAN transaction_categories\b/);
    } finally {
      sqlite.close();
    }
  });
});
