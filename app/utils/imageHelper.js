import { API_CONFIG } from '../services/config';
import { api } from '../services/api';

const FALLBACK_API_ORIGIN = 'https://brewing-hub.online';

function resolveApiOrigin() {
  const runtimeApiBase = process.env.EXPO_PUBLIC_API_URL || API_CONFIG?.baseUrl || api?.defaults?.baseURL;
  const baseUrl = String(runtimeApiBase || '').trim().replace(/\/+$/, '');

  if (!baseUrl) {
    return FALLBACK_API_ORIGIN;
  }

  const originMatch = baseUrl.match(/^(https?:\/\/[^/]+)/i);
  return originMatch ? originMatch[1] : baseUrl;
}

export function getImageUrl(path) {
  const rawPath = String(path || '').trim();
  if (!rawPath) {
    return null;
  }

  const apiOrigin = resolveApiOrigin();

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath.replace(/^http:\/\/localhost(?::\d+)?/i, apiOrigin);
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  if (/^\/storage\//i.test(normalizedPath)) {
    return `${apiOrigin}${normalizedPath}`;
  }

  return `${apiOrigin}/storage/${rawPath.replace(/^\/?(?:storage\/)?/i, '')}`;
}
