const FALLBACK_API_BASE_URL = 'https://goh.pythonanywhere.com';
const FALLBACK_ADMIN_API_BASE_URL = `${FALLBACK_API_BASE_URL}/api/admin`;

export function getValidUrl(path, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || FALLBACK_API_BASE_URL) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

export function getAdminApiUrl(endpoint) {
  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_API_BASE || FALLBACK_ADMIN_API_BASE_URL;
  return getValidUrl(endpoint, `${baseUrl.replace(/\/$/, '')}/`);
}