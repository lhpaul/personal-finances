import * as SecureStore from 'expo-secure-store';

import type { SecureStorePort } from './types';

/**
 * The **only** module in this repository allowed to import `expo-secure-store` (implementation
 * plan Decision 4, AGENTS.md non-negotiable 1). Enforced twice: `secureStoreBoundary`
 * (`eslint.config.mjs`) for the fast feedback loop, and
 * `apps/mobile/src/__tests__/secure-store-boundary.test.ts` — a source-text scan — so the
 * guarantee survives a lint-config regression.
 *
 * Every write passes `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` explicitly. This is not
 * a detail: `expo-secure-store`'s own default (confirmed against the installed
 * `expo-secure-store/build/SecureStore.d.ts`, `@default SecureStore.WHEN_UNLOCKED`) has **no**
 * `…ThisDeviceOnly` suffix, and a keychain item without one of the `ThisDeviceOnly` protection
 * classes is carried into encrypted iOS device backups and can be restored onto a different
 * device. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` excludes the entry from backup and restore, so a bank
 * password never leaves this phone even inside an iCloud backup. On Android the option is inert
 * — the Keystore-backed store is already device-local — so passing it unconditionally is safe on
 * both platforms.
 */
const WRITE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const expoSecureStoreAdapter: SecureStorePort = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value, WRITE_OPTIONS);
  },
  deleteItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
