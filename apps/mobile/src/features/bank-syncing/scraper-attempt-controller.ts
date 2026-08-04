import type { BankConfig, ScrapeResult, ScraperStepId } from '@finanzas/bank-scraper';

/**
 * `useScraperRunner`'s testable core (implementation plan Decisions 4, 5, 9, 10; the concurrency
 * checklist, issue #11). No React — `use-scraper-runner.tsx` is a thin binding that supplies
 * real dependencies, renders `getMountRequest()` as `<BankScraperComponent>`, and forwards its
 * imperative handle to {@link ScraperAttemptController.setRealCancelHandle}. Every settlement
 * path — a scripted result, a real `onResult`, or a `cancel()` — funnels through
 * {@link ScraperAttemptController.handleResult}, which is where the settle-once guarantee and
 * the credential-ref clearing both live (mirrors item #12's hook/pure split between
 * `use-home-data.ts` and `loadHomeData`).
 */

export interface ScriptRunHandle {
  cancel: () => void;
}

export interface ScriptRunCallbacks {
  onProgress: (progress: { stepId: ScraperStepId; progress: number }) => void;
  onResult: (result: ScrapeResult) => void;
}

export interface ScraperAttemptControllerDeps {
  /** `resolveBankConfigOrReject` composed down to a plain nullable lookup (Decision 4) — `null`
   * means unsupported. */
  resolveBankConfig: (countryCode: string, bankId: string) => BankConfig | null;
  readCredentials: (bankId: string) => Promise<{ rut: string; password: string } | null>;
  /** `runInstalledScript` (Decision 10), or a fake in tests. Returns `null` when no script
   * applies (including whenever `__DEV__` is false), so the controller falls through to the
   * real path. Checked **before** `readCredentials`/`resolveBankConfig` — a fixture run never
   * touches the keychain and never resolves a bank config. */
  runScript: (callbacks: ScriptRunCallbacks) => ScriptRunHandle | null;
  onProgress: (progress: { stepId: ScraperStepId; progress: number }) => void;
}

export interface MountRequest {
  attemptId: number;
  config: BankConfig;
  credentials: Record<string, string>;
}

export type ScraperRunErrorReason = 'missing_credentials' | 'unsupported_bank';

/** Value-free by construction (Decision 5, control 1): the only field is a closed-union reason,
 * never a caught error's message and never a credential. */
export class ScraperRunError extends Error {
  readonly reason: ScraperRunErrorReason;

  constructor(reason: ScraperRunErrorReason) {
    super(`ScraperRunError: ${reason}`);
    this.name = 'ScraperRunError';
    this.reason = reason;
  }
}

interface Settlement {
  settled: boolean;
  resolve: (result: ScrapeResult) => void;
}

/** The `'cancelled'` `ScrapeResult` shape `cancel()` settles with — mirrors
 * `src/dev/scripted-runner.ts`'s own `cancelledResult()` (Decision 9: cancellation is a value,
 * never an error). */
function buildCancelledResult(countryCode: string, bankId: string): ScrapeResult {
  return {
    outcome: 'cancelled',
    countryCode,
    bankId,
    products: [],
    movements: [],
    readFailure: null,
    productFailures: [],
    skippedProductKinds: [],
    traces: [],
  };
}

export class ScraperAttemptController {
  private readonly deps: ScraperAttemptControllerDeps;
  private readonly onMountRequestChange: () => void;

  private mountRequest: MountRequest | null = null;
  private credentials: Record<string, string> | null = null;
  private settlement: Settlement | null = null;
  private devCancel: (() => void) | null = null;
  private realCancel: (() => void) | null = null;
  /** Set by `cancel()` when neither `devCancel` nor `realCancel` exists yet — the window between
   * `run()` starting the real path and `readCredentials()` resolving, during which nothing is
   * mounted and no script is installed (found in review — CodeRabbit PR #85). Consumed once,
   * immediately after that await, by `run()` itself. */
  private cancelRequestedBeforeMount = false;
  private nextAttemptId = 0;

  constructor(deps: ScraperAttemptControllerDeps, onMountRequestChange: () => void) {
    this.deps = deps;
    this.onMountRequestChange = onMountRequestChange;
  }

  getMountRequest(): MountRequest | null {
    return this.mountRequest;
  }

  /** A snapshot for the credential-leak test (Decision 5) — never logged, never stored anywhere
   * that persists. */
  getCredentialsSnapshot(): Record<string, string> | null {
    return this.credentials;
  }

  /** Called by the hook's `ref` callback whenever `BankScraperComponent` (dis)mounts. */
  setRealCancelHandle(cancel: (() => void) | null): void {
    this.realCancel = cancel;
  }

  handleProgress = (progress: { stepId: ScraperStepId; progress: number }): void => {
    this.deps.onProgress(progress);
  };

  handleResult = (result: ScrapeResult): void => {
    // Cleared unconditionally at the top, on every settlement path — success, failure or cancel
    // — the `finally` Decision 5 calls for (scenario 10).
    this.credentials = null;
    this.devCancel = null;
    this.realCancel = null;
    this.cancelRequestedBeforeMount = false;
    if (this.mountRequest !== null) {
      this.mountRequest = null;
      this.onMountRequestChange();
    }

    const settlement = this.settlement;
    this.settlement = null;
    // Settle-once: read-and-set with no `await` between them, so the single-threaded event loop
    // makes this atomic (concurrency addendum). A late second call — `onResult` racing a
    // `cancel()` that already settled — is a silent no-op, not a second resolve (scenario 8).
    if (settlement !== null && !settlement.settled) {
      settlement.settled = true;
      settlement.resolve(result);
    }
  };

  /** Safe to call when there is no attempt in flight (no-op). */
  cancel(): void {
    if (this.devCancel !== null) {
      this.devCancel();
      return;
    }
    if (this.realCancel !== null) {
      this.realCancel();
      return;
    }
    // Neither handle exists yet — the real path may still be awaiting `readCredentials()`, with
    // nothing mounted and no script installed (found in review — CodeRabbit PR #85). Record the
    // request; `run()` checks it the moment that await resolves, so this is not a silent no-op.
    this.cancelRequestedBeforeMount = true;
  }

  async run(request: { countryCode: string; bankId: string }): Promise<ScrapeResult> {
    this.cancelRequestedBeforeMount = false;

    // __DEV__-only scripted path (Decision 10) — checked first, so a fixture run never reads the
    // keychain and never resolves a bank config. The settlement is armed *before* calling
    // `runScript` so a script that settles synchronously cannot race past `handleResult`'s guard.
    let resolveScripted: ((result: ScrapeResult) => void) | undefined;
    const scriptedPromise = new Promise<ScrapeResult>((resolve) => {
      resolveScripted = resolve;
    });
    this.settlement = { settled: false, resolve: resolveScripted as (result: ScrapeResult) => void };
    const scripted = this.deps.runScript({ onProgress: this.handleProgress, onResult: this.handleResult });
    if (scripted !== null) {
      this.devCancel = scripted.cancel;
      return scriptedPromise;
    }
    this.settlement = null; // no script applies — fall through to the real path

    const config = this.deps.resolveBankConfig(request.countryCode, request.bankId);
    if (config === null) {
      throw new ScraperRunError('unsupported_bank');
    }

    // Armed *before* the credential await (found in review — CodeRabbit PR #85): a `cancel()`
    // that arrives while `readCredentials` is in flight has neither `devCancel` nor `realCancel`
    // to reach, and would otherwise be a silent no-op that leaves this promise unsettled forever.
    let resolveReal: ((result: ScrapeResult) => void) | undefined;
    const promise = new Promise<ScrapeResult>((resolve) => {
      resolveReal = resolve;
    });
    this.settlement = { settled: false, resolve: resolveReal as (result: ScrapeResult) => void };

    const credentials = await this.deps.readCredentials(request.bankId);

    if (this.cancelRequestedBeforeMount) {
      // The credential (if any was returned) is never assigned to `this.credentials` in this
      // branch, so there is nothing for `handleResult`'s clearing step to do beyond its normal
      // work — the plaintext local variable simply goes out of scope, same as it does across the
      // `missing_credentials` branch below.
      this.handleResult(buildCancelledResult(request.countryCode, request.bankId));
      return promise;
    }

    if (credentials === null) {
      this.settlement = null; // no attempt is actually in flight — nothing is left armed
      throw new ScraperRunError('missing_credentials');
    }

    const attemptId = this.nextAttemptId;
    this.nextAttemptId += 1;
    const credentialsRecord: Record<string, string> = { rut: credentials.rut, password: credentials.password };
    this.credentials = credentialsRecord;

    this.mountRequest = { attemptId, config, credentials: credentialsRecord };
    this.onMountRequestChange();
    return promise;
  }
}
