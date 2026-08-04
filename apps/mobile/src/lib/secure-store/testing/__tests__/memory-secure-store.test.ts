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
