const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type PendingOrder = {
  id: number;
  reference?: string;
  total?: number;
  clientName?: string;
  dateCommande?: string;
};

export type StaffActivity = {
  userId: number;
  name: string;
  salesToday: number;
  shiftStatus: 'OPEN' | 'CLOSED' | 'ON_SHIFT';
};

export async function fetchShopSalesToday(shopId?: number): Promise<number> {
  try {
    if (!shopId) throw new Error('shopId required');
    const res = await fetch(`${API_BASE}/dashboard/shop/${shopId}/sales-today`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchShopSalesToday ${res.status}`);
    const json = await res.json();
    return json.salesToday ?? 0;
  } catch (e) {
    // fallback mock
    return 12345;
  }
}

export async function fetchPendingOrders(shopId?: number): Promise<PendingOrder[]> {
  try {
    if (!shopId) throw new Error('shopId required');
    const res = await fetch(`${API_BASE}/dashboard/shop/${shopId}/orders/pending`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchPendingOrders ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback mock
    return [
      { id: 101, reference: 'CMD-101', total: 12000, clientName: 'Client A', dateCommande: new Date().toISOString() },
      { id: 102, reference: 'CMD-102', total: 8000, clientName: 'Client B', dateCommande: new Date().toISOString() },
    ];
  }
}

export async function fetchStaffActivity(shopId?: number): Promise<StaffActivity[]> {
  try {
    if (!shopId) throw new Error('shopId required');
    const res = await fetch(`${API_BASE}/dashboard/shop/${shopId}/staff-activity`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchStaffActivity ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback mock
    return [
      { userId: 1, name: 'Alice', salesToday: 4500, shiftStatus: 'ON_SHIFT' },
      { userId: 2, name: 'Bob', salesToday: 3000, shiftStatus: 'ON_SHIFT' },
    ];
  }
}

export async function markOrderPrepared(shopId: number, orderId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/dashboard/shop/${shopId}/orders/${orderId}/prepare`, { method: 'POST', headers: AUTH_HEADER() });
    return res.ok;
  } catch (e) {
    return false;
  }
}
