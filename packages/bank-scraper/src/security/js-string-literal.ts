/**
 * Builds a JavaScript string literal by escaping, never by interpolating (spec AC4;
 * implementation plan Decision 5). The source writes `rutInput.value = '${rut}';`, which breaks
 * on an apostrophe and is a script-injection vector. `JSON.stringify` already escapes quotes,
 * backslashes and control characters; the only gap is that U+2028 (LINE SEPARATOR) and U+2029
 * (PARAGRAPH SEPARATOR) are valid inside a JSON string but were, until ES2019, illegal inside a
 * JavaScript string literal in some engines — they are replaced by their `\u` escapes so the
 * result is always a syntactically valid, single JS string literal regardless of engine version.
 */

const LINE_SEPARATOR = ' ';
const PARAGRAPH_SEPARATOR = ' ';
const LINE_SEPARATOR_PATTERN = new RegExp(LINE_SEPARATOR, 'gu');
const PARAGRAPH_SEPARATOR_PATTERN = new RegExp(PARAGRAPH_SEPARATOR, 'gu');

export function toJsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(LINE_SEPARATOR_PATTERN, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR_PATTERN, '\\u2029');
}
