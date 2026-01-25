import { API } from '../config/api';
const API_BASE = `${API}/notifications`;

const tokenHeader = () => {
  const token = localStorage.getItem('smb_token');
  return { Authorization: `Bearer ${token}` };
};

export async function getUnreadNotifications() {
  const res = await fetch(API_BASE, { headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markRead(id: number) {
  const res = await fetch(`${API_BASE}/${id}/read`, { method: 'POST', headers: { ...tokenHeader() } });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export default { getUnreadNotifications, markRead };