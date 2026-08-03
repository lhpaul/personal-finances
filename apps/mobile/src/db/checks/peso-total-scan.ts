/**
 * The peso-total guard is one condition, and this scanner proves it (implementation plan
 * Decision 15, issue #10; spec Business Rule 17, Deferral Note 3, AC22).
 *
 * Every total and chart in the MVP is a peso total; the inclusion rule that governs them
 * (`src/db/fragments.ts`'s `isIncluded` / `includedAmount`) counts a movement whenever it is not
 * excluded — it does not look at currency. A future aggregate that sums `includedAmount` without
 * also naming `isPesoDenominated` would silently add a foreign-currency movement into a peso
 * total. This scanner makes that mechanical: over comment-stripped source, it reports every file
 * whose `sql`-tagged template bodies (including nested `sql` tags, each its own occurrence)
 * apply `sum(` to `includedAmount`, unless that same file **also** names `isPesoDenominated`
 * somewhere in it.
 *
 * `count(${includedAmount})` and `avg(${includedAmount})` are not flagged — a count of a dollar
 * row is legitimate; only a *summation* can add a dollar's numeric value into a peso figure.
 *
 * Three files are allowlisted by `filePath` (hard-coded here, not read from source, so a source
 * file cannot add itself — the same reasoning `src/db/checks/inclusion-rule-scan.ts` states for
 * its own allowlist): `src/db/fragments.ts` (the definition), this file itself (its own rule
 * text necessarily contains the literal spellings this scanner is written to detect), and its own
 * test file (whose edge-case fixtures deliberately restate the pattern as scanner *input*, not
 * application code).
 *
 * **Suppression semantics: none.** This scanner recognises no inline suppression directive, for
 * the same reason `inclusion-rule-scan.ts` recognises none — a suppression comment is exactly the
 * mechanism by which a dollar would re-enter a peso total. The only escape is the hard-coded
 * allowlist, which is a reviewed code change.
 */

export interface PesoTotalScanFinding {
  filePath: string;
  line: number;
  detail: string;
}

const ALLOWLISTED_SUFFIXES = [
  'src/db/fragments.ts',
  'src/db/checks/peso-total-scan.ts',
  'src/db/checks/__tests__/peso-total-scan.test.ts',
];

function isAllowlisted(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return ALLOWLISTED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Strips `//` line comments and block comments, leaving string and template contents untouched
 * and preserving every newline so line numbers stay correct (identical approach to
 * `inclusion-rule-scan.ts`'s `stripComments`). */
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
  body: string;
  bodyStart: number;
}

// `sql` is frequently called with an explicit result-type argument in this codebase —
// `sql<number>\`coalesce(sum(${includedAmount}), 0)\`` is exactly the shape a real
// `totalForCategoryInPeriod`-style aggregate uses — so the tag-start pattern must recognise an
// optional simple (non-nested-`<>`) generic between `sql` and the opening backtick.
const SQL_TAG_START = /\bsql\s*(?:<[^`<>]*>)?\s*`/;

function findNextSqlTagBodyStart(source: string, from: number): number {
  const re = new RegExp(SQL_TAG_START, 'g');
  re.lastIndex = from;
  const match = re.exec(source);
  return match ? match.index + match[0].length : -1;
}

/** True when the text immediately preceding `backtickPos` (skipping whitespace, and skipping one
 * optional `<...>` generic argument such as `sql<number>`) is the exact word `sql`. */
function isPrecededBySqlKeyword(source: string, backtickPos: number): boolean {
  let j = backtickPos - 1;
  while (j >= 0 && /\s/.test(source[j] ?? '')) j -= 1;

  if (source[j] === '>') {
    let depth = 1;
    j -= 1;
    while (j >= 0 && depth > 0) {
      if (source[j] === '>') depth += 1;
      else if (source[j] === '<') depth -= 1;
      j -= 1;
    }
    while (j >= 0 && /\s/.test(source[j] ?? '')) j -= 1;
  }

  if (j < 2) return false;
  if (source.slice(j - 2, j + 1) !== 'sql') return false;
  const before = j - 3 >= 0 ? source[j - 3] : undefined;
  return before === undefined || !/[A-Za-z0-9_$]/.test(before);
}

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

const SUM_CALL_PATTERN = /\bsum\s*\(/gi;

/** Finds every `sum(...)` occurrence in `body` and reports the ones whose matching-paren span
 * contains `includedAmount` — tracking paren depth so `coalesce(sum(${includedAmount}), 0)`'s
 * nested call is still resolved to its own, correct closing paren. */
function findSumOfIncludedAmount(body: string, bodyStart: number, stripped: string): PesoTotalScanFinding[] {
  const findings: PesoTotalScanFinding[] = [];
  SUM_CALL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SUM_CALL_PATTERN.exec(body)) !== null) {
    const openParenIndex = match.index + match[0].length; // just past the '('
    let depth = 1;
    let i = openParenIndex;
    while (i < body.length && depth > 0) {
      if (body[i] === '(') depth += 1;
      else if (body[i] === ')') depth -= 1;
      i += 1;
    }
    const inner = body.slice(openParenIndex, i - 1);
    if (inner.includes('includedAmount')) {
      findings.push({
        filePath: '', // filled in by the caller
        line: lineAt(stripped, bodyStart + match.index),
        detail: `'${match[0]}…)' sums includedAmount without isPesoDenominated in the same file — use isPesoDenominated from src/db/fragments.ts.`,
      });
    }
    if (match[0].length === 0) SUM_CALL_PATTERN.lastIndex += 1;
  }

  return findings;
}

export function findUnguardedPesoTotals(source: string, filePath: string): PesoTotalScanFinding[] {
  if (isAllowlisted(filePath)) return [];

  const stripped = stripComments(source.replace(/\r\n/g, '\n'));

  // File-level guard: the same file naming isPesoDenominated anywhere clears every occurrence in
  // it (Decision 15's own scanner text — the guard is a file-level pairing, not per-occurrence).
  if (stripped.includes('isPesoDenominated')) return [];

  const findings: PesoTotalScanFinding[] = [];
  for (const { body, bodyStart } of extractSqlTagBodies(stripped)) {
    for (const finding of findSumOfIncludedAmount(body, bodyStart, stripped)) {
      findings.push({ ...finding, filePath });
    }
  }
  return findings;
}
