import type { SnapshotTable, SqliteSnapshot } from './snapshot-types';

/**
 * Additivity is enforced by a pairwise snapshot analyser, not by review (implementation plan
 * Decision 7). A pure function over two parsed `drizzle/meta/*_snapshot.json` objects — no file
 * system, no database — so it is unit-testable in milliseconds. Every `kind` below is a hard
 * failure that names what would be lost on a user's device (spec Business Rule 9). There is no
 * suppression directive for a non-additive finding, by design (Decision 8): the analyser
 * recognises none.
 *
 * Explicitly **allowed** (0 findings): a new table (with any constraints, because it has no
 * existing rows), a new nullable column on an existing table, a new non-unique index, and the
 * removal of a non-unique index, a unique constraint, a check constraint or a foreign key
 * (loosening a constraint never destroys data). A new `notNull` column on an existing table is
 * **never** allowed, even with a `default`.
 */

export type FindingKind =
  | 'table_removed'
  | 'column_removed'
  | 'column_type_changed'
  | 'column_made_mandatory'
  | 'column_pk_changed'
  | 'new_mandatory_column'
  | 'new_unique_on_existing_table'
  | 'check_added_or_changed_on_existing_table'
  | 'fk_added_to_existing_table'
  | 'default_removed_from_mandatory_column';

export interface Finding {
  kind: FindingKind;
  table: string;
  column?: string;
  detail: string;
}

export function findNonAdditiveChanges(prev: SqliteSnapshot, next: SqliteSnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const tableName of Object.keys(prev.tables)) {
    if (!(tableName in next.tables)) {
      findings.push({
        kind: 'table_removed',
        table: tableName,
        detail: `Table '${tableName}' exists in the previous shape but not the new one — every row of it would be lost.`,
      });
    }
  }

  for (const [tableName, nextTable] of Object.entries(next.tables)) {
    const prevTable = prev.tables[tableName];
    if (!prevTable) continue; // A brand-new table has no existing rows; anything it declares is safe.

    checkColumns(tableName, prevTable.columns, nextTable.columns, findings);
    checkNewUniques(tableName, prevTable, nextTable, findings);
    checkNewOrChangedChecks(tableName, prevTable, nextTable, findings);
    checkNewForeignKeys(tableName, prevTable, nextTable, findings);
  }

  return findings;
}

function checkColumns(
  tableName: string,
  prevColumns: SnapshotTable['columns'],
  nextColumns: SnapshotTable['columns'],
  findings: Finding[],
): void {
  for (const columnName of Object.keys(prevColumns)) {
    if (!(columnName in nextColumns)) {
      findings.push({
        kind: 'column_removed',
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' exists in the previous shape but not the new one — every value in it would be lost.`,
      });
    }
  }

  for (const [columnName, nextColumn] of Object.entries(nextColumns)) {
    const prevColumn = prevColumns[columnName];

    if (!prevColumn) {
      if (nextColumn.notNull) {
        findings.push({
          kind: 'new_mandatory_column',
          table: tableName,
          column: columnName,
          detail: `Column '${tableName}.${columnName}' is a new NOT NULL column on an existing table. Spec Business Rule 9 forbids a new mandatory field on an existing record kind unconditionally, even with a default.`,
        });
      }
      continue;
    }

    if (prevColumn.type.toLowerCase() !== nextColumn.type.toLowerCase()) {
      findings.push({
        kind: 'column_type_changed',
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' changed type from '${prevColumn.type}' to '${nextColumn.type}' — SQLite would rebuild the table and coerce every existing value.`,
      });
    }

    if (!prevColumn.notNull && nextColumn.notNull) {
      findings.push({
        kind: 'column_made_mandatory',
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' became NOT NULL — this fails on the first existing row holding NULL.`,
      });
    }

    if (prevColumn.primaryKey !== nextColumn.primaryKey) {
      findings.push({
        kind: 'column_pk_changed',
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' changed primary-key status — this requires a table rebuild.`,
      });
    }

    if (
      prevColumn.notNull &&
      prevColumn.default !== undefined &&
      nextColumn.notNull &&
      nextColumn.default === undefined
    ) {
      findings.push({
        kind: 'default_removed_from_mandatory_column',
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' is NOT NULL and lost its default — this turns a later safe ADD COLUMN recipe into a rejected one.`,
      });
    }
  }
}

function checkNewUniques(
  tableName: string,
  prevTable: SnapshotTable,
  nextTable: SnapshotTable,
  findings: Finding[],
): void {
  for (const [indexName, nextIndex] of Object.entries(nextTable.indexes)) {
    if (!nextIndex.isUnique) continue;
    if (indexName in prevTable.indexes) continue;
    findings.push({
      kind: 'new_unique_on_existing_table',
      table: tableName,
      detail: `A new unique index '${indexName}' was added to the existing table '${tableName}' — this throws on the first duplicate already stored on the phone.`,
    });
  }

  for (const constraintName of Object.keys(nextTable.uniqueConstraints)) {
    if (constraintName in prevTable.uniqueConstraints) continue;
    findings.push({
      kind: 'new_unique_on_existing_table',
      table: tableName,
      detail: `A new unique constraint '${constraintName}' was added to the existing table '${tableName}' — this throws on the first duplicate already stored on the phone.`,
    });
  }
}

function checkNewOrChangedChecks(
  tableName: string,
  prevTable: SnapshotTable,
  nextTable: SnapshotTable,
  findings: Finding[],
): void {
  for (const [checkName, nextCheck] of Object.entries(nextTable.checkConstraints)) {
    const prevCheck = prevTable.checkConstraints[checkName];
    if (!prevCheck) {
      findings.push({
        kind: 'check_added_or_changed_on_existing_table',
        table: tableName,
        detail: `A new CHECK constraint '${checkName}' was added to the existing table '${tableName}' — a constraint tightened over rows that already exist.`,
      });
    } else if (prevCheck.value !== nextCheck.value) {
      findings.push({
        kind: 'check_added_or_changed_on_existing_table',
        table: tableName,
        detail: `CHECK constraint '${checkName}' on table '${tableName}' changed — a constraint tightened over rows that already exist.`,
      });
    }
  }
}

function checkNewForeignKeys(
  tableName: string,
  prevTable: SnapshotTable,
  nextTable: SnapshotTable,
  findings: Finding[],
): void {
  for (const fkName of Object.keys(nextTable.foreignKeys)) {
    if (fkName in prevTable.foreignKeys) continue;
    findings.push({
      kind: 'fk_added_to_existing_table',
      table: tableName,
      detail: `A new foreign key '${fkName}' was added to the existing table '${tableName}' — SQLite has no ADD CONSTRAINT, so this requires a copy-and-rename table rebuild.`,
    });
  }
}
