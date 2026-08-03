import { createContext, useContext, type ReactNode } from 'react';

import type { StageMovement } from '../../db/types';

/**
 * The stage session (implementation plan Decision 2, spec Use Case 10): the batch array, the
 * index, the pending selection and the resolved counter, held as React state inside
 * `CategorizeScreen` and exposed to its children through this context — never persisted. Leaving
 * the flow unmounts the screen and the session is gone (AC16).
 */
export interface StageSessionValue {
  batch: StageMovement[];
  index: number;
  currentMovement: StageMovement | undefined;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (categoryId: string | null) => void;
  resolvedCount: number;
  isLastMovement: boolean;
  /** Advances the index without changing the resolved counter — skip (AC13) or a deferral mark
   * (AC14, AC15). */
  advance: () => void;
  /** Advances the index and increments the resolved counter — a confirmed category (AC10) or an
   * exclusion (AC19). */
  advanceResolved: () => void;
}

const StageSessionContext = createContext<StageSessionValue | null>(null);

export function StageSessionProvider({
  value,
  children,
}: {
  value: StageSessionValue;
  children: ReactNode;
}) {
  return <StageSessionContext.Provider value={value}>{children}</StageSessionContext.Provider>;
}

export function useStageSession(): StageSessionValue {
  const context = useContext(StageSessionContext);
  if (context === null) {
    throw new Error('useStageSession must be used within a StageSessionProvider');
  }
  return context;
}
