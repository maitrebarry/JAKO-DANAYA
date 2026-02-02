import { useColorScheme } from 'react-native';
import { useApp } from './store/AppContext';

export const dark = {
  background: '#0b1220',
  surface: '#0f1724',
  card: '#111827',
  primary: '#0ea5e9',
  text: '#e5f6ff',
  muted: '#9ca3af',
  danger: '#ef4444',
};

export const light = {
  background: '#f8fafc',
  surface: '#fff',
  card: '#fff',
  primary: '#0ea5e9',
  text: '#0f172a',
  muted: '#666',
  danger: '#ef4444',
};

export const useTheme = () => {
  const scheme = useColorScheme();
  let baseScheme = scheme;
  try {
    const { themePref } = useApp();
    if (themePref === 'dark' || themePref === 'light') baseScheme = themePref;
  } catch (e) {
    // if AppProvider is not present, fall back to system
  }
  const base = baseScheme === 'dark' ? dark : light;
  return { ...base, isDark: baseScheme === 'dark' };
};
