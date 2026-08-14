import * as SecureStore from 'expo-secure-store';

import type { SecureStorePort } from './types';

export const expoSecureStoreAdapter: SecureStorePort = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  deleteItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
