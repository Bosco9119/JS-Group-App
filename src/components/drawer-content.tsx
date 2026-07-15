import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView } from 'expo-router/drawer';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { useOnline } from '@/context/online';
import { useTheme } from '@/hooks/use-theme';
import { fetchTrips } from '@/lib/driver-api';
import { initialsFromName, vehicleLabel } from '@/lib/format';

type Item = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AppDrawerContent(props: any) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const { driver, user, logout } = useAuth();
  const { online, setOnline } = useOnline();
  const [vehicle, setVehicle] = useState('—');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const trips = await fetchTrips();
        if (cancelled) return;
        const withVehicle = trips.find((trip) => trip.vehicle);
        setVehicle(vehicleLabel(withVehicle?.vehicle ?? null));
      } catch {
        if (!cancelled) setVehicle('—');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items: Item[] = [
    { key: 'home', label: t('nav.home'), icon: 'home-outline', href: '/(app)/(tabs)/' },
    { key: 'jobs', label: t('nav.jobs'), icon: 'briefcase-outline', href: '/(app)/(tabs)/jobs' },
    { key: 'map', label: t('nav.map'), icon: 'map-outline', href: '/(app)/(tabs)/map' },
    { key: 'schedule', label: t('nav.schedule'), icon: 'calendar-outline', href: '/(app)/schedule' },
    {
      key: 'vehicle',
      label: t('nav.vehicleCheck'),
      icon: 'car-outline',
      href: '/(app)/vehicle-check',
    },
    { key: 'docs', label: t('nav.documents'), icon: 'document-text-outline', href: '/(app)/documents' },
    {
      key: 'notifications',
      label: t('nav.notifications'),
      icon: 'notifications-outline',
      href: '/(app)/(tabs)/notifications',
    },
    { key: 'reports', label: t('nav.reports'), icon: 'bar-chart-outline', href: '/(app)/reports' },
    { key: 'settings', label: t('nav.settings'), icon: 'settings-outline', href: '/(app)/settings' },
    { key: 'help', label: t('nav.help'), icon: 'help-circle-outline', href: '/(app)/help' },
  ];

  function go(href: string) {
    props.navigation?.closeDrawer?.();
    router.push(href as never);
  }

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.scroll, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.avatarText}>{initialsFromName(driver?.name ?? user?.name)}</ThemedText>
        </View>
        <ThemedText type="smallBold">{driver?.name ?? user?.name ?? 'Driver'}</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {vehicle}
        </ThemedText>
        <View style={styles.onlineRow}>
          <View
            style={[
              styles.onlinePill,
              { backgroundColor: online ? theme.backgroundSelected : theme.border },
            ]}
          >
            <View
              style={[styles.dot, { backgroundColor: online ? theme.success : theme.textSecondary }]}
            />
            <ThemedText type="small" style={{ color: online ? theme.accent : theme.textSecondary }}>
              {online ? t('nav.online') : t('nav.offline')}
            </ThemedText>
          </View>
          <Switch
            value={online}
            onValueChange={(value) => void setOnline(value)}
            trackColor={{ false: theme.border, true: theme.accentMuted }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.menu}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => go(item.href)}
            style={({ pressed }) => [
              styles.menuItem,
              { backgroundColor: pressed ? theme.backgroundSelected : 'transparent' },
            ]}
          >
            <Ionicons name={item.icon} size={20} color={theme.text} />
            <ThemedText type="small">{item.label}</ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => {
            props.navigation?.closeDrawer?.();
            void logout();
          }}
          style={styles.menuItem}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <ThemedText type="small" style={{ color: theme.danger }}>
            {t('common.signOut')}
          </ThemedText>
        </Pressable>
        <ThemedText themeColor="textSecondary" type="small" style={styles.version}>
          {t('nav.version', { version: '1.0.0' })}
        </ThemedText>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  onlineRow: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  menu: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius,
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
  },
  version: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
});
