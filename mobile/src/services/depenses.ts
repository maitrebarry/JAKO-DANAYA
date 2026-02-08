import { API_BASE_URL } from '../utils/env';

export type DepenseDTO = {
  id: number;
  reference?: string;
  libelle?: string;
  note?: string;
  montant?: number;
  status?: string;
  boutiqueId?: number;
  referenceCaisse?: string;
  createdAt?: string;
  deviseSymbole?: string;
};

export type DepensePayload = {
  reference?: string | null;
  libelle?: string | null;
  note?: string | null;
  montant: number;
  date?: string | null;
  referenceCaisse?: string | null;
};

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

export async function listDepenses(opts: { boutiqueId?: number; status?: string; token: string }): Promise<DepenseDTO[]> {
  const params = new URLSearchParams();
  if (opts.boutiqueId) params.append('boutiqueId', String(opts.boutiqueId));
  if (opts.status) params.append('status', opts.status);

  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(opts.token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur depenses (${res.status})`);
  }
  const json = await res.json();
  return Array.isArray(json) ? (json as DepenseDTO[]) : [];
}

export async function getDepense(id: number, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur depense (${res.status})`);
  }
  return res.json();
}

export async function createDepense(payload: DepensePayload, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}

export async function updateDepense(id: number, payload: DepensePayload, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}

export async function deleteDepense(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function validateDepense(id: number, opts: { referenceCaisse: string }, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}/validate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ referenceCaisse: opts.referenceCaisse }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}

export async function rejectDepense(id: number, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}/reject`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}

export async function cancelDepense(id: number, opts: { reason?: string }, token: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/depenses/${id}/cancel`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ reason: opts.reason || 'Annulation dépense' }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json().catch(() => ({}));
}
