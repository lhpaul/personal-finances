import { StateManagerService } from './state-manager.service';

describe('StateManagerService', () => {
  it('accepts the legitimate forward sequence untouched (AC20)', () => {
    const manager = new StateManagerService();
    const sequence = [
      { stepId: 'load-start', progress: 0 },
      { stepId: 'login-start', progress: 0.1 },
      { stepId: 'get-products-start', progress: 0.5 },
      { stepId: 'get-transactions-start', progress: 0.6 },
      { stepId: 'get-transactions-start', progress: 0.75 }, // legitimately reports many times
      { stepId: 'get-transactions-start', progress: 0.9 },
      { stepId: 'ready', progress: 1 },
    ] as const;
    const emittedSteps: string[] = [];
    const emittedProgress: number[] = [];
    for (const update of sequence) {
      const result = manager.updateState(update);
      expect(result.accepted).toBe(true);
      emittedSteps.push(result.stepId);
      emittedProgress.push(result.progress);
    }
    expect(emittedSteps).toEqual([
      'load-start',
      'login-start',
      'get-products-start',
      'get-transactions-start',
      'get-transactions-start',
      'get-transactions-start',
      'ready',
    ]);
    for (let i = 1; i < emittedProgress.length; i += 1) {
      expect(emittedProgress[i]).toBeGreaterThanOrEqual(emittedProgress[i - 1] as number);
    }
  });

  it('progress never decreases: a lower progress at the same step is clamped to the max seen', () => {
    const manager = new StateManagerService();
    manager.updateState({ stepId: 'get-transactions-start', progress: 0.9 });
    const result = manager.updateState({ stepId: 'get-transactions-start', progress: 0.75 });
    expect(result.accepted).toBe(true);
    expect(result.progress).toBe(0.9);
  });

  it('rejects a payload naming an earlier step and leaves the state unchanged (Decision 15)', () => {
    const manager = new StateManagerService();
    manager.updateState({ stepId: 'get-transactions-start', progress: 0.6 });
    const result = manager.updateState({ stepId: 'get-products-start', progress: 0.5 });
    expect(result.accepted).toBe(false);
    expect(result.rejectedReason).toBe('rejected_backwards_step');
    expect(result.stepId).toBe('get-transactions-start');
    expect(result.progress).toBe(0.6);
  });

  it('a stale message from a previous page does not rewind the screen — a mixed out-of-order sequence', () => {
    const manager = new StateManagerService();
    const steps: string[] = [];
    const progresses: number[] = [];
    const rejections: Array<string | undefined> = [];
    const feed = [
      { stepId: 'load-start', progress: 0 },
      { stepId: 'login-start', progress: 0.1 },
      { stepId: 'get-products-start', progress: 0.5 },
      { stepId: 'get-transactions-start', progress: 0.9 },
      { stepId: 'get-transactions-start', progress: 0.75 }, // stale, lower progress
      { stepId: 'get-products-start', progress: 0.5 }, // stale, earlier step arriving late
      { stepId: 'ready', progress: 1 },
    ] as const;
    for (const update of feed) {
      const result = manager.updateState(update);
      if (result.accepted) {
        steps.push(result.stepId);
        progresses.push(result.progress);
      } else {
        rejections.push(result.rejectedReason);
      }
    }
    // The same-step, lower-progress message (index 4) is accepted — same-step repeats are
    // legitimate (a product-transactions step reports many times) — but its progress is clamped
    // to the max already seen. Only the truly earlier-step message (index 5) is rejected.
    expect(steps).toEqual([
      'load-start',
      'login-start',
      'get-products-start',
      'get-transactions-start',
      'get-transactions-start',
      'ready',
    ]);
    for (let i = 1; i < progresses.length; i += 1) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1] as number);
    }
    expect(rejections).toEqual(['rejected_backwards_step']);
  });

  it('rejects an unrecognized step id', () => {
    const manager = new StateManagerService();
    // @ts-expect-error -- deliberately invalid input to prove the guard, not a typo
    const result = manager.updateState({ stepId: 'not-a-real-step', progress: 0.5 });
    expect(result.accepted).toBe(false);
    expect(result.rejectedReason).toBe('unknown_step');
  });

  it('a NaN progress does not permanently corrupt the monotonic guarantee (CodeRabbit finding #27)', () => {
    const manager = new StateManagerService();
    manager.updateState({ stepId: 'get-products-start', progress: 0.5 });
    const rejectedProgress = manager.updateState({ stepId: 'get-transactions-start', progress: Number.NaN });
    expect(Number.isNaN(rejectedProgress.progress)).toBe(false);
    expect(rejectedProgress.progress).toBe(0.5); // NaN is treated as "no new information"
    // A later, legitimate progress value must still be able to advance normally — Math.max with
    // a leaked NaN would poison every subsequent call.
    const recovered = manager.updateState({ stepId: 'get-transactions-start', progress: 0.9 });
    expect(recovered.progress).toBe(0.9);
  });

  it('clamps an out-of-range progress value into 0..1 (CodeRabbit finding #27)', () => {
    const manager = new StateManagerService();
    const tooHigh = manager.updateState({ stepId: 'get-products-start', progress: 5 });
    expect(tooHigh.progress).toBe(1);
    const manager2 = new StateManagerService();
    const negative = manager2.updateState({ stepId: 'get-products-start', progress: -3 });
    expect(negative.progress).toBe(0);
  });

  it('starts at load-start / progress 0 before any update', () => {
    const manager = new StateManagerService();
    expect(manager.getCurrentStep()).toBe('load-start');
    expect(manager.getCurrentProgress()).toBe(0);
  });
});
