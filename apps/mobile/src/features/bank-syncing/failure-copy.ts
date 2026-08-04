import type { FailureReasonCode } from '@finanzas/bank-scraper';

/**
 * Error copy as a total map from a closed code, never a caught message (implementation plan
 * Decision 7, Assumption A4, A7, non-negotiable 1). No React, no I/O.
 */

/** The four `FailureReasonCode` values plus the local `'read_in_progress'` refusal reason
 * (Decision 6's `refused` phase — item #10's own value, not a `FailureReasonCode`). */
export type SyncFailureKind = FailureReasonCode | 'read_in_progress';

/**
 * `bank_syncing.error.body.<code>` — one key per failure kind. `Record<SyncFailureKind, string>`
 * is what makes "never a raw exception" structural: the only input is a code from a closed
 * union, so a bank's own error text, a caught `Error.message` or a `ScraperTrace` cannot reach
 * this map at all. Deliberately a **different** key set from item #10's `sync.errors.*`
 * (Assumption A7) — those four keys render short badge labels on the bank detail screen (#20);
 * this screen needs full actionable sentences.
 */
export const FAILURE_BODY_KEY: Record<SyncFailureKind, string> = {
  invalid_credentials: 'bank_syncing.error.body.invalid_credentials',
  session_closed: 'bank_syncing.error.body.session_closed',
  network: 'bank_syncing.error.body.network',
  parse_failed: 'bank_syncing.error.body.parse_failed',
  read_in_progress: 'bank_syncing.error.body.read_in_progress',
};

export type RetryAction = 'restart_read' | 'reenter_credentials';

/**
 * `invalid_credentials` is the one exception (Decision 8, BEHAVIOR.md): item #6 puts it in
 * `NON_RETRYABLE_ERROR_CODES` because repeated sign-in attempts can lock the person's real bank
 * account, so retrying that failure returns to the credentials form instead of re-running the
 * read. Every other reason — including the local `read_in_progress` refusal — restarts the read
 * with the same stored credential.
 */
export function resolveRetryAction(kind: SyncFailureKind): RetryAction {
  return kind === 'invalid_credentials' ? 'reenter_credentials' : 'restart_read';
}
