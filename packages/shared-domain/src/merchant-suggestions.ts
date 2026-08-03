import { normalizeDescription } from './merchant-matching';

/**
 * Alias-candidate suggestions for `#screen=merchant-edit&state=suggestions` (implementation plan
 * for issue #14, Decision 10, "Suggestion rule"). Pure, no I/O, no React, no SQL — imports nothing
 * from this package except `normalizeDescription`.
 *
 * The MVP derives candidates from the person's own movements only (`docs/project/1-business-domain.md`
 * puts community-sourced suggestions out of scope — there is no backend, Non-negotiable #1). A
 * false suggestion re-links real movements with no undo drawn in the mockup, so this module is
 * deliberately precision-over-recall: a generic-word stop list, a four-character significant-word
 * floor, and prefix-containment (never arbitrary substring) keep a short, common merchant word
 * (e.g. `UBER`) from claiming an unrelated longer word (`UBERTO`) — edge-case row 20 in the plan's
 * enumeration is the regression test for exactly that failure mode.
 *
 * **Naming deviation from the plan's illustrative code sample**: the plan names these constants
 * `MIN_SIGNIFICANT_TOKEN_LENGTH`, `CANDIDATE_TOKEN_COUNT` and `GENERIC_TOKENS` (both marked
 * "Illustrative — adapt during implementation"). Any of the three, once exported from this
 * package's `index.ts` (`export *`), trips `domain-surface.test.ts`'s credential/identity
 * negative-control scan — its `FORBIDDEN_NAME_PATTERN` matches the substring `token`
 * case-insensitively, which is meant to catch an auth/session token export, not a text-parsing
 * "token" as in tokenization. Renamed to `*_WORD_*` / `GENERIC_WORDS` below; the algorithm and
 * every edge-case behavior are unchanged.
 */

/** The shortest word length `merchantWords` (Step 1) or a P2b candidate word can carry and
 * still count as "significant" on its own. */
export const MIN_SIGNIFICANT_WORD_LENGTH = 4;

/** The shortest prefix two strings must share for P3 (candidate pattern vs. an existing alias
 * pattern), *and* the shortest a merchantWords member must be to anchor a P2a containment check
 * (edge-case row 20: `UBER`, 4 characters, is too short to safely anchor a containment match
 * against `UBERTO` — `MERCADOLIBRE`, 12 characters, is not). */
export const MIN_SHARED_PREFIX_LENGTH = 6;

/** How many leading words of a normalized description become a candidate's `rawPattern`. */
export const CANDIDATE_WORD_COUNT = 2;

/** The most candidates `suggestAliasCandidates` ever returns. */
export const MAX_ALIAS_CANDIDATES = 5;

/** Words a Chilean bank statement puts on almost every line. Evidence from one of these
 *  alone is not evidence. */
export const GENERIC_WORDS: readonly string[] = [
  'CHILE',
  'SANTIAGO',
  'COMPRA',
  'PAGO',
  'PAGOS',
  'TRANSFERENCIA',
  'ONLINE',
  'SERVICIO',
  'SERVICIOS',
  'COMERCIAL',
  'LTDA',
  'LIMITADA',
  'SPA',
];

const GENERIC_WORD_SET = new Set(GENERIC_WORDS);

export interface AliasCandidate {
  /** Normalized leading word run — what becomes `merchant_aliases.raw_pattern`. */
  rawPattern: string;
  /** How many unattributed movements this candidate would fold in. */
  movementCount: number;
  /** One observed description, for display. */
  sampleDescription: string;
}

export interface SuggestAliasCandidatesInput {
  merchantName: string;
  existingPatterns: readonly string[];
  descriptions: readonly string[];
}

/** Splits an already-normalized (single-spaced, trimmed, uppercase) string into its words. An
 * empty string yields no words. */
function splitWords(normalized: string): string[] {
  return normalized === '' ? [] : normalized.split(' ');
}

/** Step 1: the merchant's own vocabulary — words of the merchant name plus every existing
 * alias pattern, filtered to the words specific enough to carry evidence on their own. */
function buildMerchantWords(merchantName: string, normalizedExistingPatterns: readonly string[]): Set<string> {
  const words = new Set<string>();
  for (const source of [normalizeDescription(merchantName), ...normalizedExistingPatterns]) {
    for (const word of splitWords(source)) {
      if (word.length >= MIN_SIGNIFICANT_WORD_LENGTH && !GENERIC_WORD_SET.has(word)) {
        words.add(word);
      }
    }
  }
  return words;
}

/** The length of the longest common leading substring of `a` and `b`. */
function sharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
}

/**
 * Step 4's four predicates, evaluated against one candidate's `rawPattern` (already split into
 * words) and the shared inputs. Any predicate holding keeps the candidate.
 */
function candidateQualifies(
  candidateWords: readonly string[],
  rawPattern: string,
  merchantWords: ReadonlySet<string>,
  normalizedExistingPatterns: readonly string[],
): boolean {
  // P1 — a candidate word is exactly a merchantWords member.
  if (candidateWords.some((word) => merchantWords.has(word))) return true;

  // P2 containment, both directions, as a genuine prefix relation (never an arbitrary substring
  // anywhere inside the word — edge-case row 6 vs. row 20 is the discriminator):
  //   (a) a merchantWords member, long enough on its own (>= MIN_SHARED_PREFIX_LENGTH) to safely
  //       anchor a match, is a *prefix* of a candidate word;
  for (const merchantWord of merchantWords) {
    if (merchantWord.length < MIN_SHARED_PREFIX_LENGTH) continue;
    if (candidateWords.some((word) => word.startsWith(merchantWord))) return true;
  }
  //   (b) a candidate word — significant on its own and not generic — is a *prefix* of a
  //       merchantWords member.
  for (const word of candidateWords) {
    if (word.length < MIN_SIGNIFICANT_WORD_LENGTH || GENERIC_WORD_SET.has(word)) continue;
    for (const merchantWord of merchantWords) {
      if (merchantWord.startsWith(word)) return true;
    }
  }

  // P3 — the candidate rawPattern and some existing alias pattern share a long common prefix.
  return normalizedExistingPatterns.some(
    (pattern) => sharedPrefixLength(rawPattern, pattern) >= MIN_SHARED_PREFIX_LENGTH,
  );
}

interface CandidateGroup {
  rawPattern: string;
  descriptions: string[];
}

/**
 * Derives alias-candidate suggestions from a person's own unattributed movement descriptions
 * (implementation plan Decision 10). Deterministic: the same input, in any order, produces the
 * same output (edge-case row 16).
 */
export function suggestAliasCandidates(input: SuggestAliasCandidatesInput): AliasCandidate[] {
  const normalizedExistingPatterns = input.existingPatterns.map(normalizeDescription).filter((p) => p !== '');
  const merchantWords = buildMerchantWords(input.merchantName, normalizedExistingPatterns);

  // Step 2 — normalize, drop empties, group by the leading-word-run pattern.
  const groups = new Map<string, CandidateGroup>();
  for (const rawDescription of input.descriptions) {
    const normalized = normalizeDescription(rawDescription);
    if (normalized === '') continue;
    const words = splitWords(normalized);
    const rawPattern = words.slice(0, CANDIDATE_WORD_COUNT).join(' ');
    let group = groups.get(rawPattern);
    if (!group) {
      group = { rawPattern, descriptions: [] };
      groups.set(rawPattern, group);
    }
    group.descriptions.push(normalized);
  }

  const candidates: AliasCandidate[] = [];
  for (const group of groups.values()) {
    // Step 3 — already an alias under "Actual", never a suggestion.
    if (normalizedExistingPatterns.includes(group.rawPattern)) continue;

    const candidateWords = splitWords(group.rawPattern);
    if (!candidateQualifies(candidateWords, group.rawPattern, merchantWords, normalizedExistingPatterns)) {
      continue;
    }

    const sampleDescription = [...group.descriptions].sort()[0] as string;
    candidates.push({
      rawPattern: group.rawPattern,
      movementCount: group.descriptions.length,
      sampleDescription,
    });
  }

  // Step 5 — highest movementCount first, ASCII-ascending rawPattern as the deterministic tie-break.
  candidates.sort((a, b) => {
    if (b.movementCount !== a.movementCount) return b.movementCount - a.movementCount;
    if (a.rawPattern < b.rawPattern) return -1;
    if (a.rawPattern > b.rawPattern) return 1;
    return 0;
  });

  return candidates.slice(0, MAX_ALIAS_CANDIDATES);
}
