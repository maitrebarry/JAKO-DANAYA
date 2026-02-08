import { API_BASE_URL } from '../utils/env';

function authHeaders(token: string) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res: Response): Promise<string> {
  const txt = await res.text().catch(() => '');
  if (!txt) return `Erreur réseau (${res.status})`;
  try {
    const j = JSON.parse(txt);
    return j?.message || j?.error || txt;
  } catch {
    return txt;
  }
}

export type UniteDTO = {
  id: number;
  libelle?: string | null;
  symbole?: string | null;
  code?: string | null;
};

export async function listUnites(token: string): Promise<UniteDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/unites`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function createUnite(payload: Partial<UniteDTO> & Record<string, any>, token: string): Promise<UniteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/unites`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateUnite(id: number, payload: Partial<UniteDTO> & Record<string, any>, token: string): Promise<UniteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/unites/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deleteUnite(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/unites/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}
