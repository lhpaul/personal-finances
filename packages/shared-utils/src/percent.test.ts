import { formatPercentTenths, PERCENT_DECIMAL_SEPARATOR } from './percent';

/** Scenario 16 of the home-screen implementation plan's Testing Strategy. */
describe('percent', () => {
  it('exports the Chilean comma as PERCENT_DECIMAL_SEPARATOR', () => {
    expect(PERCENT_DECIMAL_SEPARATOR).toBe(',');
  });

  it.each([
    [206, '20,6%'],
    [1000, '100,0%'],
    [0, '0,0%'],
    [5, '0,5%'],
    [999, '99,9%'],
    [10, '1,0%'],
  ])('formatPercentTenths(%p) -> %p', (tenths, expected) => {
    expect(formatPercentTenths(tenths)).toBe(expected);
  });

  it('renders a negative value with the U+2212 minus sign, not a hyphen', () => {
    expect(formatPercentTenths(-50)).toBe('−5,0%');
  });

  it.each([1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'throws TypeError on the non-safe-integer input %p',
    (input) => {
      expect(() => formatPercentTenths(input)).toThrow(TypeError);
    },
  );
});
