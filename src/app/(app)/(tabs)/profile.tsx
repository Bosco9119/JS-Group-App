import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { DriverAvatar } from '@/components/driver-avatar';
import { ThemedText } from '@/components/themed-text';
import { ErrorBanner } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { removeDriverPhoto, uploadDriverPhoto } from '@/lib/driver-api';
import { formatDate } from '@/lib/format';
import { pickProfilePhoto } from '@/lib/media';
import { formatApiMessage } from '@/lib/utils';

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

function isLicenseExpired(licenseExpiry: string | null): boolean {
  if (!licenseExpiry) return false;
  const expiry = new Date(`${licenseExpiry}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const { driver, user, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items: MenuItem[] = [
    { label: t('profile.vehicleInfo'), icon: 'car-outline', href: '/(app)/vehicle-check' },
    { label: t('nav.documents'), icon: 'document-text-outline', href: '/(app)/documents' },
    { label: t('nav.settings'), icon: 'settings-outline', href: '/(app)/settings' },
    { label: t('nav.help'), icon: 'help-circle-outline', href: '/(app)/help' },
    { label: t('profile.about'), icon: 'information-circle-outline', href: '/(app)/help' },
  ];

  async function handlePickAndUpload() {
    setBusy(true);
    setError(null);
    try {
      const photo = await pickProfilePhoto();
      if (!photo) return;
      await uploadDriverPhoto(photo);
      await refreshMe();
    } catch (err) {
      setError(formatApiMessage(err, t('profile.unableUploadPhoto')));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemovePhoto() {
    setBusy(true);
    setError(null);
    try {
      await removeDriverPhoto();
      await refreshMe();
    } catch (err) {
      setError(formatApiMessage(err, t('profile.unableRemovePhoto')));
    } finally {
      setBusy(false);
    }
  }

  function onAvatarPress() {
    if (busy) return;

    const buttons = driver?.photo_url
      ? [
          { text: t('common.cancel'), style: 'cancel' as const },
          { text: t('profile.changePhoto'), onPress: () => void handlePickAndUpload() },
          {
            text: t('profile.removePhoto'),
            style: 'destructive' as const,
            onPress: () => void handleRemovePhoto(),
          },
        ]
      : [
          { text: t('common.cancel'), style: 'cancel' as const },
          { text: t('profile.changePhoto'), onPress: () => void handlePickAndUpload() },
        ];

    Alert.alert(t('profile.photoTitle'), undefined, buttons);
  }

  const expired = isLicenseExpired(driver?.license_expiry ?? null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={t('nav.profile')}
        showBell
        onBellPress={() => router.push('/(app)/(tabs)/notifications')}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={styles.hero}>
          <Pressable onPress={onAvatarPress} disabled={busy} style={styles.avatarWrap}>
            <DriverAvatar photoUrl={driver?.photo_url} name={driver?.name ?? user?.name} size={84} />
            <View style={[styles.avatarBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <ThemedText type="subtitle">{driver?.name ?? user?.name}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {user?.email}
          </ThemedText>
        </View>

        <View
          style={[styles.detailsCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        >
          <ThemedText type="smallBold" style={styles.detailsTitle}>
            {t('profile.driverDetailsTitle')}
          </ThemedText>

          <View style={styles.detailRow}>
            <ThemedText themeColor="textSecondary" type="small">
              {t('profile.icNumber')}
            </ThemedText>
            <ThemedText type="small">{driver?.ic_number ?? '—'}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText themeColor="textSecondary" type="small">
              {t('profile.phone')}
            </ThemedText>
            <ThemedText type="small">{driver?.phone ?? '—'}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText themeColor="textSecondary" type="small">
              {t('profile.licenseNumber')}
            </ThemedText>
            <ThemedText type="small">{driver?.license_number ?? '—'}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText themeColor="textSecondary" type="small">
              {t('profile.licenseExpiry')}
            </ThemedText>
            <ThemedText type="small" style={expired ? { color: theme.danger } : undefined}>
              {driver?.license_expiry ? formatDate(driver.license_expiry) : '—'}
              {expired ? ` (${t('profile.licenseExpired')})` : ''}
            </ThemedText>
          </View>
        </View>

        <View
          style={[styles.menu, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href as never)}
              style={[styles.menuItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons name={item.icon} size={20} color={theme.text} />
              <ThemedText type="small" style={{ flex: 1 }}>
                {item.label}
              </ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  avatarWrap: {
    marginBottom: Spacing.two,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCard: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  detailsTitle: {
    marginBottom: Spacing.one,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  menu: {
    borderWidth: 1,
    borderRadius: Radius,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
