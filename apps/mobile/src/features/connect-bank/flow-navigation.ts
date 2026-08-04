/**
 * The connect-bank flow's return-to-origin logic (implementation plan Layer-by-Layer, Business
 * Rule 24, AC26-AC27). Pure — no React, no navigation library import.
 */

export type FlowEntryOrigin = 'onboarding' | 'settings';

/** Where the picker's back control (and the credential form's back gesture) return to. */
export function resolveBackHref(origin: FlowEntryOrigin): string {
  return origin === 'settings' ? '/settings/banks' : '/(onboarding)/connect-bank';
}

/** Where finishing the flow (`bank-connected`'s "Estoy listo") continues to. */
export function resolveExitHref(origin: FlowEntryOrigin): string {
  return origin === 'settings' ? '/settings/banks' : '/(onboarding)/notifications';
}
