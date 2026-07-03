import { API_BASE_URL } from '../utils/env';

export type Fournisseur = {
  id: number;
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
  boutique?: { id: number; nom?: string } | null;
};

export type FournisseurPayload = {
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
  boutique?: { id: number } | null;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `Erreur réseau (${res.status})`;
  try {
    const j = JSON.parse(text);
    return j?.message || j?.error || j?.code || text;
  } catch {
    return text;
  }
}

export async function fetchFournisseurs(token: string): Promise<Fournisseur[]> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement fournisseurs (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export async function createFournisseur(payload: FournisseurPayload, token: string): Promise<Fournisseur> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as Fournisseur;
}

export async function updateFournisseur(id: number, payload: FournisseurPayload, token: string): Promise<Fournisseur> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as Fournisseur;
}

export async function deleteFournisseur(id: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
