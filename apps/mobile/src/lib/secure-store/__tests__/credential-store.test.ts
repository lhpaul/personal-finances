import {
  credentialsKeyFor,
  deleteCredentials,
  readCredentials,
  writeCredentials,
} from '../credential-store';
import type { SecureStorePort } from '../types';

function createFakePort(initial: Record<string, string> = {}): SecureStorePort {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(store.has(key) ? (store.get(key) as string) : null),
    setItem: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe('credentialsKeyFor', () => {
  it('is deterministic and matches the documented "bank_creds:<institution id>" shape', () => {
    expect(credentialsKeyFor('banco-de-chile')).toBe('bank_creds:banco-de-chile');
    expect(credentialsKeyFor('banco-de-chile')).toBe(credentialsKeyFor('banco-de-chile'));
  });

  it('produces a different key per institution', () => {
    expect(credentialsKeyFor('banco-de-chile')).not.toBe(credentialsKeyFor('santander'));
  });
});

describe('writeCredentials / readCredentials / deleteCredentials', () => {
  it('round-trips a written credential', async () => {
    const port = createFakePort();
    await writeCredentials(port, 'banco-de-chile', { rut: '12.345.678-5', password: 'secret' });
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toEqual({
      rut: '12.345.678-5',
      password: 'secret',
    });
  });

  it('returns null when no entry exists', async () => {
    const port = createFakePort();
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toBeNull();
  });

  it('returns null for malformed JSON rather than throwing', async () => {
    const port = createFakePort({ [credentialsKeyFor('banco-de-chile')]: 'not json' });
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toBeNull();
  });

  it('returns null when the stored shape is missing rut or password', async () => {
    const port = createFakePort({
      [credentialsKeyFor('banco-de-chile')]: JSON.stringify({ rut: '12.345.678-5' }),
    });
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toBeNull();
  });

  it('deletes an entry', async () => {
    const port = createFakePort();
    await writeCredentials(port, 'banco-de-chile', { rut: '12.345.678-5', password: 'secret' });
    await deleteCredentials(port, 'banco-de-chile');
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toBeNull();
  });

  it('scopes entries per institution — writing a second institution does not overwrite the first', async () => {
    const port = createFakePort();
    await writeCredentials(port, 'banco-de-chile', { rut: '12.345.678-5', password: 'one' });
    await writeCredentials(port, 'santander', { rut: '12.345.678-5', password: 'two' });
    await expect(readCredentials(port, 'banco-de-chile')).resolves.toEqual({
      rut: '12.345.678-5',
      password: 'one',
    });
    await expect(readCredentials(port, 'santander')).resolves.toEqual({
      rut: '12.345.678-5',
      password: 'two',
    });
  });
});
