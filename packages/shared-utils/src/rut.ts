/**
 * RUT normalization, modulo-11 check-digit validation, and display formatting (Decisions 9, 10 —
 * implementation plan for issue #4).
 *
 * The RUT is half of a Chilean bank login. Every function here is pure `string -> string |
 * boolean`: no I/O, no module-level cache keyed on a RUT, and every thrown error message is a
 * fixed constant string that never interpolates the input (AGENTS.md non-negotiable 1). This
 * file also contains no `console.` call — enforced by `'no-console': 'error'` for this workspace.
 */

// \s already matches every Unicode space-separator character in JavaScript regexes
// (U+0020, U+00A0 non-breaking space, U+2009 thin space, etc.) — no separate range is needed.
const NORMALIZE_STRIP_PATTERN = /[.\-\s]/gu;
const RUT_BODY_PATTERN = /^[1-9][0-9]{5,7}$/;
const CHECK_DIGIT_PATTERN = /^[0-9K]$/;
const DIGITS_ONLY_PATTERN = /^[0-9]+$/;
const RUT_SHAPE_PATTERN = /^([0-9]+)([0-9K])$/;
const CHECK_DIGIT_WEIGHT_CYCLE = [2, 3, 4, 5, 6, 7];

/**
 * Strips `.`, `-` and Unicode whitespace (including U+00A0 non-breaking space and U+2009 thin
 * space), then upper-cases. Does **not** validate. `'12.345.678-5'` -> `'123456785'`.
 */
export function normalizeRut(input: string): string {
  return input.replace(NORMALIZE_STRIP_PATTERN, '').toUpperCase();
}

/**
 * `'12345678'` -> `'5'`. Throws `TypeError` (value-free, per Decision 9) if `bodyDigits`
 * contains anything other than ASCII digits.
 */
export function computeRutCheckDigit(bodyDigits: string): string {
  if (!DIGITS_ONLY_PATTERN.test(bodyDigits) || bodyDigits.length === 0) {
    throw new TypeError('computeRutCheckDigit: body must contain digits only');
  }
  let sum = 0;
  let weightIndex = 0;
  for (let i = bodyDigits.length - 1; i >= 0; i -= 1) {
    const digit = bodyDigits[i] as string;
    const weight = CHECK_DIGIT_WEIGHT_CYCLE[weightIndex % CHECK_DIGIT_WEIGHT_CYCLE.length] as number;
    sum += Number(digit) * weight;
    weightIndex += 1;
  }
  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Shared structural-parse step for `isValidRut` and `formatRut`: normalizes, splits into body
 * and check digit via `RUT_SHAPE_PATTERN`, strips the body's leading zeros, then requires the
 * result to satisfy `RUT_BODY_PATTERN`. Returns `null` when the input is structurally malformed
 * at any of those steps — this is the single place the "what counts as a well-formed RUT body"
 * contract lives; `isValidRut` and `formatRut` never re-derive it themselves.
 */
function parseRutParts(input: string): { body: string; checkDigit: string } | null {
  const normalized = normalizeRut(input);
  const match = RUT_SHAPE_PATTERN.exec(normalized);
  if (!match) return null;
  const rawBody = match[1] as string;
  const checkDigit = match[2] as string;
  const body = rawBody.replace(/^0+/, '');
  if (!RUT_BODY_PATTERN.test(body)) return null;
  return { body, checkDigit };
}

/**
 * Never throws — returns `false` for any malformed input. A typo filter, not a registry
 * (Decision 10): normalizes, strips leading zeros from the body, then requires a 6-8-digit body
 * and a `0`-`9`/`K` check digit before running modulo-11.
 */
export function isValidRut(input: string): boolean {
  const parts = parseRutParts(input);
  if (!parts) return false;
  const { body, checkDigit } = parts;
  if (!CHECK_DIGIT_PATTERN.test(checkDigit)) return false;
  let expected: string;
  try {
    expected = computeRutCheckDigit(body);
  } catch {
    return false;
  }
  return expected === checkDigit;
}

/**
 * `'123456789'` -> `'12.345.678-9'`. Throws `TypeError` (value-free) on structurally malformed
 * input. Does **not** check the check digit — the mockup renders an arithmetically invalid RUT
 * in the `error` state, so formatting must succeed on it (Decision 10).
 */
export function formatRut(input: string): string {
  const parts = parseRutParts(input);
  if (!parts) {
    throw new TypeError('formatRut: malformed RUT input');
  }
  const { body, checkDigit } = parts;
  let grouped = '';
  for (let i = 0; i < body.length; i += 1) {
    const positionFromEnd = body.length - i;
    if (i > 0 && positionFromEnd % 3 === 0) {
      grouped += '.';
    }
    grouped += body[i];
  }
  return `${grouped}-${checkDigit}`;
}
