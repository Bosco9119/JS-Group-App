import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useAppTranslation } from '@/context/locale';
import { usePermissions } from '@/context/permissions';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openSystemSettings } from '@/lib/permissions';

function PermissionCard({
  title,
  body,
  granted,
  grantedLabel,
  deniedLabel,
}: {
  title: string;
  body: string;
  granted: boolean;
  grantedLabel: string;
  deniedLabel: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {body}
      </ThemedText>
      <ThemedText type="small" style={{ color: granted ? theme.success : theme.danger }}>
        {granted ? grantedLabel : deniedLabel}
      </ThemedText>
    </View>
  );
}

export default function PermissionsScreen() {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const router = useRouter();
  const { snapshot, requestAll, refresh } = usePermissions();
  const [busy, setBusy] = useState(false);

  async function onAllow() {
    setBusy(true);
    try {
      const next = await requestAll();
      if (next.allGranted) {
        router.replace('/');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    setBusy(true);
    try {
      const next = await refresh();
      if (next.allGranted) {
        router.replace('/');
        return;
      }
      await onAllow();
    } finally {
      setBusy(false);
    }
  }

  const denied = !snapshot.allGranted;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image
          source={require('@/assets/images/js-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="JS Group"
        />
        <ThemedText type="subtitle" style={styles.title}>
          {t('permissions.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{t('permissions.subtitle')}</ThemedText>

        <PermissionCard
          title={t('permissions.locationTitle')}
          body={t('permissions.locationBody')}
          granted={snapshot.locationGranted}
          grantedLabel={t('permissions.locationGranted')}
          deniedLabel={t('permissions.locationDenied')}
        />
        <PermissionCard
          title={t('permissions.notificationTitle')}
          body={t('permissions.notificationBody')}
          granted={snapshot.notificationGranted}
          grantedLabel={t('permissions.notificationGranted')}
          deniedLabel={t('permissions.notificationDenied')}
        />
        <PermissionCard
          title={t('permissions.cameraTitle')}
          body={t('permissions.cameraBody')}
          granted={snapshot.cameraGranted}
          grantedLabel={t('permissions.cameraGranted')}
          deniedLabel={t('permissions.cameraDenied')}
        />
        <PermissionCard
          title={t('permissions.mediaTitle')}
          body={t('permissions.mediaBody')}
          granted={snapshot.mediaLibraryGranted}
          grantedLabel={t('permissions.mediaGranted')}
          deniedLabel={t('permissions.mediaDenied')}
        />

        {denied ? (
          <ThemedText themeColor="textSecondary" type="small">
            {t('permissions.deniedBody')}
          </ThemedText>
        ) : null}

        <Button title={t('permissions.allow')} loading={busy} onPress={() => void onAllow()} />
        <Button title={t('common.retry')} variant="secondary" loading={busy} onPress={() => void onRetry()} />
        <Button
          title={t('common.openSettings')}
          variant="ghost"
          onPress={() => void openSystemSettings()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 144,
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  title: { fontSize: 28, lineHeight: 34 },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
