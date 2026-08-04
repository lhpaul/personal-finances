import path from 'node:path';

import { getTransactionContext } from '../repositories/transactions';
import { loadFixture } from '../testing/load-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 22 (Decision 11): the
 * committed delta fixture applies cleanly on top of a bootstrapped store and yields exactly the
 * three expected movements, with the expected person-layer — including the excluded row's
 * `category_source = 'user'` (Decision 4, so the auto-suggestion caption is absent).
 */
const FIXTURE_PATH = path.resolve(__dirname, '..', '__fixtures__', 'transaction-detail-v1.sql');

describe('transaction-detail-v1.sql fixture (Decision 11)', () => {
  it('applies cleanly on top of a bootstrapped store and re-applies idempotently', async () => {
    const { sqlite } = await openBootstrappedMemoryDb();
    try {
      expect(() => loadFixture(sqlite, FIXTURE_PATH)).not.toThrow();
      expect(() => loadFixture(sqlite, FIXTURE_PATH)).not.toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('detail-tx-categorized carries the mockup\'s own sample values, an auto-suggested category and a note', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadFixture(sqlite, FIXTURE_PATH);

      const context = getTransactionContext(db, 'detail-tx-categorized');
      expect(context?.transaction.amount).toBe(35000);
      expect(context?.transaction.rawDescription).toBe(
        'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL',
      );
      expect(context?.transaction.note).toBe('Compras semanales');
      expect(context?.transaction.transactionCategoryId).toBe('supermercado');
      expect(context?.transaction.categorySource).toBe('auto');
      expect(context?.transaction.excludedAt).toBeNull();
      expect(context?.merchantName).toBe('Líder S.A.');
      expect(context?.product?.name).toBe('Cta. corriente');
      expect(context?.product?.mask).toBe('4821');
    } finally {
      sqlite.close();
    }
  });

  it('detail-tx-uncategorized shares the same bank facts and merchant, with no category and no note', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadFixture(sqlite, FIXTURE_PATH);

      const context = getTransactionContext(db, 'detail-tx-uncategorized');
      expect(context?.transaction.amount).toBe(35000);
      expect(context?.transaction.rawDescription).toBe(
        'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL',
      );
      expect(context?.transaction.note).toBeNull();
      expect(context?.transaction.transactionCategoryId).toBeNull();
      expect(context?.transaction.categorySource).toBeNull();
      expect(context?.transaction.excludedAt).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('detail-tx-excluded is excluded with reason shared_expense, and its category_source is user (not auto)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      loadFixture(sqlite, FIXTURE_PATH);

      const context = getTransactionContext(db, 'detail-tx-excluded');
      expect(context?.transaction.transactionCategoryId).toBe('supermercado');
      // `category_source = 'user'` — not 'auto' — is why the auto-suggestion caption is absent
      // for this row (Decision 4), even though it carries a category.
      expect(context?.transaction.categorySource).toBe('user');
      expect(context?.transaction.excludedAt).not.toBeNull();
      expect(context?.transaction.exclusionReason).toBe('shared_expense');
      expect(context?.transaction.exclusionNote).toBeNull();
      expect(context?.transaction.includedAmount).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
