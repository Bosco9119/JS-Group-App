import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/preferences';

type ResolvedScheme = 'light' | 'dark';

type ThemeColors = (typeof Colors)[ResolvedScheme];

type ThemeContextValue = {
  ready: boolean;
  preference: ThemePreference;
  scheme: ResolvedScheme;
  colors: ThemeColors;
  setPreference: (value: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemePreferencesProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [ready, setReady] = useState(false);
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getThemePreference();
      if (!cancelled) {
        setPreferenceState(stored);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback(async (value: ThemePreference) => {
    setPreferenceState(value);
    await setThemePreference(value);
  }, []);

  const scheme: ResolvedScheme =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      ready,
      preference,
      scheme,
      colors: Colors[scheme],
      setPreference,
    }),
    [ready, preference, scheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreferences() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemePreferences must be used within ThemePreferencesProvider');
  }
  return context;
}
