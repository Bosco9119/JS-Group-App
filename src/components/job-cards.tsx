import { Pressable, StyleSheet, View } from 'react-native';

import { StatusChip, jobTypeTone, statusTone } from '@/components/status-chip';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { countCompletedStops, formatDateTime, formatTimeRange } from '@/lib/format';
import type { DriverTripSummary, TripStopSummary } from '@/lib/types';
import { statusLabel } from '@/i18n';
import { useAppTranslation } from '@/context/locale';

type TripCardProps = {
  trip: DriverTripSummary;
  onPress: () => void;
};

export function TripCard({ trip, onPress }: TripCardProps) {
  const theme = useTheme();
  const { t } = useAppTranslation();
  const firstStop = trip.stops?.[0];
  const stopProgress = countCompletedStops(trip);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <ThemedText type="smallBold">{trip.trip_no}</ThemedText>
        <StatusChip
          label={statusLabel(t, trip.status, trip.status_label)}
          tone={statusTone(trip.status)}
        />
      </View>
      <ThemedText themeColor="textSecondary" type="small">
        {formatTimeRange(trip.planned_start, trip.planned_end)}
      </ThemedText>
      {firstStop?.job?.customer_name ? (
        <ThemedText type="smallBold">{firstStop.job.customer_name}</ThemedText>
      ) : null}
      {firstStop?.job?.address_text ? (
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
          {firstStop.job.address_text}
        </ThemedText>
      ) : (
        <ThemedText themeColor="textSecondary" type="small">
          {stopProgress.done}/{stopProgress.total} stops
        </ThemedText>
      )}
      {firstStop?.job ? (
        <StatusChip label={firstStop.job.job_type_label} tone={jobTypeTone(firstStop.job.job_type)} />
      ) : null}
    </Pressable>
  );
}

type StopCardProps = {
  stop: TripStopSummary & { tripNo?: string };
  onPress: () => void;
};

export function StopCard({ stop, onPress }: StopCardProps) {
  const theme = useTheme();
  const { t } = useAppTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <ThemedText type="smallBold">{stop.job?.job_no ?? `Stop #${stop.sequence}`}</ThemedText>
        <StatusChip
          label={stop.job?.job_type_label ?? stop.stop_type_label}
          tone={jobTypeTone(stop.job?.job_type)}
        />
      </View>
      <ThemedText themeColor="textSecondary" type="small">
        {formatDateTime(stop.planned_arrival)}
      </ThemedText>
      {stop.job?.customer_name ? <ThemedText type="smallBold">{stop.job.customer_name}</ThemedText> : null}
      {stop.job?.address_text ? (
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={2}>
          {stop.job.address_text}
        </ThemedText>
      ) : null}
      <StatusChip
        label={statusLabel(t, stop.status, stop.status_label)}
        tone={statusTone(stop.status)}
      />
    </Pressable>
  );
}

type MetricProps = {
  label: string;
  value: string | number;
};

export function MetricTile({ label, value }: MetricProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.metric,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <ThemedText type="subtitle" style={{ color: theme.accent, fontSize: 22, lineHeight: 28 }}>
        {value}
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '47%',
    borderWidth: 1,
    borderRadius: Radius,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
