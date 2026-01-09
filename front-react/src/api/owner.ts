const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type ShopOverview = {
  salesTotal?: number;
  sales7d?: number[];
  pendingOrders?: number;
  topProducts?: { id: number; name: string; sold: number }[];
};

export async function fetchShopOverview(shopId?: number): Promise<ShopOverview> {
  try {
    if (!shopId) throw new Error('shopId required');
    const res = await fetch(`${API_BASE}/dashboard/shops/${shopId}/overview`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchShopOverview ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback: return mock data
    return {
      salesTotal: 123450,
      sales7d: [12000, 15000, 11000, 13000, 12500, 14000, 12345],
      pendingOrders: 5,
      topProducts: [
        { id: 1, name: 'Produit A', sold: 120 },
        { id: 2, name: 'Produit B', sold: 90 },
        { id: 3, name: 'Produit C', sold: 80 },
      ],
    };
  }
}
