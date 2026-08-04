import type { BankConfig, ScrapeResult } from '@finanzas/bank-scraper';

import {
  ScraperAttemptController,
  ScraperRunError,
  type ScraperAttemptControllerDeps,
  type ScriptRunCallbacks,
  type ScriptRunHandle,
} from '../scraper-attempt-controller';

const FAKE_CONFIG = { id: 'banco-de-chile' } as unknown as BankConfig;

const RESULT_BASE = {
  countryCode: 'cl',
  bankId: 'banco-de-chile',
  products: [],
  movements: [],
  productFailures: [],
  skippedProductKinds: [],
  traces: [],
};

function completeResult(): ScrapeResult {
  return { ...RESULT_BASE, outcome: 'complete', readFailure: null };
}

function cancelledResult(): ScrapeResult {
  return { ...RESULT_BASE, outcome: 'cancelled', readFailure: null };
}

function buildDeps(overrides: Partial<ScraperAttemptControllerDeps> = {}): ScraperAttemptControllerDeps {
  return {
    resolveBankConfig: () => FAKE_CONFIG,
    readCredentials: async () => ({ rut: '11.111.111-1', password: 'SENTINEL' }),
    runScript: () => null,
    onProgress: () => undefined,
    ...overrides,
  };
}

/**
 * Testing Strategy scenarios 8-11 (implementation plan, issue #11) — the runner's settle-once,
 * credential-ref-clearing and rejection contracts, driven directly against the controller with
 * no renderer (item #2's no-renderer precedent).
 */
describe('ScraperAttemptController (scenarios 8-11; the concurrency checklist)', () => {
  it('scenario 8: resolves exactly once when onResult and cancel() fire in the same tick — onResult first', async () => {
    let capturedCallbacks: ScriptRunCallbacks | undefined;
    const controller = new ScraperAttemptController(
      buildDeps({
        runScript: (callbacks) => {
          capturedCallbacks = callbacks;
          return { cancel: () => callbacks.onResult(cancelledResult()) };
        },
      }),
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    capturedCallbacks?.onResult(completeResult());
    controller.cancel();

    const result = await promise;
    expect(result.outcome).toBe('complete'); // the first settlement wins
  });

  it('scenario 8: resolves exactly once when onResult and cancel() fire in the same tick — cancel() first', async () => {
    let capturedCallbacks: ScriptRunCallbacks | undefined;
    const controller = new ScraperAttemptController(
      buildDeps({
        runScript: (callbacks) => {
          capturedCallbacks = callbacks;
          return { cancel: () => callbacks.onResult(cancelledResult()) };
        },
      }),
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    controller.cancel();
    capturedCallbacks?.onResult(completeResult());

    const result = await promise;
    expect(result.outcome).toBe('cancelled'); // the first settlement wins
  });

  it('scenario 9: cancel() before any result settles with the cancelled outcome', async () => {
    let cancelHandle: ScriptRunHandle | undefined;
    const controller = new ScraperAttemptController(
      buildDeps({
        runScript: (callbacks) => {
          cancelHandle = { cancel: () => callbacks.onResult(cancelledResult()) };
          return cancelHandle;
        },
      }),
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    controller.cancel();

    const result = await promise;
    expect(result.outcome).toBe('cancelled');
  });

  it('cancel() is a safe no-op when nothing is in flight', () => {
    const controller = new ScraperAttemptController(buildDeps(), () => undefined);
    expect(() => controller.cancel()).not.toThrow();
  });

  it('real path: cancel() during the readCredentials() await settles as cancelled rather than silently no-oping (found in review — CodeRabbit PR #85)', async () => {
    let resolveCredentials: ((value: { rut: string; password: string } | null) => void) | undefined;
    const readCredentials = jest.fn(
      () =>
        new Promise<{ rut: string; password: string } | null>((resolve) => {
          resolveCredentials = resolve;
        }),
    );
    const controller = new ScraperAttemptController(
      buildDeps({ runScript: () => null, readCredentials }),
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve(); // let run() reach the readCredentials() await

    // Neither devCancel nor realCancel exists yet in this window — nothing is mounted, no
    // script is installed. Before the fix, this was a silent no-op.
    controller.cancel();
    resolveCredentials?.({ rut: '11.111.111-1', password: 'SENTINEL' });

    const result = await promise;
    expect(result.outcome).toBe('cancelled');
    // The credential the resolved promise carried is never assigned to controller state — the
    // snapshot stays null throughout, not merely "cleared after settle".
    expect(controller.getCredentialsSnapshot()).toBeNull();
    expect(controller.getMountRequest()).toBeNull();
  });

  it('real path: cancel() after the mount request is armed but before the host supplies a real cancel handle settles as cancelled (found in review — CodeRabbit PR #85 round 2)', async () => {
    const controller = new ScraperAttemptController(buildDeps({ runScript: () => null }), () => undefined);

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve();
    await Promise.resolve();

    // The mount request exists (the host has been asked to render `BankScraperComponent`), but
    // `setRealCancelHandle` — the component's own `ref` callback — has not fired yet. This is
    // exactly the window an unmount that commits before that render reaches: `use-bank-sync.ts`
    // calls `cancel()` from its effect cleanup, and the element is already gone, so no `ref`
    // callback will ever arrive.
    expect(controller.getMountRequest()).not.toBeNull();
    expect(controller.getCredentialsSnapshot()).not.toBeNull();

    controller.cancel();

    const result = await promise;
    expect(result.outcome).toBe('cancelled');
    expect(controller.getCredentialsSnapshot()).toBeNull();
    expect(controller.getMountRequest()).toBeNull();
  });

  it('scenario 10: the credential snapshot is null after settle, on the success path', async () => {
    // Force the real (non-scripted) path so a credential is actually read.
    const controller = new ScraperAttemptController(buildDeps({ runScript: () => null }), () => undefined);
    // The real path mounts rather than settling on its own — settle it manually via handleResult,
    // exactly as the hook's `onResult` prop would.
    void controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve(); // let the readCredentials() microtask resolve
    await Promise.resolve();

    expect(controller.getCredentialsSnapshot()).toEqual({ rut: '11.111.111-1', password: 'SENTINEL' });
    controller.handleResult(completeResult());
    expect(controller.getCredentialsSnapshot()).toBeNull();
  });

  it('scenario 10: the credential snapshot is null after settle, on the failure path', async () => {
    const controller = new ScraperAttemptController(buildDeps({ runScript: () => null }), () => undefined);
    void controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getCredentialsSnapshot()).not.toBeNull();
    controller.handleResult({ ...RESULT_BASE, outcome: 'failed', readFailure: { reasonCode: 'session_closed' } });
    expect(controller.getCredentialsSnapshot()).toBeNull();
  });

  it('scenario 10: the credential snapshot is null after settle, on the cancel path', async () => {
    const controller = new ScraperAttemptController(buildDeps({ runScript: () => null }), () => undefined);
    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getCredentialsSnapshot()).not.toBeNull();
    // Installs a real cancel handle — mirrors the hook's own `ref` callback on the mounted
    // component — so `cancel()` itself drives the settlement, rather than calling `handleResult`
    // directly and leaving `cancel()` an untested no-op (found in review — CodeRabbit PR #85).
    controller.setRealCancelHandle(() => controller.handleResult(cancelledResult()));
    controller.cancel();
    expect(controller.getCredentialsSnapshot()).toBeNull();
    await expect(promise).resolves.toMatchObject({ outcome: 'cancelled' });
  });

  it('scenario 11: run() rejects with a value-free ScraperRunError("missing_credentials") when the keychain has no entry', async () => {
    const readCredentials = jest.fn().mockResolvedValue(null);
    const controller = new ScraperAttemptController(
      buildDeps({ runScript: () => null, readCredentials }),
      () => undefined,
    );

    await expect(controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' })).rejects.toMatchObject({
      reason: 'missing_credentials',
    });
    expect(readCredentials).toHaveBeenCalledTimes(1);
  });

  it('scenario 11: run() rejects with ScraperRunError("unsupported_bank") and never reads the keychain for an unsupported bank', async () => {
    const readCredentials = jest.fn();
    const controller = new ScraperAttemptController(
      buildDeps({ runScript: () => null, resolveBankConfig: () => null, readCredentials }),
      () => undefined,
    );

    await expect(controller.run({ countryCode: 'cl', bankId: 'unknown-bank' })).rejects.toBeInstanceOf(ScraperRunError);
    expect(readCredentials).not.toHaveBeenCalled();
  });

  it('a scripted run never calls resolveBankConfig or readCredentials at all', async () => {
    const resolveBankConfig = jest.fn().mockReturnValue(FAKE_CONFIG);
    const readCredentials = jest.fn();
    let capturedCallbacks: ScriptRunCallbacks | undefined;
    const controller = new ScraperAttemptController(
      buildDeps({
        resolveBankConfig,
        readCredentials,
        runScript: (callbacks) => {
          capturedCallbacks = callbacks;
          return { cancel: () => undefined };
        },
      }),
      () => undefined,
    );

    const promise = controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    capturedCallbacks?.onResult(completeResult());
    await promise;

    expect(resolveBankConfig).not.toHaveBeenCalled();
    expect(readCredentials).not.toHaveBeenCalled();
  });

  it('the mount request clears once settled, and getMountRequest() reflects a real attempt while it is in flight', async () => {
    let onMountRequestChangeCalls = 0;
    const controller = new ScraperAttemptController(buildDeps({ runScript: () => null }), () => {
      onMountRequestChangeCalls += 1;
    });

    expect(controller.getMountRequest()).toBeNull();
    void controller.run({ countryCode: 'cl', bankId: 'banco-de-chile' });
    await Promise.resolve();
    await Promise.resolve();

    expect(controller.getMountRequest()).not.toBeNull();
    expect(onMountRequestChangeCalls).toBe(1);

    controller.handleResult(completeResult());
    expect(controller.getMountRequest()).toBeNull();
    expect(onMountRequestChangeCalls).toBe(2);
  });
});
