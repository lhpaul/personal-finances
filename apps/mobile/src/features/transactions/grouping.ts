import { formatMonthHeading } from '@finanzas/shared-utils';

import type { SupportedLocale } from '../../db/labels';
import type { MonthCount, TransactionListRow } from '../../db/types';

/**
 * The flat, heterogeneous entry array `FlashList` renders (implementation plan for issue #15,
 * Decision 3), so no `.map()` of the table into a `ScrollView` exists anywhere. `getItemType`
 * (below) recycles headers, rows and the search summary in separate pools.
 */
export type TransactionListEntry =
  | { kind: 'month-header'; monthKey: string; label: string; count: number }
  | { kind: 'movement'; row: TransactionListRow }
  | { kind: 'search-summary'; term: string; count: number };

/**
 * Builds the flat entry array a page of rows renders as (Decision 3, Decision 8). While a search
 * term is active, one `search-summary` entry replaces every month header — the mockup's `search`
 * state draws one summary line, not month groups (`data-states="search"`). The summary's count
 * is the **sum of `monthCounts`** — the same SQL-sourced counts a month header uses — never
 * `rows.length`, so it is correct even when more matches exist than the loaded page holds.
 *
 * Returns `[]` for no rows, in either mode.
 */
export function buildListEntries(
  rows: TransactionListRow[],
  monthCounts: MonthCount[],
  locale: SupportedLocale,
  searchTerm: string | null,
): TransactionListEntry[] {
  if (rows.length === 0) return [];

  if (searchTerm !== null) {
    const totalCount = monthCounts.reduce((sum, month) => sum + month.count, 0);
    const entries: TransactionListEntry[] = [{ kind: 'search-summary', term: searchTerm, count: totalCount }];
    for (const row of rows) entries.push({ kind: 'movement', row });
    return entries;
  }

  const countByMonth = new Map(monthCounts.map((month) => [month.monthKey, month.count]));
  const entries: TransactionListEntry[] = [];
  let currentMonthKey: string | null = null;

  for (const row of rows) {
    const monthKey = row.dateLocal.slice(0, 7);
    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      entries.push({
        kind: 'month-header',
        monthKey,
        label: formatMonthHeading(`${monthKey}-01`, locale),
        count: countByMonth.get(monthKey) ?? 0,
      });
    }
    entries.push({ kind: 'movement', row });
  }

  return entries;
}

/** One recycling pool per entry kind, so `FlashList` never recycles a header view as a row view
 * or vice versa (Decision 3, brief AC1). */
export function getEntryType(entry: TransactionListEntry): TransactionListEntry['kind'] {
  return entry.kind;
}
