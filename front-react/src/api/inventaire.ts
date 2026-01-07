const API_BASE = 'http://localhost:8085/api/inventaires';

const tokenHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export async function listInventaires(boutiqueId?: number) {
  const url = boutiqueId ? `${API_BASE}?boutiqueId=${boutiqueId}` : API_BASE;
  const res = await fetch(url, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createInventaire(payload: any) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addLigneInventaire(inventaireId: number, payload: any) {
  const res = await fetch(`${API_BASE}/${inventaireId}/lignes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tokenHeader() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listLignes(inventaireId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}/lignes`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getInventaire(inventaireId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getNextReference() {
  const res = await fetch(`${API_BASE}/next-reference`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.reference || json;
}

export async function regularizeInventaire(inventaireId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}/regularize`, {
    method: 'POST',
    headers: { ...tokenHeader() },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function exportInventaireCsv(inventaireId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}/export/csv`, {
    headers: { ...tokenHeader(), Accept: 'text/csv' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => null);
    if (res.status === 401) throw { status: 401, message: txt || 'Authentification requise' };
    throw { status: res.status, message: txt || 'Erreur export CSV' };
  }
  const blob = await res.blob();
  return blob;
}

export async function exportInventairePdf(inventaireId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}/export/pdf`, {
    headers: { ...tokenHeader(), Accept: 'application/pdf' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => null);
    if (res.status === 401) throw { status: 401, message: txt || 'Authentification requise' };
    throw { status: res.status, message: txt || 'Erreur export PDF' };
  }
  const blob = await res.blob();
  return blob;
}

export async function deleteLigneInventaire(inventaireId: number, ligneId: number) {
  const res = await fetch(`${API_BASE}/${inventaireId}/lignes/${ligneId}`, {
    method: 'DELETE',
    headers: { ...tokenHeader() }
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => null);
    if (res.status === 401) throw { status: 401, message: txt || 'Authentification requise' };
    throw { status: res.status, message: txt || 'Erreur suppression' };
  }
  return res;
}

export default { listInventaires, createInventaire, addLigneInventaire, regularizeInventaire, exportInventaireCsv, deleteLigneInventaire };