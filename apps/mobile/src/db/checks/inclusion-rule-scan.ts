/**
 * The inclusion rule is one file, and this scanner proves it (implementation plan Decision 9,
 * spec Business Rule 6, AC20). A pure function over TypeScript/TSX source text — no file system
 * — so `src/db/__tests__/inclusion-rule-single-definition.test.ts` can drive it over the real
 * tree and `src/db/checks/__tests__/inclusion-rule-scan.test.ts` can drive it over fixtures.
 *
 * Three rules, applied to comment-stripped source:
 *
 * - **A**: a `sql\`…\`` tagged-template body (including the contents of its `${…}`
 *   interpolations, and including nested `sql` tags, each scanned as their own occurrence)
 *   mentioning `excluded`, `included_amount` or `includedAmount`.
 * - **B**: `isNull(` or `isNotNull(` applied to any expression ending in `.excludedAt`.
 * - **C**: the snake_case literals `excluded_at` or `included_amount` anywhere in the file.
 *
 * Five files are allowlisted by `filePath` (hard-coded here, not read from source, so a source
 * file cannot add itself to it — Decision 8's "no suppression directive" applies to this scanner
 * too): `src/db/fragments.ts` (the definition), `src/db/schema.ts` (the column declaration),
 * this file itself (its own rule definitions necessarily contain the literal spellings this
 * scanner is written to detect), its own test file (whose edge-case fixtures deliberately
 * restate the rule as scanner *input*, not application code), and
 * `src/db/__tests__/schema.test.ts` — its AC28 table-and-column census asserts the expected
 * column set **written out longhand** (a design requirement of Testing Strategy scenario 28, so a
 * schema edit that diverges from the data model fails loudly rather than silently), which
 * necessarily lists `excluded_at` and `included_amount` as plain column-name strings. That is a
 * column *declaration*, the same class of statement `schema.ts` itself makes — not a restatement
 * of the rule's semantics (no `WHERE`, no `COALESCE`, no read of the column's value) — so it is
 * allowlisted for the same reason `schema.ts` is.
 */

export type InclusionRuleFindingRule = 'A' | 'B' | 'C';

export interface Finding {
  rule: InclusionRuleFindingRule;
  filePath: string;
  line: number;
  detail: string;
}

const ALLOWLISTED_SUFFIXES = [
  'src/db/fragments.ts',
  'src/db/schema.ts',
  'src/db/checks/inclusion-rule-scan.ts',
  'src/db/checks/__tests__/inclusion-rule-scan.test.ts',
  'src/db/__tests__/schema.test.ts',
];

function isAllowlisted(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWLISTED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Strips `//` line comments and block comments, leaving everything inside a string or template
 * literal untouched (so a URL or a comment-like sequence inside a string is never stripped) and
 * preserving every newline so line numbers stay correct. */
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

interface SqlTagBody {
  /** The tagged template's own body text, with any nested backtick-delimited template's span
   * replaced by same-length space filler so character offsets within `body` still map 1:1 onto
   * the original source (`bodyStart + offset`). */
  body: string;
  /** Absolute index in `source` of the character immediately after the opening backtick. */
  bodyStart: number;
}

const SQL_TAG_START = /\bsql\s*`/;

function findNextSqlTagBodyStart(source: string, from: number): number {
  const re = new RegExp(SQL_TAG_START, 'g');
  re.lastIndex = from;
  const match = re.exec(source);
  return match ? match.index + match[0].length : -1;
}

/** True when the identifier immediately preceding `backtickPos` (skipping whitespace) is the
 * exact word `sql`. Used to decide whether a nested template literal (found while scanning a
 * `${…}` interpolation) is itself an `sql`-tagged occurrence worth reporting on its own, or an
 * unrelated (possibly untagged, possibly differently-tagged) template that must still be skipped
 * correctly but never counted. */
function isPrecededBySqlKeyword(source: string, backtickPos: number): boolean {
  let j = backtickPos - 1;
  while (j >= 0 && /\s/.test(source[j] ?? '')) j -= 1;
  if (j < 2) return false;
  if (source.slice(j - 2, j + 1) !== 'sql') return false;
  const before = j - 3 >= 0 ? source[j - 3] : undefined;
  return before === undefined || !/[A-Za-z0-9_$]/.test(before);
}

/** Scans a template literal's contents starting right after its opening backtick, returning its
 * own body text and the index right after the matching closing backtick. Any nested `sql`-tagged
 * template discovered along the way (inside a `${…}`) is pushed to `results` directly, keeping
 * discovery a single pass with no post-hoc reconstruction. */
function scanTemplateBody(
  source: string,
  bodyStart: number,
  results: SqlTagBody[],
): { body: string; endIndex: number } {
  let i = bodyStart;
  let body = '';
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (ch === '\\') {
      body += ch + (source[i + 1] ?? '');
      i += 2;
      continue;
    }

    if (ch === '`') {
      return { body, endIndex: i + 1 };
    }

    if (ch === '$' && source[i + 1] === '{') {
      const expr = scanExpression(source, i + 2, results);
      body += expr.text;
      i = expr.endIndex;
      continue;
    }

    body += ch;
    i += 1;
  }

  return { body, endIndex: n };
}

/** Scans a `${…}` interpolation starting right after `${`, tracking brace depth and skipping
 * plain string literals, until the matching `}`. A nested backtick starts another template
 * literal; it is fully scanned (recursively, so arbitrarily deep nesting resolves correctly), and
 * if it is itself `sql`-tagged it is pushed to `results` there and then. Either way its whole
 * span is excised from this expression's own text (replaced with same-length filler) so the
 * enclosing body's keyword search never sees a nested occurrence's text twice. */
function scanExpression(
  source: string,
  start: number,
  results: SqlTagBody[],
): { text: string; endIndex: number } {
  let i = start;
  let depth = 1;
  let text = '';
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    if (ch === '\\') {
      text += ch + (source[i + 1] ?? '');
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let literal = ch;
      while (j < n && source[j] !== quote) {
        if (source[j] === '\\') {
          literal += (source[j] ?? '') + (source[j + 1] ?? '');
          j += 2;
          continue;
        }
        literal += source[j] ?? '';
        j += 1;
      }
      literal += source[j] ?? '';
      text += literal;
      i = j + 1;
      continue;
    }

    if (ch === '`') {
      const isSqlTag = isPrecededBySqlKeyword(source, i);
      const nested = scanTemplateBody(source, i + 1, results);
      if (isSqlTag) results.push({ body: nested.body, bodyStart: i + 1 });
      text += ' '.repeat(nested.endIndex - i);
      i = nested.endIndex;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      text += ch;
      i += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      i += 1;
      if (depth === 0) return { text, endIndex: i };
      text += ch;
      continue;
    }

    text += ch;
    i += 1;
  }

  return { text, endIndex: n };
}

function extractSqlTagBodies(source: string): SqlTagBody[] {
  const results: SqlTagBody[] = [];
  let i = 0;

  while (i < source.length) {
    const bodyStart = findNextSqlTagBodyStart(source, i);
    if (bodyStart === -1) break;
    const { body, endIndex } = scanTemplateBody(source, bodyStart, results);
    results.push({ body, bodyStart });
    i = endIndex;
  }

  return results.sort((a, b) => a.bodyStart - b.bodyStart);
}

const RULE_A_PATTERNS = [/excluded/gi, /included_amount/gi, /includedAmount/g];
const RULE_B_PATTERN = /\b(?:isNull|isNotNull)\s*\([^()]*?\.excludedAt\s*\)/g;
const RULE_C_PATTERNS = [/excluded_at/gi, /included_amount/gi];

export function findInclusionRuleRestatements(source: string, filePath: string): Finding[] {
  if (isAllowlisted(filePath)) return [];

  const stripped = stripComments(source.replace(/\r\n/g, '\n'));
  const findings: Finding[] = [];

  for (const { body, bodyStart } of extractSqlTagBodies(stripped)) {
    for (const pattern of RULE_A_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        findings.push({
          rule: 'A',
          filePath,
          line: lineAt(stripped, bodyStart + match.index),
          detail: `sql-tagged template body restates the inclusion rule ('${match[0]}') — use isIncluded / includedAmount from src/db/fragments.ts instead.`,
        });
        if (match[0].length === 0) pattern.lastIndex += 1;
      }
    }
  }

  RULE_B_PATTERN.lastIndex = 0;
  let matchB: RegExpExecArray | null;
  while ((matchB = RULE_B_PATTERN.exec(stripped)) !== null) {
    findings.push({
      rule: 'B',
      filePath,
      line: lineAt(stripped, matchB.index),
      detail: `'${matchB[0]}' restates the inclusion rule's exclusion check — use isIncluded from src/db/fragments.ts instead.`,
    });
  }

  for (const pattern of RULE_C_PATTERNS) {
    pattern.lastIndex = 0;
    let matchC: RegExpExecArray | null;
    while ((matchC = pattern.exec(stripped)) !== null) {
      findings.push({
        rule: 'C',
        filePath,
        line: lineAt(stripped, matchC.index),
        detail: `Literal '${matchC[0]}' restates a column the inclusion rule owns — read through isIncluded / includedAmount from src/db/fragments.ts instead.`,
      });
    }
  }

  return findings;
}
