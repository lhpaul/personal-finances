import { aliasMatches, normalizeDescription, resolveMerchant } from './merchant-matching';
import type { MerchantAlias, MerchantMatchType } from './types';

function alias(id: string, merchantId: string, matchType: MerchantMatchType, rawPattern: string): MerchantAlias {
  return { id, merchantId, matchType, rawPattern };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([items[i] as T, ...perm]);
    }
  }
  return result;
}

describe('normalizeDescription', () => {
  const cases: Array<[string, string, string]> = [
    ['MERPAGO*MERCADOLIBRE', 'MERPAGO MERCADOLIBRE', 'the * separator the mockup actually shows'],
    [
      'MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO',
      'MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO',
      'an already-normalized string is a fixed point',
    ],
    ['  compra   lider  express ', 'COMPRA LIDER EXPRESS', 'case folding, leading/trailing space, runs of spaces'],
    ['FARMACIA ÑUÑOA', 'FARMACIA NUNOA', 'Ñ -> N (Chilean feeds are inconsistent)'],
    ['CAFÉ ALTURA', 'CAFE ALTURA', 'accented vowel'],
    ['SUSHI EXPRESS', 'SUSHI EXPRESS', 'non-breaking space is punctuation-class, not a letter'],
    ['PAGO-SERVICIO/AGUA', 'PAGO SERVICIO AGUA', 'multiple separators on one string'],
    ['TRANSFERENCIA A JUAN P.', 'TRANSFERENCIA A JUAN P', 'trailing punctuation must not leave a trailing space'],
    ['***', '', 'an all-punctuation string normalizes to empty'],
    ['', '', 'empty input'],
    ['   ', '', 'whitespace-only input'],
    ['UBER BV 1234', 'UBER BV 1234', 'digits survive; they are legitimate alias content'],
  ];

  it.each(cases)('normalizeDescription(%p) -> %p (%s)', (input, expected) => {
    expect(normalizeDescription(input)).toBe(expected);
  });

  it.each(cases)('is idempotent for %p', (input) => {
    const once = normalizeDescription(input);
    expect(normalizeDescription(once)).toBe(once);
  });
});

describe('aliasMatches', () => {
  it('exact — the happy path', () => {
    expect(aliasMatches('ML CHILE SPA', alias('a1', 'm1', 'exact', 'ML CHILE SPA'))).toBe(true);
  });

  it('exact — negative lookalike: exact is not a prefix', () => {
    expect(aliasMatches('ML CHILE SPA LTDA', alias('a1', 'm1', 'exact', 'ML CHILE SPA'))).toBe(false);
  });

  it("prefix — the mockup's own alias and description", () => {
    expect(
      aliasMatches(
        'MERCADOLIBRE COMPRA ONLINE PRODUCTO ELECTRONICO',
        alias('a1', 'm1', 'prefix', 'MERCADOLIBRE COMPRA'),
      ),
    ).toBe(true);
  });

  it('prefix — a prefix equal to the whole string', () => {
    expect(aliasMatches('MERCADOLIBRE COMPRA', alias('a1', 'm1', 'prefix', 'MERCADOLIBRE COMPRA'))).toBe(true);
  });

  it('prefix — negative lookalike: token boundary, not raw startsWith', () => {
    expect(aliasMatches('LIDERAZGO CAPACITACION', alias('a1', 'm1', 'prefix', 'LIDER'))).toBe(false);
  });

  it("contains — the mockup's own description", () => {
    expect(
      aliasMatches(
        'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL',
        alias('a1', 'm1', 'contains', 'LIDER'),
      ),
    ).toBe(true);
  });

  it('contains — boundary at the start of the string', () => {
    expect(aliasMatches('UBER BV', alias('a1', 'm1', 'contains', 'UBER'))).toBe(true);
  });

  it('contains — negative lookalike: token boundary, not raw includes', () => {
    expect(aliasMatches('UBERTO PANADERIA', alias('a1', 'm1', 'contains', 'UBER'))).toBe(false);
  });

  it('contains — normalization creates the boundary the raw string lacked', () => {
    expect(aliasMatches('MERPAGO*MERCADOLIBRE', alias('a1', 'm1', 'contains', 'MERCADOLIBRE'))).toBe(true);
  });

  it('contains — multi-token pattern, boundary on both ends', () => {
    expect(
      aliasMatches(
        'COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL',
        alias('a1', 'm1', 'contains', 'PEDRO DE VALDIVIA'),
      ),
    ).toBe(true);
  });

  it('contains — boundary at the end of the string', () => {
    expect(
      aliasMatches('COMPRA LIDER EXPRESS 15 PEDRO DE VALDIVIA SANTIAGO CL', alias('a1', 'm1', 'contains', 'CL')),
    ).toBe(true);
  });

  it.each<MerchantMatchType>(['exact', 'prefix', 'contains'])(
    'an empty (all-punctuation) pattern never matches (matchType=%s)',
    (matchType) => {
      expect(aliasMatches('UBER BV', alias('a1', 'm1', matchType, '***'))).toBe(false);
    },
  );

  it.each<MerchantMatchType>(['exact', 'prefix', 'contains'])(
    'an empty description matches nothing (matchType=%s)',
    (matchType) => {
      expect(aliasMatches('', alias('a1', 'm1', matchType, 'UBER'))).toBe(false);
    },
  );
});

describe('resolveMerchant', () => {
  it('specificity: exact beats contains', () => {
    const aliases = [alias('a1', 'm1', 'exact', 'ML CHILE SPA'), alias('a2', 'm2', 'contains', 'ML')];
    expect(resolveMerchant('ML CHILE SPA', aliases)).toMatchObject({ merchantId: 'm1', aliasId: 'a1' });
  });

  it('overlapping constructs: longest pattern wins within one strategy', () => {
    const aliases = [
      alias('a1', 'm2', 'prefix', 'MERCADOLIBRE'),
      alias('a2', 'm1', 'prefix', 'MERCADOLIBRE COMPRA'),
    ];
    expect(resolveMerchant('MERCADOLIBRE COMPRA ONLINE', aliases)).toMatchObject({
      merchantId: 'm1',
      aliasId: 'a2',
    });
  });

  it('specificity beats length', () => {
    const aliases = [
      alias('a1', 'm2', 'prefix', 'MERCADOLIBRE'),
      alias('a2', 'm1', 'exact', 'MERCADOLIBRE COMPRA ONLINE'),
    ];
    expect(resolveMerchant('MERCADOLIBRE COMPRA ONLINE', aliases)).toMatchObject({
      merchantId: 'm1',
      aliasId: 'a2',
    });
  });

  it('a full tie resolves to the lowest aliasId, asserted with the array passed in both orders', () => {
    const forward = [alias('a1', 'm1', 'contains', 'UBER'), alias('a2', 'm2', 'contains', 'UBER')];
    const reversed = [alias('a2', 'm2', 'contains', 'UBER'), alias('a1', 'm1', 'contains', 'UBER')];
    expect(resolveMerchant('UBER BV', forward)).toMatchObject({ merchantId: 'm1', aliasId: 'a1' });
    expect(resolveMerchant('UBER BV', reversed)).toMatchObject({ merchantId: 'm1', aliasId: 'a1' });
  });

  it('input order never affects the result — all 24 permutations of a four-alias set', () => {
    const aliases = [
      alias('a1', 'm1', 'exact', 'ML CHILE SPA'),
      alias('a2', 'm2', 'contains', 'ML'),
      alias('a3', 'm3', 'prefix', 'ML CHIL'),
      alias('a4', 'm4', 'contains', 'CHILE'),
    ];
    const expected = resolveMerchant('ML CHILE SPA', aliases);
    expect(expected).toMatchObject({ merchantId: 'm1', aliasId: 'a1' });
    for (const perm of permutations(aliases)) {
      expect(resolveMerchant('ML CHILE SPA', perm)).toEqual(expected);
    }
  });

  it('no match is null, never a guess', () => {
    const aliases = [alias('a1', 'm1', 'contains', 'UBER')];
    expect(resolveMerchant('***', aliases)).toBeNull();
  });

  it('an empty alias table returns null', () => {
    expect(resolveMerchant('UBER BV', [])).toBeNull();
  });
});
