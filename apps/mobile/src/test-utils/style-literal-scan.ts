/**
 * Scanner B — flags hardcoded visual values (hex colors, `rgb()`/`rgba()` colors, and numeric
 * style-property literals) in TypeScript/TSX source.
 *
 * **Known limitation** (documented per the implementation plan): this scanner matches only a
 * numeric literal *directly* assigned to a tracked key, so `padding: theme.space[4] + 2`
 * escapes detection. It exists to catch the common case, not to be a type checker — manual
 * review and the mockup-fidelity step in the smoke runbook cover that residue.
 *
 * See the implementation plan's Parser-risk addendum → Scanner B for the full edge-case
 * contract (L1-L10) and the suppression-directive semantics:
 * docs/specs/developments/20260801172100_2-theme-design-system-primitives/
 * 2_2-theme-design-system-primitives_implementation-plan.md
 */

export type StyleLiteralKind = 'hex' | 'rgb' | 'style-number';

export type StyleLiteral = {
  line: number;
  column: number;
  kind: StyleLiteralKind;
  text: string;
};

const HEX_REGEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RGB_REGEX = /rgba?\(\s*[^)]*\)/g;

/** Property names `style-number` tracks. Written as fragments so `padding*` / `margin*` /
 * `border*Radius` / `border*Width` cover every RN variant (`paddingHorizontal`,
 * `borderTopLeftRadius`, …) without enumerating each one. */
const TRACKED_PROPERTY = [
  'padding[A-Za-z]*',
  'margin[A-Za-z]*',
  'rowGap',
  'columnGap',
  'gap',
  'border[A-Za-z]*Radius',
  'border[A-Za-z]*Width',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'width',
  'height',
  'top',
  'right',
  'bottom',
  'left',
].join('|');

const STYLE_NUMBER_REGEX = new RegExp(
  `\\b(?:${TRACKED_PROPERTY})\\b\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?=[,}\\n;]|$)`,
  'g',
);

const DIRECTIVE_MARKER = 'style-literal-allow:';

type LineInfo = { text: string; startIndex: number };

function splitLines(source: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let startIndex = 0;
  const rawLines = source.split('\n');
  for (const rawLine of rawLines) {
    lines.push({ text: rawLine, startIndex });
    startIndex += rawLine.length + 1; // +1 for the '\n' consumed by split
  }
  return lines;
}

function indexToLineColumn(index: number, lineInfos: LineInfo[]): { line: number; column: number } {
  // Lines are in ascending startIndex order — find the last one at or before `index`.
  let lineNumber = 1;
  let column = index + 1;
  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i];
    if (info === undefined) continue;
    if (info.startIndex <= index) {
      lineNumber = i + 1;
      column = index - info.startIndex + 1;
    } else {
      break;
    }
  }
  return { line: lineNumber, column };
}

/**
 * Collects suppression exemptions and empty-reason violations from the **original** source
 * (before comment stripping — the directive lives inside a comment, so stripping first would
 * delete it before it could be read).
 */
function collectDirectives(
  lineInfos: LineInfo[],
): { exemptLines: Set<number>; violations: StyleLiteral[] } {
  const exemptLines = new Set<number>();
  const violations: StyleLiteral[] = [];

  for (let i = 0; i < lineInfos.length; i++) {
    const info = lineInfos[i];
    if (info === undefined) continue;
    const commentStart = info.text.indexOf('//');
    if (commentStart === -1) continue;

    const commentBody = info.text.slice(commentStart + 2);
    const markerIndex = commentBody.indexOf(DIRECTIVE_MARKER);
    if (markerIndex === -1) continue;

    const reason = commentBody.slice(markerIndex + DIRECTIVE_MARKER.length).trim();
    const codeBeforeComment = info.text.slice(0, commentStart).trim();
    const lineNumber = i + 1;
    const targetLine = codeBeforeComment === '' ? lineNumber + 1 : lineNumber;

    if (reason === '') {
      violations.push({
        line: lineNumber,
        column: commentStart + 2 + markerIndex + 1,
        kind: 'style-number',
        text: 'missing suppression reason',
      });
      continue;
    }

    exemptLines.add(targetLine);
  }

  return { exemptLines, violations };
}

/** Blanks out `//` and `/* *‍/` comments (replacing non-newline characters with spaces) so
 * every remaining character keeps its original index — line/column math on the stripped text
 * stays correct without a separate position-mapping pass. */
function stripComments(source: string): string {
  let result = '';
  let i = 0;
  const len = source.length;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: '"' | "'" | '`' | null = null;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        result += '  ';
        i += 2;
        continue;
      }
      result += ch === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    if (inString !== null) {
      result += ch;
      if (ch === '\\') {
        // Preserve the escaped character too, so escaped quotes don't end the string early.
        if (next !== undefined) {
          result += next;
          i += 2;
          continue;
        }
      }
      if (ch === inString) inString = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      result += ch;
      i++;
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
    i++;
  }

  return result;
}

export function findStyleLiterals(source: string): StyleLiteral[] {
  const lineInfos = splitLines(source);
  const { exemptLines, violations } = collectDirectives(lineInfos);

  const stripped = stripComments(source);
  const strippedLineInfos = splitLines(stripped);

  let match: RegExpExecArray | null;

  HEX_REGEX.lastIndex = 0;
  while ((match = HEX_REGEX.exec(stripped)) !== null) {
    const { line, column } = indexToLineColumn(match.index, strippedLineInfos);
    if (exemptLines.has(line)) continue;
    violations.push({ line, column, kind: 'hex', text: match[0] });
  }

  RGB_REGEX.lastIndex = 0;
  while ((match = RGB_REGEX.exec(stripped)) !== null) {
    const { line, column } = indexToLineColumn(match.index, strippedLineInfos);
    if (exemptLines.has(line)) continue;
    violations.push({ line, column, kind: 'rgb', text: match[0] });
  }

  STYLE_NUMBER_REGEX.lastIndex = 0;
  while ((match = STYLE_NUMBER_REGEX.exec(stripped)) !== null) {
    const rawValue = match[1];
    if (rawValue === undefined) continue;
    if (Number(rawValue) === 0) continue; // L7 — `0` is the only allowed numeric literal.

    const { line, column } = indexToLineColumn(match.index, strippedLineInfos);
    if (exemptLines.has(line)) continue;
    violations.push({ line, column, kind: 'style-number', text: match[0].trim() });
  }

  return violations.sort((a, b) => a.line - b.line || a.column - b.column);
}
