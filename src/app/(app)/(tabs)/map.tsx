import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { StatusChip, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel } from '@/i18n';
import { fetchTrips } from '@/lib/driver-api';
import { nextActionableTrip, nextPendingStop } from '@/lib/trip-metrics';
import type { DriverTripSummary } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [trips, setTrips] = useState<DriverTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTrips(await fetchTrips());
    } catch (err) {
      setError(formatApiMessage(err, t('trips.unableLoad')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const trip = useMemo(() => nextActionableTrip(trips), [trips]);
  const nextStop = useMemo(() => nextPendingStop(trip), [trip]);
  const stops = trip?.stops ?? [];

  async function openMaps(address?: string | null) {
    if (!address) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    await Linking.openURL(url);
  }

  async function callPhone(phone?: string | null) {
    if (!phone) return;
    await Linking.openURL(`tel:${phone}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={trip?.trip_no ?? t('nav.map')}
        showBack={false}
        showBell
        onBellPress={() => router.push('/(app)/(tabs)/notifications')}
      />
      {loading ? (
        <LoadingState label={t('trips.loading')} />
      ) : (
        <View style={styles.body}>
          {error ? <ErrorBanner message={error} /> : null}
          <View style={[styles.mapFake, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="map" size={48} color={theme.accent} />
            <ThemedText themeColor="textSecondary" type="small" style={{ textAlign: 'center' }}>
              {t('map.placeholder')}
            </ThemedText>
            {stops.map((stop, index) => (
              <View
                key={stop.id}
                style={[
                  styles.marker,
                  {
                    left: `${18 + index * 22}%`,
                    top: `${28 + (index % 3) * 18}%`,
                    backgroundColor: theme.accent,
                  },
                ]}
              >
                <ThemedText style={styles.markerText}>{stop.sequence}</ThemedText>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            {!nextStop ? (
              <EmptyState title={t('map.noNextStop')} message={t('map.noNextStopBody')} />
            ) : (
              <>
                <ThemedText type="smallBold">{t('home.nextStop')}</ThemedText>
                <ThemedText>{nextStop.job?.customer_name ?? nextStop.stop_type_label}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {nextStop.job?.address_text ?? '—'}
                </ThemedText>
                <StatusChip
                  label={statusLabel(t, nextStop.status, nextStop.status_label)}
                  tone={statusTone(nextStop.status)}
                />
                <View style={styles.actions}>
                  <Button
                    title={t('map.call')}
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => void callPhone(nextStop.job?.contact_no)}
                  />
                  <Button
                    title={t('map.navigate')}
                    style={{ flex: 1 }}
                    onPress={() => void openMaps(nextStop.job?.address_text)}
                  />
                </View>
                {trip ? (
                  <Button
                    title={t('map.openTrip')}
                    variant="ghost"
                    onPress={() => router.push(`/(app)/trips/${trip.id}`)}
                  />
                ) : null}
              </>
            )}

            <Pressable onPress={() => setExpanded((v) => !v)} style={styles.expand}>
              <ThemedText type="smallBold">{t('map.stopList')}</ThemedText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.text}
              />
            </Pressable>
            {expanded
              ? stops.map((stop) => (
                  <View key={stop.id} style={styles.stopRow}>
                    <ThemedText type="small">
                      #{stop.sequence} {stop.job?.job_no ?? stop.stop_type_label}
                    </ThemedText>
                    <StatusChip
                      label={statusLabel(t, stop.status, stop.status_label)}
                      tone={statusTone(stop.status)}
                    />
                  </View>
                ))
              : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  mapFake: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: Radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '48%',
  },
  actions: { flexDirection: 'row', gap: Spacing.two },
  expand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  stopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
