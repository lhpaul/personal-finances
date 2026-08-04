import { useSyncExternalStore } from 'react';

import { getSnapshot, subscribe, type ConnectFlowState } from './connect-flow-store';

export type { FlowEntryOrigin } from './flow-navigation';
export { resolveBackHref, resolveExitHref } from './flow-navigation';

/**
 * The `useSyncExternalStore` wrapper over `connect-flow-store.ts` (implementation plan
 * Layer-by-Layer). New to this codebase — chosen over React context because the flow spans two
 * route groups (concurrency addendum, "New patterns").
 */
export function useConnectFlow(): ConnectFlowState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
