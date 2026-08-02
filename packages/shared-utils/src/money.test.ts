import { formatClp, formatClpAbbreviated, formatThousands, isValidMoneyMinorUnits } from './money';

describe('money', () => {
  describe('formatClp — Group A: every mockup literal', () => {
    const cases: Array<[number, Parameters<typeof formatClp>[1], string, string]> = [
      [0, undefined, '$0', 'mu-amount">$0<'],
      [42000, { direction: 'out' }, '$42.000', 'mu-tx__amount">$42.000<'],
      [35000, { direction: 'out' }, '$35.000', 'DS card line 2565'],
      [46700, undefined, '$46.700', 'mu-amount mu-mt1'],
      [60200, undefined, '$60.200', 'mu-amount'],
      [412000, { direction: 'out' }, '$412.000', 'mu-amount--out'],
      [508400, undefined, '$508.400', 'mu-amount'],
      [1200000, { direction: 'in' }, '+$1.200.000', 'line 1532'],
      [2500000, { direction: 'in' }, '+$2.500.000', 'DS card line 2564'],
      [1200000, { direction: 'in', signDisplay: 'never' }, '$1.200.000', 'line 1195 (hero, --in, unsigned)'],
      [1352470, { direction: 'out' }, '$1.352.470', 'mu-amount--out'],
      [1842300, undefined, '$1.842.300', 'mu-amount'],
      [3700000, { direction: 'in', signDisplay: 'never' }, '$3.700.000', 'line 1864'],
      [32100000, { direction: 'out' }, '$32.100.000', 'mu-amount--out'],
      [38400000, { direction: 'in', signDisplay: 'never' }, '$38.400.000', 'line 2065'],
    ];

    it.each(cases)('formatClp(%p, %p) -> %p (%s)', (input, options, expected) => {
      expect(formatClp(input, options)).toBe(expected);
    });
  });

  describe('formatClp — Group B: the sign rule as a truth table (Decision 4)', () => {
    const directions: Array<'in' | 'out' | 'neutral'> = ['in', 'out', 'neutral'];
    const magnitudes: Array<[number, string]> = [
      [500000, 'positive'],
      [0, 'zero'],
      [-500000, 'negative'],
    ];

    for (const direction of directions) {
      for (const [value, label] of magnitudes) {
        it(`direction=${direction}, amount=${label} (signDisplay: directional)`, () => {
          const result = formatClp(value, { direction, signDisplay: 'directional' });
          if (value === 0) {
            expect(result).toBe('$0');
          } else if (value < 0) {
            expect(result.charCodeAt(0)).toBe(0x2212);
            expect(result).toBe('−$500.000');
          } else if (direction === 'in') {
            expect(result).toBe('+$500.000');
          } else {
            expect(result).toBe('$500.000');
          }
        });
      }
    }

    for (const direction of directions) {
      it(`direction=${direction}, negative amount, signDisplay: never`, () => {
        expect(formatClp(-500000, { direction, signDisplay: 'never' })).toBe('$500.000');
      });
    }

    it('zero is never signed, even with direction: in', () => {
      expect(formatClp(0, { direction: 'in' })).toBe('$0');
    });

    it('negative sign is U+2212, not a hyphen-minus', () => {
      const result = formatClp(-500000);
      expect(result.charCodeAt(0)).toBe(0x2212);
      expect(result).toBe('−$500.000');
    });

    it('signDisplay: never strips the negative sign', () => {
      expect(formatClp(-500000, { signDisplay: 'never' })).toBe('$500.000');
    });

    it('direction: out never adds a sign', () => {
      expect(formatClp(1200000, { direction: 'out' })).toBe('$1.200.000');
    });
  });

  describe('formatThousands / formatClp — Group C: grouping boundaries', () => {
    const cases: Array<[number, string]> = [
      [0, '$0'],
      [1, '$1'],
      [999, '$999'],
      [1000, '$1.000'],
      [9999, '$9.999'],
      [10000, '$10.000'],
      [999999, '$999.999'],
      [1000000, '$1.000.000'],
      [1000000000, '$1.000.000.000'],
      [Number.MAX_SAFE_INTEGER, '$9.007.199.254.740.991'],
    ];

    it.each(cases)('formatClp(%p) -> %p', (input, expected) => {
      expect(formatClp(input)).toBe(expected);
    });

    it('never emits a comma or a non-breaking space (no Intl fallback, Decision 1)', () => {
      for (const [input] of cases) {
        const result = formatClp(input);
        expect(result).not.toContain(',');
        expect(result).not.toContain(' ');
      }
      expect(formatClp(-1234567)).not.toContain(',');
    });
  });

  describe('formatClp / formatThousands / isValidMoneyMinorUnits — Group D: invalid input', () => {
    const invalidNumbers = [
      1200.5,
      -1200.5,
      0.5,
      NaN,
      Infinity,
      -Infinity,
      1e21,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    it.each(invalidNumbers)('formatClp(%p) throws TypeError', (input) => {
      expect(() => formatClp(input)).toThrow(TypeError);
    });

    const invalidUnknownValues: unknown[] = ['1200', null, undefined];

    it.each(invalidUnknownValues)('formatClp(%p as unknown) throws TypeError', (input) => {
      expect(() => formatClp(input as unknown as number)).toThrow(TypeError);
    });

    it('formatThousands(-1) throws TypeError', () => {
      expect(() => formatThousands(-1)).toThrow(TypeError);
    });

    it.each([...invalidNumbers, ...invalidUnknownValues])(
      'isValidMoneyMinorUnits(%p) is false',
      (value) => {
        expect(isValidMoneyMinorUnits(value)).toBe(false);
      },
    );

    it.each([0, -1, 1200])('isValidMoneyMinorUnits(%p) is true', (value) => {
      expect(isValidMoneyMinorUnits(value)).toBe(true);
    });
  });

  describe('formatClpAbbreviated — Group E: abbreviation tiers and rounding (Decision 6)', () => {
    const cases: Array<[number, Parameters<typeof formatClpAbbreviated>[1], string, string]> = [
      [3700000, undefined, '3.7M', 'mockup line 1472'],
      [1352470, undefined, '1.4M', 'proves half-up at the tenth (13.5247 -> 14)'],
      [2347530, { direction: 'in' }, '+2.3M', 'mockup line 1484'],
      [279000, { withCurrencySymbol: true }, '$279K', 'mockup line 1515'],
      [235000, { withCurrencySymbol: true }, '$235K', 'mockup line 1516'],
      [193000, { withCurrencySymbol: true }, '$193K', 'mockup line 1517'],
      [156000, { withCurrencySymbol: true }, '$156K', 'mockup line 1518'],
      [0, undefined, '0', 'zero has no tier and no sign'],
      [999, undefined, '999', 'below the K tier'],
      [1000, undefined, '1K', 'exact K tier entry'],
      [1499, undefined, '1K', 'rounds down'],
      [1500, undefined, '2K', 'half rounds up'],
      [999499, undefined, '999K', 'just below promotion'],
      [999500, undefined, '1.0M', 'tier promotion — never 1.000K'],
      [1000000, undefined, '1.0M', 'exact M tier entry'],
      [1049999, undefined, '1.0M', 'rounds down to the tenth'],
      [1050000, undefined, '1.1M', 'half rounds up at the tenth'],
      [4000000, undefined, '4.0M', 'trailing .0 is kept'],
      [-1500, undefined, '−2K', 'half-away-from-zero on the magnitude'],
      [-3700000, { withCurrencySymbol: true }, '−$3.7M', 'sign precedes the symbol'],
      [1000000000, undefined, '1000.0M', 'ungrouped whole part'],
      [
        Number.MAX_SAFE_INTEGER,
        undefined,
        '9007199254.7M',
        'divideRoundHalfUp stays exact past 2^53',
      ],
    ];

    it.each(cases)('formatClpAbbreviated(%p, %p) -> %p (%s)', (input, options, expected) => {
      expect(formatClpAbbreviated(input, options)).toBe(expected);
    });

    it('the negative-magnitude U+2212 codepoint is asserted explicitly', () => {
      expect(formatClpAbbreviated(-1500).charCodeAt(0)).toBe(0x2212);
    });

    it.each([
      1200.5,
      -1200.5,
      0.5,
      NaN,
      Infinity,
      -Infinity,
      1e21,
      Number.MAX_SAFE_INTEGER + 1,
    ])('formatClpAbbreviated(%p) throws TypeError', (input) => {
      expect(() => formatClpAbbreviated(input)).toThrow(TypeError);
    });

    it.each(['1200', null, undefined])(
      'formatClpAbbreviated(%p as unknown) throws TypeError',
      (input) => {
        expect(() => formatClpAbbreviated(input as unknown as number)).toThrow(TypeError);
      },
    );
  });
});
