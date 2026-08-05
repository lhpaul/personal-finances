import {
  attachEncryptedStatement,
  cipherVersionStatement,
  detachStatement,
  exportStatement,
  getUserVersionStatement,
  isValidRawKeyHex,
  keyPragma,
  quoteIdentifier,
  selectAllStatement,
  setUserVersionStatement,
  tableInfoStatement,
  userTableCountStatement,
} from '../statements';

/**
 * Asserts the exact text of every statement builder (implementation plan Decision 10) — a typo
 * here fails in Node, in milliseconds, even though the statement's *effect* (does SQLCipher
 * accept it) cannot be observed outside a device.
 */

const VALID_KEY = 'a'.repeat(64);

describe('isValidRawKeyHex', () => {
  it('accepts exactly 64 lowercase hex characters', () => {
    expect(isValidRawKeyHex(VALID_KEY)).toBe(true);
    expect(isValidRawKeyHex('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('rejects uppercase', () => {
    expect(isValidRawKeyHex('A'.repeat(64))).toBe(false);
  });

  it('rejects 63 characters', () => {
    expect(isValidRawKeyHex('a'.repeat(63))).toBe(false);
  });

  it('rejects 65 characters', () => {
    expect(isValidRawKeyHex('a'.repeat(65))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidRawKeyHex('g'.repeat(64))).toBe(false);
  });

  it('rejects a key with an embedded quote', () => {
    expect(isValidRawKeyHex(`${'a'.repeat(31)}'${'a'.repeat(32)}`)).toBe(false);
  });
});

describe('keyPragma', () => {
  it('produces the exact quoted-hex PRAGMA text', () => {
    expect(keyPragma(VALID_KEY)).toBe(`PRAGMA key = "x'${VALID_KEY}'";`);
  });

  it('throws rather than interpolate an invalid key (R7)', () => {
    expect(() => keyPragma('not-hex')).toThrow(/not 64 lowercase hex/);
    expect(() => keyPragma(`${VALID_KEY.slice(0, 63)}'`)).toThrow(/not 64 lowercase hex/);
  });
});

describe('attachEncryptedStatement', () => {
  it('produces the exact ATTACH text', () => {
    expect(attachEncryptedStatement('encrypted', '/tmp/finanzas.enc.db', VALID_KEY)).toBe(
      `ATTACH DATABASE '/tmp/finanzas.enc.db' AS encrypted KEY "x'${VALID_KEY}'";`,
    );
  });

  it('escapes an embedded single quote in the path', () => {
    expect(attachEncryptedStatement('encrypted', "/tmp/o'brien/finanzas.enc.db", VALID_KEY)).toBe(
      `ATTACH DATABASE '/tmp/o''brien/finanzas.enc.db' AS encrypted KEY "x'${VALID_KEY}'";`,
    );
  });

  it('throws on an invalid key', () => {
    expect(() => attachEncryptedStatement('encrypted', '/tmp/x.db', 'bad')).toThrow();
  });

  it('throws on an unsafe alias', () => {
    expect(() => attachEncryptedStatement('bad alias', '/tmp/x.db', VALID_KEY)).toThrow(/safe identifier/);
  });
});

describe('exportStatement / detachStatement', () => {
  it('produces the exact sqlcipher_export call', () => {
    expect(exportStatement('encrypted')).toBe("SELECT sqlcipher_export('encrypted');");
  });

  it('produces the exact DETACH text', () => {
    expect(detachStatement('encrypted')).toBe('DETACH DATABASE encrypted;');
  });

  it('both reject an unsafe alias', () => {
    expect(() => exportStatement('a;b')).toThrow(/safe identifier/);
    expect(() => detachStatement('a;b')).toThrow(/safe identifier/);
  });
});

describe('cipherVersionStatement', () => {
  it('produces the exact PRAGMA text', () => {
    expect(cipherVersionStatement()).toBe('PRAGMA cipher_version;');
  });
});

describe('quoteIdentifier', () => {
  it('wraps a plain identifier in double quotes', () => {
    expect(quoteIdentifier('transactions')).toBe('"transactions"');
  });

  it('doubles an embedded double quote', () => {
    expect(quoteIdentifier('weird"name')).toBe('"weird""name"');
  });
});

describe('userTableCountStatement', () => {
  it('with no schema, queries the default schema', () => {
    expect(userTableCountStatement()).toBe(
      "SELECT count(*) AS n FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
    );
  });

  it('with a schema, qualifies sqlite_schema', () => {
    expect(userTableCountStatement('encrypted')).toBe(
      "SELECT count(*) AS n FROM encrypted.sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
    );
  });
});

describe('tableInfoStatement', () => {
  it('quotes the table name and omits the schema prefix when absent', () => {
    expect(tableInfoStatement('transactions')).toBe('PRAGMA table_info("transactions");');
  });

  it('qualifies with the schema when present', () => {
    expect(tableInfoStatement('transactions', 'encrypted')).toBe(
      'PRAGMA encrypted.table_info("transactions");',
    );
  });
});

describe('selectAllStatement', () => {
  it('quotes the table name, no WHERE clause', () => {
    expect(selectAllStatement('app_settings')).toBe('SELECT * FROM "app_settings";');
  });

  it('qualifies with the schema when present', () => {
    expect(selectAllStatement('app_settings', 'encrypted')).toBe(
      'SELECT * FROM encrypted."app_settings";',
    );
  });
});

describe('getUserVersionStatement / setUserVersionStatement', () => {
  it('reads the default schema by default', () => {
    expect(getUserVersionStatement()).toBe('PRAGMA user_version;');
  });

  it('reads a qualified schema', () => {
    expect(getUserVersionStatement('encrypted')).toBe('PRAGMA encrypted.user_version;');
  });

  it('writes an integer literal, qualified', () => {
    expect(setUserVersionStatement(3, 'encrypted')).toBe('PRAGMA encrypted.user_version = 3;');
  });

  it('writes zero on the default schema', () => {
    expect(setUserVersionStatement(0)).toBe('PRAGMA user_version = 0;');
  });

  it('throws on a non-integer version', () => {
    expect(() => setUserVersionStatement(1.5)).toThrow(/non-negative integer/);
  });

  it('throws on a negative version', () => {
    expect(() => setUserVersionStatement(-1)).toThrow(/non-negative integer/);
  });
});
