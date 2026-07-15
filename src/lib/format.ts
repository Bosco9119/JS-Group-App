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

export function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '—';
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? '—';
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
