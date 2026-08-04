import type { BankConnectionSummary } from '../../db/types';
import type { CopyFragment } from './types';

/**
 * The four `sync.errors.*` keys this item defines (implementation plan for issue #20, Decision
 * 10; item #10's A7 and item #11's A7 both assign this catalogue entry to this item).
 * `composeFailureMessageKey` (`src/features/sync/map-read-result.ts`) is total over these same
 * four codes and writes the resulting key verbatim into `last_error_message` — so
 * `lastErrorMessage` already equals one of these keys, never bank-supplied free text.
 */
export const SYNC_ERROR_KEYS = {
  invalid_credentials: 'sync.errors.invalid_credentials',
  session_closed: 'sync.errors.session_closed',
  network: 'sync.errors.network',
  parse_failed: 'sync.errors.parse_failed',
} as const;

const UNKNOWN_KEY = 'sync.errors.unknown';

/**
 * Total over `lastErrorCode` (Decision 10): resolves one of the four known keys, or the
 * defensive `sync.errors.unknown` fallback for a `null` or unrecognised code. Deliberately never
 * reads `lastErrorMessage`'s content — even though the column already carries the same key
 * `composeFailureMessageKey` wrote, treating a stored string as a claim to validate (not a key to
 * blindly resolve) means a corrupt or legacy row, or a hypothetical future defect that lets bank
 * text leak into the column, can never render as raw text or an untrusted key (BR1).
 */
export function resolveSyncErrorKey(
  connection: Pick<BankConnectionSummary, 'lastErrorCode' | 'lastErrorMessage'>,
): CopyFragment {
  const code = connection.lastErrorCode;
  if (code !== null && code in SYNC_ERROR_KEYS) {
    return { key: SYNC_ERROR_KEYS[code], values: {} };
  }
  return { key: UNKNOWN_KEY, values: {} };
}
