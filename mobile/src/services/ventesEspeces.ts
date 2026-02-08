import { API_BASE_URL } from '../utils/env';

// Align with web implementation:
// - List endpoint: GET /api/historique/ventes/especes/boutique/:boutiqueId
// - Detail: GET /api/ventes/:id
// - Lines:  GET /api/ventes/:id/lignes

export type HistoriqueVenteEspeceItem = {
  type?: string | null; // expected: 'VENTE'
  id: number;
  date?: string | null;
  dateIso?: string | null;
  reference?: string | null;
  client?: string | null;
  responsable?: string | null;
  montant?: number | null;
  referenceCaisse?: string | null;
  lignes?: string[];
};

export type VenteDTO = {
  id: number;
  nomClient?: string | null;
  dateVente?: string | null;
  montantTotal?: number | null;
  referenceCaisse?: string | null;
  remise?: number | null;
  netAPayer?: number | null;
  montantRecu?: number | null;
  monnaieRembourse?: number | null;
  utilisateur?: any;
  boutique?: any;
};

export type LigneVenteDTO = {
  id: number;
  quantite?: number | null;
  quantiteConditionnement?: number | null;
  newPrice?: number | null;
  priceMode?: string | null;
  quantiteLivre?: number | null;
  resteUnitesDansCartonApresVente?: number | null;
  produit?: any;
  vente?: any;
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

export async function fetchHistoriqueVentesEspeces(boutiqueId: number, token: string): Promise<HistoriqueVenteEspeceItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/historique/ventes/especes/boutique/${boutiqueId}`, {
    headers: authHeader(token),
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  return Array.isArray(data) ? (data as any[]) : [];
}

export async function fetchVenteById(id: number, token: string): Promise<VenteDTO> {
  const res = await fetch(`${API_BASE_URL}/api/ventes/${id}`, {
    headers: authHeader(token),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  return (data || {}) as any;
}

export async function fetchVenteLignes(id: number, token: string): Promise<LigneVenteDTO[]> {
  const res = await fetch(`${API_BASE_URL}/api/ventes/${id}/lignes`, {
    headers: authHeader(token),
  });

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }

  return Array.isArray(data) ? (data as any[]) : [];
}
