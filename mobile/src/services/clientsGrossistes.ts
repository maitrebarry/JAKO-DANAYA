import { API_BASE_URL } from '../utils/env';

export type ClientGrossisteDTO = {
  id: number;
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
  nomClient?: string;
};

export type CreateClientGrossistePayload = {
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
};

function authHeaders(token: string) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `Erreur réseau (${res.status})`;
  try {
    const j = JSON.parse(text);
    return j?.message || j?.error || j?.code || text;
  } catch {
    return text;
  }
}

export async function listClientsGrossistes(token: string): Promise<ClientGrossisteDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/clients-grossistes`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as ClientGrossisteDTO[]) : [];
}

export async function createClientGrossiste(
  payload: CreateClientGrossistePayload,
  token: string
): Promise<ClientGrossisteDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/clients-grossistes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json().catch(() => ({}))) as any;
  }
  const txt = await res.text().catch(() => '');
  throw new Error(txt || 'Réponse invalide');
}
