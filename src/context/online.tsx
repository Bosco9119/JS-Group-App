import { createContext, useContext, useMemo, type ReactNode } from 'react';

type OnlineContextValue = {
  ready: boolean;
  online: boolean;
};

const OnlineContext = createContext<OnlineContextValue | null>(null);

/** Drivers stay online while signed in — no manual offline toggle. */
export function OnlineProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ ready: true, online: true }), []);
  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
  const ctx = useContext(OnlineContext);
  if (!ctx) {
    throw new Error('useOnline must be used within OnlineProvider');
  }
  return ctx;
}
