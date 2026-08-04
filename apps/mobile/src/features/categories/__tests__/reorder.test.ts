import { moveItem, resolveDropIndex, type RowOffset } from '../reorder';

/** Scenario 12 of the implementation plan for issue #21's Testing Strategy. */
describe('moveItem', () => {
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op when from === to', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, 1)).toEqual(items);
  });

  it('never mutates its input', () => {
    const items = Object.freeze(['a', 'b', 'c']);
    expect(() => moveItem(items, 0, 2)).not.toThrow();
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('resolveDropIndex (equal-height rows)', () => {
  // Four adjacent rows of height 60: [0,60) [60,120) [120,180) [180,240).
  const offsets: RowOffset[] = [
    { top: 0, height: 60 },
    { top: 60, height: 60 },
    { top: 120, height: 60 },
    { top: 180, height: 60 },
  ];

  it('returns fromIndex for a translation smaller than half the neighbouring row', () => {
    // Half of the next row's height (60) is 30; 25 does not cross it.
    expect(resolveDropIndex({ offsets, fromIndex: 0, translationY: 25 })).toBe(0);
  });

  it('advances to the next row once the translation crosses half its height', () => {
    expect(resolveDropIndex({ offsets, fromIndex: 0, translationY: 35 })).toBe(1);
  });

  it('steps through multiple rows for a large downward translation, clamped at the end', () => {
    expect(resolveDropIndex({ offsets, fromIndex: 0, translationY: 200 })).toBe(3);
  });

  it('resolves an upward drag symmetrically', () => {
    expect(resolveDropIndex({ offsets, fromIndex: 3, translationY: -35 })).toBe(2);
    expect(resolveDropIndex({ offsets, fromIndex: 3, translationY: -25 })).toBe(3);
  });

  it('clamps at the start for a large upward translation', () => {
    expect(resolveDropIndex({ offsets, fromIndex: 3, translationY: -500 })).toBe(0);
  });

  it('returns fromIndex when translationY is 0', () => {
    expect(resolveDropIndex({ offsets, fromIndex: 1, translationY: 0 })).toBe(1);
  });
});

describe('resolveDropIndex (unequal-height rows)', () => {
  // Three rows of heights 40, 100, 60: [0,40) [40,140) [140,200).
  const offsets: RowOffset[] = [
    { top: 0, height: 40 },
    { top: 40, height: 100 },
    { top: 140, height: 60 },
  ];

  it('uses the target row’s own height for its half-height threshold, not a shared assumed height', () => {
    // Half of row 1's height (100) is 50 past its top (40) -> midpoint 90.
    // Dragged row's bottom starts at 40; a translation of 45 reaches 85 (< 90) -> no crossing.
    expect(resolveDropIndex({ offsets, fromIndex: 0, translationY: 45 })).toBe(0);
    // A translation of 55 reaches 95 (> 90) -> crosses into row 1.
    expect(resolveDropIndex({ offsets, fromIndex: 0, translationY: 55 })).toBe(1);
  });
});
