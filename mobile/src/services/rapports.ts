import { API_BASE_URL } from '../utils/env';

export type RapportType = 'ventes' | 'stock' | 'valeur-stock' | 'top-produits';

export type VenteJournalierDTO = { date: string; nombreVentes: number; montantTotal: number };
export type StockReportItemDTO = {
  stockId?: number;
  produitId?: number;
  produitName?: string;
  quantiteDisponible?: number;
  costAverage?: number;
  lastPurchasePrice?: number;
  magasinId?: number;
  magasinName?: string;
};
export type ValeurStockDTO = { valeurTotale: number; details: StockReportItemDTO[] };
export type TopProductDTO = { produitId: number; produitName: string; quantiteVendue: number; montantTotal: number };

export type RapportParams = {
  boutique?: number | null;
  from?: string;
  to?: string;
  limit?: number;
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

function buildQuery(params: RapportParams): string {
  const qs = new URLSearchParams();
  if (params.boutique != null) qs.set('boutique', String(params.boutique));
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit != null) qs.set('limit', String(params.limit));
  return qs.toString();
}

export async function fetchRapport(type: RapportType, params: RapportParams, token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/rapports/${type}?${buildQuery(params)}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement rapport (${res.status})`);
  return data;
}

export function buildRapportExportQuery(params: RapportParams): string {
  return buildQuery(params);
}
