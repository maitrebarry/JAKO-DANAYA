// NOTE: dashboard-related endpoints are archived/disabled for now. These client helpers keep local fallbacks when backend endpoints are unavailable.
import { API as API_BASE } from '../config/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type StockItem = {
  id: number;
  produitName?: string;
  quantiteDisponible?: number;
  magasin?: string;
};

export type Reception = {
  id: number;
  reference?: string;
  expectedAt?: string;
  status?: string;
};

export async function fetchCriticalStocks(shopId?: number): Promise<StockItem[]> {
  try {
    const url = shopId ? `${API_BASE}/dashboard/inventory?shopId=${shopId}` : `${API_BASE}/dashboard/inventory`;
    const res = await fetch(url, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchCriticalStocks ${res.status}`);
    return await res.json();
  } catch (e) {
    return [
      { id: 1, produitName: 'Produit A', quantiteDisponible: 2, magasin: 'Magasin 1' },
      { id: 2, produitName: 'Produit B', quantiteDisponible: 4, magasin: 'Magasin 2' },
    ];
  }
}

export async function fetchReceptions(shopId?: number): Promise<Reception[]> {
  try {
    const url = shopId ? `${API_BASE}/dashboard/inventory/receptions?shopId=${shopId}` : `${API_BASE}/dashboard/inventory/receptions`;
    const res = await fetch(url, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchReceptions ${res.status}`);
    return await res.json();
  } catch (e) {
    return [
      { id: 1, reference: 'REC-001', expectedAt: new Date().toISOString(), status: 'ATTENTE' },
    ];
  }
}
