import { API_BASE_URL } from '../utils/env';

export type UtilisationMovementDTO = {
  id: number; // mouvement id
  dateMouvement?: string | null;
  sousType?: 'UTILISATION' | 'PERTE' | string | null;
  quantite?: number | null;
  produit?: any;
  magasin?: any;
  boutique?: any;
  utilisateur?: any;
  description?: string | null;
};

export type UtilisationPerteDTO = {
  id: number; // utilisation_pertes id
  motif?: string | null;
  quantite?: number | null;
  date?: string | null; // LocalDate
  type?: 'UTILISATION' | 'PERTE' | string | null;
  produit?: any;
  boutique?: any;
  magasin?: any;
  mouvementId?: number | null;
};

export type UtilisationPertePayload = {
  motif?: string | null;
  quantite: number;
  date?: string | null;
  type: 'UTILISATION' | 'PERTE';
  produit: { id: number };
  magasin?: { id: number } | null;
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

export async function listUtilisationPertes(token: string): Promise<UtilisationMovementDTO[]> {
  // Align with web: list movements (id = mouvementId)
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/mouvements/utilisations`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur utilisation/pertes (${res.status})`);
  }
  const json = await res.json();
  return Array.isArray(json) ? (json as UtilisationMovementDTO[]) : [];
}

export async function getUtilisationPerte(id: number, token: string): Promise<UtilisationPerteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/utilisation-pertes/${id}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur utilisation/perte (${res.status})`);
  }
  return (await res.json().catch(() => ({}))) as any;
}

export async function getUtilisationPerteByMouvement(mouvementId: number, token: string): Promise<UtilisationPerteDTO | null> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/utilisation-pertes/mouvement/${mouvementId}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur utilisation/perte (${res.status})`);
  }
  return (await res.json().catch(() => ({}))) as any;
}

export async function createUtilisationPerte(payload: UtilisationPertePayload, token: string): Promise<UtilisationPerteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/utilisation-pertes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateUtilisationPerte(id: number, payload: UtilisationPertePayload, token: string): Promise<UtilisationPerteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/utilisation-pertes/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deleteUtilisationMouvement(mouvementId: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/mouvements/${mouvementId}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}
