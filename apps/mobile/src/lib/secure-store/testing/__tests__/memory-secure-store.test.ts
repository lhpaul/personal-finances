import { createMemorySecureStore } from '../memory-secure-store';

describe('createMemorySecureStore (implementation plan for issue #19, Decision 17)', () => {
  it('round-trips a written value', async () => {
    const store = createMemorySecureStore();
    await store.setItem('a', 'one');
    await expect(store.getItem('a')).resolves.toBe('one');
  });

  it('returns null for a key that was never written', async () => {
    const store = createMemorySecureStore();
    await expect(store.getItem('missing')).resolves.toBeNull();
  });

  it('deleteItem removes the key', async () => {
    const store = createMemorySecureStore({ a: 'one' });
    await store.deleteItem('a');
    await expect(store.getItem('a')).resolves.toBeNull();
  });

  it('entries() enumerates every key currently held — the capability the real keychain lacks', async () => {
    const store = createMemorySecureStore({ a: 'one', b: 'two' });
    expect(store.entries()).toEqual({ a: 'one', b: 'two' });
    await store.deleteItem('a');
    expect(store.entries()).toEqual({ b: 'two' });
  });

  it('seeds from the constructor argument without aliasing the caller-supplied object', async () => {
    const initial = { a: 'one' };
    const store = createMemorySecureStore(initial);
    await store.setItem('a', 'mutated');
    expect(initial.a).toBe('one');
  });
});
