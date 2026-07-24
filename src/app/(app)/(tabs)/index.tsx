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
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel } from '@/i18n';
import { fetchTrips } from '@/lib/driver-api';
import { greetingKey } from '@/lib/format';
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
  const tripDone = nextTrip?.status === 'completed';
  const tripHeading =
    tripDone
      ? t('home.todayTrip')
      : nextTrip?.status === 'in_progress'
        ? t('home.currentJob')
        : t('home.nextJob');

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
        <ThemedText type="subtitle" style={styles.greeting}>
          {greeting}, {driver?.name ?? 'Driver'}
        </ThemedText>

        {error ? <ErrorBanner message={error} /> : null}

        <ThemedText type="smallBold">{t('home.overview')}</ThemedText>
        <View style={styles.metrics}>
          <MetricTile label={t('home.inProgress')} value={metrics.inProgress} />
          <MetricTile label={t('home.completed')} value={metrics.completed} />
          <MetricTile label={t('home.assigned')} value={metrics.assigned} />
        </View>

        {nextTrip ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">{tripHeading}</ThemedText>
            <TripCard trip={nextTrip} onPress={() => router.push(`/(app)/trips/${nextTrip.id}`)} />
            {tripDone ? (
              <ThemedText themeColor="textSecondary" type="small">
                {t('home.allStopsDone')}
              </ThemedText>
            ) : null}
          </View>
        ) : (
          <EmptyState title={t('trips.emptyTitle')} message={t('trips.emptyMessage')} />
        )}

        {nextTrip?.stops?.length ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">
              {tripDone ? t('home.stops') : t('home.upcomingStops')}
            </ThemedText>
            {nextTrip.stops.slice(0, 4).map((stop) => {
              const isNext = !tripDone && nextStop?.id === stop.id;
              return (
                <Pressable
                  key={stop.id}
                  onPress={() => router.push(`/(app)/stops/${stop.id}?tripId=${nextTrip.id}`)}
                  style={[
                    styles.timelineItem,
                    {
                      borderLeftColor: isNext ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <View style={styles.timelineRow}>
                    <ThemedText type="smallBold" style={{ flex: 1 }}>
                      #{stop.sequence} · {stop.job?.job_no ?? stop.stop_type_label}
                      {isNext ? ` · ${t('home.nextStop')}` : ''}
                    </ThemedText>
                    <StatusChip
                      label={statusLabel(t, stop.status, stop.status_label)}
                      tone={statusTone(stop.status)}
                    />
                  </View>
                  {stop.job?.customer_name ? (
                    <ThemedText type="small">{stop.job.customer_name}</ThemedText>
                  ) : null}
                  <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
                    {stop.job?.address_text ?? '—'}
                  </ThemedText>
                </Pressable>
              );
            })}
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
  greeting: { fontSize: 22, lineHeight: 28 },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: { gap: Spacing.two },
  timelineItem: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: 2,
    marginBottom: Spacing.two,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
