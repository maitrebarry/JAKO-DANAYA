import { API_BASE_URL } from '../utils/env';

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

export type CaisseDTO = {
  id: number;
  numero?: number | null;
  reference?: string | null;
  statut?: 'OUVERTE' | 'FERMEE' | string | null;
  dateCaisse?: string | null; // yyyy-MM-dd (usually)
  montantInitial?: number | null;
  montantTotal?: number | null;
  boutique?: { id: number; nom?: string | null } | null;
};

export type CreateCaissePayload = {
  dateCaisse: string; // yyyy-MM-dd
  montantInitial: number;
  montantTotal: number;
  reference?: string;
  statut?: 'OUVERTE' | 'FERMEE' | string;
  boutique: { id: number };
};

export type CaisseMovementDTO = {
  id: number;
  type?: string | null;
  typeLabel?: string | null;
  montant?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  deviseSymbole?: string | null;
  paiementId?: number | null;
  paiementReference?: string | null;
  commandeId?: number | null;
  commandeReference?: string | null;
  userId?: number | null;
  userFullName?: string | null;
  referenceCaisse?: string | null;
  boutiqueId?: number | null;
  raison?: string | null;
  metadata?: string | null;
  createdAt?: string | null;
};

export async function listCaisses(token: string): Promise<CaisseDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/caisses`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement caisses (${res.status})`);
  return Array.isArray(data) ? (data as any) : [];
}

export async function getCaisse(id: number, token: string): Promise<CaisseDTO> {
  const res = await fetch(`${API_BASE_URL}/api/caisses/${id}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Caisse introuvable (${res.status})`);
  return (data || {}) as any;
}

export async function createCaisse(payload: CreateCaissePayload, token: string): Promise<CaisseDTO> {
  const res = await fetch(`${API_BASE_URL}/api/caisses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return (await res.json().catch(() => ({}))) as any;
  const txt = await res.text().catch(() => '');
  throw new Error(txt || 'Réponse invalide');
}

export async function updateCaisse(id: number, payload: Partial<CaisseDTO>, token: string): Promise<CaisseDTO> {
  const res = await fetch(`${API_BASE_URL}/api/caisses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return (await res.json().catch(() => ({}))) as any;
  const txt = await res.text().catch(() => '');
  throw new Error(txt || 'Réponse invalide');
}

export async function listMovementsByReference(reference: string, token: string): Promise<CaisseMovementDTO[]> {
  const ref = encodeURIComponent(reference);
  const res = await fetch(`${API_BASE_URL}/api/caisses/${ref}/movements`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement mouvements (${res.status})`);
  return Array.isArray(data) ? (data as any) : [];
}

export async function listMovementsByBoutique(boutiqueId: number, token: string): Promise<CaisseMovementDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/caisses/boutique/${boutiqueId}/movements`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement mouvements (${res.status})`);
  return Array.isArray(data) ? (data as any) : [];
}
