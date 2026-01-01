const API_BASE = 'http://localhost:8085/api/utilisateurs';

const tokenHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export async function listUtilisateurs() {
  const res = await fetch(API_BASE, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default { listUtilisateurs };