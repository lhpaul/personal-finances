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
 * The exhaustive set of `TOUCH_METRICS` keys, one per pressable primitive built in this item
 * (plus a size/variant suffix where a primitive has more than one visual box). Declaring this
 * as a literal union — rather than typing `TOUCH_METRICS` as `Record<string, TouchMetrics>` —
 * means `TOUCH_METRICS.<typo>` is a compile error instead of a silent `undefined`, so a
 * misspelled key can never defeat the AC4 touch-target guarantee at runtime.
 */
export type TouchMetricsKey =
  | 'button'
  | 'buttonSm'
  | 'buttonGhost'
  | 'categoryChip'
  | 'transactionRow'
  | 'hero'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'segmentItem'
  | 'pill'
  | 'tabBarItem'
  | 'emptyStateAction'
  | 'sheetDismiss'
  | 'headerAction'
  | 'categoryRow'
  | 'bankRow'
  | 'noteAction'
  | 'topBarBtn'
  | 'listRow';

/**
 * One entry per pressable primitive built in this item, keyed by primitive (plus a size/variant
 * suffix where a primitive has more than one visual box). Components consume
 * `TOUCH_METRICS.<key>` directly; `apps/mobile/src/__tests__/touch-targets.test.ts` iterates
 * this **same** record and asserts every entry's effective target (visual box + `hitSlop`)
 * reaches `theme.touchTarget.min` on both axes — one enumeration, no drift.
 *
 * `segmentItem` (30) and `pill` (32) are *pre-hit-slop* input heights — both are below
 * `theme.touchTarget.min` on their own; `withMinTarget` is what brings their effective target
 * (height + hitSlop.top + hitSlop.bottom, exactly what `touch-targets.test.ts` asserts) up to
 * the minimum, the same way it does for `buttonSm` (40) and the checkbox/radio/switch pair.
 *
 * Extended in Steps 3 and 4 as more pressable primitives land. Non-pressable rendering modes
 * (`Checkbox`, `Radio`, `Switch` rendered inside a pressable row they don't own) are exempt and
 * are not listed here — see the implementation plan's Decision 4.
 */
export const TOUCH_METRICS = {
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
  tabBarItem: withMinTarget({ height: componentMetrics.tabBar.itemMinTouchHeight }),
  /** `EmptyState`'s action renders as `Button` `size="sm"` — same visual box as `buttonSm`,
   * listed under its own key because it is a distinct call site the plan names explicitly. */
  emptyStateAction: withMinTarget({ height: componentMetrics.button.heightSm }),
  sheetDismiss: withMinTarget({
    width: componentMetrics.sheet.grabWidth,
    height: componentMetrics.sheet.grabHeight,
  }),
  /** Home-screen implementation plan (issue #12), Step 5. */
  headerAction: withMinTarget({
    width: componentMetrics.screenHeader.actionSize,
    height: componentMetrics.screenHeader.actionSize,
  }),
  categoryRow: withMinTarget({ height: componentMetrics.categoryRow.minTouchHeight }),
  bankRow: withMinTarget({ height: componentMetrics.bankRow.minTouchHeight }),
  /** `Note`'s optional action (e.g. `sync-error`'s "Reintentar", found in review) — content-sized
   * like `transactionRow`/`bankRow`, using `note.lineHeight` as the visual box `withMinTarget`
   * expands from. */
  noteAction: withMinTarget({ height: componentMetrics.note.lineHeight }),
  /** `TopBar`'s back button (implementation plan for issue #9, Decision 10's contingency). */
  topBarBtn: withMinTarget({
    width: componentMetrics.topBar.buttonSize,
    height: componentMetrics.topBar.buttonSize,
  }),
  /** `ListRow` (implementation plan for issue #19, Decision 12). */
  listRow: withMinTarget({ height: componentMetrics.listRow.minTouchHeight }),
} satisfies Record<TouchMetricsKey, TouchMetrics>;
