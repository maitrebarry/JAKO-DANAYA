import { API_BASE_URL } from '../utils/env';

export const fetchProduits = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Erreur récupération produits');
  return res.json();
};

export const fetchProduit = async (id: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Produit introuvable');
  return res.json();
};

export const createProduit = async (formData: FormData, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits`, { method: 'POST', body: formData, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Création produit échouée: ' + txt);
  }
  return res.json();
};

export const fetchConfigurationMarge = async (boutiqueId: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/configuration-marge/boutique/${boutiqueId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Erreur récupération configuration marge');
  return res.json();
};

export const fetchUnites = async (token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/unites`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Erreur récupération unités: ' + txt);
  }
  return res.json();
};

export const createEmballage = async (
  produitId: number,
  payload: { uniteId: number; nombreUnites: number; estParDefaut?: boolean },
  token: string
) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${produitId}/emballages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error("Création emballage échouée: " + txt);
  }
  return res.json();
};

export const updateEmballage = async (
  produitId: number,
  emballageId: number,
  payload: { uniteId: number; nombreUnites: number; estParDefaut?: boolean },
  token: string
) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${produitId}/emballages/${emballageId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error("Modification emballage échouée: " + txt);
  }
  return res.json();
};

export const deleteEmballage = async (produitId: number, emballageId: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${produitId}/emballages/${emballageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error("Suppression emballage échouée: " + txt);
  }
  return true;
};

export const fetchRecomputeJobStatus = async (jobId: string, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/configuration-marge/job/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Erreur récupération statut job: ' + txt);
  }
  return res.json();
};
export const importProduitsAsync = async (file: any, token: string, createMissingUnits = true) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('createMissingUnits', String(createMissingUnits));
  const res = await fetch(`${API_BASE_URL}/api/produits/import-async`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error('Import échoué: ' + txt);
  }
  return res.json();
};

export const recomputeMargeForBoutique = async (boutiqueId: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/configuration-marge/boutique/${boutiqueId}/recompute-job`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 202) {
    const txt = await res.text().catch(() => '');
    throw new Error('Recompute échoué: ' + txt);
  }
  return res.json().catch(() => ({}));
};

export const updateProduit = async (id: number, formData: FormData, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${id}`, { method: 'PUT', body: formData, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Mise à jour produit échouée: ' + txt);
  }
  return res.json();
};

export const deleteProduit = async (id: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/api/produits/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Suppression échouée');
  return true;
};
