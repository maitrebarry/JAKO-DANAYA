import { API_BASE_URL } from '../utils/env';

export type DocumentReference = {
  sourceType: string;
  sourceId: number;
  reference?: string;
  date?: string;
  previewUrl?: string;
  downloadUrl?: string;
};

export type DocumentsPage = {
  content: DocumentReference[];
  totalElements: number;
  number: number;
};

export type FetchDocumentsParams = {
  page: number;
  size: number;
  type?: string;
  ref?: string;
  boutique?: number | null;
  magasin?: number | null;
};

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchDocuments(params: FetchDocumentsParams, token: string): Promise<DocumentsPage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('size', String(params.size));
  if (params.type) qs.set('type', params.type);
  if (params.ref) qs.set('ref', params.ref);
  if (params.boutique != null) qs.set('boutique', String(params.boutique));
  if (params.magasin != null) qs.set('magasin', String(params.magasin));

  const res = await fetch(`${API_BASE_URL}/api/documents?${qs.toString()}`, { headers: authHeader(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Erreur chargement documents (${res.status})`);
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    totalElements: Number(data?.totalElements || 0),
    number: Number(data?.number || 0),
  };
}

// previewUrl/downloadUrl returned by the backend already include a leading "/api/" segment;
// downloadAndShareFile expects a path relative to "/api/", so strip that prefix here.
export function apiPathFromDocumentUrl(url?: string): string {
  return (url || '').replace(/^\/?api\//, '');
}
