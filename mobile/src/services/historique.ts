import { API_BASE_URL } from '../utils/env';

export type HistoriqueVenteItemDTO = {
  type: 'LIVRAISON' | 'PAIEMENT' | string;
  id: number;
  date?: string | null;
  dateIso?: string | null;
  reference?: string | null;
  referenceCommandeId?: number | null;
  referenceCommande?: string | null;
  client?: string | null;
  montant?: number | null;
  annule?: boolean | null;
  referenceCaisse?: string | null;
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

export async function fetchHistoriqueVentesBoutique(
  boutiqueId: number,
  token: string,
  opts?: { annulations?: boolean }
): Promise<HistoriqueVenteItemDTO[]> {
  const ann = opts?.annulations ? 'annulations/' : '';
  const res = await fetch(`${API_BASE_URL}/api/historique/ventes/${ann}boutique/${boutiqueId}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement historique (${res.status})`);
  return Array.isArray(data) ? data : [];
}

async function postCancel(apiPath: string, reason: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export function cancelPaiement(id: number, reason: string, token: string): Promise<void> {
  return postCancel(`paiements/${id}/cancel`, reason, token);
}

export function cancelReception(id: number, reason: string, token: string): Promise<void> {
  return postCancel(`receptions/${id}/cancel`, reason, token);
}

export function cancelLivraison(id: number, reason: string, token: string): Promise<void> {
  return postCancel(`livraisons/${id}/cancel`, reason, token);
}

export function cancelPaiementClient(id: number, reason: string, token: string): Promise<void> {
  return postCancel(`paiements-clients/${id}/cancel`, reason, token);
}
