import type { BankProductSummary } from '../../../db/types';
import { iconForProductType, sortProductsForDisplay, toProductView } from '../product-view';

// A locale-formatting call (`toLocaleString`) is banned repo-wide (root `eslint.config.mjs`) —
// this fake formatter is a plain string transform, not a real CLP formatter (that is item #4's
// `formatClp`, injected by the real caller).
const format = (minorUnits: number) => `$${minorUnits}`;

function baseProduct(overrides: Partial<BankProductSummary> = {}): BankProductSummary {
  return {
    id: 'prod-1',
    externalId: 'ext-1',
    type: 'checking',
    name: 'Cuenta corriente',
    currencyCode: 'CLP',
    mask: undefined,
    balanceMinorUnits: undefined,
    creditLimitMinorUnits: undefined,
    availableCreditMinorUnits: undefined,
    ...overrides,
  };
}

describe('iconForProductType (Assumption A5)', () => {
  it.each([
    ['checking', '🏦'],
    ['sight', '🏦'],
    ['savings', '🏦'],
    ['credit_card', '💳'],
    ['credit_line', '📈'],
    ['unknown_future_type', '🏦'],
  ])('%s -> %s', (type, expected) => {
    expect(iconForProductType(type)).toBe(expected);
  });
});

describe('sortProductsForDisplay (Decision 5)', () => {
  it('orders by the data model declared type order, then by name', () => {
    const products = [
      baseProduct({ id: 'b', type: 'credit_line', name: 'Línea B' }),
      baseProduct({ id: 'a', type: 'checking', name: 'Cuenta B' }),
      baseProduct({ id: 'c', type: 'credit_card', name: 'Tarjeta' }),
      baseProduct({ id: 'd', type: 'checking', name: 'Cuenta A' }),
    ];
    expect(sortProductsForDisplay(products).map((p) => p.id)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('sorts an unrecognised type after every known type', () => {
    const products = [
      baseProduct({ id: 'x', type: 'brand_new_type', name: 'Zzz' }),
      baseProduct({ id: 'y', type: 'credit_line', name: 'Aaa' }),
    ];
    expect(sortProductsForDisplay(products).map((p) => p.id)).toEqual(['y', 'x']);
  });
});

describe('toProductView (Decision 5)', () => {
  it('mask only', () => {
    const view = toProductView(baseProduct({ mask: '4821' }), format);
    expect(view.metaFragment).toEqual({ key: 'bank_review.product_meta_mask', values: { mask: '4821' } });
  });

  it('mask + cupo', () => {
    const view = toProductView(
      baseProduct({ type: 'credit_card', mask: '7734', creditLimitMinorUnits: 2_500_000 }),
      format,
    );
    expect(view.metaFragment).toEqual({
      key: 'bank_review.product_meta_mask_cupo',
      values: { mask: '7734', cupo: format(2_500_000) },
    });
  });

  it('cupo only', () => {
    const view = toProductView(baseProduct({ type: 'credit_line', creditLimitMinorUnits: 800_000 }), format);
    expect(view.metaFragment).toEqual({
      key: 'bank_review.product_meta_cupo',
      values: { cupo: format(800_000) },
    });
  });

  it('neither mask nor cupo -> no meta line', () => {
    const view = toProductView(baseProduct(), format);
    expect(view.metaFragment).toBeUndefined();
  });

  it('an absent balance renders no amount (never $0)', () => {
    const view = toProductView(baseProduct(), format);
    expect(view.amount).toBeUndefined();
  });

  it("a credit card's balance is tone out; every other type is neutral (Assumption A6)", () => {
    const card = toProductView(baseProduct({ type: 'credit_card', balanceMinorUnits: 412_000 }), format);
    expect(card.amount).toEqual({ minorUnits: 412_000, tone: 'out' });

    const checking = toProductView(baseProduct({ balanceMinorUnits: 1_842_300 }), format);
    expect(checking.amount).toEqual({ minorUnits: 1_842_300, tone: 'neutral' });

    const creditLine = toProductView(baseProduct({ type: 'credit_line', balanceMinorUnits: 0 }), format);
    expect(creditLine.amount).toEqual({ minorUnits: 0, tone: 'neutral' });
  });
});
