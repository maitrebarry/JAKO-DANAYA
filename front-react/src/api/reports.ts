export interface Movement {
  id: number;
  date: string; // ISO
  type: string;
  montant: number;
  caisse: string | null;
  description?: string;
}

export interface Aggregates {
  totalCount: number;
  totalAmount: number;
}

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8085';

async function safeFetch(url: string, opts?: RequestInit) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error('Network error');
    return await res.json();
  } catch (err) {
    // propagate error to caller to allow fallback to mock data
    throw err;
  }
}

export async function fetchMovements(startDate?: string, endDate?: string): Promise<Movement[]> {
  const qs = new URLSearchParams();
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);
  try {
    const data = await safeFetch(`${API_BASE}/api/mouvements?${qs.toString()}`);
    return data as Movement[];
  } catch (err) {
    // fallback mock (small sample)
    return [
      { id: 1, date: new Date().toISOString(), type: 'VENTE', montant: 120.5, caisse: 'Caisse 1', description: 'Vente comptoir' },
      { id: 2, date: new Date().toISOString(), type: 'DEPENSE', montant: -40.0, caisse: 'Caisse 1', description: 'Achat consommable' }
    ];
  }
}

export async function fetchAggregates(startDate?: string, endDate?: string): Promise<Aggregates> {
  const qs = new URLSearchParams();
  if (startDate) qs.set('startDate', startDate);
  if (endDate) qs.set('endDate', endDate);
  try {
    const data = await safeFetch(`${API_BASE}/api/mouvements/aggregates?${qs.toString()}`);
    return data as Aggregates;
  } catch (err) {
    // fallback
    return { totalCount: 2, totalAmount: 80.5 };
  }
}

// --- New report endpoints (dynamic, no storage)
export async function fetchVentes(boutiqueId?: string | number, from?: string, to?: string): Promise<any[]> {
  const qs = new URLSearchParams();
  if (boutiqueId) qs.set('boutique', String(boutiqueId));
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  try {
    const data = await safeFetch(`${API_BASE}/api/rapports/ventes?${qs.toString()}`);
    return data as any[];
  } catch (err) {
    // fallback mock: daily sales sample
    return [
      { date: new Date().toISOString().split('T')[0], ventes: 12, montant: 125000 },
      { date: new Date().toISOString().split('T')[0], ventes: 8, montant: 76000 }
    ];
  }
}

export async function fetchStock(boutiqueId?: string | number): Promise<any[]> {
  const qs = new URLSearchParams();
  if (boutiqueId) qs.set('boutique', String(boutiqueId));
  try {
    const data = await safeFetch(`${API_BASE}/api/rapports/stock?${qs.toString()}`);
    return data as any[];
  } catch (err) {
    // fallback mock: stock per product
    return [
      { produit: 'Produit A', qte: 120, boutique: boutiqueId || 'Toutes' },
      { produit: 'Produit B', qte: 45, boutique: boutiqueId || 'Toutes' }
    ];
  }
}

export async function fetchValeurStock(boutiqueId?: string | number): Promise<any> {
  const qs = new URLSearchParams();
  if (boutiqueId) qs.set('boutique', String(boutiqueId));
  try {
    const data = await safeFetch(`${API_BASE}/api/rapports/valeur-stock?${qs.toString()}`);
    return data as any;
  } catch (err) {
    // fallback mock
    return { valeur: 1525000 };
  }
}

export async function fetchTopProduits(boutiqueId?: string | number, limit = 10): Promise<any[]> {
  const qs = new URLSearchParams();
  if (boutiqueId) qs.set('boutique', String(boutiqueId));
  qs.set('limit', String(limit));
  try {
    const data = await safeFetch(`${API_BASE}/api/rapports/top-produits?${qs.toString()}`);
    return data as any[];
  } catch (err) {
    // fallback mock
    return [
      { produit: 'Produit A', ventes: 120, montant: 250000 },
      { produit: 'Produit B', ventes: 90, montant: 180000 }
    ];
  }
}
