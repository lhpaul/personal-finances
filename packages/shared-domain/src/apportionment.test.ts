import { apportionTenths, PERCENTAGE_TENTHS_TOTAL } from './apportionment';

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

function sumOf(map: Map<string, number>): number {
  return [...map.values()].reduce((a, b) => a + b, 0);
}

describe('apportionment — AC4', () => {
  it('exports PERCENTAGE_TENTHS_TOTAL as 1000', () => {
    expect(PERCENTAGE_TENTHS_TOTAL).toBe(1000);
  });

  it('three equal thirds sum to exactly 1000 (naive rounding gets 999)', () => {
    const result = apportionTenths([
      { key: 'a', weight: 1000 },
      { key: 'b', weight: 1000 },
      { key: 'c', weight: 1000 },
    ]);
    expect(Object.fromEntries(result)).toEqual({ a: 334, b: 333, c: 333 });
    expect(sumOf(result)).toBe(1000);
  });

  it('Fixture A — comida 42000 / compras 21000 -> 667 / 333', () => {
    const result = apportionTenths([
      { key: 'comida', weight: 42000 },
      { key: 'compras', weight: 21000 },
    ]);
    expect(Object.fromEntries(result)).toEqual({ comida: 667, compras: 333 });
    expect(sumOf(result)).toBe(1000);
  });

  it('Fixture C — comida 42000 / compras 21000 / null 21000 -> 500 / 250 / 250 (exact, no leftover)', () => {
    const result = apportionTenths([
      { key: 'comida', weight: 42000 },
      { key: 'compras', weight: 21000 },
      { key: 'null-bucket', weight: 21000 },
    ]);
    expect(Object.fromEntries(result)).toEqual({ comida: 500, compras: 250, 'null-bucket': 250 });
    expect(sumOf(result)).toBe(1000);
  });

  it('Fixture D — tie-break determinism: every permutation of a fully tied input is byte-identical', () => {
    const base = [
      { key: 'comida', weight: 1000 },
      { key: 'compras', weight: 1000 },
      { key: 'salud', weight: 1000 },
    ];
    const expected = { comida: 334, compras: 333, salud: 333 };
    for (const perm of permutations(base)) {
      const result = apportionTenths(perm);
      expect(Object.fromEntries(result)).toEqual(expected);
    }
  });

  describe('the two documented exceptions to the sum invariant', () => {
    it('total weight 0 -> every bucket 0, sum 0', () => {
      const result = apportionTenths([
        { key: 'a', weight: 0 },
        { key: 'b', weight: 0 },
      ]);
      expect(Object.fromEntries(result)).toEqual({ a: 0, b: 0 });
      expect(sumOf(result)).toBe(0);
    });

    it('empty input -> empty map', () => {
      const result = apportionTenths([]);
      expect(result.size).toBe(0);
    });
  });

  it('a zero-weight bucket never takes a leftover tenth ahead of a positive-remainder bucket', () => {
    const result = apportionTenths([
      { key: 'a', weight: 1 },
      { key: 'b', weight: 2 },
      { key: 'c', weight: 0 },
    ]);
    expect(Object.fromEntries(result)).toEqual({ a: 333, b: 667, c: 0 });
    expect(sumOf(result)).toBe(1000);
  });

  it('exactness: a case whose quotients are exact distributes no leftover at all', () => {
    // Same shape as Fixture C, restated to make the "no leftover" claim explicit.
    const result = apportionTenths([
      { key: 'a', weight: 500 },
      { key: 'b', weight: 250 },
      { key: 'c', weight: 250 },
    ]);
    expect(Object.fromEntries(result)).toEqual({ a: 500, b: 250, c: 250 });
  });

  it('BigInt exactness: weights near Number.MAX_SAFE_INTEGER / 1000 still sum to exactly 1000', () => {
    // Each weight * PERCENTAGE_TENTHS_TOTAL individually exceeds Number.MAX_SAFE_INTEGER
    // (3e15 * 1000 = 3e18), which a float-based (Number) implementation would compute with
    // precision loss. The BigInt path computes it exactly.
    const bigWeight = 3_000_000_000_000_000;
    expect(bigWeight * PERCENTAGE_TENTHS_TOTAL).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    const result = apportionTenths([
      { key: 'a', weight: bigWeight },
      { key: 'b', weight: bigWeight },
      { key: 'c', weight: bigWeight },
    ]);
    expect(Object.fromEntries(result)).toEqual({ a: 334, b: 333, c: 333 });
    expect(sumOf(result)).toBe(1000);
  });

  it('a seven-bucket case sums to exactly 1000', () => {
    const result = apportionTenths([
      { key: 'k1', weight: 130 },
      { key: 'k2', weight: 95 },
      { key: 'k3', weight: 310 },
      { key: 'k4', weight: 47 },
      { key: 'k5', weight: 12 },
      { key: 'k6', weight: 88 },
      { key: 'k7', weight: 260 },
    ]);
    expect(result.size).toBe(7);
    expect(sumOf(result)).toBe(1000);
  });

  it('a 1000-bucket case (deterministic generator: weight_i = i + 1) sums to exactly 1000', () => {
    const entries = Array.from({ length: 1000 }, (_, i) => ({ key: `k${i}`, weight: i + 1 }));
    const result = apportionTenths(entries);
    expect(result.size).toBe(1000);
    expect(sumOf(result)).toBe(1000);
  });

  it('the mockup-shaped five-bucket expense distribution sums to exactly 1000', () => {
    // Weights proportional to #screen=dashboard's expense donut legend (20,6% / 17,4% / 14,3% /
    // 13,3% / 11,8%). The mockup's percentages are derived from abbreviated amounts (Note on the
    // mockup's own percentages, plan Verification Log), so this fixture asserts the sum
    // invariant and granularity, not an exact reproduction of the displayed figures.
    const result = apportionTenths([
      { key: 'comida', weight: 206 },
      { key: 'transporte', weight: 174 },
      { key: 'entretenimiento', weight: 143 },
      { key: 'salud', weight: 133 },
      { key: 'compras', weight: 118 },
    ]);
    expect(result.size).toBe(5);
    expect(sumOf(result)).toBe(1000);
  });

  describe('guards', () => {
    it('throws RangeError on a negative weight', () => {
      expect(() => apportionTenths([{ key: 'a', weight: -1 }])).toThrow(RangeError);
    });

    it('throws TypeError on a non-integer weight', () => {
      expect(() => apportionTenths([{ key: 'a', weight: 1.5 }])).toThrow(TypeError);
    });

    it('throws TypeError on a non-safe-integer weight (NaN)', () => {
      expect(() => apportionTenths([{ key: 'a', weight: NaN }])).toThrow(TypeError);
    });

    it('throws RangeError on a duplicate key', () => {
      expect(() =>
        apportionTenths([
          { key: 'a', weight: 1 },
          { key: 'a', weight: 2 },
        ]),
      ).toThrow(RangeError);
    });
  });

  describe('planted-violation cycle (naive per-bucket rounding fails the sum invariant)', () => {
    it('demonstrates that Math.round(weight * 1000 / total) does NOT sum to 1000 for three equal thirds', () => {
      // This is the failure the real implementation must avoid; it is asserted here as a
      // standalone negative-control computation, not by mutating apportionment.ts (see the PR
      // description for the full four-phase planted-violation transcript run against the real
      // source file).
      const weights = [1000, 1000, 1000];
      const total = weights.reduce((a, b) => a + b, 0);
      const naive = weights.map((w) => Math.round((w * PERCENTAGE_TENTHS_TOTAL) / total));
      const naiveSum = naive.reduce((a, b) => a + b, 0);
      expect(naiveSum).toBe(999);
      expect(naiveSum).not.toBe(PERCENTAGE_TENTHS_TOTAL);
    });
  });
});
