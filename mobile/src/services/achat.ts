import { API_BASE_URL } from '../utils/env';

// NOTE: This module is dedicated to ACHAT / COMMANDE FOURNISSEUR.
// It must remain separate from VENTE logic (cash or credit).

export type Fournisseur = {
  id: number;
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
};

export type CreateFournisseurPayload = {
  nom?: string;
  prenom?: string;
  contact?: string;
  codePays?: string;
  ville?: string;
};

export type AchatLinePayload = {
  id_stock: number;
  quantite: number; // units
  quantiteConditionnement?: number | null;
  prix: number; // unit purchase price
};

export type CommandeFournisseurDTO = {
  id: number;
  reference: string;
  dateCommande: string;
  fournisseur?: { id: number; prenom?: string; nom?: string } | null;
  total: number;
  montantPaye?: number;
  pourcentageRecu?: number;
  pourcentagePaye?: number;
  lignes?: Array<{
    id: number;
    stockId?: number | null;
    produitId?: number | null;
    nom?: string;
    quantite?: number;
    quantiteConditionnement?: number | null;
    prix?: number;
    montant?: number;
    multiplicateur?: number | null;
    depot?: string | null;
    unite?: { id?: number; libelle?: string; symbole?: string; code?: string } | null;
  }>;
};

export type PaiementCommandeFournisseurPayload = {
  montant: number;
  reference?: string;
  date?: string; // ISO string (recommended)
  timezoneOffsetMinutes?: number;
};

export type ReceptionCommandeFournisseurPayload = {
  lignes: Array<{
    ligneId: number;
    quantiteLivre?: number | null;
    quantiteConditionnement?: number | null;
  }>;
};

export type ReceptionArticleDTO = {
  idProduit: number | null;
  designation?: string | null;
  depot?: string | null;
  stock?: number | null;
  qteCommande?: number | null;
  qteRecue?: number | null;
  receptionActuelle?: number | null; // remaining to receive (units)
};

export type CreateReceptionPayload = {
  reference: string;
  dateReception?: string; // ISO
  timezoneOffsetMinutes?: number;
  idCommandeFournisseur: number;
  referenceCommande?: string;
  fournisseur?: string;
  idBoutique?: number;
  lignesReception: Array<{
    idProduit: number;
    designation?: string;
    depot?: string;
    stock?: number | null;
    qteCommande?: number | null;
    qteRecue?: number | null;
    receptionActuelle: number; // units received now
    quantiteConditionnement?: number | null;
  }>;
};

export type CreateReceptionResponse = {
  id?: number;
  reference?: string;
  dateReception?: string;
  lignesResult?: any[];
};

export type HistoriqueItemDTO = {
  type: 'RECEPTION' | 'PAIEMENT' | string;
  id: number;
  date?: string | null;
  dateIso?: string | null;
  reference?: string | null;
  referenceCommandeId?: number | null;
  referenceCommande?: string | null;
  fournisseur?: string | null;
  montant?: number | null;
  annule?: boolean | null;
};

export type CreateCommandeFournisseurPayload = {
  reference: string;
  dateCommande: string; // yyyy-MM-ddTHH:mm
  fournisseur: { id: number };
  produitsSelectionnes: AchatLinePayload[];
  total: number;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
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

export async function fetchFournisseurs(token: string): Promise<Fournisseur[]> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement fournisseurs (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export async function createFournisseur(payload: CreateFournisseurPayload, token: string): Promise<Fournisseur> {
  const res = await fetch(`${API_BASE_URL}/api/fournisseurs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json().catch(() => ({}))) as any;
  }
  // Should not happen, but keep safe fallback
  const txt = await res.text().catch(() => '');
  throw new Error(txt || 'Réponse invalide');
}

export async function fetchBoutiqueStocksForAchat(token: string) {
  // For now, align with web default when no magasin: use boutique-level stocks (/stocks filtered to no magasin).
  const res = await fetch(`${API_BASE_URL}/api/stocks`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement stocks (${res.status})`);
  const list = Array.isArray(data) ? data : [];
  return list.filter((s: any) => !s?.magasin);
}

export async function createCommandeFournisseur(payload: CreateCommandeFournisseurPayload, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await res.json().catch(() => ({}));
  }
  return await res.text().catch(() => '');
}

export async function fetchCommandesFournisseurs(token: string): Promise<CommandeFournisseurDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement commandes (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export async function fetchCommandeFournisseurById(id: number, token: string): Promise<CommandeFournisseurDTO> {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs/${id}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Commande introuvable (${res.status})`);
  return (data || {}) as any;
}

export async function createPaiementCommandeFournisseur(
  id: number,
  payload: PaiementCommandeFournisseurPayload,
  token: string
) {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs/${id}/paiement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await res.json().catch(() => ({}));
  return await res.text().catch(() => '');
}

export async function enregistrerReceptionCommandeFournisseur(
  id: number,
  boutiqueId: number,
  payload: ReceptionCommandeFournisseurPayload,
  token: string
) {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs/${id}/reception?boutiqueId=${encodeURIComponent(String(boutiqueId))}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await res.json().catch(() => ({}));
  return await res.text().catch(() => '');
}

export async function deleteCommandeFournisseur(id: number, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/commandes-fournisseurs/${id}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }
  return true;
}

export async function fetchReceptionArticlesForCommande(
  commandeId: number,
  token: string
): Promise<ReceptionArticleDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/receptions/commande/${commandeId}/articles`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement articles réception (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export async function createReception(payload: CreateReceptionPayload, token: string): Promise<CreateReceptionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/receptions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return (await res.json().catch(() => ({}))) as any;
  return { reference: payload.reference };
}

export async function fetchHistoriqueBoutique(
  boutiqueId: number,
  token: string,
  opts?: { annulations?: boolean }
): Promise<HistoriqueItemDTO[]> {
  const ann = opts?.annulations ? 'annulations/' : '';
  const res = await fetch(`${API_BASE_URL}/api/historique/${ann}boutique/${boutiqueId}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement historique (${res.status})`);
  return Array.isArray(data) ? data : [];
}
