import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../utils/env';
import { Platform, Linking } from 'react-native';

function safeFilename(name: string) {
  return (name || 'document.pdf').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function downloadAndSharePdf(opts: {
  apiPath: string; // without leading /api
  token: string;
  filename: string;
}) {
  const { apiPath, token } = opts;
  const filename = safeFilename(opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`);

  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/${apiPath.replace(/^\//, '')}`;

  // Web: expo-file-system doesn't reliably support downloadAsync; use fetch+blob.
  if (Platform.OS === 'web') {
    const res = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Erreur PDF (${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    // Open in a new tab; leave it to the browser to handle download/view.
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    return { uri: objectUrl, shared: true };
  }

  const fileUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;

  const res = await FileSystem.downloadAsync(url, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // Validate status: downloadAsync may still write an error body.
  const status = (res as any)?.status;
  if (typeof status === 'number' && status >= 400) {
    let details = '';
    try {
      details = await FileSystem.readAsStringAsync(res.uri);
    } catch {
      // ignore
    }
    try {
      await FileSystem.deleteAsync(res.uri, { idempotent: true } as any);
    } catch {
      // ignore
    }
    throw new Error(details || `Erreur PDF (${status})`);
  }

  if (!(await Sharing.isAvailableAsync())) {
    // Fallback: try to open locally (Android/iOS) then return URI.
    try {
      await Linking.openURL(res.uri);
      return { uri: res.uri, shared: true };
    } catch {
      return { uri: res.uri, shared: false };
    }
  }

  await Sharing.shareAsync(res.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Ouvrir / partager le PDF',
  });

  return { uri: res.uri, shared: true };
}
