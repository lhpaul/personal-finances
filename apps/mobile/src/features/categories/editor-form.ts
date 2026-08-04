/**
 * Pure form state for `CategoryEditorSheet` (implementation plan for issue #21, Assumption A3).
 * No React, no i18n — the sheet reuses the same two fields (*Nombre*, *Ícono*) for create and
 * edit; only the title and the presence of the delete button differ (Decision 8, mode-driven).
 */

export interface EditorFormValues {
  name: string;
  emoji: string | undefined;
}

/** `category === null` is the create flow's empty form; otherwise the sheet is pre-filled with
 * the category's current name and emoji (edit flow). */
export function initialEditorForm(
  category: { name: string; emoji: string | undefined } | null,
): EditorFormValues {
  if (category === null) return { name: '', emoji: undefined };
  return { name: category.name, emoji: category.emoji };
}

export interface EditorFormValidation {
  valid: boolean;
  canSave: boolean;
  /** `form.name.trim()` — the value a caller should persist, never the raw `form.name` (found in
   * review, PR #97: `validateEditorForm` trimmed only to test emptiness and discarded the
   * trimmed value, so a name typed as `'  Comida  '` was written verbatim by
   * `createUserCategory`/`renameCategory` and rendered with the padding on every row and
   * picker). Always the trimmed string, regardless of `valid` — an empty `normalizedName` is
   * exactly what makes `valid` false in that case. */
  normalizedName: string;
}

/** The name must be non-empty after trimming and an emoji must be selected. No length ceiling is
 * invented (Layer-by-Layer). `canSave` mirrors `valid` — kept as its own field so a caller never
 * has to know that today they are the same check. */
export function validateEditorForm(form: { name: string; emoji: string | undefined }): EditorFormValidation {
  const normalizedName = form.name.trim();
  const valid = normalizedName.length > 0 && form.emoji !== undefined;
  return { valid, canSave: valid, normalizedName };
}
