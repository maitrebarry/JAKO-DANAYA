import { API_BASE_URL } from '../utils/env';

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}/api/${path.replace(/^\//, '')}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  return res.json();
}
