/**
 * The message-routing and step protocol between an injected page script and the engine
 * (implementation plan Layer-by-Layer Changes → engine; spec "Read step", "Read outcome",
 * "Failure reason"). Bank-agnostic: nothing here names a specific bank.
 */

/** How a posted message is routed by `MessageHandlerService`. */
export enum ScraperEventType {
  ADD_SCRIPT = 'add-script',
  ERROR = 'error',
  RUN_NEXT_SCRIPT = 'run-next-script',
  STATE_CHANGE = 'state-change',
  TRACE = 'trace',
  WAIT_AND_RETRY = 'wait-and-retry',
}

/**
 * Spec "Read step" code values. `load-start` is not surfaced to a person; the other four map to
 * `#screen=bank-syncing` states. A read never moves backwards through these (Business Rule 23).
 */
export type ScraperStepId =
  | 'load-start'
  | 'login-start'
  | 'get-products-start'
  | 'get-transactions-start'
  | 'ready';

/**
 * The only valid forward order (spec "Read step" → Valid transitions). `StateManagerService`
 * rejects any payload naming a step earlier than `#currentStep` in this array (Decision 15).
 */
export const VALID_STEP_TRANSITIONS: readonly ScraperStepId[] = [
  'load-start',
  'login-start',
  'get-products-start',
  'get-transactions-start',
  'ready',
];

/** Spec "Read outcome" code values. */
export type ReadOutcome = 'complete' | 'partial' | 'failed' | 'cancelled';

/** Spec "Failure reason" code values — exactly the set `last_error_code` can record (V11). */
export type FailureReasonCode =
  | 'invalid_credentials'
  | 'session_closed'
  | 'network'
  | 'parse_failed';

/**
 * `invalid_credentials` is never retried, at all (Business Rule 22, Decision 8) — stronger than
 * "subject to the same cap" as every other reason.
 */
export const NON_RETRYABLE_ERROR_CODES: readonly FailureReasonCode[] = ['invalid_credentials'];

/**
 * The refusal a caller gets for an unsupported bank or country (spec Decision 8, AC18). This is
 * deliberately not a `FailureReasonCode`: it happens before anything is opened, so it must be
 * distinguishable from the four sync failure reasons a connection can record.
 */
export interface ScraperRequestRejection {
  reason: 'unsupported_country' | 'unsupported_bank';
  countryCode: string;
  bankId: string;
}
