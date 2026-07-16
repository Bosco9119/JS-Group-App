import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';

export default function VehicleCheckScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('nav.vehicleCheck')} showBack />
      <View style={styles.body}>
        <ThemedText type="subtitle">{t('checklist.stubTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('checklist.stubBody')}</ThemedText>
        <Button title={t('nav.jobs')} onPress={() => router.push('/(app)/(tabs)/jobs')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    justifyContent: 'center',
  },
});
