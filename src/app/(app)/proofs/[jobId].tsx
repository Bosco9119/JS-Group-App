import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { deleteProofPhoto, fetchProofPhotos, uploadProofPhotos } from '@/lib/driver-api';
import { getOptionalCoords, pickProofPhotos } from '@/lib/media';
import type { ProofPhoto } from '@/lib/types';
import { createClientUuid, formatApiMessage } from '@/lib/utils';

export default function JobProofsScreen() {
  const { jobId, tripId, stopId } = useLocalSearchParams<{
    jobId: string;
    tripId?: string;
    stopId?: string;
  }>();
  const numericJobId = Number(jobId);
  const theme = useTheme();
  const { t } = useAppTranslation();
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPhotos(await fetchProofPhotos(numericJobId));
    } catch (err) {
      setError(formatApiMessage(err, t('proofs.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [numericJobId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload() {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickProofPhotos();
      if (!picked.length) {
        setBusy(false);
        return;
      }
      const coords = await getOptionalCoords();
      await uploadProofPhotos(numericJobId, picked, {
        clientUuid: createClientUuid(),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        driverTripId: tripId ? Number(tripId) : undefined,
        tripStopId: stopId ? Number(stopId) : undefined,
      });
      await load();
    } catch (err) {
      setError(formatApiMessage(err, t('proofs.unableUpload')));
    } finally {
      setBusy(false);
    }
  }

  function onDelete(photo: ProofPhoto) {
    Alert.alert(t('proofs.deleteTitle'), t('proofs.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('proofs.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await deleteProofPhoto(numericJobId, photo.id);
              await load();
            } catch (err) {
              setError(formatApiMessage(err, t('proofs.unableDelete')));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('proofs.title')} showBack />
      {loading ? (
        <LoadingState label={t('proofs.loading')} />
      ) : (
        <ScrollView contentContainerStyle={styles.padded}>
          {error ? <ErrorBanner message={error} /> : null}

          <Button title={t('proofs.upload')} loading={busy} onPress={() => void onUpload()} />

          {photos.length === 0 ? (
            <EmptyState title={t('proofs.emptyTitle')} message={t('proofs.emptyMessage')} />
          ) : (
            <View style={styles.grid}>
              {photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  onLongPress={() => onDelete(photo)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}
                >
                  <Image
                    source={{ uri: photo.photo_url ?? undefined }}
                    style={styles.image}
                    contentFit="cover"
                  />
                  <ThemedText type="small">{photo.photo_type_label}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {t('proofs.longPressDelete')}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
  },
  grid: { gap: Spacing.three },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    overflow: 'hidden',
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  image: {
    width: '100%',
    height: 220,
    backgroundColor: '#ccc',
  },
});
