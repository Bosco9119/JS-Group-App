import { Alert, Platform } from 'react-native';

import i18n from '@/i18n';
import type { TripStopSummary } from '@/lib/types';

/** Next stop that still needs Start job (clock-in) — records job.started_at / actual_arrival. */
export function nextStartableStop(
  trip: { stops?: TripStopSummary[] } | null | undefined,
): TripStopSummary | null {
  if (!trip?.stops?.length) return null;
  return trip.stops.find((stop) => ['pending', 'en_route'].includes(stop.status)) ?? null;
}

/** Next non-terminal stop (may already be started). */
export function nextOpenStop(
  trip: { stops?: TripStopSummary[] } | null | undefined,
): TripStopSummary | null {
  if (!trip?.stops?.length) return null;
  return (
    trip.stops.find((stop) => !['completed', 'skipped', 'failed'].includes(stop.status)) ?? null
  );
}

export function confirmStartNextJobDialog(stop: TripStopSummary): Promise<boolean> {
  const jobLabel = stop.job?.job_no ?? `#${stop.sequence}`;
  const customer = stop.job?.customer_name ? ` — ${stop.job.customer_name}` : '';
  const title = i18n.t('stops.startNextTitle');
  const message = i18n.t('stops.startNextBody', { job: `${jobLabel}${customer}` });

  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false,
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: i18n.t('stops.startNextLater'), style: 'cancel', onPress: () => resolve(false) },
      { text: i18n.t('stops.startNextNow'), onPress: () => resolve(true) },
    ]);
  });
}
