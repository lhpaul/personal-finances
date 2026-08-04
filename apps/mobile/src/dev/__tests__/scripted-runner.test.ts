import {
  __resetScriptedRunnerForTests,
  clearScript,
  getInstalledScript,
  installScript,
  runInstalledScript,
} from '../scripted-runner';

/**
 * `__DEV__`-only scripted-runner support (implementation plan Decision 10, issue #11). `__DEV__`
 * is `true` under `jest-expo`, so these assertions exercise the real runtime guard by setting
 * `(global as { __DEV__: boolean }).__DEV__` directly rather than mocking it away.
 */
describe('scripted-runner (Decision 10)', () => {
  afterEach(() => {
    __resetScriptedRunnerForTests();
    (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  });

  it('installScript / getInstalledScript / clearScript round-trip', () => {
    expect(getInstalledScript()).toBeNull();
    installScript('complete');
    expect(getInstalledScript()).toBe('complete');
    clearScript();
    expect(getInstalledScript()).toBeNull();
  });

  it('returns null when no script is installed, falling through to the real path', () => {
    const handle = runInstalledScript({ onProgress: () => undefined, onResult: () => undefined });
    expect(handle).toBeNull();
  });

  it('returns null unconditionally when __DEV__ is false, even with a script installed (the resolver-returns-real-runner guarantee)', () => {
    installScript('complete');
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    const handle = runInstalledScript({ onProgress: () => undefined, onResult: () => undefined });
    expect(handle).toBeNull();
  });

  it('a hold script reports one progress event at the held step and never settles on its own', () => {
    installScript('hold_products');
    const onResult = jest.fn();
    const onProgress = jest.fn();
    const handle = runInstalledScript({ onProgress, onResult });

    expect(handle).not.toBeNull();
    expect(onProgress).toHaveBeenCalledWith({ stepId: 'get-products-start', progress: 0 });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('the complete script settles asynchronously with outcome "complete"', async () => {
    installScript('complete');
    const onResult = jest.fn();
    runInstalledScript({ onProgress: () => undefined, onResult });

    expect(onResult).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toMatchObject({ outcome: 'complete', readFailure: null });
  });

  it.each([
    ['fail_invalid_credentials', 'invalid_credentials'],
    ['fail_session_closed', 'session_closed'],
    ['fail_network', 'network'],
    ['fail_parse_failed', 'parse_failed'],
  ] as const)('%s settles with readFailure.reasonCode = %s', async (scriptId, reasonCode) => {
    installScript(scriptId);
    const onResult = jest.fn();
    runInstalledScript({ onProgress: () => undefined, onResult });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toMatchObject({ outcome: 'failed', readFailure: { reasonCode } });
  });

  it('cancel() clears pending timers and settles with the cancelled outcome — no result fires afterward', async () => {
    installScript('complete');
    const onResult = jest.fn();
    const handle = runInstalledScript({ onProgress: () => undefined, onResult });

    handle?.cancel();
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0]).toMatchObject({ outcome: 'cancelled' });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onResult).toHaveBeenCalledTimes(1); // the original timer never fires a second result
  });

  it('play_full reports a non-monotonic raw sequence (the screen, not this script, absorbs it)', async () => {
    installScript('play_full');
    const progressValues: number[] = [];
    runInstalledScript({
      onProgress: (progress) => progressValues.push(progress.progress),
      onResult: () => undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(progressValues).toEqual([0.1, 0.2, 0.05, 0.5, 0.95]);
    // The raw sequence deliberately dips (0.2 -> 0.05) — `resolveProgressValue`'s Math.max is
    // what the screen relies on to absorb this, not the script.
    expect(Math.min(...progressValues)).toBeLessThan(Math.max(...progressValues.slice(0, 2)));
  });
});
