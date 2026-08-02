/**
 * Types for a parsed `drizzle/meta/*_snapshot.json` (drizzle-kit's sqlite dialect), verified
 * against the real generated snapshot at `drizzle/meta/0000_snapshot.json` (implementation
 * plan's Verification Log). Shared by `additivity.ts` and `declared-shape.ts` — both are pure
 * functions over this shape, with no file system access of their own (Decision 6: all
 * file-system access for the checks lives in `apps/mobile/scripts/db/check.ts`).
 */

export interface SnapshotColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  autoincrement?: boolean;
  default?: unknown;
  onUpdate?: boolean;
  generated?: unknown;
}

export interface SnapshotIndex {
  name: string;
  columns: string[];
  isUnique: boolean;
  where?: string;
}

export interface SnapshotForeignKey {
  name: string;
  tableFrom: string;
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface SnapshotUniqueConstraint {
  name: string;
  columns: string[];
}

export interface SnapshotCheckConstraint {
  name: string;
  value: string;
}

export interface SnapshotTable {
  name: string;
  columns: Record<string, SnapshotColumn>;
  indexes: Record<string, SnapshotIndex>;
  foreignKeys: Record<string, SnapshotForeignKey>;
  compositePrimaryKeys: Record<string, unknown>;
  uniqueConstraints: Record<string, SnapshotUniqueConstraint>;
  checkConstraints: Record<string, SnapshotCheckConstraint>;
}

export interface SqliteSnapshot {
  version: string;
  dialect: string;
  tables: Record<string, SnapshotTable>;
}
