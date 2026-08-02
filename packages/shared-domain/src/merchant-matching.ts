import type { Merchant, MerchantAlias, MerchantMatchType } from './types';

/**
 * Merchant alias matching (implementation plan Decisions 6, 7; brief Scope bullet 2).
 *
 * Chilean bank feeds are inconsistent about diacritics and separators
 * (`MERPAGO*MERCADOLIBRE`, `FARMACIA ÑUÑOA`), so both the raw description and the stored
 * `raw_pattern` are normalized before matching, and matching runs on token boundaries rather
 * than raw substring search — a bare `contains 'UBER'` would otherwise claim
 * `UBERTO PANADERIA`. A false positive (wrong merchant, wrong auto-category) is more expensive
 * than a miss (the movement stays uncategorized, which Business Rule 6 already handles
 * gracefully), so the matcher is deliberately conservative.
 */

/** Unicode combining diacritical marks, U+0300-U+036F — what `NFKD` splits an accent into. */
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC_PATTERN = /[^A-Z0-9]+/g;

/**
 * Unicode `NFKD` -> strip combining marks -> `toUpperCase()` (the locale-independent one, never
 * `toLocaleUpperCase`) -> replace every character outside `[A-Z0-9]` with a space -> collapse
 * runs of spaces -> trim. Idempotent: `normalizeDescription(normalizeDescription(x)) ===
 * normalizeDescription(x)`.
 */
export function normalizeDescription(raw: string): string {
  const withoutDiacritics = raw.normalize('NFKD').replace(COMBINING_MARKS_PATTERN, '');
  const upper = withoutDiacritics.toUpperCase();
  const spaced = upper.replace(NON_ALPHANUMERIC_PATTERN, ' ');
  return spaced.trim();
}

/**
 * Matches a raw bank description against one alias, with the given `matchType`. Both sides are
 * normalized (defensively — `merchant_aliases.raw_pattern` is documented as already normalized,
 * but a stored pattern containing a stray `*` must not silently fail to match).
 *
 * Token boundaries are enforced by space-padding both operands: `prefix` and `contains` compare
 * `` `${s} }` `` / `` ` ${s} ` `` forms so a match can only start/end at a token boundary. An
 * empty normalized pattern never matches anything, and an empty normalized description never
 * matches anything.
 */
export function aliasMatches(
  rawDescription: string,
  alias: Pick<MerchantAlias, 'rawPattern' | 'matchType'>,
): boolean {
  const description = normalizeDescription(rawDescription);
  const pattern = normalizeDescription(alias.rawPattern);
  if (description === '' || pattern === '') return false;

  switch (alias.matchType) {
    case 'exact':
      return description === pattern;
    case 'prefix':
      return `${description} `.startsWith(`${pattern} `);
    case 'contains':
      return ` ${description} `.includes(` ${pattern} `);
    default: {
      // Fixed sentence, no interpolation of the input (Business Rule 1 — no thrown message in
      // this module ever echoes caller-supplied content, even for a value this defensive branch
      // cannot reach through the TypeScript-typed API).
      const exhaustive: never = alias.matchType;
      void exhaustive;
      throw new RangeError('aliasMatches: unknown matchType');
    }
  }
}

export interface MerchantMatch {
  merchantId: string;
  aliasId: string;
  matchType: MerchantMatchType;
  normalizedDescription: string;
  normalizedPattern: string;
}

const SPECIFICITY_RANK: Record<MerchantMatchType, number> = {
  exact: 0,
  prefix: 1,
  contains: 2,
};

/**
 * Resolves the single best-matching alias for a raw description, by (Decision 7): specificity
 * (`exact` > `prefix` > `contains`), then the **longest normalized pattern**, then the lowest
 * `alias.id` (ASCII). This is a total order over a set of aliases with unique ids, so the
 * result never depends on the order aliases were passed in. Returns `null` when nothing
 * matches — it never guesses.
 */
export function resolveMerchant(
  rawDescription: string,
  aliases: readonly MerchantAlias[],
): MerchantMatch | null {
  const description = normalizeDescription(rawDescription);
  let best: { alias: MerchantAlias; normalizedPattern: string } | null = null;

  for (const alias of aliases) {
    if (!aliasMatches(rawDescription, alias)) continue;
    const normalizedPattern = normalizeDescription(alias.rawPattern);
    if (best === null) {
      best = { alias, normalizedPattern };
      continue;
    }
    const specificityDelta = SPECIFICITY_RANK[alias.matchType] - SPECIFICITY_RANK[best.alias.matchType];
    if (specificityDelta < 0) {
      best = { alias, normalizedPattern };
      continue;
    }
    if (specificityDelta > 0) continue;

    const lengthDelta = normalizedPattern.length - best.normalizedPattern.length;
    if (lengthDelta > 0) {
      best = { alias, normalizedPattern };
      continue;
    }
    if (lengthDelta < 0) continue;

    if (alias.id < best.alias.id) {
      best = { alias, normalizedPattern };
    }
  }

  if (best === null) return null;
  return {
    merchantId: best.alias.merchantId,
    aliasId: best.alias.id,
    matchType: best.alias.matchType,
    normalizedDescription: description,
    normalizedPattern: best.normalizedPattern,
  };
}

/** Convenience re-export point for callers that only need the merchant type shape. */
export type { Merchant };
