import { suggestCategory } from './category-suggestion';
import type { CategorySource, Merchant } from './types';

const seededMerchantWithDefault: Merchant = {
  id: 'm1',
  name: 'MercadoLibre Chile',
  transactionCategoryId: 'compras',
  isUserDefined: false,
};

const seededMerchantWithoutDefault: Merchant = {
  id: 'm2',
  name: 'Unknown Corp',
  transactionCategoryId: null,
  isUserDefined: false,
};

const userMerchantWithDefault: Merchant = {
  id: 'm3',
  name: 'Almacén de la esquina',
  transactionCategoryId: 'comida',
  isUserDefined: true,
};

const userMerchantWithoutDefault: Merchant = {
  id: 'm4',
  name: 'Sin categoría por defecto',
  transactionCategoryId: null,
  isUserDefined: true,
};

describe('suggestCategory — Decision 14, Business Rule 6', () => {
  it.each<CategorySource>(['auto', 'rule', 'user'])(
    'currentCategorySource "user" always returns null, even with a merchant default (prior source=%s ignored)',
    () => {
      expect(
        suggestCategory({ currentCategorySource: 'user', merchant: seededMerchantWithDefault }),
      ).toBeNull();
      expect(
        suggestCategory({ currentCategorySource: 'user', merchant: userMerchantWithDefault }),
      ).toBeNull();
    },
  );

  it.each<CategorySource | null>([null, 'auto', 'rule'])(
    'a seeded merchant with a default suggests "auto" (currentCategorySource=%s)',
    (currentCategorySource) => {
      expect(suggestCategory({ currentCategorySource, merchant: seededMerchantWithDefault })).toEqual({
        transactionCategoryId: 'compras',
        source: 'auto',
      });
    },
  );

  it.each<CategorySource | null>([null, 'auto', 'rule'])(
    'a user-configured merchant with a default suggests "rule" (currentCategorySource=%s)',
    (currentCategorySource) => {
      expect(suggestCategory({ currentCategorySource, merchant: userMerchantWithDefault })).toEqual({
        transactionCategoryId: 'comida',
        source: 'rule',
      });
    },
  );

  it('no merchant resolved -> null', () => {
    expect(suggestCategory({ currentCategorySource: null, merchant: null })).toBeNull();
  });

  it('a seeded merchant with no default -> null', () => {
    expect(
      suggestCategory({ currentCategorySource: null, merchant: seededMerchantWithoutDefault }),
    ).toBeNull();
  });

  it('a user-configured merchant with no default -> null', () => {
    expect(
      suggestCategory({ currentCategorySource: null, merchant: userMerchantWithoutDefault }),
    ).toBeNull();
  });

  it('never mutates its input', () => {
    const input = { currentCategorySource: null, merchant: { ...seededMerchantWithDefault } };
    const frozenMerchant = Object.freeze(input.merchant);
    expect(() => suggestCategory({ ...input, merchant: frozenMerchant })).not.toThrow();
  });
});
