import type { BankConnection } from '../../db/types';

/**
 * The four manifest states `#screen=home` declares (implementation plan Decision 4).
 * `resolveHomeState` is a pure, total-order function: exactly one state is always selected.
 */
export type HomeState = 'empty' | 'sync-error' | 'pending' | 'all-clear';

export interface HomeStateInput {
  connections: readonly BankConnection[];
  uncategorizedCount: number;
}

/**
 * Priority: `empty` > `sync-error` > `pending` > `all-clear` (Assumption A1 — the mockup's
 * `sync-error` state hides the challenge hero, and `empty` hides every card below it, so the
 * four states are mutually exclusive in the drawing).
 *
 * - `empty`: no connection has a `lastSuccessAt` yet, including "no connections at all"
 *   (Assumption A2).
 * - `sync-error`: any connection's `syncStatus` is `'error'`.
 * - `pending`: `uncategorizedCount > 0`.
 * - `all-clear`: otherwise.
 */
export function resolveHomeState({ connections, uncategorizedCount }: HomeStateInput): HomeState {
  const hasFirstSuccess = connections.some((connection) => connection.lastSuccessAt !== null);
  if (!hasFirstSuccess) return 'empty';
  if (connections.some((connection) => connection.syncStatus === 'error')) return 'sync-error';
  if (uncategorizedCount > 0) return 'pending';
  return 'all-clear';
}
