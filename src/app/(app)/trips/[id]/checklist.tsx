import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { StatusChip } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { resolveMediaUrl } from '@/lib/config';
import {
  clockInTrip,
  fetchChecklist,
  fetchTrip,
  updateChecklist,
  uploadChecklistPhotos,
} from '@/lib/driver-api';
import { pickProofPhotos } from '@/lib/media';
import type { ChecklistItem, ChecklistItemInput, VehicleChecklist } from '@/lib/types';
import { ApiError } from '@/lib/types';
import { firstFieldError, formatApiMessage } from '@/lib/utils';

type DraftItem = {
  key: string;
  label: string;
  passed: boolean | null;
  notes: string;
};

function toDraft(items: ChecklistItem[]): DraftItem[] {
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    passed: item.passed,
    notes: item.notes ?? '',
  }));
}

export default function TripChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tripStatus, setTripStatus] = useState<string>('planned');
  const [canClockIn, setCanClockIn] = useState(false);
  const [checklist, setChecklist] = useState<VehicleChecklist | null>(null);
  const [draft, setDraft] = useState<DraftItem[]>([]);

  const readOnly = tripStatus !== 'planned';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const trip = await fetchTrip(tripId);
      setTripStatus(trip.status);
      setCanClockIn(trip.can_clock_in);

      let data = trip.checklist ?? null;
      if (!data || !data.items?.length) {
        data = await fetchChecklist(tripId);
      }
      setChecklist(data);
      setDraft(toDraft(data.items ?? []));
    } catch (err) {
      setError(formatApiMessage(err, t('checklist.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [t, tripId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const allChosen = useMemo(
    () => draft.length > 0 && draft.every((item) => item.passed === true || item.passed === false),
    [draft],
  );

  function setPassed(key: string, passed: boolean) {
    setDraft((prev) => prev.map((item) => (item.key === key ? { ...item, passed } : item)));
  }

  function setNotes(key: string, notes: string) {
    setDraft((prev) => prev.map((item) => (item.key === key ? { ...item, notes } : item)));
  }

  async function onSave() {
    if (!allChosen) {
      Alert.alert(t('checklist.incompleteTitle'), t('checklist.incompleteBody'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: ChecklistItemInput[] = draft.map((item) => ({
        key: item.key,
        label: item.label,
        passed: item.passed === true,
        notes: item.notes.trim() || null,
      }));
      const updated = await updateChecklist(tripId, payload);
      setChecklist(updated);
      setDraft(toDraft(updated.items));

      const trip = await fetchTrip(tripId);
      setCanClockIn(trip.can_clock_in);
      setTripStatus(trip.status);

      if (updated.passed) {
        Alert.alert(t('checklist.passedTitle'), t('checklist.passedBody'));
      } else {
        Alert.alert(t('checklist.failedTitle'), t('checklist.failedBody'));
      }
    } catch (err) {
      setError(formatApiMessage(err, t('checklist.unableSave')));
    } finally {
      setSaving(false);
    }
  }

  async function onAddPhotos() {
    setUploading(true);
    setError(null);
    try {
      const picked = await pickProofPhotos();
      if (!picked.length) return;
      const updated = await uploadChecklistPhotos(tripId, picked);
      setChecklist(updated);
    } catch (err) {
      setError(formatApiMessage(err, t('checklist.unableUploadPhotos')));
    } finally {
      setUploading(false);
    }
  }

  async function onStartTrip() {
    setStarting(true);
    setError(null);
    try {
      const updated = await clockInTrip(tripId);
      setTripStatus(updated.status);
      setCanClockIn(updated.can_clock_in);
      Alert.alert(t('trips.startTrip'), t('checklist.startedBody'), [
        { text: t('common.ok'), onPress: () => router.replace(`/(app)/trips/${tripId}`) },
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const checklistMsg = firstFieldError(err.errors, 'checklist');
        setError(checklistMsg ?? formatApiMessage(err, t('trips.unableStart')));
      } else {
        setError(formatApiMessage(err, t('trips.unableStart')));
      }
    } finally {
      setStarting(false);
    }
  }

  const photoUrls = (checklist?.photo_urls ?? [])
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => !!url);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={t('checklist.title')}
        showBack
        onBack={() => {
          router.replace(`/(app)/trips/${tripId}`);
        }}
      />
      {loading ? (
        <LoadingState label={t('checklist.loading')} />
      ) : (
        <ScrollView contentContainerStyle={styles.padded}>
          {error ? <ErrorBanner message={error} /> : null}

          {readOnly ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">{t('checklist.lockedTitle')}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {t('checklist.lockedBody')}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <ThemedText type="smallBold">{t('checklist.overall')}</ThemedText>
            <StatusChip
              label={
                checklist?.passed
                  ? t('checklist.statusPassed')
                  : checklist?.passed === false
                    ? t('checklist.statusFailed')
                    : t('checklist.statusPending')
              }
              tone={checklist?.passed ? 'success' : checklist?.passed === false ? 'danger' : 'warning'}
            />
          </View>

          {draft.map((item) => (
            <View
              key={item.key}
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">{item.label}</ThemedText>
              <View style={styles.passRow}>
                <Pressable
                  disabled={readOnly}
                  onPress={() => setPassed(item.key, true)}
                  style={[
                    styles.choice,
                    {
                      borderColor: item.passed === true ? theme.accent : theme.border,
                      backgroundColor:
                        item.passed === true ? theme.backgroundSelected : theme.background,
                      opacity: readOnly ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: item.passed === true ? theme.accent : theme.text }}
                  >
                    {t('checklist.pass')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  disabled={readOnly}
                  onPress={() => setPassed(item.key, false)}
                  style={[
                    styles.choice,
                    {
                      borderColor: item.passed === false ? theme.danger : theme.border,
                      backgroundColor:
                        item.passed === false ? '#FEE2E2' : theme.background,
                      opacity: readOnly ? 0.7 : 1,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: item.passed === false ? theme.danger : theme.text }}
                  >
                    {t('checklist.fail')}
                  </ThemedText>
                </Pressable>
              </View>
              {!readOnly || item.notes ? (
                <TextInput
                  editable={!readOnly}
                  value={item.notes}
                  onChangeText={(value) => setNotes(item.key, value)}
                  placeholder={t('checklist.notesPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.notes,
                    {
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}

          <ThemedText type="smallBold">{t('checklist.photos')}</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {t('checklist.photosOptional')}
          </ThemedText>
          {photoUrls.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {photoUrls.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
              ))}
            </ScrollView>
          ) : null}

          {!readOnly ? (
            <>
              <Button
                title={t('checklist.addPhotos')}
                variant="secondary"
                loading={uploading}
                onPress={() => void onAddPhotos()}
              />
              <Button
                title={t('checklist.save')}
                loading={saving}
                onPress={() => void onSave()}
              />
              {canClockIn ? (
                <Button
                  title={t('trips.startTrip')}
                  loading={starting}
                  onPress={() => void onStartTrip()}
                />
              ) : null}
            </>
          ) : null}
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
  banner: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  passRow: { flexDirection: 'row', gap: Spacing.two },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  notes: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  thumbs: { gap: Spacing.two },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: Radius,
  },
});
