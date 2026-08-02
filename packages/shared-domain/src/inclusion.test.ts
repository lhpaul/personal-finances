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

  it('every individual case object is also frozen, not just the outer array (CodeRabbit finding on PR #44)', () => {
    for (const row of INCLUSION_RULE_CASES) {
      expect(Object.isFrozen(row)).toBe(true);
    }
  });

  it('the blocking case (partial) is not the same number as the full case', () => {
    // Guards against a regression that silently makes `partial` collapse into `full`.
    const partial = INCLUSION_RULE_CASES.find((c) => c.key === 'partial');
    expect(partial?.expectedContribution).toBe(21000);
    expect(partial?.expectedContribution).not.toBe(partial?.amount);
  });

  it('every documented case still passes isIncludedInAnalysis/effectiveAmount/contributedAmount without throwing', () => {
    for (const row of INCLUSION_RULE_CASES) {
      const fields = { amount: row.amount, includedAmount: row.includedAmount, excludedAt: row.excludedAt };
      expect(() => isIncludedInAnalysis(fields)).not.toThrow();
      expect(() => effectiveAmount(fields)).not.toThrow();
      expect(() => contributedAmount(fields)).not.toThrow();
    }
  });
});

describe('Business Rule 8 — amounts are integers in minor units', () => {
  it.each([1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'effectiveAmount throws TypeError when amount is %p',
    (amount) => {
      expect(() => effectiveAmount({ amount, includedAmount: null, excludedAt: null })).toThrow(TypeError);
    },
  );

  it.each([1.5, NaN, Infinity, -Infinity])(
    'effectiveAmount throws TypeError when includedAmount is %p (and amount is otherwise valid)',
    (includedAmount) => {
      expect(() => effectiveAmount({ amount: 1000, includedAmount, excludedAt: null })).toThrow(TypeError);
    },
  );

  it('a null includedAmount never triggers the includedAmount guard', () => {
    expect(() => effectiveAmount({ amount: 1000, includedAmount: null, excludedAt: null })).not.toThrow();
  });

  it('effectiveAmount throws RangeError when amount is a negative safe integer (CodeRabbit finding on PR #44)', () => {
    // docs/project/4-database-model.md: transactions.amount is "always positive". Rejecting a
    // negative amount here — rather than letting it silently reach apportionTenths's own
    // negative-weight RangeError as a confusing downstream failure — makes the domain boundary
    // the place the rejection happens.
    expect(() => effectiveAmount({ amount: -1000, includedAmount: null, excludedAt: null })).toThrow(RangeError);
  });

  it('effectiveAmount throws RangeError when includedAmount is a negative safe integer', () => {
    expect(() => effectiveAmount({ amount: 1000, includedAmount: -500, excludedAt: null })).toThrow(RangeError);
  });

  it('zero is not negative: amount 0 and includedAmount 0 both pass (the zero-amount and partial-zero cases)', () => {
    expect(() => effectiveAmount({ amount: 0, includedAmount: null, excludedAt: null })).not.toThrow();
    expect(() => effectiveAmount({ amount: 1000, includedAmount: 0, excludedAt: null })).not.toThrow();
  });

  it('contributedAmount propagates the same guard when the movement is included', () => {
    expect(() => contributedAmount({ amount: 1.5, includedAmount: null, excludedAt: null })).toThrow(TypeError);
  });

  it('every returned value across INCLUSION_RULE_CASES is a safe integer', () => {
    for (const row of INCLUSION_RULE_CASES) {
      const fields = { amount: row.amount, includedAmount: row.includedAmount, excludedAt: row.excludedAt };
      expect(Number.isSafeInteger(effectiveAmount(fields))).toBe(true);
      expect(Number.isSafeInteger(contributedAmount(fields))).toBe(true);
    }
  });
});

describe('Business Rule 1 — no thrown message interpolates its input', () => {
  it('the two TypeError messages are fixed sentences that never echo the received value', () => {
    const injectedValue = 987654.321;
    try {
      effectiveAmount({ amount: injectedValue, includedAmount: null, excludedAt: null });
      throw new Error('expected effectiveAmount to throw');
    } catch (error) {
      expect((error as Error).message).toBe('effectiveAmount: amount must be a safe-integer minor-unit value');
      expect((error as Error).message).not.toContain(String(injectedValue));
    }
    try {
      effectiveAmount({ amount: 1000, includedAmount: injectedValue, excludedAt: null });
      throw new Error('expected effectiveAmount to throw');
    } catch (error) {
      expect((error as Error).message).toBe(
        'effectiveAmount: includedAmount must be a safe-integer minor-unit value',
      );
      expect((error as Error).message).not.toContain(String(injectedValue));
    }
  });

  it('the two RangeError messages for negative amounts are also fixed sentences that never echo the received value', () => {
    const injectedNegativeAmount = -123456;
    try {
      effectiveAmount({ amount: injectedNegativeAmount, includedAmount: null, excludedAt: null });
      throw new Error('expected effectiveAmount to throw');
    } catch (error) {
      expect((error as Error).message).toBe('effectiveAmount: amount must not be negative');
      expect((error as Error).message).not.toContain(String(injectedNegativeAmount));
    }
    try {
      effectiveAmount({ amount: 1000, includedAmount: injectedNegativeAmount, excludedAt: null });
      throw new Error('expected effectiveAmount to throw');
    } catch (error) {
      expect((error as Error).message).toBe('effectiveAmount: includedAmount must not be negative');
      expect((error as Error).message).not.toContain(String(injectedNegativeAmount));
    }
  });

  it('isIncludedInAnalysis never throws (it only reads excludedAt, never money)', () => {
    for (const row of INCLUSION_RULE_CASES) {
      const fields = { amount: row.amount, includedAmount: row.includedAmount, excludedAt: row.excludedAt };
      expect(() => isIncludedInAnalysis(fields)).not.toThrow();
    }
  });
});
