import type { ScraperStepId } from '@finanzas/bank-scraper';

/**
 * The pure step/state machine for `#screen=bank-syncing` (implementation plan Decisions 2, 3,
 * Assumption A3, issue #11). No React, no I/O — every function here is total over a closed
 * union, so a fifth `ScraperStepId` or a fifth `BankSyncingState` is a compile error, not a
 * silent fall-through.
 */

/** Exactly the four states the manifest declares for `bank-syncing` (V2). */
export type BankSyncingState = 'login' | 'products' | 'transactions' | 'error';

const BANK_SYNCING_STATES: readonly BankSyncingState[] = ['login', 'products', 'transactions', 'error'];

/** Validates a `?fidelityState=` route param against the closed `BankSyncingState` union
 * (Decision 12) — an unrecognised or missing value falls back to `login`, the manifest's own
 * `initial: true` state, rather than rendering nothing. */
export function resolvePreviewBankSyncingState(raw: string | null): BankSyncingState {
  const match = BANK_SYNCING_STATES.find((candidate) => candidate === raw);
  return match ?? 'login';
}

/** The hook's own lifecycle phase (Decision 6). `starting` is before the first `onProgress`
 * arrives; `stopped` is the cancellation-on-unmount outcome (Assumption A1) and is unreachable
 * on screen, but is part of the union so the outcome mapping stays total. */
export type SyncPhase = 'starting' | 'reading' | 'succeeded' | 'stopped' | 'failed' | 'refused';

/** V9: `load-start` is not surfaced to a person, so it presents as `login`. `ready` presents as
 * `transactions` because the manifest declares four states and the mockup draws the success CTA
 * inside `transactions` (Assumption A2). */
export const STEP_TO_STATE: Record<ScraperStepId, BankSyncingState> = {
  'load-start': 'login',
  'login-start': 'login',
  'get-products-start': 'products',
  'get-transactions-start': 'transactions',
  ready: 'transactions',
};

/**
 * The two error phases are checked first, so a `phase: 'failed' | 'refused'` always renders
 * `error` regardless of which step id is still attached to the last-seen progress event.
 */
export function resolveBankSyncingState(input: { phase: SyncPhase; stepId: ScraperStepId }): BankSyncingState {
  if (input.phase === 'failed' || input.phase === 'refused') return 'error';
  return STEP_TO_STATE[input.stepId];
}

/** The mockup's three fixed widths (Decision 3). `error` is never rendered — the mockup's card
 * only draws under `data-states="login products transactions"` — the entry exists only to keep
 * the `Record` total. */
export const PROGRESS_FLOOR: Record<BankSyncingState, number> = {
  login: 0.25,
  products: 0.6,
  transactions: 0.9,
  error: 0,
};

/**
 * The bar never moves backwards: `PROGRESS_FLOOR` is non-decreasing along the scraper's own step
 * order, and `scraperProgress` is already non-decreasing because `StateManagerService` is its
 * sole writer (V10). The pointwise `Math.max` of two non-decreasing sequences is non-decreasing.
 */
export function resolveProgressValue(state: BankSyncingState, scraperProgress: number): number {
  return Math.max(PROGRESS_FLOOR[state], scraperProgress);
}

export type StepBadgeStatus = 'pending' | 'in_progress' | 'done';
export type StepIcon = '✅' | '⏳';

export interface StepRowPresentation {
  icon: StepIcon;
  status: StepBadgeStatus;
}

export interface StepRowsPresentation {
  login: StepRowPresentation;
  products: StepRowPresentation;
  transactions: StepRowPresentation;
}

/**
 * The exact icon/badge triple the mockup draws per progress state (Assumption A3, non-negotiable
 * 6). Row 1's icon is drawn `✅` unconditionally in the mockup — not behind a `data-states`
 * attribute at all — while its badge still reads `En curso` in `login`; that inconsistency is
 * implemented as drawn, not "corrected". Row 3 has no `done` badge variant because the mockup
 * never draws one — the `transactions` state doubles as the success frame (Assumption A2), so row
 * 3 stays `in_progress` even once the read finishes; the CTA below the card is what changes.
 *
 * Only called for the three progress states — the card this drives is never rendered in `error`
 * (Decision 3).
 */
export function resolveStepStatuses(state: 'login' | 'products' | 'transactions'): StepRowsPresentation {
  switch (state) {
    case 'login':
      return {
        login: { icon: '✅', status: 'in_progress' },
        products: { icon: '⏳', status: 'pending' },
        transactions: { icon: '⏳', status: 'pending' },
      };
    case 'products':
      return {
        login: { icon: '✅', status: 'done' },
        products: { icon: '✅', status: 'in_progress' },
        transactions: { icon: '⏳', status: 'pending' },
      };
    case 'transactions':
      return {
        login: { icon: '✅', status: 'done' },
        products: { icon: '✅', status: 'done' },
        transactions: { icon: '✅', status: 'in_progress' },
      };
  }
}
