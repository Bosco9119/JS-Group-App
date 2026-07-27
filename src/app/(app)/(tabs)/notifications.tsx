import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';

type LocalNotification = {
  id: string;
  title: string;
  body: string;
  ago: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  href?: string;
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();

  const items: LocalNotification[] = [
    {
      id: '1',
      title: t('notifications.sampleNewJobTitle'),
      body: t('notifications.sampleNewJobBody'),
      ago: t('notifications.agoMinutes', { count: 2 }),
      icon: 'briefcase',
      tone: theme.accent,
      href: '/(app)/(tabs)/jobs',
    },
    {
      id: '2',
      title: t('notifications.sampleUpdateTitle'),
      body: t('notifications.sampleUpdateBody'),
      ago: t('notifications.agoMinutes', { count: 18 }),
      icon: 'refresh',
      tone: theme.info,
      href: '/(app)/(tabs)/jobs',
    },
    {
      id: '3',
      title: t('notifications.sampleReminderTitle'),
      body: t('notifications.sampleReminderBody'),
      ago: t('notifications.agoHours', { count: 1 }),
      icon: 'alarm',
      tone: theme.warning,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('nav.notifications')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary" type="small">
          {t('notifications.stubHint')}
        </ThemedText>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (item.href) router.push(item.href as never);
            }}
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name={item.icon} size={20} color={item.tone} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {item.body}
              </ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {item.ago}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
