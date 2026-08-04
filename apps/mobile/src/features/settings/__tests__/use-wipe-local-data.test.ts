import fs from 'node:fs';
import path from 'node:path';

import { attemptConfirmDelete, type WipePhase } from '../use-wipe-local-data';
import type { WipeResult } from '../wipe-local-data';

/**
 * Scenario 6 of the implementation plan for issue #19: `confirmDelete()` called twice in a row
 * runs `wipeLocalData` exactly once; `confirmDelete()` in phase `'idle'` is a no-op. Exercised as
 * a plain async function with no renderer (Decision 6's hook/pure split precedent).
 */
describe('attemptConfirmDelete (Decision 7, concurrency checklist item 2)', () => {
  it('is a no-op when the phase is "idle"', async () => {
    let phase: WipePhase = 'idle';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'ok' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(wipe).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(phase).toBe('idle');
  });

  it('is a no-op when the phase is "wiping" (already in flight)', async () => {
    let phase: WipePhase = 'wiping';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'ok' }));

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess: jest.fn() });

    expect(wipe).not.toHaveBeenCalled();
  });

  it('two calls in a row run wipe exactly once — the second call reads phase "wiping" and returns immediately', async () => {
    let phase: WipePhase = 'confirming';
    let resolveWipe: (result: WipeResult) => void = () => undefined;
    const wipe = jest.fn(
      () =>
        new Promise<WipeResult>((resolve) => {
          resolveWipe = resolve;
        }),
    );
    const onSuccess = jest.fn();
    const deps = { getPhase: () => phase, setPhase: (next: WipePhase) => (phase = next), wipe, onSuccess };

    const first = attemptConfirmDelete(deps);
    // By the time `attemptConfirmDelete` has moved past its first `await deps.wipe()` call
    // (`wipe` is already invoked synchronously up to its own first `await`), `phase` has been set
    // to `'wiping'` — a second call now reads that, not `'confirming'`.
    const second = attemptConfirmDelete(deps);

    resolveWipe({ status: 'ok' });
    await Promise.all([first, second]);

    expect(wipe).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('on { status: ok }, calls onSuccess and leaves the phase at "wiping" (the caller navigates away)', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'ok' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(phase).toBe('wiping');
  });

  it('on { status: credentials_failed }, sets the phase to "failed_credentials" and does not call onSuccess', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'credentials_failed' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(phase).toBe('failed_credentials');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('on { status: store_failed }, sets the phase to "failed_store" and does not call onSuccess', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'store_failed' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(phase).toBe('failed_store');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('found in review: a rejecting wipe() (e.g. getAppDatabase() failing before wipeLocalData ever runs) sets the phase to "failed_credentials" — nothing was touched — and never escapes as an unhandled rejection', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(() => Promise.reject(new Error('bootstrap failed')));
    const onSuccess = jest.fn();

    let unhandled: unknown;
    const onUnhandledRejection = (reason: unknown) => {
      unhandled = reason;
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });
      expect(phase).toBe('failed_credentials');
      expect(onSuccess).not.toHaveBeenCalled();
    } finally {
      await new Promise((resolve) => setImmediate(resolve));
      process.removeListener('unhandledRejection', onUnhandledRejection);
    }
    expect(unhandled).toBeUndefined();
  });
});

/**
 * Found in review: the real hook's success path must dismiss the settings stack before replacing
 * the route with onboarding (Decision 4) — a source-text assertion, since `useWipeLocalData` calls
 * `useRouter()` and cannot be exercised as a plain function (no renderer, no
 * `@testing-library/react-native` — Decision 11).
 */
describe('useWipeLocalData — the real onSuccess navigation (Decision 4)', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'use-wipe-local-data.ts'), 'utf8');

  it("calls router.dismissAll() then router.replace('/(onboarding)/intro') on success", () => {
    expect(source).toMatch(/router\.dismissAll\(\)/);
    expect(source).toMatch(/router\.replace\('\/\(onboarding\)\/intro'\)/);

    const dismissIndex = source.indexOf('router.dismissAll()');
    const replaceIndex = source.indexOf("router.replace('/(onboarding)/intro')");
    expect(dismissIndex).toBeGreaterThan(-1);
    expect(replaceIndex).toBeGreaterThan(dismissIndex);
  });
});
