import type { MonthCount, TransactionListRow } from '../../../db/types';
import { buildListEntries, getEntryType } from '../grouping';

function row(overrides: Partial<TransactionListRow> & { id: string; dateLocal: string }): TransactionListRow {
  return {
    amount: 1000,
    type: 'debit',
    rawDescription: 'Movement',
    note: null,
    excludedAt: null,
    exclusionReason: null,
    includedAmount: null,
    merchantName: undefined,
    merchantEmoji: undefined,
    categoryName: undefined,
    categoryEmoji: undefined,
    ...overrides,
  };
}

/** Scenarios 18-19 of the transactions-list implementation plan (Decisions 3, 8, brief AC1). */
describe('buildListEntries', () => {
  it('returns an empty array for no rows', () => {
    expect(buildListEntries([], [], 'es', null)).toEqual([]);
  });

  it('emits a header before each month\'s runs and carries the SQL count into the header', () => {
    const rows = [
      row({ id: 'jan-1', dateLocal: '2026-01-27' }),
      row({ id: 'jan-2', dateLocal: '2026-01-24' }),
      row({ id: 'dec-1', dateLocal: '2025-12-29' }),
    ];
    const monthCounts: MonthCount[] = [
      { monthKey: '2026-01', count: 31 }, // more matches exist than are loaded on this page
      { monthKey: '2025-12', count: 14 },
    ];

    const entries = buildListEntries(rows, monthCounts, 'es', null);

    expect(entries).toEqual([
      { kind: 'month-header', monthKey: '2026-01', label: 'Enero de 2026', count: 31 },
      { kind: 'movement', row: rows[0] },
      { kind: 'movement', row: rows[1] },
      { kind: 'month-header', monthKey: '2025-12', label: 'Diciembre de 2025', count: 14 },
      { kind: 'movement', row: rows[2] },
    ]);
  });

  it('emits one search-summary entry instead of headers when a term is active, its count from monthCounts, not rows.length', () => {
    const rows = [row({ id: 'uber-1', dateLocal: '2026-01-23' }), row({ id: 'uber-2', dateLocal: '2025-12-11' })];
    // More matches exist across the whole table than are loaded on this first page.
    const monthCounts: MonthCount[] = [
      { monthKey: '2026-01', count: 5 },
      { monthKey: '2025-12', count: 3 },
    ];

    const entries = buildListEntries(rows, monthCounts, 'es', 'uber');

    expect(entries[0]).toEqual({ kind: 'search-summary', term: 'uber', count: 8 });
    expect(entries.slice(1)).toEqual([
      { kind: 'movement', row: rows[0] },
      { kind: 'movement', row: rows[1] },
    ]);
  });

  it('getEntryType returns a distinct type per entry kind, so headers/rows/summary recycle in separate pools', () => {
    const monthHeader = { kind: 'month-header', monthKey: '2026-01', label: 'Enero de 2026', count: 1 } as const;
    const movement = { kind: 'movement', row: row({ id: 'a', dateLocal: '2026-01-01' }) } as const;
    const summary = { kind: 'search-summary', term: 'uber', count: 1 } as const;

    const types = new Set([getEntryType(monthHeader), getEntryType(movement), getEntryType(summary)]);
    expect(types.size).toBe(3);
  });
});
