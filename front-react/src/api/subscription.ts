import { API } from '../config/api';

const API_BASE = API;
const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type SubscriptionPlanLiteDTO = {
  id: number;
  code: string;
  libelle: string;
  duree_mois: number;
  prix: number;
  devise: string;
};

export type SubscriptionPaymentDTO = {
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
};

export async function fetchSubscriptionPlansForOwner(): Promise<SubscriptionPlanLiteDTO[]> {
  const res = await fetch(`${API_BASE}/subscription/plans`, { headers: AUTH_HEADER() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchMySubscriptionPayments(): Promise<SubscriptionPaymentDTO[]> {
  const res = await fetch(`${API_BASE}/subscription/payments`, { headers: AUTH_HEADER() });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function initiateSubscriptionPayment(planCode: string, provider = 'MANUEL'): Promise<any> {
  const res = await fetch(`${API_BASE}/subscription/payments/initiate`, {
    method: 'POST',
    headers: { ...AUTH_HEADER(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ planCode, provider }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitManualSubscriptionPayment(
  planCode: string,
  modePaiement: 'ORANGE_MONEY' | 'WAVE' | 'MOBICASH',
  receipt: File,
  transactionRef?: string,
  ownerNote?: string
): Promise<any> {
  const fd = new FormData();
  fd.append('planCode', planCode);
  fd.append('modePaiement', modePaiement);
  if (transactionRef) fd.append('transactionRef', transactionRef);
  if (ownerNote) fd.append('ownerNote', ownerNote);
  fd.append('receipt', receipt);

  const res = await fetch(`${API_BASE}/subscription/payments/manual-submit`, {
    method: 'POST',
    headers: AUTH_HEADER(),
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function simulateSubscriptionPaymentSuccess(paymentId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/subscription/payments/${paymentId}/simulate-success`, {
    method: 'POST',
    headers: AUTH_HEADER(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
