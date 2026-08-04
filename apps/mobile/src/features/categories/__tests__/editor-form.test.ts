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
    expect(validateEditorForm({ name: '', emoji: '🍔' })).toEqual({ valid: false, canSave: false });
  });

  it('rejects a whitespace-only name', () => {
    expect(validateEditorForm({ name: '   ', emoji: '🍔' })).toEqual({ valid: false, canSave: false });
  });

  it('rejects a missing emoji', () => {
    expect(validateEditorForm({ name: 'Mascotas', emoji: undefined })).toEqual({
      valid: false,
      canSave: false,
    });
  });

  it('accepts a trimmed non-empty name and a selected emoji', () => {
    expect(validateEditorForm({ name: 'Mascotas', emoji: '🐶' })).toEqual({
      valid: true,
      canSave: true,
    });
  });
});
