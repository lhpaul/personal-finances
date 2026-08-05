/**
 * Every SQL statement text this feature emits lives here, as pure functions (implementation plan
 * Decision 10) — both the Expo adapter (`client.ts`) and `statement-contract.test.ts` import them,
 * so a typo (`PRAGMA key = x'…'` missing the required quoting, a lost semicolon, a misspelled
 * `sqlcipher_export`) fails in Jest, in Node, in milliseconds, even though the statement's
 * *effect* cannot be observed there.
 *
 * `PRAGMA` does not accept bind parameters, so the key and every identifier below is
 * interpolated — which is exactly why every builder validates its input **before** any string is
 * built. The raw key is machine-generated (`key.ts`, from `expo-crypto`'s `getRandomBytesAsync`);
 * every identifier here is either a module constant (`EXPORT_ALIAS`) or a mechanically-retrieved
 * name (a `DUMP_TABLE_ORDER` table, a `PRAGMA table_info` column) — never user input.
 */

const RAW_KEY_HEX = /^[0-9a-f]{64}$/;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidRawKeyHex(candidate: string): boolean {
  return RAW_KEY_HEX.test(candidate);
}

function assertRawKeyHex(keyHex: string): void {
  if (!isValidRawKeyHex(keyHex)) {
    throw new Error(
      'Refusing to build a PRAGMA key statement: the key is not 64 lowercase hex characters.',
    );
  }
}

/** Validates a bare SQL identifier (an alias or a schema name) — not a quoted `"…"` identifier,
 * because every caller here passes a fixed constant (`EXPORT_ALIAS`, `'main'`) that is always a
 * valid bare identifier by construction. Table and column names go through
 * {@link quoteIdentifier} instead, because they are read from the database at runtime and quoting
 * (not merely validating) is what makes an unusual-but-legitimate name (a leading digit-adjacent
 * word, a reserved word) safe. */
function assertSafeIdentifier(name: string, label: string): void {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Refusing to build a SQL statement: ${label} '${name}' is not a safe identifier.`);
  }
}

/** Double-quotes a SQL identifier, doubling any embedded `"` (the standard SQL escape) — used for
 * every table and column name, which are read from `PRAGMA table_info` / `DUMP_TABLE_ORDER`
 * rather than hand-typed, so quoting (not merely validating) is the correct guard. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** `PRAGMA key = "x'<keyHex>'"` — issued as the connection's first statement (V15). */
export function keyPragma(keyHex: string): string {
  assertRawKeyHex(keyHex);
  return `PRAGMA key = "x'${keyHex}'";`;
}

/** `ATTACH DATABASE '<path>' AS <alias> KEY "x'<keyHex>'"` (Decision 1, V13). `path` is escaped
 * as a SQL string literal (doubled `'`); it is a resolved filesystem path built by the adapter,
 * never user input. */
export function attachEncryptedStatement(alias: string, path: string, keyHex: string): string {
  assertSafeIdentifier(alias, 'alias');
  assertRawKeyHex(keyHex);
  const escapedPath = path.replace(/'/g, "''");
  return `ATTACH DATABASE '${escapedPath}' AS ${alias} KEY "x'${keyHex}'";`;
}

/** `SELECT sqlcipher_export('<alias>')` (Decision 1, V11, V12). */
export function exportStatement(alias: string): string {
  assertSafeIdentifier(alias, 'alias');
  return `SELECT sqlcipher_export('${alias}');`;
}

/** `DETACH DATABASE <alias>`. */
export function detachStatement(alias: string): string {
  assertSafeIdentifier(alias, 'alias');
  return `DETACH DATABASE ${alias};`;
}

/** `PRAGMA cipher_version` (Decision 8, V14). */
export function cipherVersionStatement(): string {
  return 'PRAGMA cipher_version;';
}

function schemaPrefix(schema: string | undefined): string {
  if (schema === undefined) return '';
  assertSafeIdentifier(schema, 'schema');
  return `${schema}.`;
}

/** `SELECT count(*) AS n FROM [<schema>.]sqlite_schema WHERE type = 'table' AND name NOT LIKE
 * 'sqlite_%'` (Decision 7). */
export function userTableCountStatement(schema?: string): string {
  return `SELECT count(*) AS n FROM ${schemaPrefix(schema)}sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`;
}

/** `PRAGMA [<schema>.]table_info(<table>)`. */
export function tableInfoStatement(table: string, schema?: string): string {
  return `PRAGMA ${schemaPrefix(schema)}table_info(${quoteIdentifier(table)});`;
}

/** `SELECT * FROM [<schema>.]<table>` — table/column identifiers only, no `WHERE`, no bind
 * parameters (the caller filters/orders in application code, mirroring `census.ts`'s use). */
export function selectAllStatement(table: string, schema?: string): string {
  return `SELECT * FROM ${schemaPrefix(schema)}${quoteIdentifier(table)};`;
}

/** `PRAGMA [<schema>.]user_version` (read side of Decision 1's `copyUserVersionTo`). */
export function getUserVersionStatement(schema?: string): string {
  return `PRAGMA ${schemaPrefix(schema)}user_version;`;
}

/** `PRAGMA [<schema>.]user_version = <version>` — `version` must already be a non-negative
 * integer (as `PRAGMA user_version` itself always reports); `PRAGMA` cannot bind it as a
 * parameter, so it is validated before interpolation exactly like every other value in this
 * file. */
export function setUserVersionStatement(version: number, schema?: string): string {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error('Refusing to build a PRAGMA user_version statement: version is not a non-negative integer.');
  }
  return `PRAGMA ${schemaPrefix(schema)}user_version = ${version};`;
}
