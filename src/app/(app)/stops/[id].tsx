import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { SignaturePadModal } from '@/components/signature-pad-modal';
import { StatusChip, jobTypeTone, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel } from '@/i18n';
import { clockInStop, clockOutTrip, completeStop, fetchTrip } from '@/lib/driver-api';
import { getOptionalCoords, pickProofPhotos } from '@/lib/media';
import { confirmEndTripDialog, tripReadyToEnd } from '@/lib/trip-complete';
import type { LocalImage, TripStopSummary } from '@/lib/types';
import { createClientUuid, formatApiMessage } from '@/lib/utils';

export default function StopDetailScreen() {
  const { id, tripId } = useLocalSearchParams<{ id: string; tripId?: string }>();
  const stopId = Number(id);
  const linkedTripId = tripId ? Number(tripId) : null;
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();

  const [stop, setStop] = useState<TripStopSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<LocalImage[]>([]);
  const [signature, setSignature] = useState<LocalImage | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!linkedTripId) {
      setError(t('stops.missingTrip'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const trip = await fetchTrip(linkedTripId);
      const found = trip.stops?.find((item) => item.id === stopId) ?? null;
      setStop(found);
      if (!found) {
        setError(t('stops.notFound'));
      }
    } catch (err) {
      setError(formatApiMessage(err, t('stops.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [linkedTripId, stopId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const canArrive = useMemo(
    () => stop && ['pending', 'en_route'].includes(stop.status),
    [stop],
  );
  const canComplete = useMemo(
    () => stop && !['completed', 'skipped', 'failed'].includes(stop.status),
    [stop],
  );

  const progressSteps = useMemo(() => {
    if (!stop) return [];
    const arrived = !['pending', 'en_route'].includes(stop.status);
    const completed = stop.status === 'completed';
    return [
      { key: 'accepted', label: t('stops.progressAccepted'), done: true },
      { key: 'enroute', label: t('stops.progressEnRoute'), done: arrived || completed },
      { key: 'arrived', label: t('stops.progressArrived'), done: arrived || completed },
      { key: 'complete', label: t('stops.progressComplete'), done: completed },
    ];
  }, [stop, t]);

  async function onArrive() {
    setBusy(true);
    setError(null);
    try {
      await clockInStop(stopId);
      await load();
    } catch (err) {
      setError(formatApiMessage(err, t('stops.unableArrive')));
    } finally {
      setBusy(false);
    }
  }

  async function onAddPhotos() {
    try {
      const picked = await pickProofPhotos();
      if (picked.length) {
        setPhotos((prev) => [...prev, ...picked].slice(0, 10));
      }
    } catch (err) {
      setError(formatApiMessage(err, t('stops.unablePickPhotos')));
    }
  }

  async function onComplete() {
    if (photos.length < 1) {
      Alert.alert(t('stops.photoRequiredTitle'), t('stops.photoRequiredBody'));
      return;
    }

    if (!linkedTripId) {
      setError(t('stops.missingTrip'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const coords = await getOptionalCoords();
      await completeStop(stopId, {
        photos,
        signature,
        proofReceivedBy: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        clientUuid: createClientUuid(),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        takenAt: new Date().toISOString(),
      });

      const trip = await fetchTrip(linkedTripId);
      const found = trip.stops?.find((item) => item.id === stopId) ?? null;
      setStop(found);

      if (tripReadyToEnd(trip)) {
        const confirmed = await confirmEndTripDialog(trip);
        if (confirmed) {
          const updated = await clockOutTrip(trip.id);
          Alert.alert(t('trips.endedTitle'), t('trips.endedBody', { tripNo: updated.trip_no }), [
            { text: t('common.ok'), onPress: () => router.replace('/(app)/(tabs)/jobs') },
          ]);
        } else {
          Alert.alert(t('stops.stopCompletedTitle'), t('stops.stopCompletedBody'));
        }
      } else {
        Alert.alert(t('stops.stopCompletedTitle'), t('stops.stopCompletedBody'));
      }
    } catch (err) {
      setError(formatApiMessage(err, t('stops.unableComplete')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={stop?.job?.job_no ?? t('stops.title')}
        showBack
        right={
          stop ? (
            <StatusChip
              label={statusLabel(t, stop.status, stop.status_label)}
              tone={statusTone(stop.status)}
            />
          ) : null
        }
      />

      {loading ? (
        <LoadingState label={t('stops.loading')} />
      ) : !stop ? (
        <View style={styles.padded}>
          <ErrorBanner message={error ?? t('stops.notFound')} />
          <Button title={t('common.goBack')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.padded}>
          {error ? <ErrorBanner message={error} /> : null}

          <View style={styles.chipRow}>
            <StatusChip
              label={stop.job?.job_type_label ?? stop.stop_type_label}
              tone={jobTypeTone(stop.job?.job_type)}
            />
            <StatusChip
              label={statusLabel(t, stop.status, stop.status_label)}
              tone={statusTone(stop.status)}
            />
          </View>

          <View
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText type="smallBold">
              #{stop.sequence} · {stop.job?.job_no ?? stop.stop_type_label}
            </ThemedText>
            {stop.job?.customer_name ? <ThemedText>{stop.job.customer_name}</ThemedText> : null}
            {stop.job?.address_text ? (
              <ThemedText themeColor="textSecondary">{stop.job.address_text}</ThemedText>
            ) : null}
            {stop.job?.contact_person || stop.job?.contact_no ? (
              <ThemedText themeColor="textSecondary" type="small">
                {[stop.job.contact_person, stop.job.contact_no].filter(Boolean).join(' · ')}
              </ThemedText>
            ) : null}
            {stop.job?.special_instructions ? (
              <ThemedText themeColor="textSecondary" type="small">
                {t('stops.notesPrefix', { notes: stop.job.special_instructions })}
              </ThemedText>
            ) : null}
          </View>

          <View
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText type="smallBold">{t('stops.progressTitle')}</ThemedText>
            {progressSteps.map((step) => (
              <View key={step.key} style={styles.progressRow}>
                <View
                  style={[
                    styles.progressDot,
                    { backgroundColor: step.done ? theme.accent : theme.border },
                  ]}
                />
                <ThemedText type="small" style={{ color: step.done ? theme.text : theme.textSecondary }}>
                  {step.label}
                </ThemedText>
              </View>
            ))}
          </View>

          {canArrive ? (
            <Button title={t('stops.arrive')} loading={busy} onPress={() => void onArrive()} />
          ) : null}

          {canComplete ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">{t('stops.completeSection')}</ThemedText>

              <ThemedText type="smallBold">{t('stops.signatureTitle')}</ThemedText>
              <View
                style={[
                  styles.signatureBox,
                  { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                ]}
              >
                {signature ? (
                  <Image source={{ uri: signature.uri }} style={styles.signaturePreview} contentFit="contain" />
                ) : (
                  <ThemedText themeColor="textSecondary" type="small">
                    {t('stops.signatureHint')}
                  </ThemedText>
                )}
              </View>
              <View style={styles.rowActions}>
                <Button
                  title={t('stops.clearSignature')}
                  variant="ghost"
                  style={{ flex: 1 }}
                  onPress={() => setSignature(null)}
                />
                <Button
                  title={signature ? t('stops.changeSignature') : t('stops.addSignature')}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => setSignatureOpen(true)}
                />
              </View>

              <ThemedText type="smallBold">{t('stops.proofSection')}</ThemedText>
              <View style={styles.photoGrid}>
                {photos.map((photo) => (
                  <Image key={photo.uri} source={{ uri: photo.uri }} style={styles.thumb} />
                ))}
                <Button
                  title={t('stops.addPhotos')}
                  variant="secondary"
                  onPress={() => void onAddPhotos()}
                  style={styles.addPhotoBtn}
                />
              </View>
              <ThemedText themeColor="textSecondary" type="small">
                {t('stops.photosSelected', { count: photos.length })}
              </ThemedText>

              <ThemedText type="smallBold">{t('stops.receivedBy')}</ThemedText>
              <TextInput
                value={receivedBy}
                onChangeText={setReceivedBy}
                placeholder={t('stops.receivedByPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text },
                ]}
              />

              <ThemedText type="smallBold">{t('stops.notes')}</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('stops.notesPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[
                  styles.input,
                  styles.notes,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text },
                ]}
              />

              <Button title={t('stops.complete')} loading={busy} onPress={() => void onComplete()} />
            </View>
          ) : null}

          {stop.job ? (
            <Button
              title={t('stops.manageProofs')}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/(app)/proofs/[jobId]',
                  params: {
                    jobId: String(stop.job!.id),
                    tripId: String(linkedTripId ?? ''),
                    stopId: String(stop.id),
                  },
                })
              }
            />
          ) : null}

          <SignaturePadModal
            visible={signatureOpen}
            onCancel={() => setSignatureOpen(false)}
            onSave={(image) => {
              setSignature(image);
              setSignatureOpen(false);
            }}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  padded: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 4,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: Radius,
  },
  section: { gap: Spacing.two },
  signatureBox: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  signaturePreview: {
    width: '100%',
    height: 120,
  },
  rowActions: { flexDirection: 'row', gap: Spacing.two },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: Radius,
  },
  addPhotoBtn: {
    minHeight: 72,
    minWidth: 120,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
