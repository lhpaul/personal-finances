/**
 * CLP money formatting (Decisions 1, 4, 5, 6 — implementation plan for issue #4).
 *
 * Every string here is hand-built from integer arithmetic and is deliberately
 * locale-invariant: `Intl.NumberFormat` output does not reliably match the mockup for the
 * locale tags this app renders under, and `Intl.NumberFormat.prototype.formatToParts` is
 * unimplemented on iOS Hermes. See the implementation plan's Decision 1 for the full
 * rationale. This module never calls `Intl`.
 *
 * CLP has no cents: amounts are always safe-integer minor units (pesos). Non-integer input
 * throws rather than silently rounding, because a fractional peso means a float leaked into
 * the money pipeline (AGENTS.md non-negotiable 2).
 */

export type MoneyDirection = 'in' | 'out' | 'neutral';

export type MoneySignDisplay = 'directional' | 'never';

export interface FormatClpOptions {
  direction?: MoneyDirection;
  signDisplay?: MoneySignDisplay;
}

export interface FormatClpAbbreviatedOptions extends FormatClpOptions {
  withCurrencySymbol?: boolean;
}

export const CLP_CURRENCY_SYMBOL = '$';
export const CLP_THOUSANDS_SEPARATOR = '.';
/** U+2212 MINUS SIGN — matches the mockup's own negative-value character (e.g. `−12%`). */
export const MINUS_SIGN = '−';

const ABBREVIATION_K_DIVISOR = 1_000;
const ABBREVIATION_M_DIVISOR = 100_000; // tenths of a million
const ABBREVIATION_K_THRESHOLD = 1_000;
const ABBREVIATION_M_THRESHOLD = 1_000_000;

/**
 * `true` iff `value` is a safe-integer `number` — the only shape every money function in this
 * module accepts. Exported so consumers (for example item #2's `Amount` component) can guard
 * their prop boundary without a `try`/`catch` (Decision 5).
 */
export function isValidMoneyMinorUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * Formats a non-negative safe integer with `.` as the thousands separator and no decimals.
 * Sign handling belongs to `formatClp` — this function throws on a negative input rather than
 * silently applying `Math.abs`.
 */
export function formatThousands(value: number): string {
  if (!isValidMoneyMinorUnits(value) || value < 0) {
    throw new TypeError(
      `formatThousands: value must be a non-negative safe integer, received ${String(value)}`,
    );
  }
  const digits = String(value);
  let grouped = '';
  for (let i = 0; i < digits.length; i += 1) {
    const positionFromEnd = digits.length - i;
    if (i > 0 && positionFromEnd % 3 === 0) {
      grouped += CLP_THOUSANDS_SEPARATOR;
    }
    grouped += digits[i];
  }
  return grouped;
}

function resolveSign(
  value: number,
  direction: MoneyDirection,
  signDisplay: MoneySignDisplay,
): string {
  if (signDisplay === 'never') return '';
  if (value < 0) return MINUS_SIGN;
  if (value === 0) return '';
  return direction === 'in' ? '+' : '';
}

/**
 * `$1.200.000`, `+$1.200.000`, `−$500.000`, `$0`. Throws `TypeError` when `amountMinorUnits` is
 * not a safe integer — a fractional peso is a bug upstream, not something to round away
 * (Decision 5).
 */
export function formatClp(amountMinorUnits: number, options: FormatClpOptions = {}): string {
  if (!isValidMoneyMinorUnits(amountMinorUnits)) {
    throw new TypeError(
      `formatClp: amountMinorUnits must be a safe integer, received ${String(amountMinorUnits)}`,
    );
  }
  const { direction = 'neutral', signDisplay = 'directional' } = options;
  const sign = resolveSign(amountMinorUnits, direction, signDisplay);
  return `${sign}${CLP_CURRENCY_SYMBOL}${formatThousands(Math.abs(amountMinorUnits))}`;
}

/**
 * Exact half-up division on the magnitude, over `BigInt` so it stays exact across the full
 * safe-integer range (Decision 6; contract widened for issue #5's `@finanzas/shared-domain`
 * consumers). `denominator` may be any positive integer, not just this module's two internal
 * compile-time constants (1_000 or 100_000): an odd `denominator` has no exact `.5` tie for an
 * integer `numerator` (`n / d = k + 0.5` requires `d` even), so the truncating
 * `BigInt(denominator) / 2n` loses nothing even for an odd denominator. Operates on non-negative
 * inputs only — callers pass `Math.abs(...)`.
 */
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  const quotient =
    (BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator);
  return Number(quotient);
}

/**
 * `3.7M`, `+2.3M`, `$279K`. Tiers and rounding are derived from the mockup (Decision 6):
 * below 1_000 renders as a plain integer with no suffix; [1_000, 1_000_000) renders as `K` with
 * no decimal; >= 1_000_000 renders as `M` with exactly one decimal (always shown, including
 * `.0`). Rounding is half-up on the magnitude (half-away-from-zero overall). If `K` rounding
 * would reach 1000, the value is promoted to the `M` tier instead of rendering `1.000K`.
 */
export function formatClpAbbreviated(
  amountMinorUnits: number,
  options: FormatClpAbbreviatedOptions = {},
): string {
  if (!isValidMoneyMinorUnits(amountMinorUnits)) {
    throw new TypeError(
      `formatClpAbbreviated: amountMinorUnits must be a safe integer, received ${String(amountMinorUnits)}`,
    );
  }
  const { direction = 'neutral', signDisplay = 'directional', withCurrencySymbol = false } =
    options;
  const sign = resolveSign(amountMinorUnits, direction, signDisplay);
  const symbol = withCurrencySymbol ? CLP_CURRENCY_SYMBOL : '';
  const magnitude = Math.abs(amountMinorUnits);

  let body: string;
  if (magnitude < ABBREVIATION_K_THRESHOLD) {
    body = String(magnitude);
  } else if (magnitude < ABBREVIATION_M_THRESHOLD) {
    const thousands = divideRoundHalfUp(magnitude, ABBREVIATION_K_DIVISOR);
    if (thousands >= 1000) {
      // Promotion: K rounding reached 1000 — render as M instead of "1.000K".
      const tenthsOfMillion = divideRoundHalfUp(magnitude, ABBREVIATION_M_DIVISOR);
      body = `${(tenthsOfMillion / 10).toFixed(1)}M`;
    } else {
      body = `${thousands}K`;
    }
  } else {
    const tenthsOfMillion = divideRoundHalfUp(magnitude, ABBREVIATION_M_DIVISOR);
    body = `${(tenthsOfMillion / 10).toFixed(1)}M`;
  }

  return `${sign}${symbol}${body}`;
}
