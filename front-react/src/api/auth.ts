const API_BASE = 'http://localhost:8085/api';
const tokenHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export const getProfile = async () => {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: tokenHeader() });
  if (!res.ok) throw res;
  return await res.json();
};

export const updateProfile = async (payload: any) => {
  const res = await fetch(`${API_BASE}/auth/me`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...tokenHeader() }, body: JSON.stringify(payload) });
  if (!res.ok) throw res;
  return await res.json();
};

export const changePassword = async (oldPassword: string, newPassword: string) => {
  const res = await fetch(`${API_BASE}/auth/me/password`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...tokenHeader() }, body: JSON.stringify({ oldPassword, newPassword }) });
  if (!res.ok) throw res;
  return await res.json();
};

export const uploadAvatar = async (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE}/auth/me/avatar`, { method: 'POST', headers: { ...tokenHeader() }, body: fd });
  if (!res.ok) throw res;
  return await res.json();
};

export default { getProfile, updateProfile, changePassword, uploadAvatar };
