import { API_BASE_URL } from '../utils/env';

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  id?: number;
  email?: string;
  roles?: string[];
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  // Attempt to read both text and parsed JSON so we can produce helpful error messages
  const text = await res.text().catch(() => '');
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || text || `Erreur réseau (${res.status})`;
    throw new Error(msg);
  }

  return data as LoginResponse;
}

export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Erreur de session';
    throw new Error(msg);
  }
  return data as any;
}

export async function fetchBoutiques(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/boutiques`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error('Erreur lors du chargement des boutiques');
  }
  return Array.isArray(data) ? data : [];
}

export async function updateCurrentUser(payload: Record<string, any>, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Erreur mise à jour profil');
  return data;
}

export async function changePassword(oldPassword: string, newPassword: string, token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ oldPassword, newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Erreur changement mot de passe');
  return data;
}

export async function uploadAvatar(file: any, token: string) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/auth/me/avatar`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || 'Erreur upload avatar');
  return data;
}

// Upload with progress reporting using XMLHttpRequest. Returns an object { promise, abort }
export function uploadAvatarWithProgress(file: any, token: string, onProgress: (percent: number) => void) {
  const fd = new FormData();
  fd.append('file', file);

  const xhr = new XMLHttpRequest();
  const promise = new Promise<any>((resolve, reject) => {
    xhr.open('POST', `${API_BASE_URL}/api/auth/me/avatar`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        try { onProgress(pct); } catch (e) {}
      }
    };

    xhr.onload = () => {
      try {
        const status = xhr.status;
        const text = xhr.responseText || '';
        const data = text ? JSON.parse(text) : {};
        if (status >= 200 && status < 300) resolve(data);
        else reject(new Error(data?.message || data?.error || `Upload failed (${status})`));
      } catch (e) { reject(e); }
    };

    xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'));
    xhr.onabort = () => reject(new Error('Upload annulé'));
    xhr.send(fd);
  });

  return { promise, abort: () => xhr.abort() };
}