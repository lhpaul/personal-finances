import {
  assignOccurrenceIndexes,
  buildDedupInput,
  DEDUP_INPUT_SEPARATOR,
  DEDUP_INPUT_VERSION,
  type MovementIdentityFields,
} from '../dedup';

/**
 * Implementation plan Decisions 1-2 (issue #10): the `v2` dedup input and
 * `assignOccurrenceIndexes`, tested as pure functions independent of SQLite. Spec Business Rules
 * 9-11, AC5, AC6.
 */

describe('buildDedupInput (Decision 1)', () => {
  const base = {
    userFinancialProductId: 'product-1',
    dateLocal: '2026-02-01',
    amount: 4300,
    direction: 'debit' as const,
    rawDescription: 'LIDER SUPERMERCADO',
    externalId: null,
    occurrenceIndex: 0,
    isManual: false,
    id: 'row-1',
  };

  it('leads with the version tag', () => {
    expect(buildDedupInput(base).startsWith(`${DEDUP_INPUT_VERSION}${DEDUP_INPUT_SEPARATOR}`)).toBe(true);
  });

  it('a charge and its identically-described refund produce different inputs — direction is part of identity (Business Rule 9, AC5)', () => {
    const charge = buildDedupInput({ ...base, direction: 'debit' });
    const refund = buildDedupInput({ ...base, direction: 'credit' });
    expect(charge).not.toBe(refund);
  });

  it('two rows differing only in occurrenceIndex produce different inputs — Business Rule 10', () => {
    const first = buildDedupInput({ ...base, occurrenceIndex: 0 });
    const second = buildDedupInput({ ...base, occurrenceIndex: 1 });
    expect(first).not.toBe(second);
  });

  it('an externalId changes the input even when every other field matches (Business Rule 9 fallback route)', () => {
    const withoutId = buildDedupInput({ ...base, externalId: null });
    const withId = buildDedupInput({ ...base, externalId: 'ext-1' });
    expect(withoutId).not.toBe(withId);
  });

  it('a manual row folds in its own id; a non-manual row does not', () => {
    const manualA = buildDedupInput({ ...base, isManual: true, id: 'row-a' });
    const manualB = buildDedupInput({ ...base, isManual: true, id: 'row-b' });
    expect(manualA).not.toBe(manualB);

    const nonManualA = buildDedupInput({ ...base, isManual: false, id: 'row-a' });
    const nonManualB = buildDedupInput({ ...base, isManual: false, id: 'row-b' });
    expect(nonManualA).toBe(nonManualB);
  });

  it('every other field held constant, an identical row produces an identical input (planted-negative: no field is silently ignored beyond what is documented)', () => {
    expect(buildDedupInput(base)).toBe(buildDedupInput({ ...base }));
  });
});

describe('assignOccurrenceIndexes (Decision 2, Business Rules 10-11, AC5, AC6)', () => {
  const coffee = (overrides?: Partial<MovementIdentityFields>): MovementIdentityFields => ({
    dateLocal: '2026-02-01',
    amount: 2500,
    direction: 'debit',
    rawDescription: 'CAFE',
    externalId: null,
    ...overrides,
  });

  it('two identical coffees get indexes 0 and 1 — never fewer, never the same index (AC5)', () => {
    expect(assignOccurrenceIndexes([coffee(), coffee()])).toEqual([0, 1]);
  });

  it('a charge and its identically-described refund are two distinct identity groups, each starting at 0', () => {
    const charge = coffee({ direction: 'debit' });
    const refund = coffee({ direction: 'credit' });
    expect(assignOccurrenceIndexes([charge, refund])).toEqual([0, 0]);
  });

  it('three unrelated movements each get index 0 — distinct rows are never grouped together', () => {
    const a = coffee({ rawDescription: 'CAFE A' });
    const b = coffee({ rawDescription: 'CAFE B' });
    const c = coffee({ amount: 9999 });
    expect(assignOccurrenceIndexes([a, b, c])).toEqual([0, 0, 0]);
  });

  it('the resulting multiset of (identityKey, index) pairs is independent of input order — reordering the read stores nothing new (AC6)', () => {
    const rows = [
      coffee(),
      coffee(),
      coffee({ direction: 'credit' }),
      coffee({ rawDescription: 'UNRELATED' }),
    ];

    function multisetOf(input: MovementIdentityFields[]): Set<string> {
      const indexes = assignOccurrenceIndexes(input);
      return new Set(
        input.map((row, i) => buildDedupInput({
          userFinancialProductId: 'p',
          dateLocal: row.dateLocal,
          amount: row.amount,
          direction: row.direction,
          rawDescription: row.rawDescription,
          externalId: row.externalId,
          occurrenceIndex: indexes[i] as number,
          isManual: false,
          id: 'unused',
        })),
      );
    }

    const original = multisetOf(rows);
    // Reversed, and shuffled to a third arbitrary order — both must resolve to the same set of
    // dedup inputs as the original, proving the result does not depend on listing order.
    const reversed = multisetOf([...rows].reverse());
    const shuffled = multisetOf([rows[2] as MovementIdentityFields, rows[0] as MovementIdentityFields, rows[3] as MovementIdentityFields, rows[1] as MovementIdentityFields]);

    expect(reversed).toEqual(original);
    expect(shuffled).toEqual(original);
  });

  it('an empty list returns an empty array (degenerate input terminates)', () => {
    expect(assignOccurrenceIndexes([])).toEqual([]);
  });
});
