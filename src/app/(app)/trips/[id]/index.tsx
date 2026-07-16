import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { JobLineItems } from '@/components/job-line-items';
import { StatusChip, isStopFinished, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel } from '@/i18n';
import { canNavigate, openMapsNavigate } from '@/lib/directions';
import { clockInTrip, clockOutTrip, fetchTrip } from '@/lib/driver-api';
import {
  countCompletedStops,
  formatDate,
  formatDateTime,
  formatTimeRange,
  vehicleLabel,
} from '@/lib/format';
import { jobLineItems } from '@/lib/job-items';
import { confirmEndTripDialog, tripReadyToEnd } from '@/lib/trip-complete';
import type { DriverTripSummary } from '@/lib/types';
import { ApiError } from '@/lib/types';
import { firstFieldError, formatApiMessage } from '@/lib/utils';

function isDemoNotes(notes?: string | null): boolean {
  return !!notes && /SEED[-_]/i.test(notes);
}

function showInfo(title: string, message: string, okLabel: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    onOk?.();
    return;
  }
  Alert.alert(title, message, [{ text: okLabel, onPress: onOk }]);
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [trip, setTrip] = useState<DriverTripSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPromptedRef = useRef(false);
  const endingRef = useRef(false);

  const endTripAfterConfirm = useCallback(
    async (current: DriverTripSummary) => {
      if (!tripReadyToEnd(current) || endingRef.current) {
        return;
      }

      const confirmed = await confirmEndTripDialog(current);
      if (!confirmed) {
        return;
      }

      endingRef.current = true;
      setEnding(true);
      setError(null);
      try {
        const updated = await clockOutTrip(current.id);
        setTrip(updated);
        showInfo(
          t('trips.endedTitle'),
          t('trips.endedBody', { tripNo: updated.trip_no }),
          t('common.ok'),
        );
      } catch (err) {
        setError(formatApiMessage(err, t('trips.unableEnd')));
      } finally {
        endingRef.current = false;
        setEnding(false);
      }
    },
    [router, t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrip(tripId);
      setTrip(data);
      if (tripReadyToEnd(data) && !autoPromptedRef.current && !endingRef.current) {
        autoPromptedRef.current = true;
        void endTripAfterConfirm(data);
      }
    } catch (err) {
      setError(formatApiMessage(err, t('trips.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [endTripAfterConfirm, t, tripId]);

  useFocusEffect(
    useCallback(() => {
      autoPromptedRef.current = false;
      void load();
    }, [load]),
  );

  async function onStartTrip() {
    setStarting(true);
    setError(null);
    try {
      const updated = await clockInTrip(tripId);
      setTrip(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const checklistMsg = firstFieldError(err.errors, 'checklist');
        if (checklistMsg) {
          setError(checklistMsg);
          router.push(`/(app)/trips/${tripId}/checklist`);
          return;
        }
      }
      setError(formatApiMessage(err, t('trips.unableStart')));
    } finally {
      setStarting(false);
    }
  }

  async function onEndTripPress() {
    if (!trip) return;
    await endTripAfterConfirm(trip);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={trip?.trip_no ?? t('trips.tripTitle')}
        showBack
        right={
          trip ? (
            <StatusChip
              label={statusLabel(t, trip.status, trip.status_label)}
              tone={statusTone(trip.status)}
            />
          ) : null
        }
      />

      {loading ? (
        <LoadingState label={t('trips.loadingTrip')} />
      ) : !trip ? (
        <View style={styles.padded}>
          <ErrorBanner message={error ?? t('trips.notFound')} />
          <Button title={t('common.goBack')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.padded}>
          {error ? <ErrorBanner message={error} /> : null}

          {trip.is_overnight || trip.is_out_state ? (
            <View style={styles.chipRow}>
              {trip.is_overnight ? (
                <StatusChip label={t('trips.overnight')} tone="neutral" />
              ) : null}
              {trip.is_out_state ? (
                <StatusChip label={t('trips.outOfState')} tone="neutral" />
              ) : null}
            </View>
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText type="smallBold">{trip.trip_no}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {t('trips.vehicle')}: {vehicleLabel(trip.vehicle)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {[
                trip.planned_date ? formatDate(trip.planned_date) : null,
                formatTimeRange(trip.planned_start, trip.planned_end),
              ]
                .filter((part) => part && part !== '—')
                .join(' · ')}
            </ThemedText>
            {trip.actual_start ? (
              <ThemedText themeColor="textSecondary" type="small">
                {t('trips.actualStart', { at: formatDateTime(trip.actual_start) })}
              </ThemedText>
            ) : null}
            {trip.actual_end ? (
              <ThemedText themeColor="textSecondary" type="small">
                {t('trips.actualEnd', { at: formatDateTime(trip.actual_end) })}
              </ThemedText>
            ) : null}
            {trip.notes && !isDemoNotes(trip.notes) ? (
              <View style={styles.notesBlock}>
                <ThemedText type="smallBold">{t('trips.tripNotes')}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {trip.notes}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.stats}>
              <Stat
                label={t('trips.stops')}
                value={(() => {
                  const { done, total } = countCompletedStops(trip);
                  return `${done}/${total}`;
                })()}
              />
            </View>
          </View>

          {trip.status === 'planned' && !trip.can_clock_in ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
              ]}
            >
              <ThemedText type="smallBold">{t('checklist.requiredTitle')}</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                {t('checklist.requiredBody')}
              </ThemedText>
              <Button
                title={t('checklist.open')}
                onPress={() => router.push(`/(app)/trips/${trip.id}/checklist`)}
              />
            </View>
          ) : null}

          {trip.status === 'planned' || trip.checklist ? (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <View style={styles.row}>
                <ThemedText type="smallBold">{t('checklist.title')}</ThemedText>
                <StatusChip
                  label={
                    trip.checklist?.passed
                      ? t('checklist.statusPassed')
                      : trip.checklist?.passed === false
                        ? t('checklist.statusFailed')
                        : t('checklist.statusPending')
                  }
                  tone={
                    trip.checklist?.passed
                      ? 'success'
                      : trip.checklist?.passed === false
                        ? 'danger'
                        : 'warning'
                  }
                />
              </View>
              {trip.checklist?.checked_at ? (
                <ThemedText themeColor="textSecondary" type="small">
                  {t('checklist.checkedAt', { at: formatDateTime(trip.checklist.checked_at) })}
                </ThemedText>
              ) : null}
              <Button
                title={trip.status === 'planned' ? t('checklist.open') : t('checklist.view')}
                variant="secondary"
                onPress={() => router.push(`/(app)/trips/${trip.id}/checklist`)}
              />
            </View>
          ) : null}

          {trip.can_clock_in ? (
            <Button title={t('trips.startTrip')} loading={starting} onPress={() => void onStartTrip()} />
          ) : null}

          {tripReadyToEnd(trip) ? (
            <Button title={t('trips.endTrip')} loading={ending} onPress={() => void onEndTripPress()} />
          ) : null}

          {trip.status === 'completed' ? (
            <ThemedText themeColor="textSecondary" type="small">
              {t('trips.tripCompletedHint')}
            </ThemedText>
          ) : trip.status !== 'planned' &&
            trip.status !== 'in_progress' &&
            !trip.can_clock_in ? (
            <ThemedText themeColor="textSecondary" type="small">
              {t('trips.cannotStart', {
                status: statusLabel(t, trip.status, trip.status_label),
              })}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">{t('trips.stops')}</ThemedText>
          {(trip.stops ?? []).map((stop) => {
            const job = stop.job;
            const finished = isStopFinished(stop.status);
            const navTarget = {
              address: job?.address_text,
              latitude: job?.latitude,
              longitude: job?.longitude,
            };
            return (
              <View
                key={stop.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}
              >
                <Pressable
                  onPress={() =>
                    router.push(`/(app)/stops/${stop.id}?tripId=${trip.id}`)
                  }
                >
                  <View style={styles.row}>
                    <ThemedText type="smallBold" style={{ flex: 1 }}>
                      #{stop.sequence} · {job?.job_no ?? stop.stop_type_label}
                    </ThemedText>
                    <StatusChip
                      label={statusLabel(t, stop.status, stop.status_label)}
                      tone={statusTone(stop.status)}
                    />
                  </View>
                  {job?.customer_name ? (
                    <ThemedText type="small">{job.customer_name}</ThemedText>
                  ) : null}
                  {job?.address_text ? (
                    <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
                      {job.address_text}
                    </ThemedText>
                  ) : null}
                  {jobLineItems(job).length || job?.items_description ? (
                    <View style={{ marginTop: Spacing.one }}>
                      <JobLineItems job={job} maxItems={4} compact showHeading />
                    </View>
                  ) : null}
                  <ThemedText type="small" style={{ color: theme.accent, marginTop: Spacing.one }}>
                    {t('jobDetail.viewDetails')}
                  </ThemedText>
                </Pressable>
                {!finished && canNavigate(navTarget) ? (
                  <Button
                    title={t('map.navigate')}
                    variant="secondary"
                    onPress={() => void openMapsNavigate(navTarget)}
                  />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    alignItems: 'center',
  },
  notesBlock: { gap: 2, marginTop: Spacing.one },
  stats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  banner: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.two,
  },
});
