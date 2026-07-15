import type { DriverTripSummary, TripStopSummary } from '@/lib/types';

export type HomeMetrics = {
  assigned: number;
  completed: number;
  inProgress: number;
};

export function computeHomeMetrics(trips: DriverTripSummary[]): HomeMetrics {
  let assigned = 0;
  let completed = 0;
  let inProgress = 0;

  for (const trip of trips) {
    if (trip.status === 'planned') assigned += 1;
    if (trip.status === 'in_progress') inProgress += 1;
    if (trip.status === 'completed') completed += 1;
  }

  return { assigned, completed, inProgress };
}

export function nextActionableTrip(trips: DriverTripSummary[]): DriverTripSummary | null {
  return (
    trips.find((trip) => trip.status === 'in_progress') ??
    trips.find((trip) => trip.status === 'planned') ??
    trips[0] ??
    null
  );
}

export function nextPendingStop(trip: DriverTripSummary | null): TripStopSummary | null {
  if (!trip?.stops?.length) return null;
  return (
    trip.stops.find((stop) => !['completed', 'skipped', 'failed'].includes(stop.status)) ?? null
  );
}

export function flattenStops(
  trips: DriverTripSummary[],
): Array<TripStopSummary & { tripId: number; tripNo: string; tripStatus: string }> {
  const rows: Array<TripStopSummary & { tripId: number; tripNo: string; tripStatus: string }> = [];
  for (const trip of trips) {
    for (const stop of trip.stops ?? []) {
      rows.push({
        ...stop,
        tripId: trip.id,
        tripNo: trip.trip_no,
        tripStatus: trip.status,
      });
    }
  }
  return rows;
}
