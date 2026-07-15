import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LoadingState } from '@/components/ui/states';
import { AuthProvider } from '@/context/auth';
import { LocaleProvider, useLocale } from '@/context/locale';
import { PermissionsProvider } from '@/context/permissions';
import { ThemePreferencesProvider, useThemePreferences } from '@/context/theme';
import '@/i18n';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { ready: themeReady, scheme } = useThemePreferences();
  const { ready: localeReady } = useLocale();

  useEffect(() => {
    if (themeReady && localeReady) {
      SplashScreen.hideAsync();
    }
  }, [themeReady, localeReady]);

  if (!themeReady || !localeReady) {
    return <LoadingState />;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemePreferencesProvider>
      <LocaleProvider>
        <PermissionsProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PermissionsProvider>
      </LocaleProvider>
    </ThemePreferencesProvider>
  );
}
