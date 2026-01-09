const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type ShopDTO = { id: number; name: string; statut?: string };
export type AlertDTO = { id: number; level: 'INFO' | 'WARN' | 'CRITICAL'; message: string; createdAt: string };

export async function fetchAdminShops(): Promise<ShopDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/shops`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchAdminShops ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback: return empty list
    return [];
  }
}

export async function fetchAdminAlerts(): Promise<AlertDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/alerts`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchAdminAlerts ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback: return mock alerts
    return [
      { id: 1, level: 'CRITICAL', message: 'Job backup failed on node-3', createdAt: new Date().toISOString() },
    ];
  }
}