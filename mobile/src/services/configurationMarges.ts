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

export type ConfigurationMargeDTO = {
  id: number;
  typeMarge?: 'FIXE' | 'POURCENTAGE' | string;
  valeurDetail?: number;
  valeurGros?: number;
  margeMinimaleDetail?: number;
  margeMinimaleGros?: number;
  boutique?: { id: number };
};

export type RecomputeJobDTO = {
  jobId: string;
  status?: string | null;
  updatedCount?: number | null;
  error?: string | null;
};

export async function getConfigMargeByBoutique(boutiqueId: number, token: string): Promise<ConfigurationMargeDTO | null> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge/boutique/${boutiqueId}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => null)) as any;
}

export async function createConfigMarge(payload: Partial<ConfigurationMargeDTO> & Record<string, any>, token: string): Promise<ConfigurationMargeDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function updateConfigMarge(id: number, payload: Partial<ConfigurationMargeDTO> & Record<string, any>, token: string): Promise<ConfigurationMargeDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}

export async function deleteConfigMarge(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function startRecomputeJob(boutiqueId: number, token: string): Promise<string> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge/boutique/${boutiqueId}/recompute-job`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(token) });
  if (res.status !== 202 && !res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => ({}));
  const jobId = json?.jobId;
  if (!jobId) throw new Error('JobId manquant');
  return jobId;
}

export async function getRecomputeJob(jobId: string, token: string): Promise<RecomputeJobDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/configuration-marge/job/${encodeURIComponent(jobId)}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json().catch(() => ({}))) as any;
}
