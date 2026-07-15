import { Alert, Platform } from 'react-native';

import i18n from '@/i18n';
import { clockOutTrip } from '@/lib/driver-api';
import type { DriverTripSummary } from '@/lib/types';
import { formatApiMessage } from '@/lib/utils';

export function tripReadyToEnd(trip: DriverTripSummary | null | undefined): boolean {
  if (!trip || trip.status !== 'in_progress') {
    return false;
  }
  if (typeof trip.can_clock_out === 'boolean') {
    return trip.can_clock_out;
  }
  return Boolean(trip.all_stops_done);
}

/** Ask the driver to confirm ending the trip. Does not call the API. */
export function confirmEndTripDialog(trip: DriverTripSummary): Promise<boolean> {
  const title = i18n.t('trips.completedDialogTitle');
  const message = i18n.t('trips.completedDialogBody', { tripNo: trip.trip_no });

  if (Platform.OS === 'web') {
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false,
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
      { text: i18n.t('common.ok'), onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Confirm, then clock out. Returns updated trip, or null if cancelled.
 */
export async function confirmAndEndTrip(trip: DriverTripSummary): Promise<DriverTripSummary | null> {
  if (!tripReadyToEnd(trip)) {
    throw new Error(i18n.t('trips.unableEnd'));
  }

  const confirmed = await confirmEndTripDialog(trip);
  if (!confirmed) {
    return null;
  }

  try {
    return await clockOutTrip(trip.id);
  } catch (err) {
    throw new Error(formatApiMessage(err, i18n.t('trips.unableEnd')));
  }
}
