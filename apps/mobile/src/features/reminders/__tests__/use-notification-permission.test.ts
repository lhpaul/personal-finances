import {
  createMemoryNotificationsPort,
  type MemoryNotificationsPort,
} from '../../../lib/notifications/testing/memory-notifications';
import {
  attemptRequestPermission,
  refreshPermission,
  type RefreshPermissionDeps,
  type RequestPermissionDeps,
} from '../use-notification-permission';

/**
 * The pure functions extracted from `useNotificationPermission` (implementation plan for issue
 * #18, Decision 7; mirrors `use-wipe-local-data.ts`'s `attemptConfirmDelete` precedent) — testable
 * with no renderer, per item #8's Decision 14 (no React renderer is installed in the `app` Jest
 * project).
 */
describe('refreshPermission (concurrent-event-source addendum: "Error propagation across async boundaries")', () => {
  function makeDeps(): RefreshPermissionDeps & {
    port: MemoryNotificationsPort;
    permission: unknown;
    error: unknown;
  } {
    const state: { permission: unknown; error: unknown } = { permission: 'undetermined', error: 'unset' };
    return {
      get permission() {
        return state.permission;
      },
      get error() {
        return state.error;
      },
      port: createMemoryNotificationsPort('granted'),
      setPermission: (value) => {
        state.permission = value;
      },
      setError: (value) => {
        state.error = value;
      },
    };
  }

  it('sets permission from the port on success and clears error', async () => {
    const deps = makeDeps();
    deps.port.permission = 'denied';
    await refreshPermission(deps);
    expect(deps.permission).toBe('denied');
    expect(deps.error).toBeNull();
  });

  it('a failing getPermission() resolves to undetermined with the error surfaced, not thrown', async () => {
    const deps = makeDeps();
    const error = new Error('native permission read rejected');
    deps.port.failNext('getPermission', error);

    await expect(refreshPermission(deps)).resolves.toBeUndefined();
    expect(deps.permission).toBe('undetermined');
    expect(deps.error).toBe(error);
  });
});

describe('attemptRequestPermission (Decision 7, concurrency addendum item 2)', () => {
  function makeDeps(port: MemoryNotificationsPort = createMemoryNotificationsPort('undetermined')) {
    const state = { requesting: false, permission: 'undetermined' as unknown, error: 'unset' as unknown };
    const deps: RequestPermissionDeps = {
      port,
      getRequesting: () => state.requesting,
      setRequesting: (value) => {
        state.requesting = value;
      },
      setPermission: (value) => {
        state.permission = value;
      },
      setError: (value) => {
        state.error = value;
      },
    };
    return { deps, state, port };
  }

  it('requests the permission and returns the resolved value', async () => {
    const { deps, state, port } = makeDeps();
    port.permission = 'granted';

    const result = await attemptRequestPermission(deps);

    expect(result).toBe('granted');
    expect(state.permission).toBe('granted');
    expect(state.error).toBeNull();
    expect(port.callLog.some((entry) => entry.kind === 'requestPermission')).toBe(true);
  });

  it('a second call while one is already in flight is a no-op (re-entrancy guard)', async () => {
    const { deps, state } = makeDeps();
    state.requesting = true; // simulates "a request is already in flight"

    const result = await attemptRequestPermission(deps);

    expect(result).toBeUndefined();
    expect(state.error).toBe('unset'); // untouched — the guard returned before calling the port
  });

  it('a rejecting requestPermission() surfaces the error without throwing past the caller', async () => {
    const { deps, state, port } = makeDeps();
    const error = new Error('native permission request rejected');
    port.failNext('requestPermission', error);

    const result = await attemptRequestPermission(deps);

    expect(result).toBeUndefined();
    expect(state.error).toBe(error);
    expect(state.requesting).toBe(false); // the `finally` clears the in-flight flag even on failure
  });
});
