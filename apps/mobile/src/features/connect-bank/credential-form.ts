import { formatRut, isValidRut } from '@finanzas/shared-utils';

/**
 * `bank-credentials`'s pure validation and display logic (implementation plan Business Rules
 * 11-12, AC13-AC14). No React, no I/O — `@finanzas/shared-utils` is the RUT authority this item
 * adds no logic on top of, only consumes.
 */

/**
 * The canonical display form when the input is structurally parseable as a RUT, or the raw input
 * otherwise. `formatRut` throws `TypeError` on malformed input and must never be called
 * unguarded — this wrapper is that guard. Does **not** require the check digit to be
 * arithmetically valid (the mockup's own placeholder, `12.345.678-9`, has a wrong check digit and
 * still displays canonically — implementation plan Assumption A1).
 */
export function formatRutForDisplay(input: string): string {
  try {
    return formatRut(input);
  } catch {
    return input;
  }
}

/**
 * The connect action is enabled only once the RUT is valid, check digit included, and the
 * password is non-empty (Business Rule 11, AC13-AC14). No length ceiling on the password
 * (Assumption A5) — the mockup draws none, and a too-long password is indistinguishable here
 * from a wrong one.
 */
export function canConnect(input: { rut: string; password: string }): boolean {
  return isValidRut(input.rut) && input.password.length > 0;
}
