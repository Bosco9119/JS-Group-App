import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import i18n, { resolveDeviceLanguage } from '@/i18n';
import {
  getLanguagePreference,
  setLanguagePreference,
  type AppLanguage,
} from '@/lib/preferences';

type LocaleContextValue = {
  ready: boolean;
  language: AppLanguage;
  setLanguage: (value: AppLanguage) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>(resolveDeviceLanguage());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getLanguagePreference();
      const next = stored ?? resolveDeviceLanguage();
      await i18n.changeLanguage(next);
      if (!cancelled) {
        setLanguageState(next);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (value: AppLanguage) => {
    setLanguageState(value);
    await i18n.changeLanguage(value);
    await setLanguagePreference(value);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      language,
      setLanguage,
    }),
    [ready, language, setLanguage],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

export function useAppTranslation() {
  return useTranslation();
}
