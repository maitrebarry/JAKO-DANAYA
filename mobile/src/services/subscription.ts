import { API_BASE_URL } from '../utils/env';

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

export type SubscriptionPlanDTO = {
  id: number;
  code: string;
  libelle: string;
  duree_mois: number;
  prix: number;
  devise: string;
};

export type SubscriptionPaymentDTO = {
  id: number;
  reference?: string;
  provider?: string;
  plan_code?: string;
  montant?: number;
  devise?: string;
  statut?: string;
  created_at?: string;
  paid_at?: string;
};

type ReceiptFile = {
  uri: string;
  name?: string;
  type?: string;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchCurrentSubscriptionStatus(token: string): Promise<CurrentSubscriptionDTO | null> {
  const res = await fetch(`${API_BASE_URL}/api/subscription/current`, {
    headers: authHeader(token),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchSubscriptionPlans(token: string): Promise<SubscriptionPlanDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/subscription/plans`, {
    headers: authHeader(token),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Erreur chargement plans abonnement';
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchMySubscriptionPayments(token: string): Promise<SubscriptionPaymentDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/subscription/payments`, {
    headers: authHeader(token),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Erreur chargement paiements abonnement';
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export async function submitManualSubscriptionPayment(
  token: string,
  payload: {
    planCode: string;
    modePaiement: 'ORANGE_MONEY' | 'WAVE' | 'MOBICASH';
    receipt: ReceiptFile;
    transactionRef?: string;
    ownerNote?: string;
  }
): Promise<any> {
  const fd = new FormData();
  fd.append('planCode', payload.planCode);
  fd.append('modePaiement', payload.modePaiement);
  if (payload.transactionRef) fd.append('transactionRef', payload.transactionRef);
  if (payload.ownerNote) fd.append('ownerNote', payload.ownerNote);
  fd.append('receipt', {
    uri: payload.receipt.uri,
    name: payload.receipt.name || `recu-${Date.now()}.jpg`,
    type: payload.receipt.type || 'image/jpeg',
  } as any);

  const res = await fetch(`${API_BASE_URL}/api/subscription/payments/manual-submit`, {
    method: 'POST',
    headers: authHeader(token),
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Erreur soumission (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
