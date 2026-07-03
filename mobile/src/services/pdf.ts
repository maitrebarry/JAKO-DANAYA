import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../utils/env';
import { Platform, Linking } from 'react-native';

function safeFilename(name: string) {
  return (name || 'document.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function buildAuthHeader(token?: string) {
  if (!token) return undefined;
  const t = token.trim();
  if (!t) return undefined;
  const raw = t.replace(/^bearer\s+/i, '').trim();
  if (!raw) return undefined;
  return `Bearer ${raw}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;

    const c1 = (triplet >> 18) & 0x3f;
    const c2 = (triplet >> 12) & 0x3f;
    const c3 = (triplet >> 6) & 0x3f;
    const c4 = triplet & 0x3f;

    output += chars[c1];
    output += chars[c2];
    output += i + 1 < bytes.length ? chars[c3] : '=';
    output += i + 2 < bytes.length ? chars[c4] : '=';
  }

  return output;
}

async function parseHttpError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `Erreur PDF (${res.status})`;
  try {
    const j = JSON.parse(text);
    return j?.message || j?.error || text;
  } catch {
    return text;
  }
}


export async function downloadAndShareFile(opts: {
  apiPath: string; // without leading /api
  token: string;
  filename: string;
  mimeType?: string; // defaults to application/pdf
}) {
  const { apiPath, token } = opts;
  const mimeType = opts.mimeType || 'application/pdf';
  const filename = safeFilename(opts.filename);
  const authHeader = buildAuthHeader(token);

  if (!authHeader) {
    throw new Error('Session expirée: token manquant pour générer le fichier');
  }

  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/${apiPath.replace(/^\//, '')}`;

  // Web: expo-file-system doesn't reliably support downloadAsync; use fetch+blob.
  if (Platform.OS === 'web') {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Erreur téléchargement (${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    // Open in a new tab; leave it to the browser to handle download/view.
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    return { uri: objectUrl, shared: true };
  }

  // Native: download to cache directory and share
  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Dossier cache non disponible pour enregistrer le fichier');
  }

  const dlDir = `${baseDir}downloads/`;
  try {
    await FileSystem.makeDirectoryAsync(dlDir, { intermediates: true });
  } catch {
    // ignore
  }

  const fileUri = `${dlDir}${filename}`;

  const fetchRes = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
    },
  });

  if (!fetchRes.ok) {
    throw new Error(await parseHttpError(fetchRes));
  }

  const ab = await fetchRes.arrayBuffer();
  const base64 = uint8ToBase64(new Uint8Array(ab));
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' as any });

  if (!(await Sharing.isAvailableAsync())) {
    // Fallback: try to open locally
    try {
      await Linking.openURL(fileUri);
      return { uri: fileUri, shared: true };
    } catch {
      return { uri: fileUri, shared: false };
    }
  }

  await Sharing.shareAsync(fileUri, {
    mimeType,
    dialogTitle: 'Ouvrir / partager le fichier',
  });

  return { uri: fileUri, shared: true };
}

export async function downloadAndSharePdf(opts: { apiPath: string; token: string; filename: string }) {
  const filename = opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`;
  return downloadAndShareFile({ ...opts, filename, mimeType: 'application/pdf' });
}
