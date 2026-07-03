import { API_BASE_URL } from '../utils/env';

export type MouvementDTO = {
  id: number;
  dateMouvement: string;
  typeMouvement: string;
  sousType?: string;
  description?: string;
  referenceId?: number;
  quantite?: number;
  montant?: number;
  deviseSymbole?: string;
  produit?: { id?: number; nomProduit?: string } | null;
  boutique?: { id?: number; nom?: string } | null;
  magasin?: { id?: number; nom?: string } | null;
  utilisateur?: { id?: number; email?: string; nom?: string; prenom?: string } | null;
};

export type SearchMouvementsParams = {
  userId?: number | null;
  type?: string;
  sousType?: string;
  boutiqueId?: number | null;
  magasinId?: number | null;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
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

function buildQuery(params: SearchMouvementsParams): string {
  const qs = new URLSearchParams();
  if (params.userId != null) qs.set('userId', String(params.userId));
  if (params.type) qs.set('type', params.type);
  if (params.sousType) qs.set('sousType', params.sousType);
  if (params.boutiqueId != null) qs.set('boutiqueId', String(params.boutiqueId));
  if (params.magasinId != null) qs.set('magasinId', String(params.magasinId));
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.size != null) qs.set('size', String(params.size));
  return qs.toString();
}

export async function searchMouvements(
  params: SearchMouvementsParams,
  token: string
): Promise<{ items: MouvementDTO[]; total: number }> {
  const res = await fetch(`${API_BASE_URL}/api/mouvements/search?${buildQuery(params)}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement mouvements (${res.status})`);
  if (Array.isArray(data)) return { items: data, total: data.length };
  return { items: Array.isArray(data?.items) ? data.items : [], total: Number(data?.total || 0) };
}

export function buildMouvementsExportQuery(params: Omit<SearchMouvementsParams, 'page' | 'size'>): string {
  return buildQuery(params);
}
