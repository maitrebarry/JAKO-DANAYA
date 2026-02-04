import { API_BASE_URL } from './env';

export function resolveMediaUrl(path?: string | null) {
  if (!path) return '';
  const p = String(path);
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (p.startsWith('/')) return API_BASE_URL + p;
  // Bare filename (no slashes) -> assume product image stored in uploads/products
  // e.g. 'abc.jpg' => https://api/.../uploads/products/abc.jpg
  if (!p.includes('/')) return API_BASE_URL + '/api/uploads/products/' + p;
  // Other relative paths -> if starts with /uploads, route through /api to be handled by backend
  if (p.startsWith('/uploads')) return API_BASE_URL + '/api' + p;
  return API_BASE_URL + '/' + p;
}
