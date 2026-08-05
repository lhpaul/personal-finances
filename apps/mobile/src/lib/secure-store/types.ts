/**
 * The two `expo-secure-store` protection classes this app writes with (implementation plan for
 * issue #25, Decision 4). Both exclude the entry from an encrypted device backup — the property
 * that matters for AGENTS.md non-negotiable 1 — but differ in when they become readable again
 * after a reboot:
 *
 * - `'when_unlocked_this_device'` — #9's original, hard-coded choice for a bank credential: only
 *   ever read during a foreground, user-initiated sync.
 * - `'after_first_unlock_this_device'` — the database key (issue #25): anything that wakes the
 *   app needs it, including #18's local notification handling, which can run while the device is
 *   locked. A `WHEN_UNLOCKED` key would make the store unreadable in exactly that case.
 */
export type SecureStoreAccessibility = 'when_unlocked_this_device' | 'after_first_unlock_this_device';

/**
 * The device secure-store contract this app depends on (implementation plan Layer-by-Layer →
 * Frontend/UI, Decision 4; widened by issue #25's Decision 4). Deliberately minimal: `getItem` /
 * `setItem` / `deleteItem` and nothing else — in particular **no "list keys" method**, because a
 * keychain offers no such API and this port must never invent a capability the real store cannot
 * honestly provide (Decision 6's `resolveLockedRut` works around the gap from the connections
 * table instead).
 *
 * `setItem`'s `options.accessibility` is optional and **defaults to
 * `'when_unlocked_this_device'`** in every implementer (issue #25 Assumption A4) — every existing
 * #9 call site is byte-identical to before this widening; only `src/db/encryption/key.ts` passes
 * `'after_first_unlock_this_device'` explicitly (issue #25's Decision 4's A7: never rely on a
 * default for the database key specifically — it always names the accessibility it wants).
 *
 * Every implementer of this port may be handed a plaintext credential value. The only production
 * implementer is `expo-secure-store.adapter.ts`, and the only caller of *that* implementer must
 * be `credential-store.ts` or `src/db/encryption/key.ts` (AGENTS.md non-negotiable 1, extended to
 * the database key by issue #25).
 */
export interface SecureStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string, options?: { accessibility?: SecureStoreAccessibility }): Promise<void>;
  deleteItem(key: string): Promise<void>;
}
