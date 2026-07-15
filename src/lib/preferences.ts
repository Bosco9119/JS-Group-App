import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'prefs.theme';
const LANGUAGE_KEY = 'prefs.language';
const ONLINE_KEY = 'prefs.online';
const CHECKLIST_KEY = 'prefs.vehicleChecklist';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'zh' | 'ms';

export async function getOnlinePreference(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONLINE_KEY);
  if (value === null) return true;
  return value === '1';
}

export async function setOnlinePreference(online: boolean): Promise<void> {
  await AsyncStorage.setItem(ONLINE_KEY, online ? '1' : '0');
}

export type ChecklistState = {
  date: string;
  items: Record<string, boolean>;
  photoUri: string | null;
};

export async function getChecklistState(): Promise<ChecklistState | null> {
  const raw = await AsyncStorage.getItem(CHECKLIST_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChecklistState;
  } catch {
    return null;
  }
}

export async function setChecklistState(state: ChecklistState): Promise<void> {
  await AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}

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
