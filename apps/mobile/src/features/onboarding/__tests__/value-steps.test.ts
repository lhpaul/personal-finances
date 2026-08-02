import { VALUE_STEPS, nextStepIndex, stepIndexFromScrollOffset } from '../value-steps';

/** Testing Strategy scenario 4. */
describe('stepIndexFromScrollOffset', () => {
  const pageWidth = 393;
  const total = VALUE_STEPS.length;

  it('offset 0 -> index 0', () => {
    expect(stepIndexFromScrollOffset(0, pageWidth, total)).toBe(0);
  });

  it('offset exactly at page 2 -> index 1', () => {
    expect(stepIndexFromScrollOffset(pageWidth, pageWidth, total)).toBe(1);
  });

  it('a half-scrolled offset rounds to the nearer page', () => {
    expect(stepIndexFromScrollOffset(pageWidth * 1.4, pageWidth, total)).toBe(1);
    expect(stepIndexFromScrollOffset(pageWidth * 1.6, pageWidth, total)).toBe(2);
  });

  it('clamps at the last page — an overscroll never returns an out-of-range index', () => {
    expect(stepIndexFromScrollOffset(pageWidth * 10, pageWidth, total)).toBe(total - 1);
  });

  it('clamps at 0 — a negative (bounce) offset never returns a negative index', () => {
    expect(stepIndexFromScrollOffset(-50, pageWidth, total)).toBe(0);
  });

  it('a zero or negative pageWidth returns 0 rather than NaN/Infinity', () => {
    expect(stepIndexFromScrollOffset(100, 0, total)).toBe(0);
    expect(stepIndexFromScrollOffset(100, -10, total)).toBe(0);
  });

  it('total <= 0 returns 0', () => {
    expect(stepIndexFromScrollOffset(100, pageWidth, 0)).toBe(0);
  });
});

describe('nextStepIndex', () => {
  it('advances by one', () => {
    expect(nextStepIndex(0, 3)).toBe(1);
    expect(nextStepIndex(1, 3)).toBe(2);
  });

  it('clamps at the last page — the last page has no next index', () => {
    expect(nextStepIndex(2, 3)).toBe(2);
  });

  it('total <= 0 returns 0', () => {
    expect(nextStepIndex(0, 0)).toBe(0);
  });
});
