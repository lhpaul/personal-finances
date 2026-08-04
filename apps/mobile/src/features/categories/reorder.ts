/**
 * Drag-to-reorder geometry (implementation plan for issue #21, Decision 10). Pure and React-free
 * — the only decision logic behind `components/CategoryReorderList.tsx`'s `PanResponder` shell, so
 * only the shell can be wrong; this module is what scenario 12 unit-tests directly.
 */

/** Moves the item at `from` to `to`, shifting the items between. A no-op (returns a shallow copy)
 * when `from === to`. Never mutates `items`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = items.slice();
  if (from === to) return copy;
  const [moved] = copy.splice(from, 1);
  if (moved === undefined) return copy;
  copy.splice(to, 0, moved);
  return copy;
}

/** One row's measured vertical geometry (`View.onLayout`), so variable-height rows (some carry a
 * subtitle, some do not) are handled by measurement rather than an assumed row height. */
export interface RowOffset {
  top: number;
  height: number;
}

/**
 * Resolves which index the dragged row (originally at `fromIndex`) should land at, given how far
 * it has been dragged (`translationY`, positive = down) over the other rows' measured `offsets`.
 *
 * Compares the dragged row's *leading edge* in the direction of travel — its bottom edge while
 * dragging down, its top edge while dragging up — against each neighbour's *midpoint* in that
 * direction: the drop index advances past a neighbour only once that edge has crossed the
 * neighbour's midpoint. For two adjacent rows this is exactly "past half the neighbouring row",
 * so a translation smaller than half the next row's height returns `fromIndex` unchanged, and it
 * still holds when rows have unequal heights (each neighbour's own height sets its own
 * half-height threshold, not a shared assumed row height). Clamps to
 * `[0, offsets.length - 1]` at both ends.
 */
export function resolveDropIndex(params: {
  offsets: readonly RowOffset[];
  fromIndex: number;
  translationY: number;
}): number {
  const { offsets, fromIndex, translationY } = params;
  const fromOffset = offsets[fromIndex];
  if (fromOffset === undefined || offsets.length === 0) return fromIndex;

  let index = fromIndex;

  if (translationY > 0) {
    const draggedBottom = fromOffset.top + fromOffset.height + translationY;
    for (let i = fromIndex + 1; i < offsets.length; i++) {
      const candidate = offsets[i];
      if (candidate === undefined) break;
      const candidateMidpoint = candidate.top + candidate.height / 2;
      if (draggedBottom > candidateMidpoint) {
        index = i;
      } else {
        break;
      }
    }
  } else if (translationY < 0) {
    const draggedTop = fromOffset.top + translationY;
    for (let i = fromIndex - 1; i >= 0; i--) {
      const candidate = offsets[i];
      if (candidate === undefined) break;
      const candidateMidpoint = candidate.top + candidate.height / 2;
      if (draggedTop < candidateMidpoint) {
        index = i;
      } else {
        break;
      }
    }
  }

  return Math.max(0, Math.min(offsets.length - 1, index));
}
