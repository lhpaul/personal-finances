import type { StageMovement } from '../../db/types';

/**
 * Categorization flow (#13) implementation plan Decision 3, spec A1, A5.
 *
 * `STAGE_BATCH_SIZE` is the only place the batch size number appears — the progress indicator,
 * the estimated-time tile and the completion counters are all derived from it. Reading the batch
 * once (rather than re-querying after each decision) is what makes AC4 ("no movement is offered
 * twice within one stage") true by construction.
 */
export const STAGE_BATCH_SIZE = 10;

/** Assumption P1: one fixed per-movement estimate, in seconds. */
export const SECONDS_PER_MOVEMENT = 15;

/** Assumption A5 / P1: `max(1, round(batchSize * 15 / 60))`, so a full ten-movement stage lands
 * at 3 minutes (the top of the domain's "1-3 minutos" promise) and a short batch never reads
 * "0 minutos". */
export function estimateStageMinutes(batchSize: number): number {
  return Math.max(1, Math.round((batchSize * SECONDS_PER_MOVEMENT) / 60));
}

export type PreviewDirection = 'expense' | 'income';

/**
 * Caps the pending queue at `STAGE_BATCH_SIZE`, preserving queue order (spec A1, A2, A14).
 *
 * `previewDirection` (Decision 14, Assumption P6) is **only** honoured in `__DEV__` fidelity
 * preview mode: when set, the batch is reordered so the first movement matching that direction
 * (`'expense'` -> `debit`, `'income'` -> `credit`) is promoted to position 1, so the progress
 * line and step indicator match the mockup's "Transacción 1 de 4" for both the `expense` and
 * `income` captures. If no movement of that direction exists in the batch, the batch is returned
 * unchanged.
 */
export function buildStageBatch(
  pending: StageMovement[],
  options?: { previewDirection?: PreviewDirection | null },
): StageMovement[] {
  const batch = pending.slice(0, STAGE_BATCH_SIZE);
  const previewDirection = options?.previewDirection;
  if (previewDirection == null) return batch;

  const wantedType = previewDirection === 'expense' ? 'debit' : 'credit';
  const index = batch.findIndex((movement) => movement.type === wantedType);
  if (index <= 0) return batch;

  const reordered = batch.slice();
  const [promoted] = reordered.splice(index, 1);
  if (promoted) reordered.unshift(promoted);
  return reordered;
}
