import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { initialsFromName } from '@/lib/format';

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const { driver, user } = useAuth();

  const items: MenuItem[] = [
    { label: t('profile.driverInfo'), icon: 'id-card-outline', href: '/(app)/help' },
    { label: t('profile.vehicleInfo'), icon: 'car-outline', href: '/(app)/vehicle-check' },
    { label: t('nav.documents'), icon: 'document-text-outline', href: '/(app)/documents' },
    { label: t('nav.settings'), icon: 'settings-outline', href: '/(app)/settings' },
    { label: t('nav.help'), icon: 'help-circle-outline', href: '/(app)/help' },
    { label: t('profile.about'), icon: 'information-circle-outline', href: '/(app)/help' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('nav.profile')} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.avatarText}>
              {initialsFromName(driver?.name ?? user?.name)}
            </ThemedText>
          </View>
          <ThemedText type="subtitle">{driver?.name ?? user?.name}</ThemedText>
          {driver?.phone ? (
            <ThemedText themeColor="textSecondary" type="small">
              {driver.phone}
            </ThemedText>
          ) : null}
          <ThemedText themeColor="textSecondary" type="small">
            {user?.email}
          </ThemedText>
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
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
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
