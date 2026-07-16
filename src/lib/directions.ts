import { Linking } from 'react-native';

export async function openMapsNavigate(opts: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<void> {
  const { address, latitude, longitude } = opts;
  if (latitude != null && longitude != null) {
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    );
    return;
  }
  if (address?.trim()) {
    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`,
    );
  }
}

export async function openPhoneCall(phone?: string | null): Promise<void> {
  const cleaned = phone?.replace(/[^\d+]/g, '');
  if (!cleaned) return;
  await Linking.openURL(`tel:${cleaned}`);
}

export async function openSms(phone?: string | null): Promise<void> {
  const cleaned = phone?.replace(/[^\d+]/g, '');
  if (!cleaned) return;
  await Linking.openURL(`sms:${cleaned}`);
}

export function canNavigate(opts: {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  return Boolean(
    opts.address?.trim() || (opts.latitude != null && opts.longitude != null),
  );
}
