/**
 * Extracts `t('…')` catalogue-key call sites from TypeScript/TSX source, for the
 * `gallery-catalogue-keys.test.ts` scenario 6 control (AC4). Mirrors the shape of
 * `style-literal-scan.ts`: a regex-based scanner, not a parser, matching the common case and
 * documenting its limitations rather than pulling in a full TypeScript AST.
 *
 * See the implementation plan's Testing Strategy → Parser-risk addendum for the full contract
 * and edge-case enumeration (E1-E12):
 * docs/specs/developments/20260802015138_34-i18n-infrastructure/
 * 2_34-i18n-infrastructure_implementation-plan.md
 *
 * **Known limitation** (E10): the scanner does not distinguish a `t(...)` call inside a `//` or
 * `/* *‍/` comment from real code — a commented-out call is still matched. The only consequence
 * is requiring a catalogue key that exists; the gallery must contain no commented-out `t(` call.
 *
 * **Suppression semantics**: not applicable. This scanner recognises no inline suppression
 * directive, by design — a suppression mechanism here would create exactly the escape hatch
 * AC5 forbids for `eslint-plugin-i18next`'s own rule.
 */

export type TranslationKeyFinding = {
  line: number;
  column: number;
};

export type TranslationKeyScanResult = {
  /** Every string-literal argument of a `t(...)` call. */
  keys: string[];
  /** One entry per `t(...)` call whose first argument is not a string literal (a variable, a
   * template literal, a ternary, or an empty string). */
  dynamic: TranslationKeyFinding[];
};

/** The callee must be exactly `t`, preceded by a non-identifier boundary (E8, E9) — `\b` alone
 * is not enough because `\b` also sits between `useT` and `(` is false (case-sensitive `t`
 * excludes `T`), but stays permissive of a member-expression callee like `obj.t(`. */
const CALL_REGEX = /\bt\s*\(/g;

type LineInfo = { text: string; startIndex: number };

function splitLines(source: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let startIndex = 0;
  for (const rawLine of source.split('\n')) {
    lines.push({ text: rawLine, startIndex });
    startIndex += rawLine.length + 1; // +1 for the '\n' consumed by split
  }
  return lines;
}

function indexToLineColumn(index: number, lineInfos: LineInfo[]): { line: number; column: number } {
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
 * Parses the first call argument starting at `startIndex` (just past the call's opening `(`,
 * skipping any leading whitespace/newlines — E12). Returns the literal's content when the
 * argument is a single- or double-quoted string (E1, E2), or `null` when it is anything else —
 * a bare identifier (E5), a template literal (E6), a conditional expression (E11), or an
 * unterminated string. An empty string literal (E7) is returned as `''`, distinguished from
 * `null` by the caller so both count as a "dynamic" finding without conflating "no literal" and
 * "empty literal".
 */
function parseFirstArgument(source: string, startIndex: number): string | null {
  let i = startIndex;
  while (i < source.length && /\s/.test(source.charAt(i))) i++;

  const quote = source.charAt(i);
  if (quote !== "'" && quote !== '"') return null;
  i++;

  let value = '';
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === '\\') {
      value += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === quote) return value;
    value += ch;
    i++;
  }
  // Unterminated string — not valid source in practice; treat as non-literal rather than throw.
  return null;
}

export function findTranslationKeys(source: string): TranslationKeyScanResult {
  const lineInfos = splitLines(source);
  const keys: string[] = [];
  const dynamic: TranslationKeyFinding[] = [];

  CALL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CALL_REGEX.exec(source)) !== null) {
    const afterOpenParen = match.index + match[0].length;
    const parsed = parseFirstArgument(source, afterOpenParen);
    const { line, column } = indexToLineColumn(match.index, lineInfos);

    if (parsed === null || parsed === '') {
      dynamic.push({ line, column });
    } else {
      keys.push(parsed);
    }
  }

  return { keys, dynamic };
}
