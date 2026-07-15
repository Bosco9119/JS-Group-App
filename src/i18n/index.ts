import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/i18n/locales/en.json';
import ms from '@/i18n/locales/ms.json';
import zh from '@/i18n/locales/zh.json';
import type { AppLanguage } from '@/lib/preferences';

export const supportedLanguages: AppLanguage[] = ['en', 'zh', 'ms'];

export function resolveDeviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? 'en';
  if (code.startsWith('zh')) return 'zh';
  if (code === 'ms' || code === 'id') return 'ms';
  if (code === 'en') return 'en';
  return 'en';
}

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ms: { translation: ms },
  },
  lng: resolveDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export function statusLabel(t: (key: string) => string, status: string, fallback?: string | null) {
  const key = `status.${status}`;
  const translated = t(key);
  if (translated === key) {
    return fallback ?? status;
  }
  return translated;
}
