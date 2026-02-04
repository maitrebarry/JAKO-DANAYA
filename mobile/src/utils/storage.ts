import * as SecureStore from 'expo-secure-store';

function hasSecureStore(): boolean {
  return !!(SecureStore && typeof (SecureStore as any).getItemAsync === 'function');
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (hasSecureStore()) return await (SecureStore as any).getItemAsync(key);
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
  } catch (e) {
    // ignore
  }
  return null;
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (hasSecureStore()) return await (SecureStore as any).setItemAsync(key, value);
    if (typeof localStorage !== 'undefined') return localStorage.setItem(key, value);
  } catch (e) {
    // ignore
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (hasSecureStore()) return await (SecureStore as any).deleteItemAsync(key);
    if (typeof localStorage !== 'undefined') return localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}
