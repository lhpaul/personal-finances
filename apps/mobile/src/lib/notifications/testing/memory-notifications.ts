import type { NotificationsPort, PermissionState, ReminderRequest, ReminderTapEvent } from '../types';

export type NotificationsCallLogEntry =
  | { kind: 'schedule'; identifier: string }
  | { kind: 'cancel'; identifier: string }
  | { kind: 'prepareChannel'; name: string }
  | { kind: 'requestPermission' }
  | { kind: 'openSystemSettings' };

export type FailableMethod = 'schedule' | 'cancel' | 'requestPermission' | 'getPermission';

export type MemoryNotificationsPort = NotificationsPort & {
  /** Mutable — a test simulates the OS answering differently (e.g. the person granting the
   * permission in the real OS dialog, or revoking it in the system settings) by assigning this
   * directly. */
  permission: PermissionState;
  readonly scheduled: Map<string, ReminderRequest>;
  readonly callLog: NotificationsCallLogEntry[];
  readonly channelPrepared: boolean;
  /** Test-only escape hatch: makes the **next** call to the named method reject with `error` —
   * the rejecting mock the systemic write-path error-handling check requires. Consumed (cleared)
   * the moment it fires, so a second call to the same method succeeds normally. */
  failNext: (method: FailableMethod, error: unknown) => void;
  /** Test-only: simulates a warm tap by invoking every registered response listener, and records
   * it as the "last response" a subsequent `getLastResponse()` call would see. */
  emitResponse: (event: ReminderTapEvent) => void;
  /** Test-only: seeds the value `getLastResponse()` resolves to, without invoking any listener —
   * simulates a cold-start tap the app missed while it was not running. */
  seedLastResponse: (event: ReminderTapEvent | null) => void;
};

/**
 * The in-memory `NotificationsPort` every test in this feature uses (implementation plan for
 * issue #18, Decision 1) — no test imports `expo-notifications` itself. Mirrors
 * `src/lib/secure-store/testing/`'s in-memory double shape: a settable permission state, a
 * scheduled-requests map, and a call log so a test can assert **ordering** (cancel before
 * schedule, Decision 2), not only the end state.
 */
export function createMemoryNotificationsPort(
  initialPermission: PermissionState = 'undetermined',
): MemoryNotificationsPort {
  let permission = initialPermission;
  let channelPrepared = false;
  let lastResponse: ReminderTapEvent | null = null;
  const scheduled = new Map<string, ReminderRequest>();
  const callLog: NotificationsCallLogEntry[] = [];
  const pendingFailures = new Map<FailableMethod, unknown>();
  const listeners = new Set<(event: ReminderTapEvent) => void>();

  function consumeFailure(method: FailableMethod): void {
    if (!pendingFailures.has(method)) return;
    const error = pendingFailures.get(method);
    pendingFailures.delete(method);
    throw error;
  }

  return {
    get permission(): PermissionState {
      return permission;
    },
    set permission(value: PermissionState) {
      permission = value;
    },
    get scheduled(): Map<string, ReminderRequest> {
      return scheduled;
    },
    get callLog(): NotificationsCallLogEntry[] {
      return callLog;
    },
    get channelPrepared(): boolean {
      return channelPrepared;
    },
    failNext(method: FailableMethod, error: unknown): void {
      pendingFailures.set(method, error);
    },
    async getPermission(): Promise<PermissionState> {
      consumeFailure('getPermission');
      return permission;
    },
    async requestPermission(): Promise<PermissionState> {
      callLog.push({ kind: 'requestPermission' });
      consumeFailure('requestPermission');
      return permission;
    },
    async listScheduledIdentifiers(): Promise<string[]> {
      return Array.from(scheduled.keys());
    },
    async schedule(request: ReminderRequest): Promise<void> {
      callLog.push({ kind: 'schedule', identifier: request.identifier });
      consumeFailure('schedule');
      scheduled.set(request.identifier, request);
    },
    async cancel(identifier: string): Promise<void> {
      callLog.push({ kind: 'cancel', identifier });
      consumeFailure('cancel');
      scheduled.delete(identifier);
    },
    async prepareChannel(name: string): Promise<void> {
      callLog.push({ kind: 'prepareChannel', name });
      channelPrepared = true;
    },
    async openSystemSettings(): Promise<void> {
      callLog.push({ kind: 'openSystemSettings' });
    },
    addResponseListener(listener: (event: ReminderTapEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async getLastResponse(): Promise<ReminderTapEvent | null> {
      return lastResponse;
    },
    emitResponse(event: ReminderTapEvent): void {
      lastResponse = event;
      for (const listener of listeners) listener(event);
    },
    seedLastResponse(event: ReminderTapEvent | null): void {
      lastResponse = event;
    },
  };
}
