import type { SqliteSnapshot } from './snapshot-types';

/**
 * `db:check` mode 1 — "history vs declared shape" (implementation plan Decision 6). This module
 * is a pure comparison of an already-fetched introspection result against an already-parsed
 * snapshot; it opens no database and reads no file itself — all of that lives in
 * `apps/mobile/scripts/db/check.ts`, so this stays unit-testable like every other file under
 * `src/db/checks/`.
 *
 * This introspection-vs-snapshot comparison is the *first* half of mode 1, and is deliberately
 * best-effort: SQLite's `PRAGMA index_list` / `PRAGMA index_info` do not expose a partial index's
 * `WHERE` clause, so this comparison cannot itself catch a drifted predicate. The *second* half
 * of mode 1 (re-running `drizzle-kit generate` against a temp copy of `drizzle/` and asserting it
 * emits nothing) is what makes "no pending difference" mechanical — see Decision 6. This module
 * is the supplementary check that catches table/column/index existence and basic shape drift
 * (name, type, nullability, primary-key, uniqueness) quickly and readably.
 */

export interface IntrospectedColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

export interface IntrospectedIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface IntrospectedForeignKey {
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
}

export interface IntrospectedTable {
  name: string;
  columns: IntrospectedColumn[];
  indexes: IntrospectedIndex[];
  foreignKeys: IntrospectedForeignKey[];
}

export interface IntrospectionResult {
  tables: IntrospectedTable[];
}

export interface DeclaredShapeFinding {
  table: string;
  column?: string;
  detail: string;
}

export function compareDeclaredShape(
  introspection: IntrospectionResult,
  snapshot: SqliteSnapshot,
): DeclaredShapeFinding[] {
  const findings: DeclaredShapeFinding[] = [];
  const introspectedByName = new Map(introspection.tables.map((t) => [t.name, t]));
  const snapshotTableNames = new Set(Object.keys(snapshot.tables));

  for (const tableName of introspectedByName.keys()) {
    if (!snapshotTableNames.has(tableName)) {
      findings.push({
        table: tableName,
        detail: `Table '${tableName}' exists in the live store but not in the declared shape.`,
      });
    }
  }

  for (const [tableName, snapshotTable] of Object.entries(snapshot.tables)) {
    const introspectedTable = introspectedByName.get(tableName);
    if (!introspectedTable) {
      findings.push({
        table: tableName,
        detail: `Table '${tableName}' is declared but does not exist in the live store.`,
      });
      continue;
    }

    compareColumns(tableName, introspectedTable, snapshotTable, findings);
    compareIndexes(tableName, introspectedTable, snapshotTable, findings);
    compareForeignKeys(tableName, introspectedTable, snapshotTable, findings);
  }

  return findings;
}

function compareColumns(
  tableName: string,
  introspectedTable: IntrospectedTable,
  snapshotTable: SqliteSnapshot['tables'][string],
  findings: DeclaredShapeFinding[],
): void {
  const introspectedColumns = new Map(introspectedTable.columns.map((c) => [c.name, c]));
  const declaredColumnNames = new Set(Object.keys(snapshotTable.columns));

  for (const columnName of introspectedColumns.keys()) {
    if (!declaredColumnNames.has(columnName)) {
      findings.push({
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' exists in the live store but not in the declared shape.`,
      });
    }
  }

  for (const [columnName, declaredColumn] of Object.entries(snapshotTable.columns)) {
    const introspectedColumn = introspectedColumns.get(columnName);
    if (!introspectedColumn) {
      findings.push({
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' is declared but does not exist in the live store.`,
      });
      continue;
    }
    if (introspectedColumn.type.toLowerCase() !== declaredColumn.type.toLowerCase()) {
      findings.push({
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' type mismatch: live '${introspectedColumn.type}' vs declared '${declaredColumn.type}'.`,
      });
    }
    if (introspectedColumn.notNull !== declaredColumn.notNull) {
      findings.push({
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' NOT NULL mismatch: live ${introspectedColumn.notNull} vs declared ${declaredColumn.notNull}.`,
      });
    }
    if (introspectedColumn.primaryKey !== declaredColumn.primaryKey) {
      findings.push({
        table: tableName,
        column: columnName,
        detail: `Column '${tableName}.${columnName}' primary-key mismatch: live ${introspectedColumn.primaryKey} vs declared ${declaredColumn.primaryKey}.`,
      });
    }
  }
}

function compareIndexes(
  tableName: string,
  introspectedTable: IntrospectedTable,
  snapshotTable: SqliteSnapshot['tables'][string],
  findings: DeclaredShapeFinding[],
): void {
  const liveIndexes = introspectedTable.indexes.filter(
    (i) => !i.name.startsWith('sqlite_autoindex_'),
  );
  const liveByName = new Map(liveIndexes.map((i) => [i.name, i]));
  const declaredNames = new Set(Object.keys(snapshotTable.indexes));

  for (const indexName of liveByName.keys()) {
    if (!declaredNames.has(indexName)) {
      findings.push({
        table: tableName,
        detail: `Index '${indexName}' exists in the live store but not in the declared shape.`,
      });
    }
  }

  for (const [indexName, declaredIndex] of Object.entries(snapshotTable.indexes)) {
    const liveIndex = liveByName.get(indexName);
    if (!liveIndex) {
      findings.push({
        table: tableName,
        detail: `Index '${indexName}' is declared but does not exist in the live store.`,
      });
      continue;
    }
    if (liveIndex.isUnique !== declaredIndex.isUnique) {
      findings.push({
        table: tableName,
        detail: `Index '${indexName}' uniqueness mismatch: live ${liveIndex.isUnique} vs declared ${declaredIndex.isUnique}.`,
      });
    }
  }
}

function compareForeignKeys(
  tableName: string,
  introspectedTable: IntrospectedTable,
  snapshotTable: SqliteSnapshot['tables'][string],
  findings: DeclaredShapeFinding[],
): void {
  const key = (tableTo: string, columnsFrom: string[]) => `${tableTo}(${columnsFrom.join(',')})`;
  const liveKeys = new Set(introspectedTable.foreignKeys.map((fk) => key(fk.tableTo, fk.columnsFrom)));
  const declaredKeys = new Set(
    Object.values(snapshotTable.foreignKeys).map((fk) => key(fk.tableTo, fk.columnsFrom)),
  );

  for (const k of liveKeys) {
    if (!declaredKeys.has(k)) {
      findings.push({
        table: tableName,
        detail: `Foreign key to ${k} exists in the live store but not in the declared shape.`,
      });
    }
  }
  for (const k of declaredKeys) {
    if (!liveKeys.has(k)) {
      findings.push({
        table: tableName,
        detail: `Foreign key to ${k} is declared but does not exist in the live store.`,
      });
    }
  }
}
