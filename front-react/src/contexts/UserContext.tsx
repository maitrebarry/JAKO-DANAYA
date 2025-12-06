import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  pseudo: string;
  typeUtilisateur: string;
}

interface UserContextType {
  user: User | null;
  permissions: string[];
  roles: string[];
  currentBoutique: { id: number; nom: string } | null;
  setUserData: (data: any) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

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
  const [currentBoutique, setCurrentBoutique] = useState<{ id: number; nom: string } | null>(null);
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
    setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
    setRoles(Array.isArray(data.roles) ? data.roles : []);
    setCurrentBoutique(data.currentBoutique || null);
    scheduleTokenExpiry(localStorage.getItem('smb_token'));
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

  return (
    <UserContext.Provider value={{ user, permissions, roles, currentBoutique, setUserData, logout }}>
      {children}
    </UserContext.Provider>
  );
};