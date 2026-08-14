import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ScrapeResult } from '@finanzas/bank-scraper';

type ResultsContextValue = {
  result: ScrapeResult | null;
  setResult: (result: ScrapeResult | null) => void;
};

const ResultsContext = createContext<ResultsContextValue | null>(null);

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const value = useMemo(() => ({ result, setResult }), [result]);
  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>;
}

export function useResults(): ResultsContextValue {
  const value = useContext(ResultsContext);
  if (value === null) {
    throw new Error('useResults must be used within ResultsProvider');
  }
  return value;
}
