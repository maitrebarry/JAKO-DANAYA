// Central API configuration
// Priority:
// 1) Vite build-time env: import.meta.env.VITE_API_URL
// 2) Runtime override (useful on static hosts): window.APP_CONFIG.API_BASE_URL
// 3) Fallback for local development: http://localhost:8085

const RAW_API_BASE = (
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_BASE_URL) ??
  'http://localhost:8085'
) as string;

// Normalise the user-provided base so callers can pass either the origin
// (https://api.example.com) or the full API root (https://api.example.com/api).
const _NORMALISED = RAW_API_BASE.replace(/\/$/, '').replace(/\/api$/i, '');
export const API_BASE = _NORMALISED;
export const API = `${API_BASE}/api`;

/**
 * Helper to build API paths. Always uses `API` (guarantees `/api` is present):
 * withApi('auth/login') => `${API}/auth/login`
 */
export const withApi = (path: string) => `${API}/${path.replace(/^\//, '')}`;

export default { API_BASE, API, withApi };