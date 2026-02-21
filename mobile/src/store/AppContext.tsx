import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchCurrentUser } from '../services/auth';
import { getBoutiqueById, type BoutiqueDTO } from '../services/boutiques';
import { fetchAllPays } from '../services/pays';
import { fetchCurrentSubscriptionStatus, type CurrentSubscriptionDTO } from '../services/subscription';
import { getItem, setItem, removeItem } from '../utils/storage';
import { mergeAuthMeResponse } from '../utils/profile';
import { getRoleNames } from '../utils/permissions';

type AppContextState = {
  token: string | null;
  setToken: (t: string | null) => void;
  boutiqueId: number | null;
  setBoutiqueId: (id: number | null) => void;
  currentBoutique: BoutiqueDTO | null;
  setCurrentBoutique: (b: BoutiqueDTO | null) => void;
  profile: any | null;
  setProfile: (p: any | null) => void;
  ready: boolean;
  themePref: 'system' | 'light' | 'dark';
  setThemePref: (p: 'system' | 'light' | 'dark') => void;
  subscriptionStatus: CurrentSubscriptionDTO | null;
  refreshSubscriptionStatus: () => Promise<void>;
  subscriptionChecked: boolean;
};

const AppContext = createContext<AppContextState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [currentBoutique, setCurrentBoutique] = useState<BoutiqueDTO | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [themePref, setThemePref] = useState<'system' | 'light' | 'dark'>('system');
  const [subscriptionStatus, setSubscriptionStatus] = useState<CurrentSubscriptionDTO | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const canBeSubscriptionBlocked = (_profileLike: any): boolean => true;

  const refreshSubscriptionStatus = async () => {
    if (!token) {
      setSubscriptionStatus(null);
      setSubscriptionChecked(false);
      return;
    }
    try {
      const s = await fetchCurrentSubscriptionStatus(token);
      const shouldTrack = canBeSubscriptionBlocked(profile);
      if (!shouldTrack) {
        setSubscriptionStatus(null);
        setSubscriptionChecked(true);
        return;
      }
      setSubscriptionStatus(s || null);
      setSubscriptionChecked(true);
    } catch (e) {
      setSubscriptionStatus(null);
      setSubscriptionChecked(true);
    }
  };

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

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!token) {
        setProfile(null);
        setSubscriptionStatus(null);
        setSubscriptionChecked(false);
        return;
      }
      try {
        const p = await fetchCurrentUser(token).catch(() => null);
        if (!mounted) return;
        if (!p) {
          setProfile(null);
          setSubscriptionStatus(null);
          setBoutiqueId(null);
          setToken(null);
          return;
        }
        const merged = mergeAuthMeResponse(p);
        setProfile(merged);

        const inferred = extractBoutiqueId(p);
        if (inferred != null) {
          setBoutiqueId((prev) => (prev != null ? prev : inferred));
        }

        if (canBeSubscriptionBlocked(merged)) {
          const s = await fetchCurrentSubscriptionStatus(token).catch(() => null);
          if (mounted) {
            setSubscriptionStatus(s || null);
            setSubscriptionChecked(true);
          }
        } else {
          if (mounted) {
            setSubscriptionStatus(null);
            setSubscriptionChecked(true);
          }
        }
      } catch (e) {
        setProfile(null);
        setSubscriptionStatus(null);
        setBoutiqueId(null);
        setToken(null);
        setSubscriptionChecked(true);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, boutiqueId, profile?.id]);

  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshSubscriptionStatus();
      }
    });
    return () => {
      sub.remove();
    };
  }, [token, profile?.id, boutiqueId]);

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
    () => ({ token, setToken, boutiqueId, setBoutiqueId, currentBoutique, setCurrentBoutique, profile, setProfile, ready, themePref, setThemePref, subscriptionStatus, refreshSubscriptionStatus, subscriptionChecked }),
    [token, boutiqueId, currentBoutique, profile, ready, themePref, subscriptionStatus, subscriptionChecked]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
