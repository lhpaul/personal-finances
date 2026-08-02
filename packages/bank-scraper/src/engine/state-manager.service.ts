import { VALID_STEP_TRANSITIONS, type ScraperStepId } from '../types/protocol.types';

/**
 * The step machine, and why progress can never go backwards (spec Business Rule 23, "Read step"
 * transitions, AC20; implementation plan Decision 15).
 *
 * `StateManagerService.updateState` is the **only** writer of the current step and progress, and
 * it enforces two guarantees mechanically rather than by convention: progress is monotonic
 * (`Math.max` of the current and incoming value — a payload reporting a lower number cannot lower
 * it), and steps only advance (`VALID_STEP_TRANSITIONS` order; a payload naming an earlier step is
 * dropped, leaving the state unchanged, rather than rewinding the screen).
 */

export interface StepUpdate {
  stepId: ScraperStepId;
  progress: number;
}

export interface StepUpdateResult {
  accepted: boolean;
  stepId: ScraperStepId;
  progress: number;
  rejectedReason?: 'unknown_step' | 'rejected_backwards_step';
}

export class StateManagerService {
  #stepIndex = 0;
  #progress = 0;

  updateState(update: StepUpdate): StepUpdateResult {
    const incomingIndex = VALID_STEP_TRANSITIONS.indexOf(update.stepId);
    if (incomingIndex === -1) {
      return {
        accepted: false,
        stepId: VALID_STEP_TRANSITIONS[this.#stepIndex] as ScraperStepId,
        progress: this.#progress,
        rejectedReason: 'unknown_step',
      };
    }
    if (incomingIndex < this.#stepIndex) {
      return {
        accepted: false,
        stepId: VALID_STEP_TRANSITIONS[this.#stepIndex] as ScraperStepId,
        progress: this.#progress,
        rejectedReason: 'rejected_backwards_step',
      };
    }
    this.#stepIndex = incomingIndex;
    this.#progress = Math.max(this.#progress, update.progress);
    return {
      accepted: true,
      stepId: VALID_STEP_TRANSITIONS[this.#stepIndex] as ScraperStepId,
      progress: this.#progress,
    };
  }

  getCurrentStep(): ScraperStepId {
    return VALID_STEP_TRANSITIONS[this.#stepIndex] as ScraperStepId;
  }

  getCurrentProgress(): number {
    return this.#progress;
  }
}
