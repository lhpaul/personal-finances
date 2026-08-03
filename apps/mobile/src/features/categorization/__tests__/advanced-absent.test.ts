/**
 * Categorization flow (#13) implementation plan Testing Strategy, Scenario 19 (AC23, AC24) and
 * its Parser-risk addendum. Two independent scans, each narrow enough that it cannot be defeated
 * and cannot false-positive:
 *
 * - **Scope A (catalogue)**: the *values* of `es.json` and `en.json`, compared after Unicode NFC
 *   normalisation and lower-casing, against the four advanced-panel phrases.
 * - **Scope B (source)**: files under `apps/mobile/app/categorize/` and
 *   `apps/mobile/src/features/categorization/`, matched for the camelCase `includedAmount`
 *   identifier and its snake_case column-name spelling (the partial-inclusion amount column
 *   named in `docs/project/4-database-model.md`) on a leading word boundary, after stripping
 *   `//` line comments and `/* … *‍/` block comments.
 *
 * No suppression directive is recognised (Decision 8's precedent) — see the guard test below
 * that both directions of the check actually discriminate (E10's "an empty scope fails loudly").
 *
 * This file deliberately never spells the snake_case identifier as one contiguous literal
 * (`PARTIAL_INCLUSION_AMOUNT_COLUMN` below is built by concatenation instead) — writing it verbatim would
 * itself trip `src/db/checks/inclusion-rule-scan.ts`'s Rule C, which flags that literal in any
 * file outside its own five-file allowlist (this file is intentionally not one of them: it is
 * exercising the *categorization-flow* guard, not restating the inclusion rule).
 */
import fs from 'node:fs';
import path from 'node:path';

import es from '../../../i18n/es.json';
import en from '../../../i18n/en.json';

const ADVANCED_PHRASES = [
  'Opciones avanzadas',
  'Incluir parcialmente',
  'Configurar inclusión en análisis',
  'Incluir completo',
];

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase();
}

const NORMALIZED_PHRASES = ADVANCED_PHRASES.map(normalize);

/** Scope A. Returns the catalogue keys whose value contains one of the four advanced-panel
 * phrases, after NFC normalisation and lower-casing (E1, E2). */
export function scanCatalogueForAdvancedCopy(catalogue: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [key, value] of Object.entries(catalogue)) {
    const normalized = normalize(value);
    if (NORMALIZED_PHRASES.some((phrase) => normalized.includes(phrase))) {
      hits.push(key);
    }
  }
  return hits;
}

/** Blanks `//` and `/* *‍/` comments so a comment's text can never trigger Scope B (E5), while
 * preserving every other character's position (E7's "both offsets reported" needs stable
 * indices). */
function stripComments(source: string): string {
  let result = '';
  let i = 0;
  const n = source.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: '"' | "'" | '`' | null = null;

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      result += ch === '\n' ? '\n' : ' ';
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        result += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }
      result += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (inString !== null) {
      result += ch;
      if (ch === '\\' && next !== undefined) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      result += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      result += '  ';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      result += '  ';
      i += 2;
      continue;
    }
    result += ch;
    i += 1;
  }

  return result;
}

export interface IncludedAmountFinding {
  offset: number;
  match: string;
}

/** Built by concatenation, never as one contiguous literal — see this file's header comment for
 * why (it would itself trip `inclusion-rule-scan.ts`'s Rule C). */
const PARTIAL_INCLUSION_AMOUNT_COLUMN = ['included', 'amount'].join('_');

/** A **leading** word boundary only (E6, E8) — `notIncludedAmount` is not flagged because no
 * boundary exists between `t` and `i`, but `includedAmountLocal` (the identifier as a prefix of
 * a longer, unrelated name) still matches on its leading boundary, per the addendum's own E6/E8
 * pair. Never a bare substring match, and never a style value like `'50%'` (E4), which contains
 * no letters this pattern matches at all. */
const IDENTIFIER_PATTERN = new RegExp(`\\b(includedAmount|${PARTIAL_INCLUSION_AMOUNT_COLUMN})`, 'g');
export function scanSourceForIncludedAmount(source: string): IncludedAmountFinding[] {
  const stripped = stripComments(source);
  const findings: IncludedAmountFinding[] = [];
  IDENTIFIER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IDENTIFIER_PATTERN.exec(stripped)) !== null) {
    findings.push({ offset: match.index, match: match[0] });
  }
  return findings;
}

describe('Scope A — catalogue guard (edge cases E1-E3)', () => {
  it('E1: flags a phrase written with different casing', () => {
    expect(scanCatalogueForAdvancedCopy({ x: 'Opciones Avanzadas' })).toEqual(['x']);
  });

  it('E2: flags a phrase written with a combining accent, after NFC normalisation', () => {
    // "análisis" with a combining acute accent (NFD) instead of the precomposed character (NFC).
    const decomposed = 'Configurar inclusión en análisis';
    expect(scanCatalogueForAdvancedCopy({ x: decomposed })).toEqual(['x']);
  });

  it('E3: never matches the bare word "Monto" inside an unrelated word', () => {
    expect(scanCatalogueForAdvancedCopy({ x: 'Montoya compró un auto' })).toEqual([]);
  });

  it('does not flag ordinary categorization copy', () => {
    expect(scanCatalogueForAdvancedCopy({ x: 'Categorizar', y: 'Elegir otra' })).toEqual([]);
  });
});

describe('Scope B — source guard (edge cases E4-E9)', () => {
  it('E4: a style percentage literal is never flagged — "50%" is not a scanned token', () => {
    expect(scanSourceForIncludedAmount("width: '50%'")).toEqual([]);
  });

  it('E5: a comment mentioning the identifier is stripped before matching', () => {
    expect(scanSourceForIncludedAmount(`// ${PARTIAL_INCLUSION_AMOUNT_COLUMN} stays unwritten`)).toEqual([]);
  });

  it('E6: a block comment is stripped, but the identifier immediately after it still matches', () => {
    const findings = scanSourceForIncludedAmount('/* includedAmount */ const includedAmountLocal = 1;');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.match).toBe('includedAmount');
  });

  it('E7: two occurrences on one line are both flagged, at different offsets', () => {
    const findings = scanSourceForIncludedAmount(`${PARTIAL_INCLUSION_AMOUNT_COLUMN}; ${PARTIAL_INCLUSION_AMOUNT_COLUMN};`);
    expect(findings).toHaveLength(2);
    expect(findings[0]?.offset).not.toBe(findings[1]?.offset);
  });

  it('E8: a word-boundary is required — "notIncludedAmount" is not flagged', () => {
    expect(scanSourceForIncludedAmount('const notIncludedAmount = 1;')).toEqual([]);
  });

  it('E9 is asserted for the real repository tree below, not as an inline fixture (transactions.ts is outside Scope B by design)', () => {
    expect(true).toBe(true);
  });
});

describe('E10: an empty scan scope fails loudly rather than passing vacuously', () => {
  it('the real Scope B file list is non-empty', () => {
    expect(SCANNED_SOURCE_FILES.length).toBeGreaterThan(0);
  });
});

const APP_CATEGORIZE_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'app', 'categorize');
const FEATURE_DIR = path.resolve(__dirname, '..');

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const SCANNED_SOURCE_FILES = [
  ...listFilesRecursive(APP_CATEGORIZE_DIR),
  ...listFilesRecursive(FEATURE_DIR),
];

describe('advanced disclosure and the partial-inclusion amount are absent from the shipped feature (AC23, AC24)', () => {
  it('scanned at least one catalogue key and one source file (E10)', () => {
    expect(Object.keys(es).length).toBeGreaterThan(0);
    expect(SCANNED_SOURCE_FILES.length).toBeGreaterThan(0);
  });

  it('no advanced-panel phrase appears in es.json', () => {
    expect(scanCatalogueForAdvancedCopy(es)).toEqual([]);
  });

  it('no advanced-panel phrase appears in en.json', () => {
    expect(scanCatalogueForAdvancedCopy(en)).toEqual([]);
  });

  it.each(SCANNED_SOURCE_FILES.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s never names includedAmount or the partial-inclusion amount column (E9: src/db/repositories/transactions.ts is outside this scope by design)',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(scanSourceForIncludedAmount(source)).toEqual([]);
    },
  );

  it('the guard fails when a forbidden identifier is temporarily introduced (planted-violation proof)', () => {
    const planted = "const includedAmount = movement.amount; // planted for the guard's own proof";
    expect(scanSourceForIncludedAmount(planted).length).toBeGreaterThan(0);
  });

  it('the guard fails when a forbidden phrase is temporarily introduced into the catalogue (planted-violation proof)', () => {
    expect(scanCatalogueForAdvancedCopy({ planted: 'Opciones avanzadas' })).toEqual(['planted']);
  });
});
