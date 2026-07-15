import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { StatusChip, jobTypeTone, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel } from '@/i18n';
import { clockInTrip, clockOutTrip, fetchTrip } from '@/lib/driver-api';
import { formatTimeRange, vehicleLabel } from '@/lib/format';
import { confirmEndTripDialog, tripReadyToEnd } from '@/lib/trip-complete';
import type { DriverTripSummary } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

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
          () => router.replace('/(app)/(tabs)/jobs'),
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
      setError(formatApiMessage(err, t('trips.unableStart')));
    } finally {
      setStarting(false);
    }
  }

  async function onEndTripPress() {
    if (!trip) return;
    await endTripAfterConfirm(trip);
  }

  async function openNavigate(address?: string | null) {
    if (!address) return;
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    );
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

          <View style={styles.chipRow}>
            <StatusChip
              label={statusLabel(t, trip.status, trip.status_label)}
              tone={statusTone(trip.status)}
            />
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText type="smallBold">{trip.trip_no}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {vehicleLabel(trip.vehicle)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {t('trips.planned', {
                date: trip.planned_date ?? '',
                start: trip.planned_start ? ` ${trip.planned_start}` : '',
                end: trip.planned_end ? `–${trip.planned_end}` : '',
              })}
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {formatTimeRange(trip.planned_start, trip.planned_end)}
            </ThemedText>
            <View style={styles.stats}>
              <Stat label={t('home.distance')} value="—" />
              <Stat
                label={t('trips.stops')}
                value={`${trip.stops_completed_count}/${trip.stops_count}`}
              />
            </View>
          </View>

          {trip.can_clock_in ? (
            <Button title={t('trips.startTrip')} loading={starting} onPress={() => void onStartTrip()} />
          ) : null}

          {tripReadyToEnd(trip) ? (
            <Button title={t('trips.endTrip')} loading={ending} onPress={() => void onEndTripPress()} />
          ) : null}

          {trip.status !== 'in_progress' && !trip.can_clock_in ? (
            <ThemedText themeColor="textSecondary">
              {t('trips.cannotStart', {
                status: statusLabel(t, trip.status, trip.status_label),
              })}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">{t('trips.stops')}</ThemedText>
          {(trip.stops ?? []).map((stop) => (
            <Pressable
              key={stop.id}
              onPress={() => {
                if (trip.status !== 'in_progress') {
                  showInfo(t('trips.notStartedTitle'), t('trips.notStartedBody'), t('common.ok'));
                  return;
                }
                router.push(`/(app)/stops/${stop.id}?tripId=${trip.id}`);
              }}
              style={[
                styles.card,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <View style={styles.row}>
                <ThemedText type="smallBold">
                  #{stop.sequence} · {stop.job?.job_no ?? stop.stop_type_label}
                </ThemedText>
                <StatusChip
                  label={stop.job?.job_type_label ?? stop.stop_type_label}
                  tone={jobTypeTone(stop.job?.job_type)}
                />
              </View>
              {stop.job?.customer_name ? (
                <ThemedText type="small">{stop.job.customer_name}</ThemedText>
              ) : null}
              {stop.job?.address_text ? (
                <ThemedText themeColor="textSecondary" type="small">
                  {stop.job.address_text}
                </ThemedText>
              ) : null}
              <StatusChip
                label={statusLabel(t, stop.status, stop.status_label)}
                tone={statusTone(stop.status)}
              />
            </Pressable>
          ))}

          {trip.stops?.[0]?.job?.address_text ? (
            <Button
              title={t('map.navigate')}
              variant="secondary"
              onPress={() => void openNavigate(trip.stops?.[0]?.job?.address_text)}
            />
          ) : null}
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
  chipRow: { flexDirection: 'row', gap: Spacing.two },
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
  stats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
});
