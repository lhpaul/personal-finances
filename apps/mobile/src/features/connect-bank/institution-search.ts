import type { PickerInstitution } from '../../db/types';

/**
 * Search folding and ordering for `bank-picker` (implementation plan Decision 11, Business Rules
 * 8 and 10). Pure; no React, no I/O.
 */

const COMBINING_MARKS = /\p{M}/gu;

/** NFD-normalize, strip combining marks, lowercase — Unicode-aware so a pre-composed character
 * that decomposes into a mark outside the basic Latin block still folds (P10). */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

/**
 * Matching is `String.prototype.includes` over the folded name — never a constructed `RegExp`,
 * so a query containing a regex metacharacter (`.`, `(`, …) is treated literally (P11). An empty
 * (after trim) query matches every row (P8) — the caller decides whether that means the `list`
 * state or the `search` state from the raw query text, not from the match count.
 */
export function matchInstitutions(
  list: PickerInstitution[],
  query: string,
): PickerInstitution[] {
  const folded = foldForSearch(query.trim());
  if (folded === '') return list;
  return list.filter((institution) => foldForSearch(institution.name).includes(folded));
}

/**
 * Available banks first, then coming-soon, each group ordered by name (Business Rule 10).
 * Stable and independent of the query (Decision 11) — apply this once, then filter with
 * {@link matchInstitutions}, so `search` renders rows in the same relative order as `list` (P12).
 *
 * Compares the **folded** name with plain `<`/`>` rather than `String.prototype.localeCompare` —
 * `localeCompare`'s collation table is ICU data that is not guaranteed identical across Hermes
 * and a Node test runner (the same byte-stability concern the root ESLint config's
 * `no-restricted-properties` ban on `toLocaleString`/`toLocaleDateString`/`toLocaleTimeString`
 * already covers for those methods). Folding first still orders "Itaú" correctly relative to
 * unaccented names, without depending on locale-specific collation rules.
 */
export function sortForPicker(list: PickerInstitution[]): PickerInstitution[] {
  return [...list].sort((a, b) => {
    if (a.scraperStatus !== b.scraperStatus) {
      return a.scraperStatus === 'available' ? -1 : 1;
    }
    const foldedA = foldForSearch(a.name);
    const foldedB = foldForSearch(b.name);
    if (foldedA < foldedB) return -1;
    if (foldedA > foldedB) return 1;
    return 0;
  });
}
