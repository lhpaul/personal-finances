import * as SecureStore from 'expo-secure-store';

import type { SecureStoreAccessibility, SecureStorePort } from './types';

/**
 * The **only** module in this repository allowed to import `expo-secure-store` (implementation
 * plan Decision 4, AGENTS.md non-negotiable 1). Enforced twice: `secureStoreBoundary`
 * (`eslint.config.mjs`) for the fast feedback loop, and
 * `apps/mobile/src/__tests__/secure-store-boundary.test.ts` — a source-text scan — so the
 * guarantee survives a lint-config regression.
 *
 * Every write passes an explicit `keychainAccessible` — never `expo-secure-store`'s own default
 * (confirmed against the installed `expo-secure-store/build/SecureStore.d.ts`, `@default
 * SecureStore.WHEN_UNLOCKED`), which has **no** `…ThisDeviceOnly` suffix and would carry the
 * entry into an encrypted iOS device backup, restorable onto a different device. Both protection
 * classes this adapter maps to (issue #25's Decision 4) exclude that: `getItem`'s `options` is
 * optional and **defaults to `'when_unlocked_this_device'`** — every #9 call site keeps its exact
 * pre-issue-#25 behaviour — while `src/db/encryption/key.ts` passes
 * `'after_first_unlock_this_device'` explicitly for the database key, which must stay readable
 * while the device is locked (a background notification wake, #18). On Android the option is
 * inert either way — the Keystore-backed store is already device-local — so passing one
 * unconditionally is safe on both platforms.
 */
const ACCESSIBILITY_MAP: Record<SecureStoreAccessibility, SecureStore.SecureStoreOptions['keychainAccessible']> = {
  when_unlocked_this_device: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  after_first_unlock_this_device: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const expoSecureStoreAdapter: SecureStorePort = {
  getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string, options?: { accessibility?: SecureStoreAccessibility }): Promise<void> {
    const accessibility = options?.accessibility ?? 'when_unlocked_this_device';
    return SecureStore.setItemAsync(key, value, {
      keychainAccessible: ACCESSIBILITY_MAP[accessibility],
    });
  },
  deleteItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
