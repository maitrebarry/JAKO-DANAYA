const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type OverviewPayload = {
  salesTotal?: number;
  productsCount?: number;
  clientsCount?: number;
  suppliersCount?: number;
  salesToday?: number;
  pendingOrders?: number;
  lowStockCount?: number;
};

export async function fetchOverview(shopId?: number): Promise<OverviewPayload> {
  let url = `${API_BASE}/dashboard/overview`;
  if (shopId) url += `?shopId=${shopId}`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dashboard fetch failed: ${res.status} ${text}`);
  }
  return (await res.json()) as OverviewPayload;
}
