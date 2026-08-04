import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getNotificationsPort, type NotificationsPort, type PermissionState } from '../../lib/notifications';

/**
 * Implementation plan for issue #18, Decision 7: `NotificationsPort.requestPermission()` is
 * called from **exactly one** place in this codebase — inside {@link attemptRequestPermission},
 * defined in this file. `notifications-boundary.test.ts` scans the whole tree for `.
 * requestPermission(` and asserts this file is the only match.
 */

export interface RefreshPermissionDeps {
  port: NotificationsPort;
  setPermission: (permission: PermissionState) => void;
  setError: (error: unknown) => void;
}

/** Reads the permission once. A failing `getPermission()` resolves to `'undetermined'` with the
 * error surfaced through `setError` (concurrent-event-source addendum, "Error propagation across
 * async boundaries") — a permission read that throws must not make the settings screen
 * unreachable. */
export async function refreshPermission(deps: RefreshPermissionDeps): Promise<void> {
  try {
    const permission = await deps.port.getPermission();
    deps.setError(null);
    deps.setPermission(permission);
  } catch (error) {
    deps.setError(error);
    deps.setPermission('undetermined');
  }
}

export interface RequestPermissionDeps {
  port: NotificationsPort;
  getRequesting: () => boolean;
  setRequesting: (requesting: boolean) => void;
  setPermission: (permission: PermissionState) => void;
  setError: (error: unknown) => void;
}

/**
 * Re-entrancy guarded (concurrency addendum item 2 — a double tap on **Habilitar notificaciones**
 * can fire before the first request resolves) and error-caught (the systemic write-path defect
 * this item must not repeat): a rejecting `requestPermission()` sets `error` and leaves
 * `permission` unchanged rather than throwing past the caller, so the screen can show a visible
 * error state and let the person press the button again to retry.
 */
export async function attemptRequestPermission(
  deps: RequestPermissionDeps,
): Promise<PermissionState | undefined> {
  if (deps.getRequesting()) return undefined;
  deps.setRequesting(true);
  try {
    const permission = await deps.port.requestPermission();
    deps.setError(null);
    deps.setPermission(permission);
    return permission;
  } catch (error) {
    deps.setError(error);
    return undefined;
  } finally {
    deps.setRequesting(false);
  }
}

export interface UseNotificationPermissionResult {
  permission: PermissionState;
  error: unknown;
  requesting: boolean;
  /** Requests the OS permission. The **only** two allowed call sites for the returned function are
   * `notifications-intro`'s "Habilitar notificaciones" press and `settings-notifications`'s toggle
   * turning on while `permission === 'undetermined'` (Decision 7) — asserted by
   * `notifications-boundary.test.ts`. */
  request: () => Promise<PermissionState | undefined>;
  refresh: () => Promise<void>;
}

/**
 * `{ permission, error, requesting, request, refresh }` (implementation plan for issue #18,
 * Layer-by-Layer). Reads once on mount, re-reads on `AppState` `'active'` — the person can revoke
 * or grant the permission in the OS settings while the app is backgrounded (concurrency addendum).
 * The `AppState` subscription is removed on unmount; an in-flight refresh dropped by cancellation
 * never calls `setState` after unmount.
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const port = useMemo(() => getNotificationsPort(), []);
  const [permission, setPermissionState] = useState<PermissionState>('undetermined');
  const [error, setError] = useState<unknown>(null);
  const [requesting, setRequestingState] = useState(false);
  const requestingRef = useRef(false);
  const cancelledRef = useRef(false);

  const setPermission = useCallback((next: PermissionState) => {
    if (!cancelledRef.current) setPermissionState(next);
  }, []);

  const setRequesting = useCallback((next: boolean) => {
    requestingRef.current = next;
    if (!cancelledRef.current) setRequestingState(next);
  }, []);

  const refresh = useCallback(
    () => refreshPermission({ port, setPermission, setError }),
    [port, setPermission],
  );

  useEffect(() => {
    cancelledRef.current = false;
    void refresh();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refresh();
    });

    return () => {
      cancelledRef.current = true;
      subscription.remove();
    };
  }, [refresh]);

  const request = useCallback(
    () =>
      attemptRequestPermission({
        port,
        getRequesting: () => requestingRef.current,
        setRequesting,
        setPermission,
        setError,
      }),
    [port, setPermission, setRequesting],
  );

  return { permission, error, requesting, request, refresh };
}
