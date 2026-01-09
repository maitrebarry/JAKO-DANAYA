const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type WidgetDTO = { key: string; permission?: string; data?: any };
export type SectionDTO = { role: string; widgets: WidgetDTO[]; shops?: { id?: number; nom?: string }[] };

export type DashboardPayload = {
  role?: string;
  widgets?: Record<string, any>;
  sections?: SectionDTO[];
  currentBoutique?: { id?: number; nom?: string };
};

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
