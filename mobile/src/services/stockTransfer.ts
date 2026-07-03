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

export type LocationTransferItem = {
  produitId: number;
  quantite?: number;
  quantiteConditionnement?: number;
};

export type LocationTransferRequest = {
  sourceType: 'BOUTIQUE' | 'MAGASIN';
  sourceId: number;
  destType: 'BOUTIQUE' | 'MAGASIN';
  destId: number;
  items: LocationTransferItem[];
};

export async function transferBetweenLocations(payload: LocationTransferRequest, token: string): Promise<{ success: boolean; count: number }> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/transferts/locations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({ success: true, count: 0 }))) as any;
}
