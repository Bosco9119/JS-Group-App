import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { resolveMediaUrl } from '@/lib/config';
import { deleteProofPhoto, fetchProofPhotos, uploadProofPhotos } from '@/lib/driver-api';
import { getOptionalCoords, pickProofPhotos } from '@/lib/media';
import type { ProofPhoto } from '@/lib/types';
import { createClientUuid, formatApiMessage } from '@/lib/utils';

function proofPhotoUri(photo: ProofPhoto): string | null {
  return resolveMediaUrl(photo.photo_url) ?? resolveMediaUrl(photo.photo_path);
}

export default function JobProofsScreen() {
  const { jobId, tripId, stopId } = useLocalSearchParams<{
    jobId: string;
    tripId?: string;
    stopId?: string;
  }>();
  const numericJobId = Number(jobId);
  const linkedTripId = tripId ? Number(tripId) : null;
  const linkedStopId = stopId ? Number(stopId) : null;
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [photos, setPhotos] = useState<ProofPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchProofPhotos(numericJobId);
      if (__DEV__) {
        console.log('[proofs] jobId=', numericJobId, 'count=', next.length);
        next.forEach((photo) => {
          console.log('[proofs] photo', {
            id: photo.id,
            photo_url: photo.photo_url,
            photo_path: photo.photo_path,
            resolved: proofPhotoUri(photo),
          });
        });
      }
      setPhotos(next);
    } catch (err) {
      console.error('[proofs] load failed', err);
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
      <AppHeader
        title={t('proofs.title')}
        showBack
        onBack={() => {
          if (linkedTripId && linkedStopId) {
            router.replace(`/(app)/stops/${linkedStopId}?tripId=${linkedTripId}`);
            return;
          }
          if (linkedTripId) {
            router.replace(`/(app)/trips/${linkedTripId}`);
            return;
          }
          if (router.canGoBack()) router.back();
        }}
      />
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
              {photos.map((photo) => {
                const uri = proofPhotoUri(photo);
                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => {
                      if (uri) setViewerUri(uri);
                    }}
                    onLongPress={() => onDelete(photo)}
                    style={[
                      styles.card,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}
                  >
                    <Image
                      source={{ uri: uri ?? undefined }}
                      style={styles.image}
                      contentFit="cover"
                    />
                    <ThemedText type="small">{photo.photo_type_label}</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                      {t('proofs.longPressDelete')}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      <PhotoViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
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
