import { nextAvailableSlug, slugifyCategoryName } from '../slug';

/** Scenario 9 of the implementation plan for issue #21's Testing Strategy. */
describe('slugifyCategoryName (implementation plan for issue #21, Decision 4)', () => {
  it('lower-cases a simple name', () => {
    expect(slugifyCategoryName('Comida')).toBe('comida');
  });

  it('strips accents via NFD normalisation', () => {
    expect(slugifyCategoryName('Educación')).toBe('educacion');
  });

  it('collapses internal whitespace runs and trims leading/trailing whitespace', () => {
    expect(slugifyCategoryName('  Mi   Categoría  ')).toBe('mi-categoria');
  });

  it('collapses punctuation runs between words into one hyphen', () => {
    expect(slugifyCategoryName('Café & Té')).toBe('cafe-te');
  });

  it('returns the categoria fallback for an emoji-only name', () => {
    expect(slugifyCategoryName('🍔')).toBe('categoria');
  });

  it('returns the categoria fallback for an empty name', () => {
    expect(slugifyCategoryName('')).toBe('categoria');
  });

  it('returns the categoria fallback for a punctuation-only name', () => {
    expect(slugifyCategoryName('---')).toBe('categoria');
  });
});

describe('nextAvailableSlug (implementation plan for issue #21, Decision 4)', () => {
  it('returns the base when it is free', () => {
    expect(nextAvailableSlug('mascotas', [])).toBe('mascotas');
    expect(nextAvailableSlug('mascotas', ['comida', 'salud'])).toBe('mascotas');
  });

  it('returns base-2 when the base is taken', () => {
    expect(nextAvailableSlug('mascotas', ['mascotas'])).toBe('mascotas-2');
  });

  it('returns base-3 when the base and base-2 are both taken', () => {
    expect(nextAvailableSlug('mascotas', ['mascotas', 'mascotas-2'])).toBe('mascotas-3');
  });
});
