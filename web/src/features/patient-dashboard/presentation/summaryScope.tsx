import { createContext, useContext, type ReactNode } from 'react';

/**
 * Whose summary the widgets below show. With no `patientId` it is the
 * signed-in patient's own; with one it is a linked patient's, read by a
 * professional through the professional route.
 */
export interface SummaryScope {
  readonly patientId?: string;
}

const OWN_SCOPE: SummaryScope = {};

const SummaryScopeContext = createContext<SummaryScope>(OWN_SCOPE);

/** Puts the widgets below on a linked patient. Without it they show the signed-in patient's own summary. */
export function SummaryScopeProvider({ scope, children }: { scope: SummaryScope; children: ReactNode }) {
  return <SummaryScopeContext.Provider value={scope}>{children}</SummaryScopeContext.Provider>;
}

export function useSummaryScope(): SummaryScope {
  return useContext(SummaryScopeContext);
}
