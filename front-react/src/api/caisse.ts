const API_BASE = 'http://localhost:8085/api/caisses';

const tokenHeader = () => {
  const token = localStorage.getItem('smb_token');
  return { Authorization: `Bearer ${token}` };
};

export async function listCaisses() {
  const res = await fetch(API_BASE, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCaisse(id: number) {
  const res = await fetch(`${API_BASE}/${id}`, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default { listCaisses, getCaisse };