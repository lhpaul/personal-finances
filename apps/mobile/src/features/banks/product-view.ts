import type { BankProductSummary } from '../../db/types';
import type { BankProductView } from './types';

/**
 * `bank-review`'s "Productos" pure view logic (implementation plan for issue #20, Decision 5).
 * No React, no SQL, no locale-dependent formatter — money formatting is the caller's job
 * (`Amount`'s own `format` prop), matching `Amount`'s "no CLP arithmetic lives in a primitive"
 * rule.
 */

/** Total map over every `user_financial_products.type` the data model declares (Assumption A5):
 * `checking`/`sight`/`savings` share the same family as a current account; `credit_card` and
 * `credit_line` get their own glyphs. An unrecognised type (a future product kind, or a legacy
 * row) falls back to the checking-family glyph rather than rendering nothing. */
const PRODUCT_TYPE_ICON: Record<string, string> = {
  checking: '🏦',
  sight: '🏦',
  savings: '🏦',
  credit_card: '💳',
  credit_line: '📈',
};
const DEFAULT_ICON = '🏦';

export function iconForProductType(type: string): string {
  return PRODUCT_TYPE_ICON[type] ?? DEFAULT_ICON;
}

/** The data model's declared `type` order (`docs/project/4-database-model.md`), used to sort the
 * "Productos" list deterministically across reads and fidelity captures. An unrecognised type
 * sorts after every known one, so it never disturbs the declared order. */
export const PRODUCT_TYPE_ORDER = ['checking', 'sight', 'savings', 'credit_card', 'credit_line'];

function productTypeRank(type: string): number {
  const index = PRODUCT_TYPE_ORDER.indexOf(type);
  return index === -1 ? PRODUCT_TYPE_ORDER.length : index;
}

/** Ordered by `type` (the data model's declared order), then by `name` — a domain decision, not a
 * database concern (the repository stays a dumb read, Decision 3). */
export function sortProductsForDisplay<T extends Pick<BankProductSummary, 'type' | 'name'>>(
  products: readonly T[],
): T[] {
  return [...products].sort((a, b) => {
    const rankDiff = productTypeRank(a.type) - productTypeRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

/** A credit card's balance is the amount owed (tone `out`); every other product type is
 * `neutral` (Assumption A6). */
function amountToneForProductType(type: string): 'neutral' | 'out' {
  return type === 'credit_card' ? 'out' : 'neutral';
}

/**
 * A total function over the four meta-line cases (Decision 5's table): mask only → `mask`; mask +
 * cupo → `mask_cupo`; cupo only → `cupo`; neither → `undefined` (no meta line at all — never an
 * empty string, which would still reserve a blank line). `cupo`'s interpolation value is already
 * a formatted CLP string (`{{cupo}}` in the catalogue) — `format` is the injected `formatClp`
 * (item #4), so this module never imports a locale-dependent default (Decision 5).
 */
function resolveMetaFragment(
  product: BankProductSummary,
  format: (minorUnits: number) => string,
): BankProductView['metaFragment'] {
  const hasMask = product.mask !== undefined;
  const hasCredit = product.creditLimitMinorUnits !== undefined;

  if (hasMask && hasCredit) {
    return {
      key: 'bank_review.product_meta_mask_cupo',
      values: { mask: product.mask as string, cupo: format(product.creditLimitMinorUnits as number) },
    };
  }
  if (hasMask) {
    return { key: 'bank_review.product_meta_mask', values: { mask: product.mask as string } };
  }
  if (hasCredit) {
    return {
      key: 'bank_review.product_meta_cupo',
      values: { cupo: format(product.creditLimitMinorUnits as number) },
    };
  }
  return undefined;
}

/**
 * One "Productos" row (Decision 5's table). `amount` is `undefined` — never `$0` — exactly when
 * `balanceMinorUnits` is absent, because `$0` would be a claim the store never made. `Amount`
 * itself does the final CLP rendering (it takes `minorUnits` + `format`, Decision 7's seam), so
 * only the meta line's `cupo` value needs pre-formatting here.
 */
export function toProductView(
  product: BankProductSummary,
  format: (minorUnits: number) => string,
): BankProductView {
  return {
    icon: iconForProductType(product.type),
    title: product.name,
    metaFragment: resolveMetaFragment(product, format),
    amount:
      product.balanceMinorUnits === undefined
        ? undefined
        : { minorUnits: product.balanceMinorUnits, tone: amountToneForProductType(product.type) },
  };
}
