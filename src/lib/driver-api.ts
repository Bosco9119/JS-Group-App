import { apiJson, apiMultipart, appendImage } from '@/lib/api';
import type {
  DriverTripSummary,
  LocalImage,
  LoginResponse,
  MeResponse,
  ProofPhoto,
} from '@/lib/types';

export async function login(email: string, password: string) {
  return apiJson<LoginResponse>('/auth/login', {
    method: 'POST',
    json: { email, password },
  });
}

export async function logout() {
  return apiJson<{ message: string }>('/auth/logout', { method: 'POST' });
}

export async function fetchMe() {
  return apiJson<MeResponse>('/auth/me');
}

export async function fetchTrips() {
  const response = await apiJson<{ data: DriverTripSummary[] }>('/transport/trips');
  return response.data;
}

export async function fetchTrip(tripId: number) {
  const response = await apiJson<{ data: DriverTripSummary }>(`/transport/trips/${tripId}`);
  return response.data;
}

export async function clockInTrip(tripId: number) {
  const response = await apiJson<{ data: DriverTripSummary }>(`/transport/trips/${tripId}/clock-in`, {
    method: 'POST',
  });
  return response.data;
}

export async function clockOutTrip(tripId: number) {
  const response = await apiJson<{ data: DriverTripSummary }>(`/transport/trips/${tripId}/clock-out`, {
    method: 'POST',
  });
  return response.data;
}

export async function clockInStop(stopId: number) {
  return apiJson<{
    data: {
      stop: { id: number; status: string; status_label: string; actual_arrival: string | null };
      job: { id: number; job_no: string; status: string; status_label: string; started_at: string | null };
    };
  }>(`/transport/stops/${stopId}/clock-in`, { method: 'POST' });
}

export type CompleteStopInput = {
  photos: LocalImage[];
  signature?: LocalImage | null;
  proofReceivedBy?: string;
  notes?: string;
  clientUuid?: string;
  latitude?: number | null;
  longitude?: number | null;
  takenAt?: string;
};

export async function completeStop(stopId: number, input: CompleteStopInput) {
  const formData = new FormData();
  for (let index = 0; index < input.photos.length; index += 1) {
    await appendImage(formData, `photos[${index}]`, input.photos[index]);
  }
  if (input.signature) {
    await appendImage(formData, 'signature', input.signature);
  }
  if (input.proofReceivedBy) formData.append('proof_received_by', input.proofReceivedBy);
  if (input.notes) formData.append('notes', input.notes);
  if (input.clientUuid) formData.append('client_uuid', input.clientUuid);
  if (input.takenAt) formData.append('taken_at', input.takenAt);
  if (input.latitude != null) formData.append('latitude', String(input.latitude));
  if (input.longitude != null) formData.append('longitude', String(input.longitude));
  formData.append('source', 'mobile');

  return apiMultipart(`/transport/stops/${stopId}/complete`, formData);
}

export async function fetchProofPhotos(jobId: number) {
  const response = await apiJson<{ data: ProofPhoto[] }>(`/transport/jobs/${jobId}/proof-photos`);
  return response.data;
}

export async function uploadProofPhotos(
  jobId: number,
  photos: LocalImage[],
  extras?: {
    caption?: string;
    clientUuid?: string;
    latitude?: number | null;
    longitude?: number | null;
    driverTripId?: number;
    tripStopId?: number;
  },
) {
  const formData = new FormData();
  for (let index = 0; index < photos.length; index += 1) {
    await appendImage(formData, `photos[${index}]`, photos[index]);
  }
  formData.append('source', 'mobile');
  if (extras?.caption) formData.append('caption', extras.caption);
  if (extras?.clientUuid) formData.append('client_uuid', extras.clientUuid);
  if (extras?.latitude != null) formData.append('latitude', String(extras.latitude));
  if (extras?.longitude != null) formData.append('longitude', String(extras.longitude));
  if (extras?.driverTripId != null) formData.append('driver_trip_id', String(extras.driverTripId));
  if (extras?.tripStopId != null) formData.append('trip_stop_id', String(extras.tripStopId));

  const response = await apiMultipart<{ data: ProofPhoto[] }>(
    `/transport/jobs/${jobId}/proof-photos`,
    formData,
  );
  return response.data;
}

export async function deleteProofPhoto(jobId: number, photoId: number) {
  return apiJson<{ message: string }>(`/transport/jobs/${jobId}/proof-photos/${photoId}`, {
    method: 'DELETE',
  });
}
