import { Redirect, type Href } from 'expo-router';

import { LoadingState } from '@/components/ui/states';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { usePermissions } from '@/context/permissions';

const APP_HOME = '/(app)/(tabs)/' as Href;

export default function Index() {
  const { t } = useAppTranslation();
  const { ready: authReady, isAuthenticated } = useAuth();
  const { ready: permissionsReady, snapshot } = usePermissions();

  if (!authReady || !permissionsReady) {
    return <LoadingState label={t('common.loading')} />;
  }

  if (!snapshot.allGranted) {
    return <Redirect href="/permissions" />;
  }

  if (isAuthenticated) {
    return <Redirect href={APP_HOME} />;
  }

  return <Redirect href="/login" />;
}
