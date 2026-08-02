/**
 * Largest-remainder (Hamilton) apportionment in tenths of a percent (implementation plan
 * Decisions 4, 5 — AC4: "percentages sum to 100 with rounding handled explicitly").
 *
 * Naive per-bucket rounding does not sum to 100: three equal thirds each round to `33,3%` and
 * sum to `99,9%`. `apportionTenths` computes each bucket's floor quota and remainder exactly in
 * `BigInt` (`floorᵢ = weightᵢ * 1000n / totalN`, `remainderᵢ = weightᵢ * 1000n % totalN`), then
 * distributes the `1000 - Σfloorᵢ` leftover tenths one each to the buckets with the largest
 * remainders. `1000` is the unit because that is the granularity the UI contract renders
 * (`20,6%`).
 */

/** The whole (100.0%) expressed in tenths of a percent — the unit every bucket sums to. */
export const PERCENTAGE_TENTHS_TOTAL = 1000;

export interface ApportionmentEntry {
  key: string;
  weight: number;
}

/**
 * Apportions `PERCENTAGE_TENTHS_TOTAL` tenths across `entries`, proportional to `weight`,
 * exactly summing to `PERCENTAGE_TENTHS_TOTAL` — except for the two documented exceptions
 * (Decision 5): an empty `entries` array returns an empty map, and a total weight of `0` gives
 * every bucket `0` (there is no whole to apportion).
 *
 * **Tie-break (Decision 5)**: leftover tenths go to buckets sorted by remainder descending,
 * then weight descending, then `key` ascending (ASCII, not `localeCompare`). Bucket keys are
 * unique by construction, so this is a total order and the result never depends on input order.
 *
 * Throws `TypeError` on a non-safe-integer weight, `RangeError` on a negative weight or a
 * duplicate key (duplicates would otherwise silently merge).
 */
export function apportionTenths(entries: readonly ApportionmentEntry[]): Map<string, number> {
  const seenKeys = new Set<string>();
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.weight)) {
      throw new TypeError(
        `apportionTenths: weight for key "${entry.key}" must be a safe integer, received ${String(entry.weight)}`,
      );
    }
    if (entry.weight < 0) {
      throw new RangeError(`apportionTenths: weight for key "${entry.key}" must not be negative`);
    }
    if (seenKeys.has(entry.key)) {
      throw new RangeError(`apportionTenths: duplicate key "${entry.key}"`);
    }
    seenKeys.add(entry.key);
  }

  if (entries.length === 0) {
    return new Map();
  }

  // Accumulated in BigInt from the start (CodeRabbit finding on PR #44): each individual weight
  // is a safe integer, but their Number sum is not bounded by Number.MAX_SAFE_INTEGER. Summing in
  // Number first and converting to BigInt afterward would silently lose precision once the total
  // crosses that bound, even though every input was exact.
  const totalBig = entries.reduce((sum, e) => sum + BigInt(e.weight), 0n);
  if (totalBig === 0n) {
    // Documented exception (Decision 5): nothing to apportion; every bucket is 0, sum 0.
    return new Map(entries.map((e) => [e.key, 0]));
  }

  const scale = BigInt(PERCENTAGE_TENTHS_TOTAL);
  const rows = entries.map((e) => ({
    key: e.key,
    weight: e.weight,
    floor: Number((BigInt(e.weight) * scale) / totalBig),
    remainder: (BigInt(e.weight) * scale) % totalBig,
  }));

  let leftover = PERCENTAGE_TENTHS_TOTAL - rows.reduce((sum, r) => sum + r.floor, 0);

  // Total order (Decision 5): remainder desc, weight desc, key asc. Never input order.
  const ranked = [...rows].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  const result = new Map(rows.map((r) => [r.key, r.floor]));
  for (const row of ranked) {
    if (leftover <= 0) break;
    result.set(row.key, (result.get(row.key) ?? 0) + 1);
    leftover -= 1;
  }
  return result;
}
