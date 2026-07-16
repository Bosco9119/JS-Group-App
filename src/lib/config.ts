export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
).replace(/\/$/, '');

/** Origin without /api/v1 — used for relative storage URLs. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/i, '');

export function resolveMediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_ORIGIN}${path}`;
}
