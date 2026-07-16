import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';

import { AppDrawerContent } from '@/components/drawer-content';
import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { OnlineProvider } from '@/context/online';
import { usePermissions } from '@/context/permissions';
import { useTheme } from '@/hooks/use-theme';

function AppDrawer() {
  const theme = useTheme();
  const { t } = useAppTranslation();

  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: theme.backgroundElement,
          width: 300,
        },
        overlayColor: 'rgba(0,0,0,0.35)',
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: t('nav.home'), drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="trips/[id]/index" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="trips/[id]/checklist" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="stops/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="proofs/[jobId]" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="schedule" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="vehicle-check" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="documents" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="reports" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="help" options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}

export default function AppLayout() {
  const { ready, isAuthenticated } = useAuth();
  const { ready: permissionsReady, snapshot } = usePermissions();
  const { t } = useAppTranslation();

  if (!ready || !permissionsReady) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (!snapshot.allGranted) {
    return <Redirect href="/permissions" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <OnlineProvider>
      <AppDrawer />
    </OnlineProvider>
  );
}
