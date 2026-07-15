import { API_BASE_URL } from '../utils/env';

// NOTE: This module is intentionally dedicated to CASH sales (vente en espèces).
// Credit sales / client orders must use the Commande Client flow (separate endpoints & business rules).

export type PriceMode = 'DETAIL' | 'GROS';

export type VenteEspeceLinePayload = {
  id_stock: number;
  quantite?: number | null;
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number | null;
  id_emballage?: number | null;
  prix: number;
  priceMode?: PriceMode;
};

export type VenteEspecePayload = {
  reference: string;
  dateVente: string;
  nomClient: string;
  total: number;
  montantRecu: number;
  monnaieRembourse: number;
  remise: number;
  produitsSelectionnes: VenteEspeceLinePayload[];
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

export async function fetchBoutiqueStocks(token: string) {
  // Backend rules: cash sale must be done from boutique-level stock (magasin stock is forbidden).
  const res = await fetch(`${API_BASE_URL}/api/stocks`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement stocks (${res.status})`);
  const list = Array.isArray(data) ? data : [];
  return list.filter((s: any) => !s?.magasin);
}

export async function createVenteEspece(payload: VenteEspecePayload, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/ventes/cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload)
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  if (contentType.includes('application/json')) {
    return await res.json().catch(() => ({}));
  }
  return await res.text().catch(() => '');
}
