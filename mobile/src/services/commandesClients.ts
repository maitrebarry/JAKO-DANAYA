import { API_BASE_URL } from '../utils/env';

export type CommandeClientDTO = {
  id: number;
  reference?: string;
  dateCommande?: string;
  total?: number;
  paie?: number;
  client?: any;
  boutique?: any;
  lignes?: any[];
};

export type PaiementCommandeClientPayload = {
  montant: number;
  reference?: string;
  date?: string;
  timezoneOffsetMinutes?: number;
  referenceCaisse: string;
};

export type CommandeClientLinePayload = {
  id_stock: number;
  quantite?: number | null;
  venteParConditionnement?: boolean;
  quantiteConditionnement?: number | null;
  prix: number;
  priceMode?: 'DETAIL' | 'GROS';
};

// Backend endpoint: POST /api/ventes/full -> creates a CommandeClient + lignes
export type CreateCommandeClientPayload = {
  reference: string;
  dateVente: string;
  client?: { id: number } | null;
  produitsSelectionnes: CommandeClientLinePayload[];
  total: number;
};

export type LivraisonCommandeClientLinePayload = {
  ligneCommandeId: number;
  stockId: number;
  quantite?: number | null;
  quantiteConditionnement?: number | null;
};

export type LivraisonCommandeClientPayload = {
  reference?: string | null;
  lignes: LivraisonCommandeClientLinePayload[];
};

function authHeaders(token: string) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function listCommandesClientsByBoutique(boutiqueId: number, token: string): Promise<CommandeClientDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/commandes-clients/boutique/${boutiqueId}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur commandes (${res.status})`);
  }
  const json = await res.json();
  return Array.isArray(json) ? (json as CommandeClientDTO[]) : [];
}

export async function getCommandeClient(id: number, token: string): Promise<CommandeClientDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/commandes-clients/${id}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur commande (${res.status})`);
  }
  return res.json();
}

export async function createPaiementCommandeClient(
  id: number,
  payload: PaiementCommandeClientPayload,
  token: string
): Promise<CommandeClientDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/commandes-clients/${id}/paiement`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let msg = txt || `Erreur paiement (${res.status})`;
    try {
      const j = JSON.parse(txt);
      msg = j?.message || j?.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteCommandeClient(id: number, token: string): Promise<void> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/commandes-clients/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: authHeaders(token) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `Erreur suppression (${res.status})`);
  }
}

export async function createLivraisonCommandeClient(
  id: number,
  payload: LivraisonCommandeClientPayload,
  token: string
): Promise<any> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/commandes-clients/${id}/livraisons`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text().catch(() => null);
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

export async function createCommandeClient(payload: CreateCommandeClientPayload, token: string): Promise<CommandeClientDTO> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/ventes/full`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  const txt = await res.text().catch(() => '');
  // Defensive: backend should return JSON, but keep a helpful error if not.
  throw new Error(txt || 'Réponse inattendue du serveur');
}
