export function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function greetingKey(date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Parse API date/time (ISO, date-only, or HH:mm[:ss]) into a Date when possible. */
function parseApiDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [hours, minutes, seconds = '0'] = trimmed.split(':');
    const date = new Date();
    date.setHours(Number(hours), Number(minutes), Number(seconds), 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** HH:mm in local time (strips +00:00 / seconds noise). */
export function formatTime(value?: string | null): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    return `${pad2(Number(hours))}:${pad2(Number(minutes))}`;
  }

  const date = parseApiDate(trimmed);
  if (!date) return trimmed;
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** e.g. 15 Jul 2026 */
export function formatDate(value?: string | null): string {
  if (!value?.trim()) return '—';
  const date = parseApiDate(value);
  if (!date) return value.trim();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** e.g. 15 Jul 2026, 09:20 — never raw ISO with +00:00 */
export function formatDateTime(value?: string | null): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();

  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return formatTime(trimmed);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return formatDate(trimmed);
  }

  const date = parseApiDate(trimmed);
  if (!date) return trimmed;

  return `${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  if (start && end) return `${formatTime(start)} – ${formatTime(end)}`;
  return formatTime(start ?? end);
}

export function vehicleLabel(vehicle?: {
  car_plate?: string | null;
  brand?: string | null;
  model?: string | null;
  vehicle_code?: string | null;
} | null): string {
  if (!vehicle) return '—';
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  if (vehicle.car_plate && model) return `${vehicle.car_plate} · ${model}`;
  return vehicle.car_plate || model || vehicle.vehicle_code || '—';
}

/** Count only fully completed stops — arrived is still in progress. */
export function countCompletedStops(trip: {
  stops?: Array<{ status: string }> | null;
  stops_completed_count?: number;
  stops_count?: number;
}): { done: number; total: number } {
  const stops = trip.stops ?? [];
  const total = trip.stops_count ?? stops.length;
  if (stops.length) {
    return {
      done: stops.filter((stop) => stop.status === 'completed').length,
      total,
    };
  }
  return { done: trip.stops_completed_count ?? 0, total };
}
