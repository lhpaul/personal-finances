/**
 * `db:check` mode 3 — "preservation" (implementation plan Decision 6, AC13). A pure
 * before/after census comparison: no database, no file system. `apps/mobile/scripts/db/check.ts`
 * loads a committed `src/db/__fixtures__/store-v*.sql` snapshot into an in-memory store, takes a
 * census, runs the migration history, takes a second census, and passes both to
 * `findPreservationViolations`.
 *
 * A table is identified by name; a row within a table is identified by the value of its
 * (single-column, `TEXT`) primary key, which the caller supplies per table. Only columns present
 * in the *before* census are compared — a new column appearing after migration is expected and
 * not a violation; only its value on a pre-existing row must equal whatever value the migration
 * assigned it consistently (this module does not second-guess that; it only asserts nothing
 * *pre-existing* was lost or altered).
 */

export interface CensusTable {
  name: string;
  /** Keyed by the table's primary-key column value. */
  rows: Record<string, Record<string, unknown>>;
}

export interface Census {
  tables: CensusTable[];
}

export type PreservationFindingKind =
  | 'table_missing_after_migration'
  | 'row_lost'
  | 'column_value_changed';

export interface PreservationFinding {
  kind: PreservationFindingKind;
  table: string;
  primaryKey?: string;
  column?: string;
  detail: string;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findPreservationViolations(before: Census, after: Census): PreservationFinding[] {
  const findings: PreservationFinding[] = [];
  const afterByName = new Map(after.tables.map((t) => [t.name, t]));

  for (const beforeTable of before.tables) {
    const afterTable = afterByName.get(beforeTable.name);
    if (!afterTable) {
      findings.push({
        kind: 'table_missing_after_migration',
        table: beforeTable.name,
        detail: `Table '${beforeTable.name}' existed before the migration but not after — every row of it was lost.`,
      });
      continue;
    }

    for (const [primaryKey, beforeRow] of Object.entries(beforeTable.rows)) {
      const afterRow = afterTable.rows[primaryKey];
      if (!afterRow) {
        findings.push({
          kind: 'row_lost',
          table: beforeTable.name,
          primaryKey,
          detail: `Row '${primaryKey}' in table '${beforeTable.name}' existed before the migration but not after.`,
        });
        continue;
      }

      for (const [column, beforeValue] of Object.entries(beforeRow)) {
        const afterValue = afterRow[column];
        if (!valuesEqual(beforeValue, afterValue)) {
          findings.push({
            kind: 'column_value_changed',
            table: beforeTable.name,
            primaryKey,
            column,
            detail: `Column '${column}' of row '${primaryKey}' in table '${beforeTable.name}' changed from ${JSON.stringify(beforeValue)} to ${JSON.stringify(afterValue)}.`,
          });
        }
      }
    }
  }

  return findings;
}
