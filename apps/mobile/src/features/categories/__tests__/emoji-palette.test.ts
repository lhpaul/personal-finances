import tokens from '../../../../../../design/tokens.json';
import { emojiPaletteFor, paletteWithCurrent } from '../emoji-palette';

/** Scenario 13 of the implementation plan for issue #21's Testing Strategy. */
describe('emojiPaletteFor (Assumption A7)', () => {
  it('equals the tokens expense glyphs minus ✨', () => {
    const expected = Object.entries(tokens.categoryIcons.expense as Record<string, string>)
      .filter(([slug]) => slug !== 'otros')
      .map(([, emoji]) => emoji);
    expect(emojiPaletteFor('expense')).toEqual(expected);
    expect(emojiPaletteFor('expense')).not.toContain(tokens.categoryIcons.expense.otros);
  });

  it('equals the tokens income glyphs minus ✨', () => {
    const expected = Object.entries(tokens.categoryIcons.income as Record<string, string>)
      .filter(([slug]) => slug !== 'otros')
      .map(([, emoji]) => emoji);
    expect(emojiPaletteFor('income')).toEqual(expected);
    expect(emojiPaletteFor('income')).not.toContain(tokens.categoryIcons.income.otros);
  });
});

describe('paletteWithCurrent (Decision 9, Assumption A7)', () => {
  const palette = emojiPaletteFor('expense');

  it('prepends an emoji not already in the palette', () => {
    const result = paletteWithCurrent(palette, '🦄');
    expect(result[0]).toBe('🦄');
    expect(result).toHaveLength(palette.length + 1);
  });

  it('does not duplicate an emoji already in the palette', () => {
    const known = palette[0] as string;
    const result = paletteWithCurrent(palette, known);
    expect(result).toEqual(palette);
  });

  it('returns the palette unchanged when currentEmoji is undefined', () => {
    expect(paletteWithCurrent(palette, undefined)).toEqual(palette);
  });
});
