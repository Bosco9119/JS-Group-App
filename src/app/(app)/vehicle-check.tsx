import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { pickProofPhotos } from '@/lib/media';
import {
  getChecklistState,
  setChecklistState,
  type ChecklistState,
} from '@/lib/preferences';
import { formatApiMessage } from '@/lib/utils';

const ITEM_KEYS = [
  'headLight',
  'tailLight',
  'brake',
  'tires',
  'mirrors',
  'oil',
  'fuel',
] as const;

export default function VehicleCheckScreen() {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const saved = await getChecklistState();
      if (saved) {
        setItems(saved.items);
        setPhotoUri(saved.photoUri);
      } else {
        const initial: Record<string, boolean> = {};
        for (const key of ITEM_KEYS) initial[key] = false;
        setItems(initial);
      }
    })();
  }, []);

  function toggle(key: string) {
    setItems((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onPhoto() {
    try {
      const picked = await pickProofPhotos();
      if (picked[0]) setPhotoUri(picked[0].uri);
    } catch (err) {
      Alert.alert(t('common.errorGeneric'), formatApiMessage(err, t('stops.unablePickPhotos')));
    }
  }

  async function onSubmit() {
    setSaving(true);
    try {
      const state: ChecklistState = {
        date: new Date().toISOString(),
        items,
        photoUri,
      };
      await setChecklistState(state);
      Alert.alert(t('vehicleCheck.savedTitle'), t('vehicleCheck.savedBody'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('nav.vehicleCheck')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary" type="small">
          {new Date().toLocaleString()}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          {t('vehicleCheck.localOnly')}
        </ThemedText>

        {ITEM_KEYS.map((key) => {
          const ok = !!items[key];
          return (
            <Pressable
              key={key}
              onPress={() => toggle(key)}
              style={[
                styles.row,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">{t(`vehicleCheck.items.${key}`)}</ThemedText>
              <ThemedText type="small" style={{ color: ok ? theme.success : theme.warning }}>
                {ok ? t('vehicleCheck.ok') : t('vehicleCheck.check')}
              </ThemedText>
            </Pressable>
          );
        })}

        <ThemedText type="smallBold">{t('vehicleCheck.photo')}</ThemedText>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
        ) : null}
        <Button title={t('vehicleCheck.takePhoto')} variant="secondary" onPress={() => void onPhoto()} />
        <Button title={t('vehicleCheck.submit')} loading={saving} onPress={() => void onSubmit()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: Radius,
  },
});
