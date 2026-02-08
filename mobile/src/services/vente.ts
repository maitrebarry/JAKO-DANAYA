import { API_BASE_URL } from '../utils/env';

export type PriceMode = 'DETAIL' | 'GROS';

export type CashSaleLinePayload = {
  id_stock: number;
  quantite?: number | null;
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number | null;
  prix: number;
  priceMode?: PriceMode;
};

export type CashSalePayload = {
  reference: string;
  dateVente: string;
  nomClient: string;
  total: number;
  montantRecu: number;
  monnaieRembourse: number;
  remise: number;
  produitsSelectionnes: CashSaleLinePayload[];
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

export async function fetchStocks(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/stocks`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement stocks (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export async function createVenteCash(payload: CashSalePayload, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/ventes/cash`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload)
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    // Backend may return JSON map or plain string
    const msg = await parseError(res);
    throw new Error(msg);
  }

  if (contentType.includes('application/json')) {
    return await res.json().catch(() => ({}));
  }
  return await res.text().catch(() => '');
}
