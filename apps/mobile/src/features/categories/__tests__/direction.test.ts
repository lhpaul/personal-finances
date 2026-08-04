import { CATEGORY_DIRECTIONS, incomeFlagFor } from '../direction';

describe('direction (implementation plan for issue #21, Decision 7)', () => {
  it('lists both directions, expense first', () => {
    expect(CATEGORY_DIRECTIONS).toEqual(['expense', 'income']);
  });

  it('incomeFlagFor maps expense to 0 and income to 1', () => {
    expect(incomeFlagFor('expense')).toBe(0);
    expect(incomeFlagFor('income')).toBe(1);
  });
});
