export const API_BASE = 'http://localhost:8085/api';
export const AUTH_HEADER = () => ({ Authorization: `Bearer ${localStorage.getItem('smb_token')}` });

export type WidgetDTO = { key: string; permission?: string; data?: any };
export type SectionDTO = { role: string; widgets: WidgetDTO[]; shops?: { id?: number; nom?: string }[] };

export type DashboardPayload = {
  role?: string;
  widgets?: Record<string, any>;
  sections?: SectionDTO[];
  currentBoutique?: { id?: number; nom?: string };
};

export async function getDashboard(shopId?: number, magasinId?: number): Promise<DashboardPayload> {
  let url = `${API_BASE}/dashboard`;
  const params = [];
  if (shopId) params.push(`shopId=${shopId}`);
  if (magasinId) params.push(`magasinId=${magasinId}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Authentification requise');
    const text = await res.text();
    throw new Error(`Dashboard fetch failed: ${res.status} ${text}`);
  }
  return await res.json() as DashboardPayload;
}

export type SubordinateDashboard = {
  role?: string;
  name?: string;
  shopName?: string;
  widgets?: WidgetDTO[];
};

/**
 * Attempt to fetch dashboards of subordinates. Backend endpoint may not exist; in that case returns an empty array.
 */
export async function getSubordinatesDashboards(): Promise<SubordinateDashboard[]> {
  const url = `${API_BASE}/dashboard/subordinates`;
  try {
    const res = await fetch(url, { headers: AUTH_HEADER() });
    if (!res.ok) return [];
    return await res.json() as SubordinateDashboard[];
  } catch (e) {
    // Endpoint not available or network error; return empty list gracefully
    return [];
  }
}

export type Boutique = {
  id: number;
  nom: string;
  pays?: { codeIso?: string; nom?: string };
};

export type Magasin = {
  id: number;
  nom: string;
  adresse?: string;
  typeMagasin?: string;
  boutique?: Boutique;
};

/**
 * Fetch all boutiques accessible to the current user
 */
export async function getBoutiques(): Promise<Boutique[]> {
  const url = `${API_BASE}/boutiques`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    throw new Error(`Failed to fetch boutiques: ${res.status}`);
  }
  return await res.json() as Boutique[];
}

export async function getMagasins(): Promise<Magasin[]> {
  const url = `${API_BASE}/magasins`;
  const res = await fetch(url, { headers: AUTH_HEADER() });
  if (!res.ok) {
    throw new Error(`Failed to fetch magasins: ${res.status}`);
  }
  return await res.json() as Magasin[];
}
