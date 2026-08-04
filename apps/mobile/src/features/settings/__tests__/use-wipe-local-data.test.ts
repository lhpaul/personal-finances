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

  it('on { status: credentials_failed }, sets the phase to "failed" and does not call onSuccess', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'credentials_failed' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(phase).toBe('failed');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('on { status: store_failed }, sets the phase to "failed" and does not call onSuccess', async () => {
    let phase: WipePhase = 'confirming';
    const wipe = jest.fn(async (): Promise<WipeResult> => ({ status: 'store_failed' }));
    const onSuccess = jest.fn();

    await attemptConfirmDelete({ getPhase: () => phase, setPhase: (next) => (phase = next), wipe, onSuccess });

    expect(phase).toBe('failed');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
