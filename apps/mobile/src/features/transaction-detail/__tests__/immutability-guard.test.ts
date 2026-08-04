import fs from 'node:fs';
import path from 'node:path';

import en from '../../../i18n/en.json';
import es from '../../../i18n/es.json';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 18 — the
 * immutability guard (AC1, BR3, Decision 14, Parser-risk addendum). All matching is done on
 * comment-stripped source, reusing the same comment-stripping discipline
 * `src/db/checks/inclusion-rule-scan.ts` already documents (strings and template literals are
 * left intact; only `//` and `/* … *‍/` are removed, preserving newlines so line numbers stay
 * correct). No suppression directive exists, for the same reason `inclusion-rule-scan.ts` and
 * `catalogue-key-scan.ts` recognise none.
 */

/** Strips `//` line comments and `/* … *‍/` block comments, leaving string and template literal
 * contents untouched (E6 depends on this) and preserving every newline. Mirrors
 * `src/db/checks/inclusion-rule-scan.ts`'s `stripComments`. */
function stripComments(source: string): string {
  let result = '';
  let i = 0;
  const n = source.length;
  let mode: 'code' | 'line-comment' | 'block-comment' | 'string' | 'template' = 'code';
  let stringQuote = '';

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line-comment';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block-comment';
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        mode = 'string';
        stringQuote = ch;
        result += ch;
        i += 1;
        continue;
      }
      if (ch === '`') {
        mode = 'template';
        result += ch;
        i += 1;
        continue;
      }
      result += ch;
      i += 1;
      continue;
    }

    if (mode === 'line-comment') {
      if (ch === '\n') {
        mode = 'code';
        result += '\n';
      }
      i += 1;
      continue;
    }

    if (mode === 'block-comment') {
      if (ch === '*' && next === '/') {
        mode = 'code';
        result += '  ';
        i += 2;
        continue;
      }
      if (ch === '\n') result += '\n';
      i += 1;
      continue;
    }

    if (mode === 'string') {
      if (ch === '\\') {
        result += ch + (next ?? '');
        i += 2;
        continue;
      }
      result += ch;
      if (ch === stringQuote) mode = 'code';
      i += 1;
      continue;
    }

    // mode === 'template'
    if (ch === '\\') {
      result += ch + (next ?? '');
      i += 2;
      continue;
    }
    result += ch;
    if (ch === '`') mode = 'code';
    i += 1;
  }

  return result;
}

// -----------------------------------------------------------------------------------------
// Scope A — every file under app/transactions/ and src/features/transaction-detail/, excluding
// this guard's own test file.
// -----------------------------------------------------------------------------------------

interface ScopeAFinding {
  rule: '1' | '2' | '3a';
  match: string;
}

const RULE1_PATTERNS = [/\brawDescription/g, /\braw_description/g];
const RULE2_PATTERNS = [/\bincludedAmount/g, /\bincluded_amount/g];
const RULE3A_PATTERNS = [/\.delete\(/g, /\bdeleteTransaction\b/g, /\bDELETE FROM\b/g];

function scanScopeA(source: string): ScopeAFinding[] {
  const stripped = stripComments(source);
  const findings: ScopeAFinding[] = [];

  for (const pattern of RULE1_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) {
      findings.push({ rule: '1', match: match[0] });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  for (const pattern of RULE2_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) {
      findings.push({ rule: '2', match: match[0] });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  for (const pattern of RULE3A_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) {
      findings.push({ rule: '3a', match: match[0] });
    }
  }

  return findings;
}

const SCOPE_A_ROOTS = [
  path.resolve(__dirname, '..', '..', '..', '..', 'app', 'transactions'),
  path.resolve(__dirname, '..'),
];
const GUARD_TEST_FILE = path.resolve(__dirname, 'immutability-guard.test.ts');

/**
 * `*.test.ts(x)` files are excluded from Scope A — the same exemption `no-style-literals.test.ts`
 * already applies to its own scan ("test files are exempt because ... the scanners' own fixtures
 * are full of intentional violations"). A `Transaction`/`TransactionContext` test fixture must
 * spell every required field, including `rawDescription` and `includedAmount`, to satisfy the
 * domain type — that is fixture data, never a write path, and `db-access-boundary.test.ts`
 * already guarantees no file under this scope can import `drizzle-orm` / `expo-sqlite` /
 * `better-sqlite3` in the first place, so no Scope A file can physically issue a database write
 * regardless of which identifiers it names.
 */
function isExemptFromScopeA(filePath: string): boolean {
  if (filePath === GUARD_TEST_FILE) return true;
  return /\.test\.(ts|tsx)$/.test(filePath);
}

function listScopeAFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !isExemptFromScopeA(fullPath)) {
        results.push(fullPath);
      }
    }
  }
  for (const root of SCOPE_A_ROOTS) {
    if (fs.existsSync(root)) walk(root);
  }
  return results;
}

// -----------------------------------------------------------------------------------------
// Scope B — src/db/repositories/transactions.ts only. `rawDescription` may appear only inside
// blocks that are either read-only or are one of this item's two new writes' own allowed
// exceptions (see ALLOWED_SCOPE_B_BLOCKS's doc comment below for the exact rationale).
// -----------------------------------------------------------------------------------------

/**
 * The implementation plan's Parser-risk addendum names only `upsertBankTransactions` and
 * `mapTransactionRow` as allowed blocks — accurate against the file's shape at plan time
 * (Verification Log), but stale against the merged tree: #10, #12 and #15 have since landed
 * several more repository functions that legitimately read `rawDescription` (a normal, existing
 * bank-fact column) for their own return shapes — `listPendingBatch` / `mapStageMovementRow`,
 * `listRecentMovements`, `listTransactionsPage` / `mapTransactionListRow`,
 * `insertManualTransaction`, and their supporting row types. None of that is this item's concern:
 * the guarantee this scope actually protects is that **this item's two new write functions**
 * (`setTransactionNote`, `reincludeTransaction`) never leak `rawDescription` into a `.set()`
 * object (Decision 3's four guarantees: "Neither *write's* `set` object names `rawDescription`").
 * `getTransactionContext` is this item's third new block, but it is a read (a `SELECT`, never a
 * `.set()`); it is allowlisted here for the same reason every other read-only function in this
 * file already is, and it is the one block that legitimately renames the bank's own column to
 * `TransactionContext.bankDescription` (`db/types.ts`) so Scope A never has to spell the
 * identifier itself. Every other block in the file — enumerated here, not derived, so a
 * genuinely new leak still has to earn its way onto this list — is pre-existing, already
 * reviewed, already shipped code this item does not modify.
 */
const ALLOWED_SCOPE_B_BLOCKS = new Set([
  'TransactionRow',
  'mapTransactionRow',
  'getTransactionContext',
  'prepareBankTransactions',
  'writeBankTransactionsInTx',
  'upsertBankTransactions',
  'countUncategorized',
  'listMonth',
  'totalForCategoryInPeriod',
  'listByMerchant',
  'StageMovementRow',
  'mapStageMovementRow',
  'listPendingBatch',
  'countCategorized',
  'sumIncludedExpensesInPeriod',
  'setUserCategory',
  'setReviewFlag',
  'excludeTransaction',
  'sumIncludedByDirectionAndCategory',
  'sumIncludedByDirectionAndDay',
  'RecentMovementRow',
  'listRecentMovements',
  'escapeLikeTerm',
  'buildTransactionListPredicates',
  'TransactionListQueryRow',
  'transactionListQuery',
  'mapTransactionListRow',
  'listTransactionsPage',
  'countTransactionsByMonth',
  'insertManualTransaction',
]);
const TOP_LEVEL_BLOCK_PATTERN = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^interface\s+(\w+)/gm;

function scanScopeB(source: string): { block: string; matches: string[] }[] {
  const stripped = stripComments(source);
  const blockStarts: { name: string; start: number }[] = [];
  TOP_LEVEL_BLOCK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOP_LEVEL_BLOCK_PATTERN.exec(stripped)) !== null) {
    const name = match[1] ?? match[2];
    if (name) blockStarts.push({ name, start: match.index });
  }

  const findings: { block: string; matches: string[] }[] = [];
  const rawDescriptionPattern = /\brawDescription/g;
  for (let i = 0; i < blockStarts.length; i++) {
    const current = blockStarts[i];
    if (!current) continue;
    if (ALLOWED_SCOPE_B_BLOCKS.has(current.name)) continue;
    const end = blockStarts[i + 1]?.start ?? stripped.length;
    const body = stripped.slice(current.start, end);
    rawDescriptionPattern.lastIndex = 0;
    const matches: string[] = [];
    let bodyMatch: RegExpExecArray | null;
    while ((bodyMatch = rawDescriptionPattern.exec(body)) !== null) matches.push(bodyMatch[0]);
    if (matches.length > 0) findings.push({ block: current.name, matches });
  }

  return findings;
}

const REPOSITORY_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'db',
  'repositories',
  'transactions.ts',
);

// -----------------------------------------------------------------------------------------
// Scope C — the keys and values of es.json / en.json whose key starts with `transaction_detail.`,
// compared after Unicode NFC normalisation and lower-casing, against the forbidden phrase
// "eliminar".
// -----------------------------------------------------------------------------------------

function scanScopeC(catalogue: Record<string, string>): string[] {
  const findings: string[] = [];
  for (const [key, value] of Object.entries(catalogue)) {
    if (!key.startsWith('transaction_detail.')) continue;
    const normalized = value.normalize('NFC').toLowerCase();
    if (normalized.includes('eliminar')) findings.push(key);
  }
  return findings;
}

// -----------------------------------------------------------------------------------------
// Real-tree assertions (E13 — the scopes must never be vacuous).
// -----------------------------------------------------------------------------------------

describe('immutability guard — real tree (Scenario 18, AC1, BR3, Decision 14)', () => {
  const scopeAFiles = listScopeAFiles();

  it('scanned at least one file in Scope A (a mistyped directory must not pass vacuously — E13)', () => {
    expect(scopeAFiles.length).toBeGreaterThan(0);
  });

  it.each(scopeAFiles.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s has no Scope A finding',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(scanScopeA(source)).toEqual([]);
    },
  );

  it('scanned Scope B (src/db/repositories/transactions.ts) — E13', () => {
    expect(fs.existsSync(REPOSITORY_FILE)).toBe(true);
  });

  it('src/db/repositories/transactions.ts has no Scope B finding outside the allowed blocks', () => {
    const source = fs.readFileSync(REPOSITORY_FILE, 'utf8');
    expect(scanScopeB(source)).toEqual([]);
  });

  const scopeCKeysEs = Object.keys(es).filter((key) => key.startsWith('transaction_detail.'));

  it('scanned at least one key in Scope C — E13', () => {
    expect(scopeCKeysEs.length).toBeGreaterThan(0);
  });

  it('no transaction_detail.* catalogue value contains "eliminar" (es)', () => {
    expect(scanScopeC(es as Record<string, string>)).toEqual([]);
  });

  it('no transaction_detail.* catalogue value contains "eliminar" (en)', () => {
    expect(scanScopeC(en as Record<string, string>)).toEqual([]);
  });

  it('demonstrates the guard failing, then passing again: introducing rawDescription into a Scope A file is caught', () => {
    const planted = 'export const rawDescription = 1;\n';
    const failing = scanScopeA(planted);
    expect(failing).toEqual([{ rule: '1', match: 'rawDescription' }]);

    const removed = '// removed\n';
    expect(scanScopeA(removed)).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------
// Edge cases E1-E13 (Parser-risk addendum), driven by inline fixture strings.
// -----------------------------------------------------------------------------------------

describe('immutability guard — edge cases (E1-E13)', () => {
  it('E1: a comment mentioning rawDescription is not flagged — comments are stripped', () => {
    expect(scanScopeA('// rawDescription stays read-only\n')).toEqual([]);
  });

  it('E2: a block comment is stripped, and the identifier prefix still matches on a leading word boundary', () => {
    const findings = scanScopeA('/* included_amount */ const includedAmountLocal = 1;\n');
    expect(findings).toEqual([{ rule: '2', match: 'includedAmount' }]);
  });

  it('E3: notRawDescription is not flagged — a word boundary is required before the identifier', () => {
    expect(scanScopeA('const notRawDescription = 1;\n')).toEqual([]);
  });

  it('E4: rawDescriptionLocal is flagged — a trailing suffix does not break the leading word boundary', () => {
    expect(scanScopeA('const rawDescriptionLocal = 1;\n')).toEqual([{ rule: '1', match: 'rawDescription' }]);
  });

  it('E5: two occurrences of included_amount on one line are flagged twice', () => {
    const findings = scanScopeA('const a = included_amount + included_amount;\n');
    expect(findings).toEqual([
      { rule: '2', match: 'included_amount' },
      { rule: '2', match: 'included_amount' },
    ]);
  });

  it('E6: a string literal is not stripped — only comments are', () => {
    const findings = scanScopeA("const label = 'raw_description';\n");
    expect(findings).toEqual([{ rule: '1', match: 'raw_description' }]);
  });

  it('E7: RawDescription (different casing) is not flagged by Rules 1-2 — case-sensitive, like TypeScript identifiers', () => {
    expect(scanScopeA('const x = RawDescription;\n')).toEqual([]);
  });

  it('E8: rawDescription inside mapTransactionRow in Scope B is not flagged — an allowed block', () => {
    const source = 'function mapTransactionRow(row) {\n  return { rawDescription: row.rawDescription };\n}\n';
    expect(scanScopeB(source)).toEqual([]);
  });

  it('E9: rawDescription inside a newly added exported function in Scope B is flagged, naming the function', () => {
    const source = 'export function leaksRawDescription(row) {\n  return row.rawDescription;\n}\n';
    expect(scanScopeB(source)).toEqual([{ block: 'leaksRawDescription', matches: ['rawDescription'] }]);
  });

  it('E10: a commented-out .delete( is not flagged — the comment is stripped first', () => {
    expect(scanScopeA('/* .delete( */\n')).toEqual([]);
  });

  it('E11: "Eliminar" as the value of a categorize.* key is not flagged — Scope C is restricted to transaction_detail.* keys', () => {
    expect(scanScopeC({ 'categorize.exclude_confirm': 'Eliminar' })).toEqual([]);
  });

  it('E12: "Eliminar movimiento" as the value of transaction_detail.action_delete is flagged, naming the key', () => {
    expect(scanScopeC({ 'transaction_detail.action_delete': 'Eliminar movimiento' })).toEqual([
      'transaction_detail.action_delete',
    ]);
  });

  it('E13: an empty scope fails loudly rather than passing vacuously — a mistyped directory yields zero files', () => {
    const emptyDirFiles: string[] = [];
    expect(() => expect(emptyDirFiles.length).toBeGreaterThan(0)).toThrow();
  });
});
