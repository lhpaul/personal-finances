import { useLocalSearchParams } from 'expo-router';

/**
 * The single source of the `ready_test_id` convention `scripts/mobile-ui/fidelity-contract.mjs`
 * validates for every `wired` target (implementation plan Decision 9).
 */
export function fidelityTestId(screenId: string): string {
  return `fidelity-${screenId}`;
}

export type FidelityPreviewState = {
  active: boolean;
  state: string | null;
};

/**
 * `__DEV__`-only preview contract for a fidelity capture deep link
 * (`finanzas:///<route>?fidelity=1&fidelityScreen=<id>&fidelityState=<id>`).
 *
 * Reads the `fidelity` / `fidelityState` route params via `useLocalSearchParams()`. Returns
 * `{ active: false, state: null }` whenever `__DEV__` is false, so nothing about this hook can
 * affect a release build (implementation plan Decision 9, AGENTS.md non-negotiable #7).
 */
export function useFidelityPreview(): FidelityPreviewState {
  const params = useLocalSearchParams<{ fidelity?: string; fidelityState?: string }>();
  if (!__DEV__ || params.fidelity !== '1') return { active: false, state: null };
  return { active: true, state: params.fidelityState ?? null };
}
