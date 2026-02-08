import { API_BASE_URL } from '../utils/env';

function authHeaders(token: string) {
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res: Response): Promise<string> {
  const txt = await res.text().catch(() => '');
  if (!txt) return `Erreur réseau (${res.status})`;
  try {
    const j = JSON.parse(txt);
    return j?.message || j?.error || txt;
  } catch {
    return txt;
  }
}

export type PaysDTO = {
  codeIso: string;
  nom?: string | null;
  indicatif?: string | null;
  deviseSymbole?: string | null;
  deviseCode?: string | null;
  drapeau?: string | null;
};

async function listPaysBackend(token: string): Promise<PaysDTO[]> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/api/pays`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? (json as any) : [];
}

async function listPaysRestCountries(): Promise<PaysDTO[]> {
  const url = 'https://restcountries.com/v3.1/all?fields=cca2,name,idd,currencies,flags';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RestCountries indisponible (${res.status})`);
  const json = await res.json().catch(() => []);
  if (!Array.isArray(json)) return [];

  return (json as any[])
    .map((c) => {
      const code = String(c?.cca2 || '').toUpperCase();
      if (!code) return null;
      const name = String(c?.name?.common || c?.name?.official || '').trim();
      const iddRoot = String(c?.idd?.root || '').trim();
      const suffix = Array.isArray(c?.idd?.suffixes) && c.idd.suffixes.length ? String(c.idd.suffixes[0] || '') : '';
      const indicatif = iddRoot ? `${iddRoot}${suffix}` : '';
      const curKeys = c?.currencies ? Object.keys(c.currencies) : [];
      const deviseCode = curKeys.length ? String(curKeys[0]) : '';
      const deviseSymbole = curKeys.length ? String(c.currencies[curKeys[0]]?.symbol || deviseCode) : '';
      const drapeau = String(c?.flags?.png || c?.flags?.svg || '').trim();

      return {
        codeIso: code,
        nom: name,
        indicatif: indicatif || null,
        deviseCode: deviseCode || null,
        deviseSymbole: deviseSymbole || null,
        drapeau: drapeau || null,
      } as PaysDTO;
    })
    .filter(Boolean) as PaysDTO[];
}

/**
 * Récupère la liste des pays pour les sélecteurs.
 * - Essaie d'abord le backend `/api/pays`
 * - Complète avec RestCountries si possible, puis fusionne (backend prioritaire)
 */
export async function fetchAllPays(token: string): Promise<PaysDTO[]> {
  let backend: PaysDTO[] = [];
  try {
    backend = await listPaysBackend(token);
  } catch {
    backend = [];
  }

  let enriched: PaysDTO[] | null = null;
  try {
    enriched = await listPaysRestCountries();
  } catch {
    enriched = null;
  }

  if (!enriched || enriched.length === 0) {
    // backend only
    return (backend || [])
      .map((p) => ({
        ...p,
        codeIso: String(p.codeIso || '').toUpperCase(),
      }))
      .filter((p) => !!p.codeIso)
      .sort((a, b) => String(a.nom || a.codeIso).localeCompare(String(b.nom || b.codeIso)));
  }

  const map = new Map<string, PaysDTO>();
  enriched.forEach((p) => map.set(String(p.codeIso || '').toUpperCase(), { ...p, codeIso: String(p.codeIso || '').toUpperCase() }));
  (backend || []).forEach((p) => map.set(String(p.codeIso || '').toUpperCase(), { ...p, codeIso: String(p.codeIso || '').toUpperCase() }));

  return Array.from(map.values()).sort((a, b) => String(a.nom || a.codeIso).localeCompare(String(b.nom || b.codeIso)));
}
