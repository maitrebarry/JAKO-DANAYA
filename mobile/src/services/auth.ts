import { API_BASE_URL } from '../utils/env';

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  id?: number;
  email?: string;
  roles?: string[];
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Erreur de connexion';
    throw new Error(msg);
  }
  return data as LoginResponse;
}

export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Erreur de session';
    throw new Error(msg);
  }
  return data as any;
}

export async function fetchBoutiques(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/boutiques`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error('Erreur lors du chargement des boutiques');
  }
  return Array.isArray(data) ? data : [];
}
