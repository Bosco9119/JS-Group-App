import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getOnlinePreference, setOnlinePreference } from '@/lib/preferences';

type OnlineContextValue = {
  ready: boolean;
  online: boolean;
  setOnline: (value: boolean) => Promise<void>;
  toggleOnline: () => Promise<void>;
};

const OnlineContext = createContext<OnlineContextValue | null>(null);

export function OnlineProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [online, setOnlineState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = await getOnlinePreference();
      if (!cancelled) {
        setOnlineState(value);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setOnline = useCallback(async (value: boolean) => {
    setOnlineState(value);
    await setOnlinePreference(value);
  }, []);

  const toggleOnline = useCallback(async () => {
    await setOnline(!online);
  }, [online, setOnline]);

  const value = useMemo(
    () => ({ ready, online, setOnline, toggleOnline }),
    [ready, online, setOnline, toggleOnline],
  );

  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
  const ctx = useContext(OnlineContext);
  if (!ctx) {
    throw new Error('useOnline must be used within OnlineProvider');
  }
  return ctx;
}
