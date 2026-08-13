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

export type BoutiqueDTO = {
  id: number;
  nom?: string | null;
  quartier?: string | null;
  adresse?: string | null;
  indicatif?: string | null;
  logo?: string | null;
  optionRevendeur?: boolean | null;
  pays?: {
    id?: number;
    codeIso?: string | null;
    indicatif?: string | null;
    deviseSymbole?: string | null;
    deviseCode?: string | null;
  } | null;
};

export async function listBoutiques(token: string): Promise<BoutiqueDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/boutiques`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function getBoutiqueById(id: number, token: string): Promise<BoutiqueDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/boutiques/${id}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateBoutique(
  id: number,
  payload: { nom: string; quartier: string; adresse: string; indicatif?: string | null; codePays?: string | null; logoFile?: any },
  token: string
): Promise<BoutiqueDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/boutiques/${id}`;
  const fd = new FormData();
  fd.append('nom', payload.nom);
  fd.append('quartier', payload.quartier);
  fd.append('adresse', payload.adresse);
  if (payload.indicatif != null) fd.append('indicatif', String(payload.indicatif));
  if (payload.codePays != null) fd.append('codePays', String(payload.codePays));
  if (payload.logoFile) fd.append('logo', payload.logoFile);

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: fd,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function createBoutique(
  payload: { nom: string; quartier: string; adresse: string; indicatif?: string | null; codePays?: string | null; logoFile?: any },
  token: string
): Promise<BoutiqueDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/boutiques`;
  const fd = new FormData();
  fd.append('nom', payload.nom);
  fd.append('quartier', payload.quartier);
  fd.append('adresse', payload.adresse);
  if (payload.indicatif != null) fd.append('indicatif', String(payload.indicatif));
  if (payload.codePays != null) fd.append('codePays', String(payload.codePays));
  if (payload.logoFile) fd.append('logo', payload.logoFile);

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: fd,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deleteBoutique(id: number, confirmation: string, token: string): Promise<any> {
  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/api/boutiques/${id}?confirmation=${encodeURIComponent(confirmation)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Suppression impossible (${res.status})`);
  }
  return data;
}
