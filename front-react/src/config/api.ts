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

export const API_BASE = RAW_API_BASE.replace(/\/$/, '');
export const API = `${API_BASE}/api`;

/**
 * Helper to build origin-relative paths: withApi('users/me') => `${API_BASE}/users/me`
 */
export const withApi = (path: string) => `${API_BASE}/${path.replace(/^\//, '')}`;

export default { API_BASE, API, withApi };