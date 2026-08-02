import { isValidRut, normalizeRut } from '@finanzas/shared-utils';
import { parseMinorUnits } from '../parsing/amount';

/**
 * Four deterministic sanitization checks over a committed HTML fixture (spec Business Rule 26,
 * AC5; implementation plan Testing Strategy → parser-risk addendum). Each is proven by planting a
 * synthetic violation of that specific class and asserting the check catches it — never by review
 * alone. Violation messages report the detector and the byte offset, **never the matched text**:
 * printing a leaked RUT into a CI log defeats the entire point of the check.
 */

export type FixtureViolationClass = 'rut' | 'name' | 'amount' | 'accountNumber';

export interface FixtureViolation {
  class: FixtureViolationClass;
  byteOffset: number;
}

const RUT_TOKEN_PATTERN = /\b\d{1,2}(?:\.\d{3}){2}-[0-9kK]\b|\b\d{7,8}-[0-9kK]\b/gu;

/** Flags only a **check-digit-valid** RUT-shaped token — a scrubbed fixture's RUT never validates. */
export function findRutViolations(content: string): FixtureViolation[] {
  const violations: FixtureViolation[] = [];
  RUT_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RUT_TOKEN_PATTERN.exec(content)) !== null) {
    const token = match[0];
    if (isValidRut(normalizeRut(token))) {
      violations.push({ class: 'rut', byteOffset: match.index });
    }
  }
  return violations;
}

const COMBINING_DIACRITICAL_MARKS_PATTERN = /[\u0300-\u036f]/gu;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(COMBINING_DIACRITICAL_MARKS_PATTERN, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Flags a whole-word, case- and accent-insensitive match of any `prohibitedTokens` entry, unless
 * the matched text is also covered by `allowlistNames` (an explicit, reviewed exemption).
 */
export function findNameViolations(
  content: string,
  prohibitedTokens: readonly string[],
  allowlistNames: readonly string[] = [],
): FixtureViolation[] {
  const violations: FixtureViolation[] = [];
  const strippedContent = stripAccents(content);
  const strippedAllowlist = allowlistNames.map((name) => stripAccents(name).toLowerCase());
  for (const token of prohibitedTokens) {
    const pattern = new RegExp(`\\b${escapeRegExp(stripAccents(token))}\\b`, 'giu');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(strippedContent)) !== null) {
      const matchedOriginal = content.slice(match.index, match.index + match[0].length);
      const isAllowed = strippedAllowlist.some((allowed) => allowed.includes(stripAccents(matchedOriginal).toLowerCase()));
      if (!isAllowed) {
        violations.push({ class: 'name', byteOffset: match.index });
      }
    }
  }
  return violations;
}

/**
 * A value is synthetic when it is zero, an exact multiple of 1000 (a plain round-thousands
 * figure), or its thousands-quotient has all-identical decimal digits (`1.111.000`, `222.000`,
 * `33.000`).
 */
export function isSyntheticAmount(minorUnits: number): boolean {
  if (minorUnits === 0) return true;
  if (minorUnits % 1000 === 0) return true;
  const quotientDigits = String(Math.floor(minorUnits / 1000));
  return [...quotientDigits].every((digit) => digit === quotientDigits[0]);
}

const AMOUNT_TOKEN_PATTERN = /(?:US\$|USD|CLP|\$)\s*[0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]+)?/gu;

export function findAmountViolations(content: string): FixtureViolation[] {
  const violations: FixtureViolation[] = [];
  AMOUNT_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_TOKEN_PATTERN.exec(content)) !== null) {
    const token = match[0];
    const currencyCode = /US\$|USD/u.test(token) ? 'USD' : 'CLP';
    let minorUnits: number;
    try {
      minorUnits = parseMinorUnits(token, currencyCode);
    } catch {
      continue; // not confidently an amount — not this detector's concern
    }
    if (!isSyntheticAmount(minorUnits)) {
      violations.push({ class: 'amount', byteOffset: match.index });
    }
  }
  return violations;
}

export function isSyntheticAccountNumber(digits: string, allowlist: readonly string[] = []): boolean {
  if (allowlist.includes(digits)) return true;
  return [...digits].every((digit) => digit === digits[0]);
}

const ACCOUNT_NUMBER_TOKEN_PATTERN = /\b[0-9]{7,20}\b/gu;

export function findAccountNumberViolations(content: string, allowlist: readonly string[] = []): FixtureViolation[] {
  const violations: FixtureViolation[] = [];
  ACCOUNT_NUMBER_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ACCOUNT_NUMBER_TOKEN_PATTERN.exec(content)) !== null) {
    if (!isSyntheticAccountNumber(match[0], allowlist)) {
      violations.push({ class: 'accountNumber', byteOffset: match.index });
    }
  }
  return violations;
}

/** Runs all four detectors and returns every violation found, in detector order. */
export function scanFixtureContent(
  content: string,
  options: { prohibitedNameTokens: readonly string[]; allowlistNames: readonly string[]; allowedAccountNumbers: readonly string[] },
): FixtureViolation[] {
  return [
    ...findRutViolations(content),
    ...findNameViolations(content, options.prohibitedNameTokens, options.allowlistNames),
    ...findAmountViolations(content),
    ...findAccountNumberViolations(content, options.allowedAccountNumbers),
  ];
}
