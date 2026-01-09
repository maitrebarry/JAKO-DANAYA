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
    if (res.status === 401) {
      throw new Error('Authentification requise');
    }
    const text = await res.text();
    throw new Error(`Dashboard fetch failed: ${res.status} ${text}`);
  }
  return (await res.json()) as OverviewPayload;
}

export type DashboardPayload = {
  role?: string;
  widgets?: Record<string, any>;
  currentBoutique?: { id?: number; nom?: string };
};

export async function fetchDashboard(shopId?: number): Promise<DashboardPayload> {
  let url = `${API_BASE}/dashboard`;
  if (shopId) url += `?shopId=${shopId}`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentification requise');
    }
    const text = await res.text();
    throw new Error(`Dashboard fetch failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  // backend may return { error: '...' }
  if (body && body.error) {
    throw new Error(body.error.toString());
  }
  return body as DashboardPayload;
}
