const FALLBACK_API_BASE_URL = process.env.NEXT_PUBLIC_API_ORIGIN || 'https://aero-2620mit.onrender.com';
const FALLBACK_ADMIN_API_BASE_URL = `${FALLBACK_API_BASE_URL}/api/admin`;

export function getValidUrl(path, baseUrl = FALLBACK_API_BASE_URL) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

export function getAdminApiUrl(endpoint) {
  return getValidUrl(endpoint, `${FALLBACK_ADMIN_API_BASE_URL}/`);
}