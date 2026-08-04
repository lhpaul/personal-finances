import type { IsoWeekday } from '../types';
import { toPlatformWeekday } from '../weekday';

/**
 * Implementation plan for issue #18, Decision 4, Testing Strategy scenario 8: all seven ISO ->
 * platform weekday pairs pinned explicitly, rather than re-deriving the `(iso % 7) + 1` formula in
 * the assertion — a formula bug and its "self-check" would otherwise agree with each other.
 */
describe('toPlatformWeekday (ISO 1=Monday…7=Sunday -> platform 1=Sunday…7=Saturday)', () => {
  it.each<[IsoWeekday, number]>([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 1],
  ])('ISO %i -> platform %i', (iso, platform) => {
    expect(toPlatformWeekday(iso)).toBe(platform);
  });
});
