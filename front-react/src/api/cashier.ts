const API_BASE = 'http://localhost:8085/api';
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type Transaction = {
  id: number;
  reference?: string;
  amount?: number;
  paymentMethod?: string;
  date?: string;
};

export async function fetchCashierTransactions(shiftId?: number): Promise<Transaction[]> {
  try {
    const q = shiftId ? `?shiftId=${shiftId}` : '';
    const res = await fetch(`${API_BASE}/dashboard/cashier/transactions${q}`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchCashierTransactions ${res.status}`);
    return await res.json();
  } catch (e) {
    // fallback mock
    return [
      { id: 1, reference: 'TX-001', amount: 1200, paymentMethod: 'CASH', date: new Date().toISOString() },
      { id: 2, reference: 'TX-002', amount: 3500, paymentMethod: 'CARD', date: new Date().toISOString() },
    ];
  }
}

export async function fetchCashTotals(shiftId?: number): Promise<{ [method: string]: number }> {
  try {
    const q = shiftId ? `?shiftId=${shiftId}` : '';
    const res = await fetch(`${API_BASE}/dashboard/cashier/totals${q}`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchCashTotals ${res.status}`);
    return await res.json();
  } catch (e) {
    return { CASH: 1200, CARD: 3500 };
  }
}

export async function closeShift(shiftId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/cashier/close?shiftId=${shiftId}`, { method: 'POST', headers: AUTH_HEADER() });
    return res.ok;
  } catch (e) {
    return false;
  }
}
