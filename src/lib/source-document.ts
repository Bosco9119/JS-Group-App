import * as LegacyFS from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/lib/config';
import { clearToken, getToken } from '@/lib/token';
import { ApiError } from '@/lib/types';

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
  const url = `${API_BASE_URL}/transport/jobs/${jobId}/source-document.pdf`;

  const result = await LegacyFS.downloadAsync(url, tempUri, {
    headers: {
      Accept: 'application/pdf',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (result.status === 401) {
    await clearToken();
    throw new ApiError('Please sign in again.', 401);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      result.status === 404
        ? 'Document not found for this job.'
        : result.status === 403
          ? 'You are not allowed to view this document.'
          : 'Unable to load document.',
      result.status,
    );
  }

  const fileName = fileNameFromDisposition(
    result.headers?.['Content-Disposition'] ?? result.headers?.['content-disposition'] ?? null,
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
