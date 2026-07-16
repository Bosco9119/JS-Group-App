import { fetch as expoFetch } from 'expo/fetch';
import { File as ExpoFile } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/lib/config';
import { clearToken, getToken } from '@/lib/token';
import { ApiError, type ApiFieldErrors, type LocalImage } from '@/lib/types';

type UnauthorizedHandler = () => void | Promise<void>;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function collectErrorMessages(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  const messages: string[] = [];

  if (record.errors && typeof record.errors === 'object') {
    for (const value of Object.values(record.errors as ApiFieldErrors)) {
      if (Array.isArray(value)) {
        messages.push(...value.filter((item): item is string => typeof item === 'string'));
      }
    }
  }

  if (messages.length === 0 && typeof record.message === 'string') {
    messages.push(record.message);
  }

  return messages;
}

function extractMessage(body: unknown, fallback: string): string {
  const messages = collectErrorMessages(body);
  if (messages.length === 0) return fallback;
  return messages.join('\n');
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = await parseBody(response);

  if (response.status === 401) {
    await clearToken();
    await onUnauthorized?.();
    throw new ApiError(extractMessage(body, 'Please sign in again.'), 401, {}, body);
  }

  if (!response.ok) {
    const errors =
      body && typeof body === 'object' && 'errors' in body
        ? ((body as { errors: ApiFieldErrors }).errors ?? {})
        : {};
    throw new ApiError(
      extractMessage(body, response.status === 403 ? 'You are not allowed to do that.' : 'Request failed.'),
      response.status,
      errors,
      body,
    );
  }

  return body as T;
}

async function authHeaders(extra?: HeadersInit): Promise<Headers> {
  const headers = new Headers(extra);
  headers.set('Accept', 'application/json');
  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export async function apiJson<T>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers: initHeaders, ...rest } = options;
  const headers = await authHeaders(initHeaders);
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (__DEV__) {
    console.log('[api]', rest.method ?? 'GET', path, '→', response.status);
  }

  return handleResponse<T>(response);
}

export async function apiMultipart<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<T> {
  const headers = await authHeaders();
  // Let fetch set multipart boundary — do not set Content-Type manually.

  // Expo SDK 53+ requires expo/fetch for FormData file parts (expo-file-system File).
  const response = await expoFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: headersToRecord(headers),
    body: formData,
  });

  if (__DEV__) {
    console.log('[api]', method, path, '→', response.status);
  }

  return handleResponse<T>(response as unknown as Response);
}

function normalizeMimeType(mimeType: string | null | undefined, fileName: string): string {
  const lowerName = fileName.toLowerCase();
  const raw = (mimeType ?? '').toLowerCase().trim();

  if (raw === 'image/jpg' || raw === 'image/pjpeg') return 'image/jpeg';
  if (raw.startsWith('image/')) return raw;

  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function normalizeFileName(name: string, mimeType: string): string {
  const base = name.trim() || `upload-${Date.now()}`;
  if (/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(base)) {
    return base;
  }

  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : mimeType === 'image/heic' || mimeType === 'image/heif'
            ? 'heic'
            : 'jpg';

  return `${base}.${extension}`;
}

/** Copy picker/content URIs into cache as a real file:// path for Expo File uploads. */
async function toCacheFileUri(uri: string, fileName: string): Promise<string> {
  const cacheDir = LegacyFS.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory is unavailable.');
  }

  const dest = `${cacheDir}upload-${Date.now()}-${fileName}`;
  await LegacyFS.copyAsync({ from: uri, to: dest });
  return dest;
}

/**
 * Append an image so Laravel receives a real uploaded file.
 * Native: expo-file-system File + expo/fetch (RN {uri,name,type} FormData is unsupported).
 * Web: Blob/File via standard fetch.
 */
export async function appendImage(formData: FormData, field: string, image: LocalImage) {
  const mimeType = normalizeMimeType(image.mimeType, image.name);
  const fileName = normalizeFileName(image.name, mimeType);

  if (Platform.OS === 'web') {
    const response = await fetch(image.uri);
    const blob = await response.blob();
    const type = normalizeMimeType(blob.type || mimeType, fileName);
    const file =
      typeof globalThis.File !== 'undefined'
        ? new globalThis.File([blob], fileName, { type })
        : blob;
    formData.append(field, file, fileName);
    return;
  }

  const localUri = await toCacheFileUri(image.uri, fileName);
  const file = new ExpoFile(localUri);
  formData.append(field, file);
}
