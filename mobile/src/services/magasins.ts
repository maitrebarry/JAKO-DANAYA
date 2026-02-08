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

export type MagasinDTO = {
  id: number;
  nom?: string | null;
  nomMagasin?: string | null;
  adresse?: string | null;
  typeMagasin?: string | null;
};

export type StockDTO = {
  id: number;
  quantiteDisponible?: number | null;
  produit?: any;
  produitId?: number | null;
  magasin?: any;
};

export async function listMagasins(token: string): Promise<MagasinDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/magasins`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function listStocksForMagasin(magasinId: number, token: string): Promise<StockDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/magasins/${magasinId}/stocks`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function createMagasin(payload: Partial<MagasinDTO> & Record<string, any>, token: string): Promise<MagasinDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/magasins`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateMagasin(id: number, payload: Partial<MagasinDTO> & Record<string, any>, token: string): Promise<MagasinDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/magasins/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deleteMagasin(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/magasins/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function listBoutiqueStocks(token: string): Promise<StockDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/stocks`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  const all = Array.isArray(json) ? (json as any[]) : [];
  // Align with web: boutique (stock global) = stocks without magasin
  return all.filter((s) => !s?.magasin);
}
