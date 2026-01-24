import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  pseudo: string;
  typeUtilisateur: string;
  contact?: string;
  adresse?: string;
  avatar?: string;
}

interface UserContextType {
  user: User | null;
  permissions: string[];
  roles: string[];
  currentBoutique: any | null;
  setUserData: (data: any) => void;
  logout: () => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [currentBoutique, setCurrentBoutique] = useState<any | null>(null);
  const navigate = useNavigate();
  const tokenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTokenTimeout = useCallback(() => {
    if (tokenTimeoutRef.current) {
      clearTimeout(tokenTimeoutRef.current);
      tokenTimeoutRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearTokenTimeout();
    setUser(null);
    setPermissions([]);
    setRoles([]);
    setCurrentBoutique(null);
    localStorage.removeItem('smb_token');
    localStorage.removeItem('smb_user_data');
    navigate('/', { replace: true });
  }, [clearTokenTimeout, navigate]);

  const decodeJwtPayload = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(char => `%${('00' + char.charCodeAt(0).toString(16)).slice(-2)}`)
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  };

  const scheduleTokenExpiry = useCallback((token: string | null) => {
    clearTokenTimeout();
    if (!token) {
      return;
    }
    const decoded = decodeJwtPayload(token);
    if (!decoded || typeof decoded.exp !== 'number') {
      return;
    }
    const msUntilExpiry = decoded.exp * 1000 - Date.now();
    if (msUntilExpiry <= 0) {
      logout();
      return;
    }
    tokenTimeoutRef.current = setTimeout(() => {
      logout();
    }, msUntilExpiry);
  }, [clearTokenTimeout, logout]);

  const setUserData = useCallback((data: any) => {
    setUser(data.user || null);
    // normalize permissions and roles to uppercase for consistent checks
    setPermissions(Array.isArray(data.permissions) ? data.permissions.map((p:any) => p.toString().toUpperCase()) : []);
    const incomingRoles: string[] = Array.isArray(data.roles) ? data.roles.map((r:any) => r.toString().toUpperCase()) : [];
    // also include the typeUtilisateur as an implicit role (e.g., PROPRIETAIRE)
    try {
      const tu = data?.user?.typeUtilisateur;
      if (tu && typeof tu === 'string') {
        const ut = tu.toString().toUpperCase();
        if (!incomingRoles.includes(ut)) incomingRoles.push(ut);
      }
    } catch (e) {
      // ignore
    }
    setRoles(incomingRoles);
    setCurrentBoutique(data.currentBoutique || null);
    scheduleTokenExpiry(localStorage.getItem('smb_token'));
    // debug
    try { console.debug('UserContext setUserData - roles=', incomingRoles, 'permissions=', Array.isArray(data.permissions) ? data.permissions.length : 0); } catch(e){}
  }, [scheduleTokenExpiry]);

  useEffect(() => {
    const token = localStorage.getItem('smb_token');
    const userData = localStorage.getItem('smb_user_data');
    if (token && userData) {
      try {
        const data = JSON.parse(userData);
        setUserData(data);
      } catch (error) {
        console.error('Error parsing user data from localStorage:', error);
      }
    }
  }, [setUserData]);

  // If currentBoutique is present but missing detailed data (eg. pays), fetch it from API
  useEffect(() => {
    const ensureFullBoutique = async () => {
      try {
        if (currentBoutique && (currentBoutique as any).id && !(currentBoutique as any).pays) {
          const token = localStorage.getItem('smb_token');
          const res = await fetch(`http://localhost:8085/api/boutiques/${(currentBoutique as any).id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (res.ok) {
            const data = await res.json();
            setCurrentBoutique(data);
            // Optionally update stored user data so next refresh has full object
            try {
              const userDataStr = localStorage.getItem('smb_user_data');
              if (userDataStr) {
                const ud = JSON.parse(userDataStr);
                ud.currentBoutique = data;
                localStorage.setItem('smb_user_data', JSON.stringify(ud));
              }
            } catch (e) { /* ignore */ }
          }
        }
      } catch (err) {
        console.warn('Could not fetch full boutique details', err);
      }
    };
    ensureFullBoutique();
  }, [currentBoutique]);

  return (
    <UserContext.Provider value={{ user, permissions, roles, currentBoutique, setUserData, logout }}>
      {children}
    </UserContext.Provider>
  );
};