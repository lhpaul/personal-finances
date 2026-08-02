import {
  financialInstitutions,
  merchantAliases,
  merchants,
  transactionCategories,
  transactions,
  userFinancialInstitutions,
  userFinancialProducts,
  users,
} from '../schema';
import { openMigratedMemoryDb } from '../testing/memory-db';
import { assertMinorUnits, assertPositiveMinorUnits } from '../money';

/**
 * Scenarios 4 (declared types), 21 (seven raw-insert identity tests) and 28 (table-and-column
 * census), per the Testing Strategy's test-file table.
 */

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

function columnsOf(sqlite: import('better-sqlite3').Database, table: string): ColumnInfo[] {
  return sqlite
    .prepare<[], ColumnInfo>(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk }));
}

describe('declared shape — money types (AC4)', () => {
  it('no table declares a real/float/double/numeric column type', () => {
    const { sqlite } = openMigratedMemoryDb();
    try {
      const tableRows = sqlite
        .prepare<[], { name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
        )
        .all();
      for (const { name } of tableRows) {
        for (const column of columnsOf(sqlite, name)) {
          expect(column.type).not.toMatch(/real|float|double|numeric/i);
        }
      }
    } finally {
      sqlite.close();
    }
  });

  it('assertMinorUnits throws on a fractional value and passes an integer through unchanged', () => {
    expect(assertMinorUnits(1000, 'test.field')).toBe(1000);
    expect(() => assertMinorUnits(1000.5, 'test.field')).toThrow(/whole number/);
    // Sign-tolerant: a negative value is a legitimate presentational balance (e.g. an overdraft).
    expect(assertMinorUnits(-500, 'test.field')).toBe(-500);
  });

  it('assertPositiveMinorUnits additionally rejects zero and negative values', () => {
    expect(assertPositiveMinorUnits(1000, 'transactions.amount')).toBe(1000);
    expect(() => assertPositiveMinorUnits(-1000, 'transactions.amount')).toThrow(/positive/);
    expect(() => assertPositiveMinorUnits(0, 'transactions.amount')).toThrow(/positive/);
    expect(() => assertPositiveMinorUnits(1000.5, 'transactions.amount')).toThrow(/whole number/);
  });
});

describe('declared shape — table-and-column census (AC28)', () => {
  it('every table and column matches docs/project/4-database-model.md field for field', () => {
    const { sqlite } = openMigratedMemoryDb();
    try {
      const expected: Record<string, string[]> = {
        users: ['id', 'email', 'first_name', 'last_name', 'national_id_type', 'country_code', 'created_at'],
        financial_institutions: ['id', 'country_code', 'name', 'assets', 'metadata', 'scraper_status'],
        user_financial_institutions: [
          'id',
          'financial_institution_id',
          'status',
          'credentials_key',
          'sync_status',
          'last_sync_at',
          'last_success_at',
          'last_error_code',
          'last_error_message',
          'created_at',
        ],
        user_financial_products: [
          'id',
          'user_financial_institution_id',
          'external_id',
          'type',
          'name',
          'currency_code',
          'assets',
          'metadata',
          'updated_at',
        ],
        transaction_categories: [
          'id',
          'slug',
          'income',
          'labels',
          'assets',
          'user_id',
          'parent_category_id',
          'sort_order',
          'created_at',
        ],
        merchants: ['id', 'name', 'assets', 'transaction_category_id', 'country_code', 'user_id', 'created_at'],
        merchant_aliases: ['id', 'merchant_id', 'raw_pattern', 'match_type', 'match_count'],
        transactions: [
          'id',
          'user_financial_product_id',
          'external_id',
          'dedup_hash',
          'amount',
          'type',
          'currency_code',
          'occurred_at',
          'date_local',
          'raw_description',
          'note',
          'merchant_id',
          'transaction_category_id',
          'category_source',
          'review_flag',
          'excluded_at',
          'exclusion_reason',
          'exclusion_note',
          'included_amount',
          'metadata',
          'is_manual',
          'created_at',
          'updated_at',
        ],
        app_settings: ['key', 'value'],
        user_budgets: [
          'id',
          'transaction_category_id',
          'period',
          'amount',
          'currency_code',
          'user_id',
          'created_at',
          'updated_at',
        ],
        user_recurring_transactions: [
          'id',
          'transaction_category_id',
          'description',
          'amount',
          'currency_code',
          'income',
          'due_day',
          'user_id',
          'created_at',
          'updated_at',
        ],
        seed_ledger: ['seed_key', 'entity_type', 'entity_id', 'seeded_hash', 'created_at', 'updated_at'],
      };

      const tableRows = sqlite
        .prepare<[], { name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name`,
        )
        .all();
      expect(tableRows.map((t) => t.name).sort()).toEqual(Object.keys(expected).sort());

      for (const [table, expectedColumns] of Object.entries(expected)) {
        const actualColumns = columnsOf(sqlite, table).map((c) => c.name);
        expect(actualColumns).toEqual(expectedColumns);
      }
    } finally {
      sqlite.close();
    }
  });

  it('no national_id_value, no auto_sync and no is_system column exists anywhere', () => {
    const { sqlite } = openMigratedMemoryDb();
    try {
      const tableRows = sqlite
        .prepare<[], { name: string }>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
        )
        .all();
      for (const { name } of tableRows) {
        const columnNames = columnsOf(sqlite, name).map((c) => c.name);
        expect(columnNames).not.toContain('national_id_value');
        expect(columnNames).not.toContain('auto_sync');
        expect(columnNames).not.toContain('is_system');
      }
    } finally {
      sqlite.close();
    }
  });
});

describe('identity guarantees — raw inserts that bypass the repository (AC21)', () => {
  it('rejects two connections to one bank', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(financialInstitutions)
        .values({ id: 'bch', countryCode: 'CL', name: 'Banco de Chile', scraperStatus: 'available' })
        .run();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'conn-1',
          financialInstitutionId: 'bch',
          status: 'active',
          credentialsKey: 'key-1',
          syncStatus: 'idle',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      expect(() =>
        db
          .insert(userFinancialInstitutions)
          .values({
            id: 'conn-2',
            financialInstitutionId: 'bch',
            status: 'active',
            credentialsKey: 'key-2',
            syncStatus: 'idle',
            createdAt: '2026-01-01T00:00:00.000Z',
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two products with one external id in one connection', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(financialInstitutions)
        .values({ id: 'bch', countryCode: 'CL', name: 'Banco de Chile', scraperStatus: 'available' })
        .run();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'conn-1',
          financialInstitutionId: 'bch',
          status: 'active',
          credentialsKey: 'key-1',
          syncStatus: 'idle',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      db.insert(userFinancialProducts)
        .values({
          id: 'product-1',
          userFinancialInstitutionId: 'conn-1',
          externalId: 'acct-1',
          type: 'checking',
          name: 'Cuenta corriente',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      expect(() =>
        db
          .insert(userFinancialProducts)
          .values({
            id: 'product-2',
            userFinancialInstitutionId: 'conn-1',
            externalId: 'acct-1',
            type: 'checking',
            name: 'Cuenta corriente (dup)',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two categories with one slug', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(transactionCategories)
        .values({
          id: 'cat-1',
          slug: 'dup-slug',
          income: 0,
          labels: JSON.stringify({ es: 'Uno' }),
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      expect(() =>
        db
          .insert(transactionCategories)
          .values({
            id: 'cat-2',
            slug: 'dup-slug',
            income: 0,
            labels: JSON.stringify({ es: 'Dos' }),
            sortOrder: 2,
            createdAt: '2026-01-01T00:00:00.000Z',
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two aliases with one pattern', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(merchants).values({ id: 'merchant-1', name: 'Uno', createdAt: '2026-01-01T00:00:00.000Z' }).run();
      db.insert(merchants).values({ id: 'merchant-2', name: 'Dos', createdAt: '2026-01-01T00:00:00.000Z' }).run();
      db.insert(merchantAliases).values({ id: 'alias-1', merchantId: 'merchant-1', rawPattern: 'DUP' }).run();
      expect(() =>
        db.insert(merchantAliases).values({ id: 'alias-2', merchantId: 'merchant-2', rawPattern: 'DUP' }).run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two movements with one (product, external_id)', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(financialInstitutions)
        .values({ id: 'bch', countryCode: 'CL', name: 'Banco de Chile', scraperStatus: 'available' })
        .run();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'conn-1',
          financialInstitutionId: 'bch',
          status: 'active',
          credentialsKey: 'key-1',
          syncStatus: 'idle',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      db.insert(userFinancialProducts)
        .values({
          id: 'product-1',
          userFinancialInstitutionId: 'conn-1',
          externalId: 'acct-1',
          type: 'checking',
          name: 'Cuenta corriente',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      db.insert(transactions)
        .values({
          id: 'txn-1',
          userFinancialProductId: 'product-1',
          externalId: 'ext-1',
          dedupHash: 'hash-1',
          amount: 1000,
          type: 'debit',
          occurredAt: '2026-01-01T00:00:00.000Z',
          dateLocal: '2026-01-01',
          rawDescription: 'One',
          isManual: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      expect(() =>
        db
          .insert(transactions)
          .values({
            id: 'txn-2',
            userFinancialProductId: 'product-1',
            externalId: 'ext-1',
            dedupHash: 'hash-2',
            amount: 2000,
            type: 'debit',
            occurredAt: '2026-01-01T00:00:00.000Z',
            dateLocal: '2026-01-01',
            rawDescription: 'Two',
            isManual: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two movements with one dedup_hash', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(financialInstitutions)
        .values({ id: 'bch', countryCode: 'CL', name: 'Banco de Chile', scraperStatus: 'available' })
        .run();
      db.insert(userFinancialInstitutions)
        .values({
          id: 'conn-1',
          financialInstitutionId: 'bch',
          status: 'active',
          credentialsKey: 'key-1',
          syncStatus: 'idle',
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      db.insert(userFinancialProducts)
        .values({
          id: 'product-1',
          userFinancialInstitutionId: 'conn-1',
          externalId: 'acct-1',
          type: 'checking',
          name: 'Cuenta corriente',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      db.insert(transactions)
        .values({
          id: 'txn-1',
          userFinancialProductId: 'product-1',
          externalId: null,
          dedupHash: 'dup-hash',
          amount: 1000,
          type: 'debit',
          occurredAt: '2026-01-01T00:00:00.000Z',
          dateLocal: '2026-01-01',
          rawDescription: 'One',
          isManual: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
        .run();
      expect(() =>
        db
          .insert(transactions)
          .values({
            id: 'txn-2',
            userFinancialProductId: 'product-1',
            externalId: null,
            dedupHash: 'dup-hash',
            amount: 2000,
            type: 'debit',
            occurredAt: '2026-01-01T00:00:00.000Z',
            dateLocal: '2026-01-01',
            rawDescription: 'Two',
            isManual: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          })
          .run(),
      ).toThrow();
    } finally {
      sqlite.close();
    }
  });

  it('rejects two users rows', () => {
    const { sqlite, db } = openMigratedMemoryDb();
    try {
      db.insert(users).values({ id: 'user-1', createdAt: '2026-01-01T00:00:00.000Z' }).run();
      expect(() => db.insert(users).values({ id: 'user-2', createdAt: '2026-01-01T00:00:00.000Z' }).run()).toThrow();
    } finally {
      sqlite.close();
    }
  });
});
