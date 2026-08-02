import { findNonAdditiveChanges } from '../additivity';
import type {
  SnapshotCheckConstraint,
  SnapshotColumn,
  SnapshotForeignKey,
  SnapshotIndex,
  SnapshotTable,
  SnapshotUniqueConstraint,
  SqliteSnapshot,
} from '../snapshot-types';

/**
 * Implementation plan Testing Strategy — "one `it(...)` per row of the [additivity] table (18
 * cases), each asserting the exact `kind`, `table` and `column`." This is that suite (AC14).
 */

function column(overrides: Partial<SnapshotColumn> & { name: string; type: string }): SnapshotColumn {
  return {
    primaryKey: false,
    notNull: false,
    autoincrement: false,
    ...overrides,
  };
}

function table(
  name: string,
  columns: Record<string, SnapshotColumn>,
  overrides: Partial<
    Pick<SnapshotTable, 'indexes' | 'foreignKeys' | 'uniqueConstraints' | 'checkConstraints'>
  > = {},
): SnapshotTable {
  return {
    name,
    columns,
    indexes: overrides.indexes ?? {},
    foreignKeys: overrides.foreignKeys ?? {},
    compositePrimaryKeys: {},
    uniqueConstraints: overrides.uniqueConstraints ?? {},
    checkConstraints: overrides.checkConstraints ?? {},
  };
}

function snapshot(tables: Record<string, SnapshotTable>): SqliteSnapshot {
  return { version: '6', dialect: 'sqlite', tables };
}

// Deliberately not annotated `Record<string, SnapshotColumn>` — an inferred literal type keeps
// `.id` / `.note` / `.amount` accesses below statically known, rather than routed through an
// index signature (`noUncheckedIndexedAccess`).
const baseTransactionsColumns = {
  id: column({ name: 'id', type: 'text', primaryKey: true, notNull: true }),
  note: column({ name: 'note', type: 'text' }),
  amount: column({ name: 'amount', type: 'integer', notNull: true }),
};

const baseMerchantsColumns = {
  id: column({ name: 'id', type: 'text', primaryKey: true, notNull: true }),
  name: column({ name: 'name', type: 'text', notNull: true }),
};

function baseline(): SqliteSnapshot {
  return snapshot({
    transactions: table('transactions', { ...baseTransactionsColumns }),
    merchants: table('merchants', { ...baseMerchantsColumns }),
  });
}

/** Guards `prev.tables[name]` / `next.tables[name]` access rather than trusting an index
 * signature or a non-null assertion. */
function requireTable(snap: SqliteSnapshot, name: string): SnapshotTable {
  const found = snap.tables[name];
  if (!found) throw new Error(`Test fixture is missing table '${name}'`);
  return found;
}

describe('findNonAdditiveChanges', () => {
  it('flags a removed table (table_removed)', () => {
    const prev = baseline();
    const next = snapshot({ transactions: requireTable(prev, 'transactions') });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'table_removed', table: 'merchants' }),
    ]);
  });

  it('flags a removed column (column_removed)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        id: baseTransactionsColumns.id,
        amount: baseTransactionsColumns.amount,
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'column_removed', table: 'transactions', column: 'note' }),
    ]);
  });

  it('treats a rename as removal plus addition, with no new_mandatory_column for a nullable renamed column', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        id: baseTransactionsColumns.id,
        amount: baseTransactionsColumns.amount,
        user_note: column({ name: 'user_note', type: 'text' }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'column_removed', table: 'transactions', column: 'note' }),
    ]);
    expect(findings.some((f) => f.kind === 'new_mandatory_column')).toBe(false);
  });

  it('flags a column type change (column_type_changed)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        amount: column({ name: 'amount', type: 'real', notNull: true }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'column_type_changed',
        table: 'transactions',
        column: 'amount',
      }),
    ]);
  });

  it('does not flag a case-only type change (boundary: type comparison is case-insensitive)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        amount: column({ name: 'amount', type: 'INTEGER', notNull: true }),
      }),
    });

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });

  it('flags a column made mandatory (column_made_mandatory)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        note: column({ name: 'note', type: 'text', notNull: true }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'column_made_mandatory',
        table: 'transactions',
        column: 'note',
      }),
    ]);
  });

  it('flags a new NOT NULL column with no default on an existing table (new_mandatory_column)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        foo: column({ name: 'foo', type: 'text', notNull: true }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'new_mandatory_column',
        table: 'transactions',
        column: 'foo',
      }),
    ]);
  });

  it('flags a new NOT NULL column even with a default (new_mandatory_column, product-policy line)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        foo: column({ name: 'foo', type: 'text', notNull: true, default: "'bar'" }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'new_mandatory_column',
        table: 'transactions',
        column: 'foo',
      }),
    ]);
  });

  it('allows a new nullable column on an existing table (0 findings)', () => {
    const prev = baseline();
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        foo: column({ name: 'foo', type: 'text' }),
      }),
    });

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });

  it('allows a brand-new table with NOT NULL columns, uniques, checks and foreign keys (0 findings — no existing rows)', () => {
    const prev = baseline();
    const uniqueConstraints: Record<string, SnapshotUniqueConstraint> = {
      new_table_slug_unique: { name: 'new_table_slug_unique', columns: ['slug'] },
    };
    const checkConstraints: Record<string, SnapshotCheckConstraint> = {
      new_table_amount_check: { name: 'new_table_amount_check', value: 'amount > 0' },
    };
    const foreignKeys: Record<string, SnapshotForeignKey> = {
      new_table_merchant_id_fk: {
        name: 'new_table_merchant_id_fk',
        tableFrom: 'new_table',
        tableTo: 'merchants',
        columnsFrom: ['merchant_id'],
        columnsTo: ['id'],
      },
    };
    const next = snapshot({
      ...prev.tables,
      new_table: table(
        'new_table',
        {
          id: column({ name: 'id', type: 'text', primaryKey: true, notNull: true }),
          slug: column({ name: 'slug', type: 'text', notNull: true }),
          amount: column({ name: 'amount', type: 'integer', notNull: true }),
          merchant_id: column({ name: 'merchant_id', type: 'text' }),
        },
        { uniqueConstraints, checkConstraints, foreignKeys },
      ),
    });

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });

  it('flags a new unique index on an existing table (new_unique_on_existing_table)', () => {
    const prev = baseline();
    const newIndex: Record<string, SnapshotIndex> = {
      transactions_note_unique: { name: 'transactions_note_unique', columns: ['note'], isUnique: true },
    };
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', { ...baseTransactionsColumns }, { indexes: newIndex }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'new_unique_on_existing_table', table: 'transactions' }),
    ]);
  });

  it('allows a new non-unique index on an existing table (0 findings)', () => {
    const prev = baseline();
    const newIndex: Record<string, SnapshotIndex> = {
      transactions_note_idx: { name: 'transactions_note_idx', columns: ['note'], isUnique: false },
    };
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', { ...baseTransactionsColumns }, { indexes: newIndex }),
    });

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });

  it('allows an existing non-unique index to be removed (0 findings)', () => {
    const existingIndex: Record<string, SnapshotIndex> = {
      transactions_note_idx: { name: 'transactions_note_idx', columns: ['note'], isUnique: false },
    };
    const prev = snapshot({
      transactions: table('transactions', { ...baseTransactionsColumns }, { indexes: existingIndex }),
      merchants: table('merchants', { ...baseMerchantsColumns }),
    });
    const next = snapshot({
      transactions: table('transactions', { ...baseTransactionsColumns }),
      merchants: table('merchants', { ...baseMerchantsColumns }),
    });

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });

  it('flags a CHECK constraint added to an existing table (check_added_or_changed_on_existing_table)', () => {
    const prev = baseline();
    const checkConstraints: Record<string, SnapshotCheckConstraint> = {
      merchants_name_check: { name: 'merchants_name_check', value: "name != ''" },
    };
    const next = snapshot({
      ...prev.tables,
      merchants: table('merchants', { ...baseMerchantsColumns }, { checkConstraints }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'check_added_or_changed_on_existing_table',
        table: 'merchants',
      }),
    ]);
  });

  it('flags a foreign key added to an existing table (fk_added_to_existing_table)', () => {
    const prev = baseline();
    const foreignKeys: Record<string, SnapshotForeignKey> = {
      transactions_merchant_id_merchants_id_fk: {
        name: 'transactions_merchant_id_merchants_id_fk',
        tableFrom: 'transactions',
        tableTo: 'merchants',
        columnsFrom: ['merchant_id'],
        columnsTo: ['id'],
      },
    };
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', { ...baseTransactionsColumns }, { foreignKeys }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({ kind: 'fk_added_to_existing_table', table: 'transactions' }),
    ]);
  });

  it('flags a NOT NULL column losing its default (default_removed_from_mandatory_column)', () => {
    const prev = snapshot({
      ...baseline().tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        amount: column({ name: 'amount', type: 'integer', notNull: true, default: 0 }),
      }),
    });
    const next = snapshot({
      ...prev.tables,
      transactions: table('transactions', {
        ...baseTransactionsColumns,
        amount: column({ name: 'amount', type: 'integer', notNull: true }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'default_removed_from_mandatory_column',
        table: 'transactions',
        column: 'amount',
      }),
    ]);
  });

  it('reports two independent violations in one pair as two findings, each naming its own table and column', () => {
    const prev = baseline();
    const next = snapshot({
      transactions: table('transactions', {
        id: baseTransactionsColumns.id,
        amount: baseTransactionsColumns.amount,
        // 'note' removed
      }),
      merchants: table('merchants', {
        ...baseMerchantsColumns,
        // new mandatory column added
        country_code: column({ name: 'country_code', type: 'text', notNull: true }),
      }),
    });

    const findings = findNonAdditiveChanges(prev, next);

    expect(findings).toHaveLength(2);
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'column_removed', table: 'transactions', column: 'note' }),
        expect.objectContaining({
          kind: 'new_mandatory_column',
          table: 'merchants',
          column: 'country_code',
        }),
      ]),
    );
  });

  it('reports nothing when prev and next are identical (the no-op case mode 3 relies on)', () => {
    const prev = baseline();
    const next = baseline();

    expect(findNonAdditiveChanges(prev, next)).toEqual([]);
  });
});
