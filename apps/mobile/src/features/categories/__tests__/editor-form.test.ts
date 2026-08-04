import { initialEditorForm, validateEditorForm } from '../editor-form';

/** Scenario 13 of the implementation plan for issue #21's Testing Strategy. */
describe('initialEditorForm', () => {
  it('returns an empty form for create (category === null)', () => {
    expect(initialEditorForm(null)).toEqual({ name: '', emoji: undefined });
  });

  it('pre-fills the current name and emoji for edit', () => {
    expect(initialEditorForm({ name: 'Comida', emoji: '🍔' })).toEqual({
      name: 'Comida',
      emoji: '🍔',
    });
  });
});

describe('validateEditorForm', () => {
  it('rejects an empty name', () => {
    expect(validateEditorForm({ name: '', emoji: '🍔' })).toEqual({
      valid: false,
      canSave: false,
      normalizedName: '',
    });
  });

  it('rejects a whitespace-only name', () => {
    expect(validateEditorForm({ name: '   ', emoji: '🍔' })).toEqual({
      valid: false,
      canSave: false,
      normalizedName: '',
    });
  });

  it('rejects a missing emoji', () => {
    expect(validateEditorForm({ name: 'Mascotas', emoji: undefined })).toEqual({
      valid: false,
      canSave: false,
      normalizedName: 'Mascotas',
    });
  });

  it('accepts a trimmed non-empty name and a selected emoji', () => {
    expect(validateEditorForm({ name: 'Mascotas', emoji: '🐶' })).toEqual({
      valid: true,
      canSave: true,
      normalizedName: 'Mascotas',
    });
  });

  /** Found in review, PR #97 (CodeRabbit): the trimmed value must actually be exposed, not just
   * used to test emptiness — otherwise a caller that persists `form.name` verbatim stores
   * leading/trailing whitespace the person never intended. */
  it('exposes the trimmed name — leading and trailing whitespace is stripped from normalizedName', () => {
    const result = validateEditorForm({ name: '  Comida  ', emoji: '🍔' });
    expect(result.normalizedName).toBe('Comida');
    expect(result.valid).toBe(true);
  });
});
