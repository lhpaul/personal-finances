import type { DisconnectBankInput, DisconnectOutcome } from '../disconnect-bank.service';
import { confirmDisconnect } from '../confirm-disconnect';

/** No renderer, injected callbacks — the `runDisconnect`/`guardedDisconnect` test precedent, one
 * level up. `onDisconnected` is where the route both closes the modal and re-reads the list
 * (issue #111), so "fires exactly on success" is the property under test in both directions. */
describe('confirmDisconnect', () => {
  const connection = { id: 'conn-1', institutionId: 'banco-de-chile' };

  function recordingRun(outcome: DisconnectOutcome | undefined): {
    run: (input: DisconnectBankInput) => Promise<DisconnectOutcome | undefined>;
    calls: DisconnectBankInput[];
  } {
    const calls: DisconnectBankInput[] = [];
    return {
      run: (input) => {
        calls.push(input);
        return Promise.resolve(outcome);
      },
      calls,
    };
  }

  it('fires onDisconnected after a disconnected outcome (issue #111: the list re-read hangs off this)', async () => {
    const { run, calls } = recordingRun({ status: 'disconnected' });
    const onDisconnected = jest.fn();

    await confirmDisconnect({ connection, run, onDisconnected });

    expect(calls).toEqual([{ connectionId: 'conn-1', institutionId: 'banco-de-chile' }]);
    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  it('does not fire onDisconnected on a failed outcome — the modal stays open with its Note', async () => {
    const { run } = recordingRun({ status: 'failed', stage: 'credential' });
    const onDisconnected = jest.fn();

    await confirmDisconnect({ connection, run, onDisconnected });

    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it('does not fire onDisconnected when run resolves undefined (in-flight no-op)', async () => {
    const { run } = recordingRun(undefined);
    const onDisconnected = jest.fn();

    await confirmDisconnect({ connection, run, onDisconnected });

    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it('skips the run entirely when the modal has no resolved target', async () => {
    const { run, calls } = recordingRun({ status: 'disconnected' });
    const onDisconnected = jest.fn();

    await confirmDisconnect({ connection: undefined, run, onDisconnected });

    expect(calls).toHaveLength(0);
    expect(onDisconnected).not.toHaveBeenCalled();
  });
});
