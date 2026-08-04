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

export function createMemorySecureStore(
  initial: Record<string, string> = {},
): MemorySecureStorePort {
  const store = new Map(Object.entries(initial));
  const accessibility = new Map<string, SecureStoreAccessibility>();

  return {
    getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value, options) => {
      store.set(key, value);
      accessibility.set(key, options?.accessibility ?? 'when_unlocked_this_device');
      return Promise.resolve();
    },
    deleteItem: (key) => {
      store.delete(key);
      accessibility.delete(key);
      return Promise.resolve();
    },
    entries: () => Object.fromEntries(store),
    accessibilityOf: (key) => accessibility.get(key),
  };
}
