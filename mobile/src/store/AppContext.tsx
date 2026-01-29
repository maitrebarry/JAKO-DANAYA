import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

type AppState = {
  token: string | null;
  setToken: (t: string | null) => void;
  boutiqueId: number | null;
  setBoutiqueId: (id: number | null) => void;
  ready: boolean;
};

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [boutiqueId, setBoutiqueId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync('auth_token');
        const savedBoutique = await SecureStore.getItemAsync('boutique_id');
        if (!mounted) return;
        if (savedToken) setToken(savedToken);
        if (savedBoutique) setBoutiqueId(Number(savedBoutique));
      } finally {
        if (mounted) setReady(true);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

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

  const value = useMemo(() => ({ token, setToken, boutiqueId, setBoutiqueId, ready }), [token, boutiqueId, ready]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
