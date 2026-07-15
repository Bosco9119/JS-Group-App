import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'driver_app_token';

type TokenStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function webStore(): TokenStore {
  return {
    async getItem(key) {
      if (typeof sessionStorage === 'undefined') return null;
      return sessionStorage.getItem(key);
    },
    async setItem(key, value) {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(key, value);
    },
    async removeItem(key) {
      if (typeof sessionStorage === 'undefined') return;
      sessionStorage.removeItem(key);
    },
  };
}

function nativeStore(): TokenStore {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
}

function storage(): TokenStore {
  return Platform.OS === 'web' ? webStore() : nativeStore();
}

export async function getToken(): Promise<string | null> {
  return storage().getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await storage().setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await storage().removeItem(TOKEN_KEY);
}
