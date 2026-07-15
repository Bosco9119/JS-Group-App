import { ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useAppTranslation, useLocale } from '@/context/locale';
import { usePermissions } from '@/context/permissions';
import { useThemePreferences } from '@/context/theme';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AppLanguage } from '@/lib/preferences';
import { openSystemSettings } from '@/lib/permissions';
import type { ThemePreference } from '@/lib/preferences';
import { Pressable } from 'react-native';

function ChoiceRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const { preference, setPreference } = useThemePreferences();
  const { language, setLanguage } = useLocale();
  const { snapshot, requestAll } = usePermissions();

  const themes: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: t('settings.themeSystem') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];

  const languages: { value: AppLanguage; label: string }[] = [
    { value: 'en', label: t('settings.langEn') },
    { value: 'zh', label: t('settings.langZh') },
    { value: 'ms', label: t('settings.langMs') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('settings.title')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold">{t('settings.theme')}</ThemedText>
        <View style={styles.rowWrap}>
          {themes.map((item) => (
            <ChoiceRow
              key={item.value}
              label={item.label}
              selected={preference === item.value}
              onPress={() => void setPreference(item.value)}
            />
          ))}
        </View>

        <ThemedText type="smallBold">{t('settings.language')}</ThemedText>
        <View style={styles.rowWrap}>
          {languages.map((item) => (
            <ChoiceRow
              key={item.value}
              label={item.label}
              selected={language === item.value}
              onPress={() => void setLanguage(item.value)}
            />
          ))}
        </View>

        <ThemedText type="smallBold">{t('settings.permissions')}</ThemedText>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="small">
            {snapshot.locationGranted ? t('permissions.locationGranted') : t('permissions.locationDenied')}
          </ThemedText>
          <ThemedText type="small">
            {snapshot.notificationGranted
              ? t('permissions.notificationGranted')
              : t('permissions.notificationDenied')}
          </ThemedText>
          <ThemedText type="small">
            {snapshot.cameraGranted ? t('permissions.cameraGranted') : t('permissions.cameraDenied')}
          </ThemedText>
          <ThemedText type="small">
            {snapshot.mediaLibraryGranted ? t('permissions.mediaGranted') : t('permissions.mediaDenied')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {t('settings.stillRequired')}
          </ThemedText>
        </View>

        <Button title={t('settings.grantAgain')} onPress={() => void requestAll()} />
        <Button title={t('common.openSettings')} variant="secondary" onPress={() => void openSystemSettings()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  choice: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
