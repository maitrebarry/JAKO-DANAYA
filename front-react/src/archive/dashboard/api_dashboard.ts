// @ts-nocheck
// Archived copy of dashboard API client (originally in src/api/dashboard.ts)
// Kept for reference while dashboard APIs are disabled in the frontend

const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type WidgetDTO = { key: string; permission?: string; data?: any };
export type SectionDTO = { role: string; widgets: WidgetDTO[]; shops?: { id?: number; nom?: string }[] };

export type DashboardPayload = {
  role?: string;
  widgets?: Record<string, any>;
  sections?: SectionDTO[];
  currentBoutique?: { id?: number; nom?: string };
};

export type ShopOverviewDTO = { salesTotal?: number; sales7d?: number[]; pendingOrders?: number; topProducts?: { id?: number; name?: string; sold?: number }[] };

export async function fetchDashboard(shopId?: number): Promise<DashboardPayload> {
  let url = `${API_BASE}/dashboard`;
  if (shopId) url += `?shopId=${shopId}`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentification requise');
    const text = await res.text();
    throw new Error(`Dashboard fetch failed: ${res.status} ${text}`);
  }
  return await res.json() as DashboardPayload;
}

export async function fetchShopOverview(shopId: number): Promise<ShopOverviewDTO> {
  const res = await fetch(`${API_BASE}/dashboard/shops/${shopId}/overview`, { headers: AUTH_HEADER() });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentification requise');
    const text = await res.text();
    throw new Error(`Shop overview fetch failed: ${res.status} ${text}`);
  }
  return await res.json() as ShopOverviewDTO;
}