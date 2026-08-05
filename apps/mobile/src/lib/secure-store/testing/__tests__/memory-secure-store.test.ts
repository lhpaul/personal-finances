import { credentialsKeyFor } from '../../credential-store';
import { createMemorySecureStore } from '../memory-secure-store';

const KEY_A = credentialsKeyFor('banco-de-chile');
const KEY_B = credentialsKeyFor('falabella');

describe('createMemorySecureStore (implementation plan for issue #19, Decision 17)', () => {
  it('round-trips a written value', async () => {
    const store = createMemorySecureStore();
    await store.setItem(credentialsKeyFor('banco-de-chile'), 'one');
    await expect(store.getItem(KEY_A)).resolves.toBe('one');
  });

  it('returns null for a key that was never written', async () => {
    const store = createMemorySecureStore();
    await expect(store.getItem(KEY_A)).resolves.toBeNull();
  });

  it('deleteItem removes the key', async () => {
    const store = createMemorySecureStore({ [KEY_A]: 'one' });
    await store.deleteItem(KEY_A);
    await expect(store.getItem(KEY_A)).resolves.toBeNull();
  });

  it('entries() enumerates every key currently held — the capability the real keychain lacks', async () => {
    const store = createMemorySecureStore({ [KEY_A]: 'one', [KEY_B]: 'two' });
    expect(store.entries()).toEqual({ [KEY_A]: 'one', [KEY_B]: 'two' });
    await store.deleteItem(KEY_A);
    expect(store.entries()).toEqual({ [KEY_B]: 'two' });
  });

  it('seeds from the constructor argument without aliasing the caller-supplied object', async () => {
    const initial = { [KEY_A]: 'one' };
    const store = createMemorySecureStore(initial);
    await store.setItem(credentialsKeyFor('banco-de-chile'), 'mutated');
    expect(initial[KEY_A]).toBe('one');
  });
});

/**
 * Issue #100: this fake must reject exactly what the real `expo-secure-store`'s key validator
 * rejects (`/^[\w.-]+$/`, verified against `node_modules/expo-secure-store/build/SecureStore.js`
 * — see `memory-secure-store.ts`'s own doc comment for the citation), so a hand-built colon key
 * fails a Node-tier test instead of only surfacing on a real device — the same class of gap #25
 * (PR #99) found for `db_key:main`.
 *
 * **Both directions, planted**: E1/E2/E3 prove the fake rejects what the real module rejects
 * (an invalid key never silently round-trips); E4/E5 prove a genuinely valid key — including the
 * pre-#100 plan's colon-format literal's dot-separated replacement — passes with the same
 * behavior the real module would produce (an empty diff between "this fake accepts it" and "the
 * real module's regex accepts it"). The planted-defect proof required in the PR body is recorded
 * by temporarily deleting `assertValidKey`'s call sites in `memory-secure-store.ts` and
 * re-running this suite: E1-E3 fail (a colon key round-trips instead of throwing) — see the PR
 * description for the recorded output.
 */
describe('createMemorySecureStore enforces the real expo-secure-store key validator (issue #100)', () => {
  it('E1: setItem rejects a colon key — the exact shape the pre-#100 credentialsKeyFor produced', async () => {
    const store = createMemorySecureStore();
    await expect(store.setItem('bank_creds:banco-de-chile', 'x')).rejects.toThrow(
      'Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".',
    );
  });

  it('E2: getItem rejects a colon key — the real module validates on every operation, not just writes', async () => {
    const store = createMemorySecureStore();
    await expect(store.getItem('bank_creds:banco-de-chile')).rejects.toThrow(/Invalid key provided to SecureStore/);
  });

  it('E3: deleteItem rejects a colon key, and the constructor rejects a colon-keyed seed', async () => {
    const store = createMemorySecureStore();
    await expect(store.deleteItem('bank_creds:banco-de-chile')).rejects.toThrow(/Invalid key provided to SecureStore/);
    expect(() => createMemorySecureStore({ 'bank_creds:banco-de-chile': 'x' })).toThrow(
      /Invalid key provided to SecureStore/,
    );
  });

  it('E4: a real credentialsKeyFor(...) output (dot-separated) round-trips with no rejection', async () => {
    const store = createMemorySecureStore();
    await expect(store.setItem(credentialsKeyFor('banco-de-chile'), 'x')).resolves.toBeUndefined();
    await expect(store.getItem(credentialsKeyFor('banco-de-chile'))).resolves.toBe('x');
  });

  it('E5: every character class the real regex allows (alphanumeric, ".", "-", "_") round-trips', async () => {
    const store = createMemorySecureStore();
    const key = 'bank_creds.banco-de-chile_2';
    await expect(store.setItem(key, 'x')).resolves.toBeUndefined();
    await expect(store.getItem(key)).resolves.toBe('x');
  });
});
