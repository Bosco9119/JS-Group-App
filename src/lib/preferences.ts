import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'prefs.theme';
const LANGUAGE_KEY = 'prefs.language';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'zh' | 'ms';

export async function getThemePreference(): Promise<ThemePreference> {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export async function setThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, value);
}

export async function getLanguagePreference(): Promise<AppLanguage | null> {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (value === 'en' || value === 'zh' || value === 'ms') {
    return value;
  }
  return null;
}

export async function setLanguagePreference(value: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, value);
}
