import { API } from '../config/api';
const API_BASE = `${API}/depenses`;

const tokenHeader = () => {
  const token = localStorage.getItem('smb_token');
  return { Authorization: `Bearer ${token}` };
};

export async function listDepenses(boutiqueId?: number, status?: string) {
  const params = new URLSearchParams();
  if (boutiqueId) params.append('boutiqueId', boutiqueId.toString());
  if (status) params.append('status', status);
  const res = await fetch(`${API_BASE}?${params.toString()}`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDepense(id: number) {
  const res = await fetch(`${API_BASE}/${id}`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createDepense(payload: any) {
  const res = await fetch(`${API_BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateDepense(id: number, payload: any) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteDepense(id: number) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function validateDepense(id: number, referenceCaisse?: string) {
  const res = await fetch(`${API_BASE}/${id}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(referenceCaisse ? { referenceCaisse } : {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectDepense(id: number) {
  const res = await fetch(`${API_BASE}/${id}/reject`, {
    method: 'POST',
    headers: { ...tokenHeader() }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cancelDepense(id: number, reason?: string) {
  const res = await fetch(`${API_BASE}/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(reason ? { reason } : {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default { listDepenses, getDepense, createDepense, updateDepense, deleteDepense, validateDepense, rejectDepense, cancelDepense };