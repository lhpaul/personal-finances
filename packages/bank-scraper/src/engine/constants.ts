/**
 * Bounded retries and the one thing that is never retried (spec Business Rules 21-22 and 32,
 * AC19; implementation plan Decision 8). Backoff is constant, not exponential — the failure being
 * retried ("the bank's Angular view has not rendered this element yet") resolves in hundreds of
 * milliseconds or not at all, so exponential backoff would only triple the worst case for no
 * benefit. These are the proven source implementation's own defaults.
 *
 * `MAX_STEP_ATTEMPTS` / `STEP_RETRY_DELAY_MS` and `MAX_ELEMENT_ATTEMPTS` / `ELEMENT_RETRY_DELAY_MS`
 * are consumed by the in-page step wrapper (`src/scripts/script-utils.ts`) — the retry loop lives
 * entirely inside the generated script, not in this engine. `MAX_SUBMIT_ATTEMPTS` fixes a real
 * defect in the source, which wrapped the credential-entry and submit steps in the generic
 * three-attempt wrapper: a flaky submit could click "Ingresar" up to three times, which is
 * precisely the repeated sign-in attempt Business Rule 22 forbids.
 */
export const MAX_STEP_ATTEMPTS = 3;
export const STEP_RETRY_DELAY_MS = 1000;
export const MAX_ELEMENT_ATTEMPTS = 10;
export const ELEMENT_RETRY_DELAY_MS = 200;
export const MAX_SUBMIT_ATTEMPTS = 1;

/**
 * The whole read's overall deadline (spec Decision 16, Business Rule 32). One `setTimeout`
 * created in `ScrapeSession.start()`, cleared as the first action of `finalize()`. Basis: the
 * source's observed cost is roughly 20-30s per product; a person with four products lands near 2
 * minutes, so 4 minutes leaves headroom for a slow connection while keeping the syncing screen
 * bounded. Flagged for human confirmation alongside spec Decision 16.
 */
export const READ_DEADLINE_MS = 240_000;

/** Domain separator for the opaque product instance identity (implementation plan Decision 6). */
export const PRODUCT_ID_DOMAIN_SEPARATOR = 'finanzas.product.v1';

/** Forbidden keys on an inbound product payload (implementation plan Decision 6). */
export const FORBIDDEN_PRODUCT_KEYS: readonly string[] = [
  'elementIndex',
  '__clickIndex',
  'accountNumber',
  'rawIdentifier',
  'index',
  'position',
];

/** A 32-lowercase-hex-character opaque instance identity (implementation plan Decision 6). */
export const INSTANCE_ID_PATTERN = /^[0-9a-f]{32}$/u;
