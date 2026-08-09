import { API } from '../config/api';
const API_BASE = API;
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

const toIsoLocalDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export type ShopDTO = { id: number; name: string; statut?: string };
export type AlertDTO = { id: number; level: 'INFO' | 'WARN' | 'CRITICAL'; message: string; createdAt: string };
export type SubscriptionPlanDTO = {
  id: number;
  code: string;
  libelle: string;
  duree_mois: number;
  prix: number;
  devise: string;
  actif: boolean;
};

export type BoutiqueSubscriptionDTO = {
  boutique_id: number;
  boutique_nom: string;
  abonnement_id?: number | null;
  statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  grace_end_at?: string | null;
  auto_renew?: boolean | null;
  plan_code?: string | null;
  plan_libelle?: string | null;
  duree_mois?: number | null;
  prix?: number | null;
  devise?: string | null;
};

export type CurrentSubscriptionDTO = {
  configured: boolean;
  boutiqueId?: number;
  boutiqueNom?: string;
  planCode?: string;
  planLibelle?: string;
  status?: string;
  dateFin?: string | null;
  daysRemaining?: number | null;
  blocked?: boolean;
  perpetual?: boolean;
  shouldShowModal?: boolean;
  message?: string | null;
};

export type SubscriptionPaymentAdminDTO = {
  id: number;
  reference: string;
  provider: string;
  mode_paiement?: string | null;
  plan_code?: string | null;
  transaction_ref?: string | null;
  owner_note?: string | null;
  preuve_url?: string | null;
  review_note?: string | null;
  montant: number;
  devise: string;
  statut: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED';
  paid_at?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  boutique_id?: number;
  boutique_nom?: string;
};

export async function fetchAdminShops(): Promise<ShopDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/shops`, { headers: AUTH_HEADER() });
    if (!res.ok) {
      if (res.status === 401) throw new Error('Authentification requise');
      throw new Error(`fetchAdminShops ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('fetchAdminShops: unexpected response', data);
      throw new Error('Invalid response from server');
    }
    return data;
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

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlanDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/subscriptions/plans`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchSubscriptionPlans ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchBoutiqueSubscriptions(): Promise<BoutiqueSubscriptionDTO[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/subscriptions/boutiques`, { headers: AUTH_HEADER() });
    if (!res.ok) throw new Error(`fetchBoutiqueSubscriptions ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function activateBoutiqueSubscription(boutiqueId: number, planCode: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/subscriptions/boutiques/${boutiqueId}/activate`, {
    method: 'POST',
    headers: { ...AUTH_HEADER(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ planCode }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `activateBoutiqueSubscription ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function suspendBoutiqueSubscription(boutiqueId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/subscriptions/boutiques/${boutiqueId}/suspend`, {
    method: 'POST',
    headers: AUTH_HEADER(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `suspendBoutiqueSubscription ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function updateBoutiqueSubscriptionDates(
  boutiqueId: number,
  dateDebut: string,
  dateFin: string
): Promise<any> {
  const payload = {
    dateDebut: toIsoLocalDateTime(dateDebut),
    dateFin: toIsoLocalDateTime(dateFin),
  };
  const res = await fetch(`${API_BASE}/admin/subscriptions/boutiques/${boutiqueId}/dates`, {
    method: 'PUT',
    headers: { ...AUTH_HEADER(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `updateBoutiqueSubscriptionDates ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function fetchCurrentSubscriptionStatus(): Promise<CurrentSubscriptionDTO | null> {
  try {
    const res = await fetch(`${API_BASE}/subscription/current`, { headers: AUTH_HEADER() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAdminSubscriptionPayments(status?: string): Promise<SubscriptionPaymentAdminDTO[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/admin/subscriptions/payments${query}`, { headers: AUTH_HEADER() });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `fetchAdminSubscriptionPayments ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function approveAdminSubscriptionPayment(paymentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/subscriptions/payments/${paymentId}/approve`, {
    method: 'POST',
    headers: AUTH_HEADER(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `approveAdminSubscriptionPayment ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function rejectAdminSubscriptionPayment(paymentId: number, reason?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/subscriptions/payments/${paymentId}/reject`, {
    method: 'POST',
    headers: { ...AUTH_HEADER(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `rejectAdminSubscriptionPayment ${res.status}`);
  }
  return res.json().catch(() => ({}));
}