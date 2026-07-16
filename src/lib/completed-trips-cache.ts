import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DriverTripSummary } from '@/lib/types';

const STORAGE_KEY = 'trips.completed.local';

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function tripDay(trip: DriverTripSummary): string | null {
  if (trip.planned_date) return trip.planned_date.slice(0, 10);
  if (trip.actual_end) return trip.actual_end.slice(0, 10);
  if (trip.actual_start) return trip.actual_start.slice(0, 10);
  return null;
}

async function readAll(): Promise<DriverTripSummary[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DriverTripSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(trips: DriverTripSummary[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

/** Keep a clocked-out trip so Jobs/Home can still show it as Completed today. */
export async function rememberCompletedTrip(trip: DriverTripSummary): Promise<void> {
  const completed: DriverTripSummary = {
    ...trip,
    status: 'completed',
    status_label: trip.status_label || 'Completed',
    can_clock_in: false,
    can_clock_out: false,
    all_stops_done: true,
  };
  const existing = await readAll();
  const today = todayKey();
  const next = existing
    .filter((item) => item.id !== completed.id)
    .filter((item) => tripDay(item) === today);
  next.unshift(completed);
  await writeAll(next);
}

export async function getCachedCompletedTrip(tripId: number): Promise<DriverTripSummary | null> {
  const today = todayKey();
  const cached = (await readAll()).filter((item) => tripDay(item) === today);
  return cached.find((item) => item.id === tripId) ?? null;
}

/**
 * Inbox API omits completed trips. Merge today's locally remembered completed
 * trips into the list (API rows win on id conflict).
 */
export async function mergeInboxWithCompletedCache(
  apiTrips: DriverTripSummary[],
): Promise<DriverTripSummary[]> {
  const today = todayKey();
  const cached = (await readAll()).filter((item) => tripDay(item) === today);

  // Keep cache only for trips the API no longer returns (true for completed inbox gap).
  const stillUseful = cached.filter((item) => !apiTrips.some((api) => api.id === item.id));
  await writeAll(stillUseful);

  const byId = new Map<number, DriverTripSummary>();
  for (const trip of stillUseful) {
    byId.set(trip.id, trip);
  }
  for (const trip of apiTrips) {
    byId.set(trip.id, trip);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aKey = a.planned_start ?? a.trip_no;
    const bKey = b.planned_start ?? b.trip_no;
    return String(aKey).localeCompare(String(bKey));
  });
}
