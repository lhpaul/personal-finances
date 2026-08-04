/**
 * Category-identity colour (implementation plan Decision 7). A donut arc never represents a
 * direction (every arc in the expense donut is an expense) — it represents a category, so it
 * indexes into `theme.chart.series`, seeded per direction so each donut reproduces the mockup's
 * own first-arc colour. These are **indices**, never hex literals, so `no-style-literals.test.ts`
 * stays green (Assumption A2) — the actual colour lookup happens at the render site
 * (`theme.chart.series[colorIndex]`).
 */
export const DONUT_SERIES_ORDER: Record<'debit' | 'credit', readonly number[]> = {
  /** `#6366f1 #f59e0b #10b981 #ef4444 #8b5cf6` — as drawn. */
  debit: [0, 1, 2, 3, 4],
  /** `#10b981 #6366f1 …` — the income donut starts on `series[2]` (`success` green), never on
   * `series[1]`'s amber (AC3's "never render an income in amber"). */
  credit: [2, 0, 1, 3, 4],
};

/**
 * Resolves rank (0-based, after sorting and capping — Decision 6) to an index into
 * `theme.chart.series`, wrapping if a future `DASHBOARD_DONUT_SEGMENT_LIMIT` ever exceeded the
 * five seeded ranks (it does not today).
 */
export function resolveDonutColorIndex(direction: 'debit' | 'credit', rank: number): number {
  const order = DONUT_SERIES_ORDER[direction];
  const index = order[rank % order.length];
  // `order` is a non-empty compile-time constant, so `index` is always defined; the fallback
  // only satisfies the type checker.
  return index ?? 0;
}
