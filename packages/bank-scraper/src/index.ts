/**
 * `@finanzas/bank-scraper`'s headless barrel (implementation plan Decision 3, issue #6).
 *
 * This file, and everything it re-exports, imports nothing from `react`, `react-native` or
 * `react-native-webview` — `apps/mobile/src/__tests__/workspace-wiring.test.ts` already imports
 * `PACKAGE_NAME` from here today (V6), and `apps/mobile` does not have `react-native-webview`
 * installed. `src/index.barrel-purity.test.ts` asserts this constraint by walking every module
 * this barrel transitively re-exports. The React component lives at `src/component/` — a deep
 * import, never re-exported here.
 */

export const PACKAGE_NAME = '@finanzas/bank-scraper';

// Protocol / step machine.
export {
  ScraperEventType,
  VALID_STEP_TRANSITIONS,
  NON_RETRYABLE_ERROR_CODES,
  type ScraperStepId,
  type ReadOutcome,
  type FailureReasonCode,
  type ScraperRequestRejection,
} from './types/protocol.types';

// Result shape.
export type {
  ProductType,
  MovementDirection,
  ScrapedProduct,
  ScrapedMovement,
  ProductReadFailure,
  ScraperTrace,
  ScrapeResult,
  RawProductPayload,
  RawMovementPayload,
} from './types/scrape-result.types';

// Bank configuration shape (consumed by a future bank-picker UI; the concrete Banco de Chile
// config is reachable only through the registry below, never imported directly by app code).
export type { BankField, ScriptConfig, BankNormalizer, BankConfig, WebViewPort } from './types/bank-config.types';

// Security perimeter.
export { isAllowedOrigin, assertCredentialEntryAllowed, type CredentialEntryCheck } from './security/origin-allowlist';
export { CredentialHolder, CredentialsClearedError } from './security/credential-holder';
export { TraceRedactor, FORBIDDEN_TRACE_KEYS } from './security/redaction';
export { toJsStringLiteral } from './security/js-string-literal';

// Country-level parsing.
export { parseMinorUnits, AmountParseError, CURRENCY_MINOR_UNIT_EXPONENTS, type AmountParseErrorCode } from './parsing/amount';
export { parseBankDateLocal, DateParseError, type DateParseErrorCode } from './parsing/date';

// Engine.
export { ScrapeSession, resolveBankConfigOrReject, type ScrapeSessionInput } from './engine/scrape-session';
export { READ_DEADLINE_MS, MAX_STEP_ATTEMPTS, MAX_ELEMENT_ATTEMPTS, MAX_SUBMIT_ATTEMPTS } from './engine/constants';

import type { WebViewPort } from './types/bank-config.types';
import type { ScraperRequestRejection, ScraperStepId } from './types/protocol.types';
import type { ScrapeResult } from './types/scrape-result.types';
import { BANK_CONFIGS } from './configs/index';
import { ScrapeSession, resolveBankConfigOrReject } from './engine/scrape-session';

// Registry.
export { BANK_CONFIGS };

export interface StartBankReadInput {
  countryCode: string;
  bankId: string;
  credentials: Record<string, string>;
  port: WebViewPort;
  priorMonths?: number;
  readDeadlineMs?: number;
  onResult: (result: ScrapeResult) => void;
  onProgress?: (progress: { stepId: ScraperStepId; progress: number }) => void;
}

/**
 * The single entry point a caller (the connect flow, a separate item) uses to start a read.
 * Refuses before opening anything for an unsupported bank/country (spec Business Rule 27,
 * AC18) — no `ScrapeSession` is even constructed in that case, so no navigation and no
 * credential access ever happen.
 */
export function startBankRead(input: StartBankReadInput): ScrapeSession | ScraperRequestRejection {
  const resolved = resolveBankConfigOrReject(BANK_CONFIGS, input.countryCode, input.bankId);
  if ('reason' in resolved) {
    return resolved;
  }
  const session = new ScrapeSession(resolved, input.port, {
    countryCode: input.countryCode,
    credentials: input.credentials,
    priorMonths: input.priorMonths,
    readDeadlineMs: input.readDeadlineMs,
    onResult: input.onResult,
    onProgress: input.onProgress,
  });
  session.start();
  return session;
}
