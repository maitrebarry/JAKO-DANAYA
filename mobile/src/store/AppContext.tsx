import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

import { fetchCurrentUser } from '../services/auth';
import { getBoutiqueById, type BoutiqueDTO } from '../services/boutiques';
import { fetchAllPays } from '../services/pays';
import { getItem, setItem, removeItem } from '../utils/storage';
import { mergeAuthMeResponse } from '../utils/profile';

type AppState = {
  token: string | null;
  setToken: (t: string | null) => void;
  boutiqueId: number | null;
  setBoutiqueId: (id: number | null) => void;
  currentBoutique: BoutiqueDTO | null;
  setCurrentBoutique: (b: BoutiqueDTO | null) => void;
  profile: any | null;
  setProfile: (p: any | null) => void;
  ready: boolean;
  themePref: 'system'|'light'|'dark';
  setThemePref: (p: 'system'|'light'|'dark') => void;
};

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [currentBoutique, setCurrentBoutique] = useState<BoutiqueDTO | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [themePref, setThemePref] = useState<'system'|'light'|'dark'>('system');

  const extractBoutiqueId = (payload: any): number | null => {
    const p = payload || null;
    const merged = mergeAuthMeResponse(p);
    const fromMerged = merged?.currentBoutique?.id ?? merged?.boutique?.id;
    const fromRaw = p?.currentBoutique?.id ?? p?.boutique?.id ?? p?.user?.currentBoutique?.id ?? p?.user?.boutique?.id;
    const id = fromMerged ?? fromRaw;
    if (id == null) return null;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const savedToken = await getItem('auth_token');
        const savedBoutique = await getItem('boutique_id');
        const savedTheme = await getItem('theme_pref');
        if (!mounted) return;
        if (savedToken) setToken(savedToken);
        if (savedBoutique) setBoutiqueId(Number(savedBoutique));
        if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') setThemePref(savedTheme as any);
      } finally {
        if (mounted) setReady(true);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (themePref) setItem('theme_pref', themePref);
  }, [themePref, ready]);
  // When token changes, load current user profile
  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!token) { setProfile(null); return; }
      try {
        const p = await fetchCurrentUser(token).catch(() => null);
        if (!mounted) return;
        const merged = mergeAuthMeResponse(p);
        setProfile(merged);

        // Auto-select boutique if backend provides an assigned boutique (common for GERANT/CAISSIER/MAGASINIER)
        const inferred = extractBoutiqueId(p);
        if (inferred != null) {
          setBoutiqueId((prev) => (prev != null ? prev : inferred));
        }
      } catch (e) {
        setProfile(null);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [token]);

  // When token/boutique changes, load current boutique details (including pays/devise)
  useEffect(() => {
    let mounted = true;
    const loadBoutique = async () => {
      if (!token || boutiqueId == null) {
        setCurrentBoutique(null);
        return;
      }
      try {
        const b = await getBoutiqueById(boutiqueId, token);
        let enriched: BoutiqueDTO = b as any;

        const pays = (enriched as any)?.pays || null;
        const needsDevise = !!pays && !pays.deviseSymbole;
        if (needsDevise) {
          const allPays = await fetchAllPays(token).catch(() => []);
          const match = (allPays || []).find((p: any) => {
            if (!p) return false;
            if (pays?.id != null && p?.id != null) return Number(p.id) === Number(pays.id);
            if (pays?.codeIso && p?.codeIso) return String(p.codeIso).toUpperCase() === String(pays.codeIso).toUpperCase();
            return false;
          });
          if (match) {
            enriched = {
              ...(enriched as any),
              pays: {
                ...(pays as any),
                deviseSymbole: match.deviseSymbole ?? (pays as any).deviseSymbole ?? null,
                deviseCode: match.deviseCode ?? (pays as any).deviseCode ?? null,
              },
            } as any;
          }
        }

        if (mounted) setCurrentBoutique(enriched);
      } catch (e) {
        if (mounted) setCurrentBoutique(null);
      }
    };

    loadBoutique();
    return () => {
      mounted = false;
    };
  }, [token, boutiqueId]);

  useEffect(() => {
    if (!ready) return;
    if (token) setItem('auth_token', token);
    else removeItem('auth_token');
  }, [token, ready]);

  useEffect(() => {
    if (!ready) return;
    if (boutiqueId != null) setItem('boutique_id', String(boutiqueId));
    else removeItem('boutique_id');
  }, [boutiqueId, ready]);

  const value = useMemo(
    () => ({ token, setToken, boutiqueId, setBoutiqueId, currentBoutique, setCurrentBoutique, profile, setProfile, ready, themePref, setThemePref }),
    [token, boutiqueId, currentBoutique, profile, ready, themePref]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
