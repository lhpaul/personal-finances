import type { SecureStoreAccessibility, SecureStorePort } from '../types';

/**
 * An in-memory `SecureStorePort` fake for Node-tier tests (implementation plan for issue #19,
 * Decision 17) — the one place in this codebase where "every key the store holds" can actually be
 * enumerated, which is exactly what `wipe-local-data.node.test.ts` needs to prove AC1: the real
 * `expo-secure-store` keychain offers no such API (`../types.ts`'s own doc comment), so this fake
 * is what lets the wipe proof assert the store is **completely** empty afterward, not merely that
 * `deleteItem` was called the expected number of times.
 */
export interface MemorySecureStorePort extends SecureStorePort {
  /** A snapshot of every key/value pair currently held — the enumeration the real keychain
   * cannot give us. */
  entries(): Record<string, string>;
  /** The `accessibility` option every `setItem` call was made with, keyed by key — a fake
   * keychain has no real protection classes, so this only exists to let issue #25's `key.test.ts`
   * assert the database key was written with `'after_first_unlock_this_device'` rather than
   * silently accepting whatever the default would have been. */
  accessibilityOf(key: string): SecureStoreAccessibility | undefined;
}

/**
 * Mirrors the installed `expo-secure-store@15.0.8`'s own private key validator exactly —
 * `build/SecureStore.js`'s `isValidKey`, `/^[\w.-]+$/.test(key)` — verified by reading that file
 * directly (`node_modules/expo-secure-store/build/SecureStore.js`), not inferred from SDK docs.
 * `expo-secure-store` does not export `isValidKey`/`ensureValidKey`, and this codebase's
 * `secureStoreBoundary` lint rule + `secure-store-boundary.test.ts` forbid importing the real
 * `expo-secure-store` package from anywhere outside `expo-secure-store.adapter.ts`, so this
 * pattern is a **verified, cited copy**, not a live import.
 *
 * Found on item #100: before this constant existed, this fake's `setItem`/`getItem`/`deleteItem`
 * accepted any string key, including one built with a colon (e.g. the plan's original
 * `bank_creds:<institutionId>` format) — a divergence from the real module's own validation that
 * let every Node-tier secure-store test pass while the real adapter would throw on a real device
 * (the same class of gap #25/PR #99 found for `db_key:main`). Enforcing the identical regex here
 * closes that gap structurally: a future hand-built colon (or space, or `@`, or any other
 * out-of-set character) key now fails the exact same Node-tier tests that exercise this fake,
 * instead of only failing on a real device.
 */
const REAL_SECURE_STORE_KEY_PATTERN = /^[\w.-]+$/;

/** The exact message text `expo-secure-store`'s `ensureValidKey` throws (`build/SecureStore.js`),
 * reproduced verbatim so a test asserting on this fake's rejection reads identically to what a
 * real-device crash log would show. */
const INVALID_KEY_MESSAGE =
  'Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".';

function assertValidKey(key: string): void {
  if (typeof key !== 'string' || !REAL_SECURE_STORE_KEY_PATTERN.test(key)) {
    throw new Error(INVALID_KEY_MESSAGE);
  }
}

export function createMemorySecureStore(
  initial: Record<string, string> = {},
): MemorySecureStorePort {
  for (const key of Object.keys(initial)) {
    assertValidKey(key);
  }
  const store = new Map(Object.entries(initial));
  const accessibility = new Map<string, SecureStoreAccessibility>();

  return {
    getItem: async (key) => {
      assertValidKey(key);
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem: async (key, value, options) => {
      assertValidKey(key);
      store.set(key, value);
      accessibility.set(key, options?.accessibility ?? 'when_unlocked_this_device');
    },
    deleteItem: async (key) => {
      assertValidKey(key);
      store.delete(key);
      accessibility.delete(key);
    },
    entries: () => Object.fromEntries(store),
    accessibilityOf: (key) => accessibility.get(key),
  };
}
