import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { TripCard } from '@/components/job-cards';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { fetchTrips } from '@/lib/driver-api';
import type { DriverTripSummary } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

type Filter = 'all' | 'assigned' | 'in_progress' | 'completed';

export default function JobsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [trips, setTrips] = useState<DriverTripSummary[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
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

  const filtered = useMemo(() => {
    if (filter === 'all') return trips;
    if (filter === 'assigned') return trips.filter((trip) => trip.status === 'planned');
    if (filter === 'in_progress') return trips.filter((trip) => trip.status === 'in_progress');
    return trips.filter((trip) => trip.status === 'completed');
  }, [filter, trips]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('jobs.filterAll') },
    { key: 'assigned', label: t('jobs.filterAssigned') },
    { key: 'in_progress', label: t('jobs.filterInProgress') },
    { key: 'completed', label: t('jobs.filterCompleted') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader title={t('nav.jobs')} />
      <View style={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? theme.accent : theme.backgroundElement,
                  borderColor: selected ? theme.accent : theme.border,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: selected ? '#fff' : theme.text, fontWeight: '600' }}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <LoadingState label={t('trips.loading')} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, filtered.length === 0 && styles.fill]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          {error ? <ErrorBanner message={error} /> : null}
          {filtered.length === 0 ? (
            <EmptyState title={t('trips.emptyTitle')} message={t('trips.emptyMessage')} />
          ) : (
            filtered.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() => router.push(`/(app)/trips/${trip.id}`)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  fill: { flexGrow: 1, justifyContent: 'center' },
});
