import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { TripCard } from '@/components/job-cards';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/states';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTranslation } from '@/context/locale';
import { useTheme } from '@/hooks/use-theme';
import { fetchTripHistory } from '@/lib/driver-api';
import { isoDateString } from '@/lib/format';
import type { DriverTripSummary, PaginationMeta } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

type PresetKey = 'today' | 'yesterday' | 'week' | 'month';
type LoadMode = 'initial' | 'refresh' | 'more';

/** Day-list presets in lieu of a native date picker — server caps any range at 31 days. */
function presetRange(key: PresetKey): { from: string; to: string } {
  const today = new Date();
  const to = isoDateString(today);

  if (key === 'today') return { from: to, to };

  if (key === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const value = isoDateString(yesterday);
    return { from: value, to: value };
  }

  const daysBack = key === 'week' ? 6 : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - daysBack);
  return { from: isoDateString(from), to };
}

export default function ScheduleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useAppTranslation();
  const [preset, setPreset] = useState<PresetKey>('week');
  const [trips, setTrips] = useState<DriverTripSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets: { key: PresetKey; label: string }[] = useMemo(
    () => [
      { key: 'today', label: t('history.presetToday') },
      { key: 'yesterday', label: t('history.presetYesterday') },
      { key: 'week', label: t('history.presetWeek') },
      { key: 'month', label: t('history.presetMonth') },
    ],
    [t],
  );

  const loadPage = useCallback(
    async (page: number, mode: LoadMode, activePreset: PresetKey) => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError(null);
      try {
        const response = await fetchTripHistory({ ...presetRange(activePreset), page });
        setTrips((current) => (mode === 'more' ? [...current, ...response.data] : response.data));
        setMeta(response.meta);
      } catch (err) {
        setError(formatApiMessage(err, t('history.unableLoad')));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, 'initial', preset);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadPage, preset]),
  );

  function onSelectPreset(key: PresetKey) {
    if (key === preset) return;
    setPreset(key);
    void loadPage(1, 'initial', key);
  }

  function onRefresh() {
    void loadPage(1, 'refresh', preset);
  }

  function onEndReached() {
    if (loading || loadingMore || refreshing || !meta) return;
    if (meta.current_page >= meta.last_page) return;
    void loadPage(meta.current_page + 1, 'more', preset);
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppHeader
        title={t('nav.schedule')}
        showBell
        onBellPress={() => router.push('/(app)/(tabs)/notifications')}
      />

      <View style={styles.presetRow}>
        {presets.map((item) => {
          const selected = item.key === preset;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelectPreset(item.key)}
              style={[
                styles.presetChip,
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
        <LoadingState label={t('history.loading')} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.content, trips.length === 0 && styles.fill]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            <EmptyState title={t('history.emptyTitle')} message={t('history.emptyMessage')} />
          }
          renderItem={({ item }) => (
            <TripCard trip={item} onPress={() => router.push(`/(app)/trips/${item.id}`)} />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ThemedText themeColor="textSecondary" type="small">
                  {t('history.loadingMore')}
                </ThemedText>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  fill: { flexGrow: 1, justifyContent: 'center' },
  footer: { paddingVertical: Spacing.four, alignItems: 'center' },
});
