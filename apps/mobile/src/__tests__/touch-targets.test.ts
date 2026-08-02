import { TOUCH_METRICS } from '../components/ui/_internal/touch-metrics';
import { theme } from '../theme';

describe('touch targets (AC4)', () => {
  const entries = Object.entries(TOUCH_METRICS);

  it('has at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s reaches theme.touchTarget.min on the vertical axis', (_key, metrics) => {
    const effectiveHeight = metrics.height + metrics.hitSlop.top + metrics.hitSlop.bottom;
    expect(effectiveHeight).toBeGreaterThanOrEqual(theme.touchTarget.min);
  });

  const fixedWidthEntries = entries.filter(([, metrics]) => metrics.width !== undefined);

  // `it.each` throws on an empty table — Steps 2's entries are all full-width/content-driven;
  // Steps 3-4 add fixed-width pressables (checkbox, radio, switch, …). Guard so this suite
  // stays meaningful at every step instead of vacuously skipping once width-bearing entries
  // exist.
  if (fixedWidthEntries.length > 0) {
    it.each(fixedWidthEntries)(
      '%s reaches theme.touchTarget.min on the horizontal axis when width is fixed',
      (_key, metrics) => {
        const width = metrics.width;
        if (width === undefined) throw new Error('expected a fixed width');
        const effectiveWidth = width + metrics.hitSlop.left + metrics.hitSlop.right;
        expect(effectiveWidth).toBeGreaterThanOrEqual(theme.touchTarget.min);
      },
    );
  } else {
    it('has no fixed-width entries yet (expected until Step 3 adds checkbox/radio/switch)', () => {
      expect(fixedWidthEntries).toHaveLength(0);
    });
  }
});
