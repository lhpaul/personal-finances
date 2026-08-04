/**
 * The device secure-store contract this app depends on (implementation plan Layer-by-Layer →
 * Frontend/UI, Decision 4). Deliberately minimal: `getItem` / `setItem` / `deleteItem` and
 * nothing else — in particular **no "list keys" method**, because a keychain offers no such
 * API and this port must never invent a capability the real store cannot honestly provide
 * (Decision 6's `resolveLockedRut` works around the gap from the connections table instead).
 *
 * Every implementer of this port may be handed a plaintext credential value. The only production
 * implementer is `expo-secure-store.adapter.ts`, and the only caller of *that* implementer must
 * be `credential-store.ts` (AGENTS.md non-negotiable 1).
 */
export interface SecureStorePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}
