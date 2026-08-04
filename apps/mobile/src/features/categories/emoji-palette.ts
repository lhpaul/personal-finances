import tokens from '../../../../../design/tokens.json';

import type { CategoryDirection } from './direction';

/** `design/tokens.json`'s `categoryIcons` shape — only the two direction buckets this feature
 * reads. Importing the tokens file from app source follows the precedent of
 * `src/db/seeds/catalogue.ts`. */
interface CategoryIconsToken {
  expense: Record<string, string>;
  income: Record<string, string>;
}

const CATEGORY_ICONS = tokens.categoryIcons as unknown as CategoryIconsToken;

/** The fallback's own token slug — excluded from the palette because ✨ Otros is never a create
 * choice and its emoji is not a pickable glyph (Assumption A7). */
const OTROS_TOKEN_SLUG = 'otros';

/**
 * The direction's seeded glyph set, minus ✨ (implementation plan for issue #21, Assumption A7).
 * The grid a person picks a category icon from — not an arbitrary emoji keyboard (follow-up 4).
 */
export function emojiPaletteFor(direction: CategoryDirection): readonly string[] {
  const icons = CATEGORY_ICONS[direction];
  return Object.entries(icons)
    .filter(([slug]) => slug !== OTROS_TOKEN_SLUG)
    .map(([, emoji]) => emoji);
}

/**
 * Prepends the category's current emoji to `palette` when it is not already one of the seeded
 * glyphs (Assumption A7) — so editing a category whose emoji was hand-picked outside the seeded
 * set (or is simply not in this direction's palette) still shows it pre-selected. Never
 * duplicates an emoji already present.
 */
export function paletteWithCurrent(
  palette: readonly string[],
  currentEmoji: string | undefined,
): readonly string[] {
  if (currentEmoji === undefined || palette.includes(currentEmoji)) return palette;
  return [currentEmoji, ...palette];
}
