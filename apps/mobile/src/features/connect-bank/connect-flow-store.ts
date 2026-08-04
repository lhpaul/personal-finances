import type { FlowEntryOrigin } from './flow-navigation';

/**
 * Module-scoped flow state (implementation plan Decision 1). The flow is entered from two
 * different route groups (onboarding and settings), so a layout-scoped React context cannot
 * cover both; a module-scoped store read through `useSyncExternalStore` needs no new dependency
 * and survives the group boundary.
 *
 * The state's own type is closed by construction: no `credentials`, no `password`, no index
 * signature. A later "just stash the password here" edit is a type error, not a runtime leak.
 */
export interface ConnectFlowState {
  institutionId: string | null;
  entryOrigin: FlowEntryOrigin;
}

let state: ConnectFlowState = { institutionId: null, entryOrigin: 'onboarding' };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ConnectFlowState {
  return state;
}

/** Entering the flow always starts with no institution chosen (spec Use Case 6 — coming back to
 * the form is coming back empty, except for a locked RUT read from the secure store). */
export function enterFlow(origin: FlowEntryOrigin): void {
  state = { institutionId: null, entryOrigin: origin };
  emit();
}

export function chooseInstitution(institutionId: string): void {
  state = { ...state, institutionId };
  emit();
}

export function reset(): void {
  state = { institutionId: null, entryOrigin: 'onboarding' };
  emit();
}

/** Test-only escape hatch, mirroring `src/db/runtime.ts`'s `__resetAppDatabaseForTests`. */
export function __resetConnectFlowForTests(): void {
  reset();
}
