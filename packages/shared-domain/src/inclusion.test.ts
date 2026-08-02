import { contributedAmount, effectiveAmount, INCLUSION_RULE_CASES, isIncludedInAnalysis } from './inclusion';

describe('inclusion — Business Rule 4, AC2', () => {
  describe.each(INCLUSION_RULE_CASES)('$key ($reason)', (row) => {
    const fields = { amount: row.amount, includedAmount: row.includedAmount, excludedAt: row.excludedAt };

    it(`isIncludedInAnalysis -> ${String(row.expectedIsIncluded)}`, () => {
      expect(isIncludedInAnalysis(fields)).toBe(row.expectedIsIncluded);
    });

    it(`effectiveAmount -> ${String(row.expectedEffectiveAmount)}`, () => {
      expect(effectiveAmount(fields)).toBe(row.expectedEffectiveAmount);
    });

    it(`contributedAmount -> ${String(row.expectedContribution)}`, () => {
      expect(contributedAmount(fields)).toBe(row.expectedContribution);
    });
  });

  it('exports exactly the seven documented cases', () => {
    expect(INCLUSION_RULE_CASES).toHaveLength(7);
    expect(INCLUSION_RULE_CASES.map((c) => c.key)).toEqual([
      'full',
      'partial',
      'partial-zero',
      'partial-equal',
      'excluded',
      'excluded-partial',
      'zero-amount',
    ]);
  });

  it('is frozen — a specification artifact, not a mutable fixture', () => {
    expect(Object.isFrozen(INCLUSION_RULE_CASES)).toBe(true);
  });

  it('the blocking case (partial) is not the same number as the full case', () => {
    // Guards against a regression that silently makes `partial` collapse into `full`.
    const partial = INCLUSION_RULE_CASES.find((c) => c.key === 'partial');
    expect(partial?.expectedContribution).toBe(21000);
    expect(partial?.expectedContribution).not.toBe(partial?.amount);
  });
});

describe('Business Rule 1 — no thrown message interpolates its input', () => {
  it('none of this module\'s three functions ever throws', () => {
    // isIncludedInAnalysis, effectiveAmount and contributedAmount are total functions over
    // MovementInclusionFields — there is no invalid input shape that reaches a throw, so this
    // module has no interpolated-message surface to test (vacuously satisfies Business Rule 1).
    for (const row of INCLUSION_RULE_CASES) {
      const fields = { amount: row.amount, includedAmount: row.includedAmount, excludedAt: row.excludedAt };
      expect(() => isIncludedInAnalysis(fields)).not.toThrow();
      expect(() => effectiveAmount(fields)).not.toThrow();
      expect(() => contributedAmount(fields)).not.toThrow();
    }
  });
});
