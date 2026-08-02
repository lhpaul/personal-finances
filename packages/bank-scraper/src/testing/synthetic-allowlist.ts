/**
 * The single, explicit, reviewed allowlist of values a fixture may use even though they might
 * otherwise resemble the class of thing `fixture-scan.ts` looks for (spec Business Rule 26, AC5;
 * implementation plan Testing Strategy → "Suppression semantics"). There is no inline suppression
 * directive anywhere in this package — the only way to exempt a value is to add it here, which is
 * a committed, reviewed source file and therefore visible in every PR diff that touches it.
 *
 * This file is itself excluded from the fixture scan (it necessarily names the allow-listed
 * values) — the single, named exception. `testing/fixture-sanitization.test.ts` asserts that
 * exclusion list has exactly one entry, so widening it is a visible test change, not a quiet
 * config edit.
 */

/**
 * Fictional placeholder names used in fixtures — never a real person, never a token from
 * `prohibited-name-tokens.ts`.
 */
export const SYNTHETIC_NAMES: readonly string[] = ['Persona Ejemplo', 'Cuenta Demo'];

/**
 * Digit runs of 7-20 characters that are allowed even though they are not all-identical-digit
 * (the general `isSyntheticAccountNumber` rule). Kept intentionally short.
 */
export const ALLOWED_ACCOUNT_NUMBERS: readonly string[] = [];
