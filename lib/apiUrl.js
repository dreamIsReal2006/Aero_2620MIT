const FALLBACK_API_BASE_URL = 'https://aero.example.com';

export function getValidUrl(path, baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || FALLBACK_API_BASE_URL) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}