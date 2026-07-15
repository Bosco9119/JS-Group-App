import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { MetricTile, TripCard } from '@/components/job-cards';
import { StatusChip, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { useOnline } from '@/context/online';
import { useTheme } from '@/hooks/use-theme';
import { fetchTrips } from '@/lib/driver-api';
import { formatTimeRange, greetingKey } from '@/lib/format';
import {
  computeHomeMetrics,
  nextActionableTrip,
  nextPendingStop,
} from '@/lib/trip-metrics';
import type { DriverTripSummary } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const { driver } = useAuth();
  const { online } = useOnline();
  const [trips, setTrips] = useState<DriverTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setTrips(await fetchTrips());
      } catch (err) {
        setError(formatApiMessage(err, t('trips.unableLoad')));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const metrics = useMemo(() => computeHomeMetrics(trips), [trips]);
  const nextTrip = useMemo(() => nextActionableTrip(trips), [trips]);
  const nextStop = useMemo(() => nextPendingStop(nextTrip), [nextTrip]);
  const greeting = t(`home.greeting.${greetingKey()}`);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <AppHeader
          title={t('nav.home')}
          showBell
          onBellPress={() => router.push('/(app)/(tabs)/notifications')}
        />
        <LoadingState label={t('trips.loading')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={t('nav.home')}
        showBell
        onBellPress={() => router.push('/(app)/(tabs)/notifications')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" style={styles.greeting}>
              {greeting}, {driver?.name ?? 'Driver'}
            </ThemedText>
          </View>
          <StatusChip
            label={online ? t('nav.online') : t('nav.offline')}
            tone={online ? 'success' : 'neutral'}
          />
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        <ThemedText type="smallBold">{t('home.overview')}</ThemedText>
        <View style={styles.metrics}>
          <MetricTile label={t('home.assigned')} value={metrics.assigned} />
          <MetricTile label={t('home.completed')} value={metrics.completed} />
          <MetricTile label={t('home.inProgress')} value={metrics.inProgress} />
          <MetricTile label={t('home.distance')} value="—" />
        </View>

        {nextTrip ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">{t('home.nextJob')}</ThemedText>
            <TripCard trip={nextTrip} onPress={() => router.push(`/(app)/trips/${nextTrip.id}`)} />
            {nextStop ? (
              <View
                style={[
                  styles.nextStop,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}
              >
                <ThemedText type="smallBold">{t('home.nextStop')}</ThemedText>
                <ThemedText type="small">{nextStop.job?.customer_name ?? nextStop.stop_type_label}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {nextStop.job?.address_text ?? '—'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {formatTimeRange(nextTrip.planned_start, nextTrip.planned_end)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState title={t('trips.emptyTitle')} message={t('trips.emptyMessage')} />
        )}

        {nextTrip?.stops?.length ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">{t('home.upcomingStops')}</ThemedText>
            {nextTrip.stops.slice(0, 4).map((stop) => (
              <Pressable
                key={stop.id}
                onPress={() => {
                  if (nextTrip.status !== 'in_progress') return;
                  router.push(`/(app)/stops/${stop.id}?tripId=${nextTrip.id}`);
                }}
                style={[styles.timelineItem, { borderLeftColor: theme.accent }]}
              >
                <ThemedText type="smallBold">
                  #{stop.sequence} · {stop.job?.job_no ?? stop.stop_type_label}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  {stop.job?.address_text ?? stop.status_label}
                </ThemedText>
                <StatusChip label={stop.status_label} tone={statusTone(stop.status)} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  greeting: { fontSize: 22, lineHeight: 28 },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: { gap: Spacing.two },
  nextStop: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  timelineItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.three,
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
});
