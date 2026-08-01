/**
 * Scanner A — extracts the distinct `mu-*` class names that appear in **selector position**
 * inside the single `<style>` block of a mockup HTML document
 * (`design/mockups/mobile/index.html`).
 *
 * This is an inventory, not a violation scanner: it reports every `mu-*` class the stylesheet
 * defines so `apps/mobile/src/__tests__/mu-class-coverage.test.ts` can compare it against
 * `MU_CLASS_MAP` (AC2 — "every mu-* primitive in the mockups has a component").
 *
 * See the implementation plan's Parser-risk addendum → Scanner A for the full edge-case
 * contract (E1-E10):
 * docs/specs/developments/20260801172100_2-theme-design-system-primitives/
 * 2_2-theme-design-system-primitives_implementation-plan.md
 */

const STYLE_OPEN = '<style>';
const STYLE_CLOSE = '</style>';

/** Matches one CSS rule: everything before `{` (the selector list) plus its declaration body. */
const RULE_REGEX = /([^{}]+)\{[^{}]*\}/g;

/** Matches a `mu-*` class token in selector position. Stops at the first non-identifier
 * character (`.`, `:`, whitespace, `,`, …), so pseudo-classes/elements and compound selectors
 * never leak into the captured name, and BEM `__`/`--` separators are preserved because they
 * are inside the character class. */
const MU_CLASS_REGEX = /\.(mu-[a-zA-Z0-9_-]+)/g;

export function muClassInventory(html: string): string[] {
  const styleStart = html.indexOf(STYLE_OPEN);
  const styleEnd = html.indexOf(STYLE_CLOSE);

  if (styleStart === -1 || styleEnd === -1 || styleEnd < styleStart) {
    throw new Error(
      'muClassInventory: could not find a <style>…</style> block in the given HTML.',
    );
  }

  const styleBlock = html.slice(styleStart + STYLE_OPEN.length, styleEnd);

  if (styleBlock.trim() === '') {
    throw new Error('muClassInventory: the <style>…</style> block is empty.');
  }

  const classes = new Set<string>();

  let ruleMatch: RegExpExecArray | null;
  RULE_REGEX.lastIndex = 0;
  while ((ruleMatch = RULE_REGEX.exec(styleBlock)) !== null) {
    const selectorList = ruleMatch[1];
    if (selectorList === undefined) continue;

    let classMatch: RegExpExecArray | null;
    MU_CLASS_REGEX.lastIndex = 0;
    while ((classMatch = MU_CLASS_REGEX.exec(selectorList)) !== null) {
      const className = classMatch[1];
      if (className === undefined) continue;
      classes.add(className);
    }
  }

  return Array.from(classes).sort();
}
