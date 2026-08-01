import { componentMetrics, theme } from '../../../theme';

export type HitSlop = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TouchMetrics = {
  /** The primitive's fixed visual width, when it has one. Omitted for full-width primitives. */
  width?: number;
  /** The primitive's visual height — never changed by this module. */
  height: number;
  /** Symmetric `hitSlop` that brings the *effective* touch target to `theme.touchTarget.min`
   * without changing the visual box. */
  hitSlop: HitSlop;
};

/**
 * Computes the `hitSlop` needed so a pressable's effective touch target reaches
 * `theme.touchTarget.min`, without changing its visual box.
 *
 * This is how AC4 (44pt touch targets) is satisfied without breaking mockup fidelity: several
 * mockup controls are visually smaller than 44 (`Button` size `sm` is 40, `CategoryChip`'s star
 * badge, `Checkbox`/`Radio` are 22, `Switch` is 27 tall, …). The visual box keeps the mockup
 * geometry; the effective touch area is expanded with `hitSlop`.
 *
 * See the implementation plan's Decision 4 (one shared touch-target module) for the full
 * rationale.
 */
export function withMinTarget(size: { width?: number; height: number }): TouchMetrics {
  const min = theme.touchTarget.min;
  const vertical = Math.max(0, Math.ceil((min - size.height) / 2));
  const horizontal =
    size.width === undefined ? 0 : Math.max(0, Math.ceil((min - size.width) / 2));

  return {
    ...(size.width === undefined ? {} : { width: size.width }),
    height: size.height,
    hitSlop: { top: vertical, bottom: vertical, left: horizontal, right: horizontal },
  };
}

/**
 * One entry per pressable primitive built in this item, keyed by primitive (plus a size/variant
 * suffix where a primitive has more than one visual box). Components consume
 * `TOUCH_METRICS.<key>` directly; `apps/mobile/src/__tests__/touch-targets.test.ts` iterates
 * this **same** record and asserts every entry's effective target (visual box + `hitSlop`)
 * reaches `theme.touchTarget.min` on both axes — one enumeration, no drift.
 *
 * Extended in Steps 3 and 4 as more pressable primitives land. Non-pressable rendering modes
 * (`Checkbox`, `Radio`, `Switch` rendered inside a pressable row they don't own) are exempt and
 * are not listed here — see the implementation plan's Decision 4.
 */
export const TOUCH_METRICS: Record<string, TouchMetrics> = {
  button: withMinTarget({ height: componentMetrics.button.height }),
  buttonSm: withMinTarget({ height: componentMetrics.button.heightSm }),
  buttonGhost: withMinTarget({ height: componentMetrics.button.heightGhost }),
  categoryChip: withMinTarget({ height: componentMetrics.categoryChip.minHeight }),
  transactionRow: withMinTarget({ height: componentMetrics.transactionRow.minTouchHeight }),
  hero: withMinTarget({ height: componentMetrics.hero.minTouchHeight }),
  checkbox: withMinTarget({
    width: componentMetrics.checkbox.size,
    height: componentMetrics.checkbox.size,
  }),
  radio: withMinTarget({
    width: componentMetrics.radio.size,
    height: componentMetrics.radio.size,
  }),
  switch: withMinTarget({
    width: componentMetrics.switchControl.width,
    height: componentMetrics.switchControl.height,
  }),
  segmentItem: withMinTarget({ height: componentMetrics.segment.itemMinTouchHeight }),
  pill: withMinTarget({ height: componentMetrics.pill.minTouchHeight }),
};
