import { API } from '../config/api';

const tokenHeader = () => {
  const token = localStorage.getItem('smb_token');
  return { Authorization: `Bearer ${token}` };
};

export interface Unite {
  id: number;
  libelle: string;
  symbole?: string;
  code?: string;
}

export interface Emballage {
  id: number;
  uniteId: number;
  uniteLibelle: string;
  nombreUnites: number;
  estParDefaut: boolean;
}

export interface Produit {
  id: number;
  nomProduit: string;
  prixAchat?: number | null;
  prixDetail?: number | null;
  prixEnGros?: number | null;
  unite?: Unite | null;
  nombreUnitesParConditionnement?: number | null;
  emballages?: Emballage[];
}

async function parseErrorOrThrow(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error((body && body.error) || fallback);
}

export async function listEmballages(produitId: number): Promise<Emballage[]> {
  const res = await fetch(`${API}/produits/${produitId}/emballages`, { headers: { ...tokenHeader() } });
  if (!res.ok) return parseErrorOrThrow(res, 'Impossible de charger les emballages');
  return res.json();
}

export async function createEmballage(
  produitId: number,
  payload: { uniteId: number; nombreUnites: number; estParDefaut?: boolean }
): Promise<Emballage> {
  const res = await fetch(`${API}/produits/${produitId}/emballages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return parseErrorOrThrow(res, "Impossible de créer l'emballage");
  return res.json();
}

export async function updateEmballage(
  produitId: number,
  emballageId: number,
  payload: { uniteId: number; nombreUnites: number; estParDefaut?: boolean }
): Promise<Emballage> {
  const res = await fetch(`${API}/produits/${produitId}/emballages/${emballageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return parseErrorOrThrow(res, "Impossible de modifier l'emballage");
  return res.json();
}

export async function deleteEmballage(produitId: number, emballageId: number): Promise<void> {
  const res = await fetch(`${API}/produits/${produitId}/emballages/${emballageId}`, {
    method: 'DELETE',
    headers: { ...tokenHeader() }
  });
  if (!res.ok) return parseErrorOrThrow(res, "Impossible de supprimer l'emballage");
}

export default { listEmballages, createEmballage, updateEmballage, deleteEmballage };
