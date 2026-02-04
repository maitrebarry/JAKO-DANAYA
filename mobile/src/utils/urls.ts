import { API_BASE_URL } from './env';

export function resolveMediaUrl(path?: string | null) {
  if (!path) return '';
  const p = String(path);
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (p.startsWith('/')) return API_BASE_URL + p;
  // Bare filename (no slashes) -> assume product image stored in uploads/products
  // e.g. 'abc.jpg' => https://api/.../uploads/products/abc.jpg
  if (!p.includes('/')) return API_BASE_URL + '/uploads/products/' + p;
  // Other relative paths -> prefix API_BASE
  return API_BASE_URL + '/' + p;
}
