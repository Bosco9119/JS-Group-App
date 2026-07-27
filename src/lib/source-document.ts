import * as LegacyFS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/lib/config';
import { clearToken, getToken } from '@/lib/token';
import { ApiError } from '@/lib/types';
import i18n from '@/i18n';

export type CachedSourceDocument = {
  fileUri: string;
  fileName: string;
  /** Prefer for WebView (Android content:// when available). */
  viewUri: string;
};

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return sanitizeFileName(fallback);
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return sanitizeFileName(decodeURIComponent(utfMatch[1].trim()));
    } catch {
      return sanitizeFileName(utfMatch[1].trim());
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  if (plainMatch?.[1]) return sanitizeFileName(plainMatch[1].trim());
  return sanitizeFileName(fallback);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Download DO/RRI PDF with Bearer auth into cache.
 * Remote URLs cannot be loaded in WebView (no Authorization header).
 */
export async function fetchSourceDocumentToCache(
  jobId: number,
  documentNo?: string | null,
): Promise<CachedSourceDocument> {
  const cacheDir = LegacyFS.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Cache directory is unavailable.');
  }

  const token = await getToken();
  const fallbackName = documentNo?.trim() || `job-${jobId}-document`;
  const tempUri = `${cacheDir}job-${jobId}-source-document.pdf`;
  const path = `/transport/jobs/${jobId}/source-document.pdf`;
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (__DEV__) {
    console.log('[api]', 'GET', path, '→', response.status);
  }

  if (response.status === 401) {
    await clearToken();
    throw new ApiError('Please sign in again.', 401);
  }

  if (!response.ok) {
    const bodyText = await response.text();
    let serverMessage = '';
    try {
      const json = JSON.parse(bodyText) as { message?: string };
      if (typeof json.message === 'string') serverMessage = json.message.trim();
    } catch {
      // ignore
    }

    const routeMissing =
      /route .* could not be found/i.test(serverMessage) ||
      /source-document\.pdf could not be found/i.test(serverMessage);

    const fallback = routeMissing
      ? i18n.t('document.routeMissing')
      : response.status === 404
        ? i18n.t('document.notFound')
        : response.status === 403
          ? i18n.t('document.forbidden')
          : i18n.t('document.unableLoad');

    throw new ApiError(serverMessage && !routeMissing ? serverMessage : fallback, response.status);
  }

  const buffer = await response.arrayBuffer();
  await LegacyFS.writeAsStringAsync(tempUri, arrayBufferToBase64(buffer), {
    encoding: LegacyFS.EncodingType.Base64,
  });

  const fileName = fileNameFromDisposition(
    response.headers.get('Content-Disposition') ?? response.headers.get('content-disposition'),
    fallbackName,
  );
  const fileUri = `${cacheDir}${fileName}`;
  if (fileUri !== tempUri) {
    try {
      await LegacyFS.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // ignore
    }
    await LegacyFS.moveAsync({ from: tempUri, to: fileUri });
  }

  let viewUri = fileUri;
  if (Platform.OS === 'android') {
    try {
      viewUri = await LegacyFS.getContentUriAsync(fileUri);
    } catch {
      viewUri = fileUri;
    }
  }

  return { fileUri, fileName, viewUri };
}
