import { CredentialHolder } from '../security/credential-holder';
import { assertCredentialEntryAllowed, isAllowedOrigin } from '../security/origin-allowlist';
import { TraceRedactor } from '../security/redaction';
import { AmountParseError, parseMinorUnits } from '../parsing/amount';
import { parseBankDateLocal } from '../parsing/date';
import type { BankConfig, WebViewPort } from '../types/bank-config.types';
import {
  NON_RETRYABLE_ERROR_CODES,
  VALID_STEP_TRANSITIONS,
  type FailureReasonCode,
  type ScraperRequestRejection,
  type ScraperStepId,
} from '../types/protocol.types';
import type {
  ProductReadFailure,
  ScrapedMovement,
  ScrapedProduct,
  ScrapeResult,
  ScraperTrace,
} from '../types/scrape-result.types';
import { READ_DEADLINE_MS } from './constants';
import { MessageHandlerService, type StateChangePayload } from './message-handler.service';
import { assertReportedMovementShape, assertReportedProductShape } from './product-shape';
import { StateManagerService } from './state-manager.service';
import { WebViewDriverService } from './webview-driver.service';

/**
 * The one object that owns a read end to end (spec Business Rules 1-32; implementation plan
 * Decisions 4-9, 15). `finalize()` is the single terminal path: every way a read can end —
 * `complete`, `partial`, `failed`, `cancelled`, deadline expiry, and an origin-gate violation —
 * reaches it and no other, so the credential is always cleared before the browser session is torn
 * down (spec Cancellation), regardless of which of those paths fired.
 */

const LOGIN_SCRIPT_KEY = 'login';
const ACCOUNT_TRANSACTIONS_SCRIPT_KEY = 'accountTransactions';
const CREDIT_CARD_DETAILS_SCRIPT_KEY = 'creditCardDetails';
const SESSION_ESTABLISHED_STEP: ScraperStepId = 'get-products-start';

export interface ScrapeSessionInput {
  countryCode: string;
  credentials: Record<string, string>;
  /** Defaults to 1 (spec Decision 4: current month plus one prior month). */
  priorMonths?: number;
  /** Overridable for tests; defaults to READ_DEADLINE_MS (Decision 8). */
  readDeadlineMs?: number;
  onResult: (result: ScrapeResult) => void;
  onProgress?: (progress: { stepId: ScraperStepId; progress: number }) => void;
}

function isFailureReasonCode(value: unknown): value is FailureReasonCode {
  return value === 'invalid_credentials' || value === 'session_closed' || value === 'network' || value === 'parse_failed';
}

/**
 * Resolves a bank/country pair against an already-loaded registry, or returns the refusal the
 * caller should surface (spec Business Rule 27, AC18) — computed with **no** navigation, no
 * WebView interaction and no credential access. Takes the registry as a plain argument rather
 * than importing it, so this engine module stays bank-agnostic (no dependency on `src/configs/`).
 */
export function resolveBankConfigOrReject(
  configsByCountry: Readonly<Record<string, readonly BankConfig[]>>,
  countryCode: string,
  bankId: string,
): BankConfig | ScraperRequestRejection {
  // Object.hasOwn guards against an inherited Object.prototype key (e.g. countryCode ===
  // 'constructor' or 'toString'): a plain bracket lookup would resolve through the prototype
  // chain to an inherited function, pass the truthiness check below, and then throw a TypeError
  // when .find() is called on it — defeating the very purpose of this function, which exists to
  // return a clean rejection for an unsupported country (CodeRabbit finding #23).
  const countryConfigs = Object.hasOwn(configsByCountry, countryCode) ? configsByCountry[countryCode] : undefined;
  if (!countryConfigs) {
    return { reason: 'unsupported_country', countryCode, bankId };
  }
  const config = countryConfigs.find((candidate) => candidate.id === bankId);
  if (!config) {
    return { reason: 'unsupported_bank', countryCode, bankId };
  }
  return config;
}

export class ScrapeSession {
  readonly #config: BankConfig;
  readonly #driver: WebViewDriverService;
  readonly #credentials: CredentialHolder;
  readonly #redactor: TraceRedactor;
  readonly #messageHandler: MessageHandlerService;
  readonly #stateManager = new StateManagerService();
  readonly #countryCode: string;
  readonly #priorMonths: number;
  readonly #readDeadlineMs: number;
  readonly #onResult: (result: ScrapeResult) => void;
  readonly #onProgress?: (progress: { stepId: ScraperStepId; progress: number }) => void;

  #started = false;
  #finalized = false;
  #cancelled = false;
  #sessionEstablished = false;
  #deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  #traces: ScraperTrace[] = [];
  #products = new Map<string, ScrapedProduct>();
  #movements = new Map<string, ScrapedMovement>();
  #productFailures = new Map<string, ProductReadFailure>();
  #readFailure: { reasonCode: FailureReasonCode } | null = null;
  #skippedProductKinds = new Set<string>();
  #lastAttemptedStepFailureReason: FailureReasonCode = 'network';

  constructor(config: BankConfig, port: WebViewPort, input: ScrapeSessionInput) {
    this.#config = config;
    this.#countryCode = input.countryCode;
    this.#priorMonths = input.priorMonths ?? 1;
    this.#readDeadlineMs = input.readDeadlineMs ?? READ_DEADLINE_MS;
    this.#onResult = input.onResult;
    this.#onProgress = input.onProgress;
    this.#credentials = new CredentialHolder(input.credentials);
    this.#redactor = new TraceRedactor(this.#credentials);
    this.#messageHandler = new MessageHandlerService(this.#redactor);
    this.#driver = new WebViewDriverService(port, config);
  }

  start(): void {
    if (this.#started || this.#finalized) return;
    this.#started = true;
    this.#deadlineTimer = setTimeout(() => this.#handleDeadlineExpired(), this.#readDeadlineMs);
    try {
      this.#driver.start();
    } catch (error) {
      // WebViewPort.navigateTo() can throw (CodeRabbit finding #29). Without this, the caller's
      // exception propagates with no `onResult` ever called — the deadline timer just created
      // above is also left dangling since #finalize() never runs. Route this through a `failed`
      // result with normal cleanup, not cancel() (which reports `cancelled`, a materially
      // different outcome for the same reason `readFailure` is null there).
      this.#addTrace({
        logGroup: 'engine',
        type: 'error',
        message: 'startup_failed: ' + (error instanceof Error ? error.message : 'unknown error'),
        timestamp: Date.now(),
      });
      this.#readFailure = { reasonCode: 'network' };
      this.#finalize();
    }
  }

  cancel(): void {
    if (this.#finalized) return;
    this.#cancelled = true;
    this.#finalize();
  }

  isFinalized(): boolean {
    return this.#finalized;
  }

  /**
   * Test-visible signal for `CredentialHolder.clear()` (CodeRabbit finding #21). Without this,
   * a test asserting "credentials are cleared" could only observe `isFinalized()` — which stays
   * true even if a regression dropped the `clear()` call from `#finalize()` entirely, since the
   * two are set independently.
   */
  areCredentialsCleared(): boolean {
    return this.#credentials.isCleared();
  }

  getTraces(): ScraperTrace[] {
    return [...this.#traces];
  }

  /**
   * Checkpoint 1 (navigation gate): `onShouldStartLoadWithRequest`. `isTopFrame` defaults to
   * `true` for callers that predate it (backward compatible). On iOS,
   * `onShouldStartLoadWithRequest` also fires for iframe (non-top-frame) requests — an
   * off-origin ad, tracker, or embedded widget inside the bank's own page must not finalize the
   * whole read the way an off-origin top-level navigation does (CodeRabbit finding #24). A
   * blocked non-top-frame request is simply not loaded; only a blocked top-frame request records
   * an origin failure.
   */
  handleShouldStartLoadWithRequest(url: string, isTopFrame = true): boolean {
    if (this.#finalized) return false;
    if (url === 'about:blank') return true;
    const allowed = isAllowedOrigin(url, this.#config.allowedOrigins);
    if (!allowed && isTopFrame) {
      this.#recordOriginBlocked(url);
    }
    return allowed;
  }

  handleLoadStart(url: string): void {
    if (this.#finalized) return;
    this.#driver.handleLoadStart(url);
  }

  /** Checkpoint 2 (injection gate): re-checks the load-end URL before injecting anything. */
  handleLoadEnd(url: string): void {
    if (this.#finalized) return;
    if (url !== 'about:blank' && !isAllowedOrigin(url, this.#config.allowedOrigins)) {
      this.#recordOriginBlocked(url);
      return;
    }
    const decision = this.#driver.handleLoadEnd(url);
    if (decision.kind !== 'inject') return;

    const { scriptKey, delay } = decision;
    const scriptConfig = this.#config.scripts[scriptKey];
    if (!scriptConfig) return;

    if (scriptKey === LOGIN_SCRIPT_KEY) {
      // Built INSIDE consume() and handed straight to inject() in the same expression — the
      // generated string is never returned, stored, or traced (Decision 5, control 2).
      this.#driver.inject(() => this.#credentials.consume((fields) => scriptConfig.script(fields)), delay);
      return;
    }
    const input = this.#buildScriptInput(scriptKey);
    this.#driver.inject(() => scriptConfig.script(input), delay);
  }

  handleWebViewMessage(rawData: string): void {
    if (this.#finalized) return; // late messages are dropped, not traced (Decision 9)
    if (!this.#started) {
      this.#addTrace({ logGroup: 'engine', type: 'warning', message: 'message_before_start', timestamp: Date.now() });
      return;
    }
    this.#messageHandler.handleMessage(rawData, {
      onTrace: (trace) => this.#addTrace(trace),
      onError: (payload) => this.#handleError(payload),
      onStateChange: (payload) => this.#handleStateChange(payload),
    });
  }

  #buildScriptInput(scriptKey: string): unknown {
    if (scriptKey === ACCOUNT_TRANSACTIONS_SCRIPT_KEY || scriptKey === CREDIT_CARD_DETAILS_SCRIPT_KEY) {
      return { priorMonths: this.#priorMonths };
    }
    return undefined;
  }

  #recordOriginBlocked(url: string): void {
    const check = assertCredentialEntryAllowed(url, this.#config.credentialEntryOrigin);
    // Never the full URL, whose path and query string can carry session-identifying material
    // (Decision 4) — only blockedOrigin/expectedOrigin are recorded.
    this.#addTrace({
      logGroup: 'origin-gate',
      type: 'error',
      message: 'origin_blocked',
      timestamp: Date.now(),
      data: { blockedOrigin: check.blockedOrigin, expectedOrigin: check.expectedOrigin },
    });
    const reasonCode: FailureReasonCode = this.#sessionEstablished ? 'session_closed' : 'network';
    this.#lastAttemptedStepFailureReason = reasonCode;
    this.#readFailure = { reasonCode };
    this.#finalize();
  }

  #handleError(payload: unknown): void {
    const record = (payload ?? {}) as Record<string, unknown>;
    const code: FailureReasonCode = isFailureReasonCode(record.code) ? record.code : 'parse_failed';
    const productInstanceId = typeof record.productInstanceId === 'string' ? record.productInstanceId : undefined;
    const attempts = typeof record.attempts === 'number' ? record.attempts : 1;
    this.#lastAttemptedStepFailureReason = code;

    if (productInstanceId && !NON_RETRYABLE_ERROR_CODES.includes(code)) {
      this.#recordProductFailure(productInstanceId, code, attempts);
      return;
    }
    this.#readFailure = { reasonCode: code };
    this.#finalize();
  }

  #handleStateChange(payload: StateChangePayload): void {
    const result = this.#stateManager.updateState({ stepId: payload.stepId, progress: payload.progress });
    // Ingest any products/movements the payload carries BEFORE checking whether the step
    // transition itself was accepted (CodeRabbit finding #25). `home` is configured with
    // singleExecution: false, so a second get-products-start for another product page is real,
    // reachable data — rejecting the *step* transition must not also discard the *data* that
    // rode along with it.
    if (payload.data?.products) {
      this.#ingestProducts(payload.data.products);
    }
    if (payload.data?.movements) {
      this.#ingestMovements(payload.data.movements);
    }
    if (!result.accepted) {
      this.#addTrace({
        logGroup: 'state-manager',
        type: 'warning',
        message: result.rejectedReason ?? 'rejected_step',
        timestamp: Date.now(),
        data: { attemptedStepId: payload.stepId },
      });
      return;
    }
    if (this.#stepAtLeast(result.stepId, SESSION_ESTABLISHED_STEP)) {
      this.#sessionEstablished = true;
    }
    this.#onProgress?.({ stepId: result.stepId, progress: result.progress });
    if (result.stepId === 'ready') {
      this.#finalize();
    }
  }

  /**
   * Reuses the single source of truth for step order (`VALID_STEP_TRANSITIONS`) instead of
   * restating a second copy that could silently drift from it if a step were ever added or
   * reordered (CodeRabbit finding #26).
   */
  #stepAtLeast(stepId: ScraperStepId, threshold: ScraperStepId): boolean {
    return VALID_STEP_TRANSITIONS.indexOf(stepId) >= VALID_STEP_TRANSITIONS.indexOf(threshold);
  }

  #ingestProducts(rawList: unknown[]): void {
    for (const raw of rawList) {
      const shape = assertReportedProductShape(raw);
      if (!shape.ok) {
        this.#addTrace({
          logGroup: 'product-shape',
          type: 'error',
          message: 'rejected_product_shape',
          timestamp: Date.now(),
          data: { violation: shape.violation },
        });
        continue;
      }
      const payload = shape.value;
      const kind = this.#config.normalizer.mapProductKind(payload.kindKey);
      if (kind === null) {
        this.#skippedProductKinds.add(payload.kindKey);
        this.#addTrace({
          logGroup: 'normalizer',
          type: 'warning',
          message: 'skipped_unsupported_product_kind',
          timestamp: Date.now(),
          data: { kindKey: payload.kindKey },
        });
        continue;
      }
      try {
        const product: ScrapedProduct = {
          instanceId: payload.instanceId,
          kind,
          displayName: payload.displayName,
          currencyCode: payload.currencyCode,
          maskedIdentifier: payload.maskedIdentifier,
        };
        // balanceText is absent when the reporting page did not expose a balance (finding #13,
        // e.g. a credit card discovered on the home page but not yet visited on its own details
        // page) — leave balanceMinorUnits unset rather than fabricating a zero.
        if (payload.balanceText !== undefined) {
          product.balanceMinorUnits = parseMinorUnits(payload.balanceText, payload.currencyCode);
        }
        if (payload.creditLimitText !== undefined) {
          product.creditLimitMinorUnits = parseMinorUnits(payload.creditLimitText, payload.currencyCode);
        }
        if (payload.availableCreditText !== undefined) {
          product.availableCreditMinorUnits = parseMinorUnits(payload.availableCreditText, payload.currencyCode);
        }
        if (payload.cardBrand !== undefined) product.cardBrand = payload.cardBrand;
        if (payload.cardCategory !== undefined) product.cardCategory = payload.cardCategory;
        if (payload.cardLast4 !== undefined) product.cardLast4 = payload.cardLast4;
        this.#products.set(product.instanceId, product);
      } catch (error) {
        this.#recordParseFailure(payload.instanceId, error);
      }
    }
  }

  #ingestMovements(rawList: unknown[]): void {
    for (const raw of rawList) {
      const shape = assertReportedMovementShape(raw);
      if (!shape.ok) {
        this.#addTrace({
          logGroup: 'movement-shape',
          type: 'error',
          message: 'rejected_movement_shape',
          timestamp: Date.now(),
          data: { violation: shape.violation },
        });
        continue;
      }
      const payload = shape.value;
      try {
        const amountText = payload.outgoingText ?? payload.incomingText;
        if (amountText === null) {
          throw new AmountParseError('no_digits', 'ScrapeSession: neither outgoing nor incoming text populated');
        }
        const movement: ScrapedMovement = {
          productInstanceId: payload.productInstanceId,
          dateLocal: parseBankDateLocal(payload.dateText),
          amountMinorUnits: parseMinorUnits(amountText, payload.currencyCode),
          direction: this.#config.normalizer.mapMovementDirection(payload),
          currencyCode: payload.currencyCode,
          rawDescription: payload.rawDescription,
          bankSuppliedId: payload.bankSuppliedId,
          positionInReadSnapshot: payload.positionInReadSnapshot,
          extras: this.#config.normalizer.mapMovementExtras(payload),
        };
        this.#movements.set(`${movement.productInstanceId}:${movement.positionInReadSnapshot}`, movement);
      } catch (error) {
        this.#recordParseFailure(payload.productInstanceId, error);
      }
    }
  }

  /**
   * A caught `AmountParseError` / `DateParseError` / `RangeError` (from `toDateLocal`) always
   * means the same thing here: this product's data could not be parsed exactly. The error's own
   * message is safe to trace (dates and amounts are not credential material).
   */
  #recordParseFailure(productInstanceId: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'unknown parse error';
    this.#addTrace({
      logGroup: 'parsing',
      type: 'error',
      message: 'parse_failed',
      timestamp: Date.now(),
      data: { productInstanceId, detail: message },
    });
    this.#recordProductFailure(productInstanceId, 'parse_failed', 1);
  }

  #recordProductFailure(productInstanceId: string, reasonCode: FailureReasonCode, attempts: number): void {
    this.#lastAttemptedStepFailureReason = reasonCode;
    this.#productFailures.set(productInstanceId, { productInstanceId, reasonCode, attempts });
  }

  #handleDeadlineExpired(): void {
    if (this.#finalized) return;
    this.#readFailure = { reasonCode: this.#lastAttemptedStepFailureReason };
    this.#finalize();
  }

  #deriveOutcome(): ScrapeResult['outcome'] {
    if (this.#cancelled) return 'cancelled';
    const hasFailure = this.#readFailure !== null || this.#productFailures.size > 0;
    const hasData = this.#products.size > 0 || this.#movements.size > 0;
    if (hasFailure && !hasData) return 'failed';
    if (hasFailure && hasData) return 'partial';
    return 'complete';
  }

  #finalize(): void {
    if (this.#finalized) return;
    this.#finalized = true;
    if (this.#deadlineTimer !== null) {
      clearTimeout(this.#deadlineTimer);
      this.#deadlineTimer = null;
    }
    // ALWAYS clear before teardown (spec Cancellation) — never the reverse.
    this.#credentials.clear();
    try {
      this.#driver.teardown();
    } catch (error) {
      // A throwing teardown (e.g. a WebViewPort whose navigateTo/stopLoading can fail) must
      // never prevent onResult from firing below — this is the single terminal path every read
      // outcome relies on (related to CodeRabbit finding #29: a synchronous WebViewPort failure
      // must always still produce a result, whether it happens on start or on cleanup).
      this.#addTrace({
        logGroup: 'engine',
        type: 'error',
        message: 'teardown_failed: ' + (error instanceof Error ? error.message : 'unknown error'),
        timestamp: Date.now(),
      });
    }

    const outcome = this.#deriveOutcome();
    const result: ScrapeResult = {
      outcome,
      countryCode: this.#countryCode,
      bankId: this.#config.id,
      products: [...this.#products.values()],
      movements: [...this.#movements.values()],
      readFailure: outcome === 'cancelled' ? null : this.#readFailure,
      productFailures: outcome === 'cancelled' ? [] : [...this.#productFailures.values()],
      skippedProductKinds: [...this.#skippedProductKinds],
      traces: [...this.#traces],
    };
    this.#onResult(result);
  }

  #addTrace(trace: ScraperTrace): void {
    this.#traces.push(this.#redactor.redactTrace(trace));
  }
}
