import { buildDemoMovements } from '../demo-movements';

/**
 * Additional coverage beyond the implementation plan's explicit scenario list (issue #15,
 * Decision 14) — the generator is pure and cheap to verify, so its determinism and coverage
 * claims are pinned mechanically rather than left to the manual runbook alone.
 */
describe('buildDemoMovements', () => {
  it('returns [] for no products — nothing to attach a movement to', () => {
    expect(buildDemoMovements([])).toEqual([]);
  });

  it('produces 240 movements in total, round-robined across every given product', () => {
    const batches = buildDemoMovements(['product-a', 'product-b']);
    const totalRows = batches.reduce((sum, batch) => sum + batch.rows.length, 0);
    expect(totalRows).toBe(240);
    expect(batches.map((batch) => batch.userFinancialProductId).sort()).toEqual(['product-a', 'product-b']);
  });

  it('spans exactly four distinct months', () => {
    const batches = buildDemoMovements(['product-a']);
    const months = new Set(batches[0]?.rows.map((row) => row.dateLocal.slice(0, 7)));
    expect(months.size).toBe(4);
  });

  it('includes both directions', () => {
    const batches = buildDemoMovements(['product-a']);
    const types = new Set(batches[0]?.rows.map((row) => row.type));
    expect(types).toEqual(new Set(['debit', 'credit']));
  });

  it('every row has a positive integer amount and a non-empty description', () => {
    const batches = buildDemoMovements(['product-a']);
    for (const row of batches[0]?.rows ?? []) {
      expect(Number.isSafeInteger(row.amount)).toBe(true);
      expect(row.amount).toBeGreaterThan(0);
      expect(row.rawDescription.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic: the same input produces byte-identical output on a second call', () => {
    const first = buildDemoMovements(['product-a', 'product-b']);
    const second = buildDemoMovements(['product-a', 'product-b']);
    expect(second).toEqual(first);
  });

  it('a single product receives every movement', () => {
    const batches = buildDemoMovements(['only-product']);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.rows).toHaveLength(240);
  });
});
