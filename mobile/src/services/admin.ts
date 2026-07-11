import { API_BASE_URL } from '../utils/env';

function authHeaders(token: string) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res: Response): Promise<string> {
  const txt = await res.text().catch(() => '');
  if (!txt) return `Erreur réseau (${res.status})`;
  try {
    const j = JSON.parse(txt);
    return j?.message || j?.error || txt;
  } catch {
    return txt;
  }
}

export type RoleDTO = { id: number; name?: string | null; description?: string | null };
export type PermissionDTO = { id: number; name?: string | null; description?: string | null };
export type SubscriptionPaymentAdminDTO = {
  id: number;
  reference?: string;
  provider?: string;
  mode_paiement?: string | null;
  plan_code?: string | null;
  transaction_ref?: string | null;
  owner_note?: string | null;
  preuve_url?: string | null;
  review_note?: string | null;
  montant?: number;
  devise?: string;
  statut?: string;
  paid_at?: string | null;
  created_at?: string | null;
  reviewed_at?: string | null;
  boutique_id?: number;
  boutique_nom?: string;
};

export type UserDTO = {
  id: number;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  pseudo?: string | null;
  contact?: string | null;
  codePays?: string | null;
  adresse?: string | null;
  typeUtilisateur?: string | null;
  statut?: string | null;
  boutique?: any;
  roles?: RoleDTO[] | string[];
  permissions?: PermissionDTO[] | string[];
  creePar?: { id: number; nom?: string | null; prenom?: string | null } | null;
};

export async function listUsers(token: string): Promise<UserDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/users`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function createUser(payload: Record<string, any>, token: string): Promise<UserDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateUser(id: number, payload: Record<string, any>, token: string): Promise<UserDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/users/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateUserStatut(id: number, statut: 'ACTIF' | 'INACTIF', token: string): Promise<UserDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/users/${id}/statut`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ statut }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function listAssignableRoles(token: string): Promise<RoleDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/assignable-roles`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function listPermissions(token: string): Promise<PermissionDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/permissions`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function createPermission(payload: Partial<PermissionDTO> & Record<string, any>, token: string): Promise<PermissionDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/permissions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updatePermission(id: number, payload: Partial<PermissionDTO> & Record<string, any>, token: string): Promise<PermissionDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/permissions/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deletePermission(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/permissions/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function listAdminUsers(token: string): Promise<UserDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/utilisateurs`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function listAdminPermissions(token: string): Promise<PermissionDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/permissions`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function getUserEffectivePermissions(userId: number, token: string): Promise<PermissionDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/utilisateurs/${userId}/permissions`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function setUserPermissions(userId: number, permissionIds: number[], token: string): Promise<PermissionDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/utilisateurs/${userId}/permissions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(permissionIds || []),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function fetchAdminSubscriptionPayments(token: string, status?: string): Promise<SubscriptionPaymentAdminDTO[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/subscriptions/payments${query}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

export async function approveAdminSubscriptionPayment(token: string, paymentId: number): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/subscriptions/payments/${paymentId}/approve`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json().catch(() => ({}));
}

export async function rejectAdminSubscriptionPayment(token: string, paymentId: number, reason?: string): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/admin/subscriptions/payments/${paymentId}/reject`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return await res.json().catch(() => ({}));
}
