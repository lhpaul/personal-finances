/**
 * The three `onboarding-value` carousel pages (implementation plan Decision 4). `VALUE_STEPS` is
 * the single ordered source for the pages, the `Dots` primitive, and
 * `value-steps-manifest-parity.test.ts`'s claim that every manifest-declared state is
 * implemented (non-negotiable 6). The mapping is fixed: `step-1` = index 0, `step-2` = index 1,
 * `step-3` = index 2.
 *
 * Decorative glyphs are module-level constants, never catalogue entries (Decision 11 — direct
 * application of item #34's Decision 10).
 */

/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues. */
export const TARGET_GLYPH = '🎯';
/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues. */
export const LOCK_GLYPH = '🔒';
/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues. */
export const SPROUT_GLYPH = '🌱';
/** Decorative glyph, not user-facing copy: language-independent, must not enter the catalogues. */
export const CHECK_GLYPH = '✓';

export type ValueStep = {
  stateId: 'step-1' | 'step-2' | 'step-3';
  glyph: string;
  titleKey: string;
  bodyKey: string;
};

export const VALUE_STEPS: readonly ValueStep[] = [
  {
    stateId: 'step-1',
    glyph: TARGET_GLYPH,
    titleKey: 'onboarding_value.step_1_title',
    bodyKey: 'onboarding_value.step_1_body',
  },
  {
    stateId: 'step-2',
    glyph: LOCK_GLYPH,
    titleKey: 'onboarding_value.step_2_title',
    bodyKey: 'onboarding_value.step_2_body',
  },
  {
    stateId: 'step-3',
    glyph: SPROUT_GLYPH,
    titleKey: 'onboarding_value.step_3_title',
    bodyKey: 'onboarding_value.step_3_body',
  },
];

/** Step-1-only checklist copy keys (`index.html:738-740`), in drawn order. */
export const VALUE_STEP_1_CHECKLIST_KEYS: readonly string[] = [
  'onboarding_value.step_1_check_1',
  'onboarding_value.step_1_check_2',
  'onboarding_value.step_1_check_3',
];

/**
 * Derives the visible page index (0-based) from a horizontal scroll offset, clamped to the valid
 * range. `pageWidth <= 0` returns `0` rather than dividing by zero or `NaN`.
 */
export function stepIndexFromScrollOffset(offsetX: number, pageWidth: number, total: number): number {
  if (total <= 0) return 0;
  if (pageWidth <= 0) return 0;
  const raw = Math.round(offsetX / pageWidth);
  return Math.min(Math.max(raw, 0), total - 1);
}

/** The next page index, clamped at the last page — advancing on the last page is a no-op index
 * (the CTA on the last page navigates away instead of calling this). */
export function nextStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(index + 1, total - 1);
}
