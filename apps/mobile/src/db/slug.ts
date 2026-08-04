/**
 * Slug derivation for a user-created category (implementation plan for issue #21, Decision 4).
 *
 * Pure, no SQL, no imports beyond the standard library — `src/db/repositories/categories.ts` is
 * the only caller, inside the same transaction that reads the taken slugs and inserts the row, so
 * the unique index (`transaction_categories_slug_unique`) cannot be raced by this app (there is
 * exactly one process and one database handle).
 */

/**
 * NFD-normalises `name`, strips combining marks (so `Educación` → `educacion`), lower-cases it,
 * replaces every run of non-`[a-z0-9]` characters with a single `-`, and trims leading/trailing
 * `-`. Returns the constant `'categoria'` when the result would otherwise be empty — a name made
 * only of emoji or punctuation.
 */
export function slugifyCategoryName(name: string): string {
  const withoutMarks = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = withoutMarks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'categoria' : slug;
}

/**
 * Returns `base` when it is not in `taken`, otherwise the first of `base-2`, `base-3`, … that is
 * free.
 */
export function nextAvailableSlug(base: string, taken: readonly string[]): string {
  const takenSet = new Set(taken);
  if (!takenSet.has(base)) return base;

  let suffix = 2;
  while (takenSet.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
