import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

import { fetchCurrentUser } from '../services/auth';

type AppState = {
  token: string | null;
  setToken: (t: string | null) => void;
  boutiqueId: number | null;
  setBoutiqueId: (id: number | null) => void;
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
  const [profile, setProfile] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [themePref, setThemePref] = useState<'system'|'light'|'dark'>('system');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync('auth_token');
        const savedBoutique = await SecureStore.getItemAsync('boutique_id');
        const savedTheme = await SecureStore.getItemAsync('theme_pref');
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
    if (themePref) SecureStore.setItemAsync('theme_pref', themePref);
  }, [themePref, ready]);
  // When token changes, load current user profile
  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!token) { setProfile(null); return; }
      try {
        const p = await fetchCurrentUser(token).catch(() => null);
        if (!mounted) return;
        setProfile(p?.user || p || null);
      } catch (e) {
        setProfile(null);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    if (token) SecureStore.setItemAsync('auth_token', token);
    else SecureStore.deleteItemAsync('auth_token');
  }, [token, ready]);

  useEffect(() => {
    if (!ready) return;
    if (boutiqueId != null) SecureStore.setItemAsync('boutique_id', String(boutiqueId));
    else SecureStore.deleteItemAsync('boutique_id');
  }, [boutiqueId, ready]);

  const value = useMemo(() => ({ token, setToken, boutiqueId, setBoutiqueId, profile, setProfile, ready, themePref, setThemePref }), [token, boutiqueId, profile, ready, themePref]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
