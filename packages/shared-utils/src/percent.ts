import { MINUS_SIGN } from './money';

/**
 * Percentage formatting for tenths-of-a-percent integers (implementation plan for issue #12,
 * Decision 12). `@finanzas/shared-domain`'s `apportionTenths` returns shares as integer tenths
 * (`PERCENTAGE_TENTHS_TOTAL = 1000`); the mockup renders one decimal with a Chilean comma
 * (`20,6%`). No formatter for that shape existed in this package before this item.
 *
 * Lives in its own file rather than `money.ts` because item #5's open PR was already changing
 * `money.ts` at plan time (Verification Log), and because a percentage is not a money value.
 */

export const PERCENT_DECIMAL_SEPARATOR = ',';

/** `206` -> `20,6%`, `1000` -> `100,0%`, `0` -> `0,0%`, `5` -> `0,5%`, `-50` -> `−5,0%`. Tenths
 * of a percent in, display string out. Throws `TypeError` on a non-safe-integer input — a
 * fractional tenth is a bug upstream, the same discipline `formatClp` applies to money. */
export function formatPercentTenths(tenths: number): string {
  if (!Number.isSafeInteger(tenths)) {
    throw new TypeError(
      `formatPercentTenths: tenths must be a safe integer, received ${String(tenths)}`,
    );
  }
  const magnitude = Math.abs(tenths);
  const whole = Math.trunc(magnitude / 10);
  const fraction = magnitude % 10;
  const sign = tenths < 0 ? MINUS_SIGN : '';
  return `${sign}${whole}${PERCENT_DECIMAL_SEPARATOR}${fraction}%`;
}
