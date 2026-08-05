import crypto from 'node:crypto';

import { createMemorySecureStore } from '../../../lib/secure-store/testing/memory-secure-store';
import { DatabaseEncryptionUnavailableError } from '../errors';
import { openEncryptedStore } from '../open-encrypted-store';
import type { CipherDatabasePort, CipherHandle } from '../types';

function nodeRandomBytes(byteCount: number): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(crypto.randomBytes(byteCount)));
}

/** A port that only ever needs to answer `cipherVersion()` for this suite — every other method
 * throws if called at all, which is exactly the "no database open" assertion below. */
function capabilityOnlyPort(version: string | null): CipherDatabasePort {
  const unreachable = (methodName: string) => (): never => {
    throw new Error(`${methodName} must not be called when cipherVersion() reports no SQLCipher build.`);
  };
  return {
    cipherVersion: () => version,
    openPlain: unreachable('openPlain') as unknown as (databaseName: string) => CipherHandle,
    openKeyed: unreachable('openKeyed') as unknown as (databaseName: string, keyHex: string) => CipherHandle,
    deleteDatabaseIfPresent: unreachable('deleteDatabaseIfPresent') as unknown as (databaseName: string) => void,
  };
}

describe('openEncryptedStore — capability probe (Decision 8)', () => {
  it('cipherVersion() === null throws DatabaseEncryptionUnavailableError and never opens a database', async () => {
    const port = capabilityOnlyPort(null);
    const secureStore = createMemorySecureStore();

    await expect(
      openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: () => '2026-01-01T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(DatabaseEncryptionUnavailableError);
  });

  it('does not fall back to a plaintext open on a missing SQLCipher build — no plaintext-open branch exists', async () => {
    const port = capabilityOnlyPort(null);
    const secureStore = createMemorySecureStore();

    // The port's openPlain/openKeyed both throw if ever invoked (capabilityOnlyPort's own
    // contract) — reaching this point without that throw firing already proves the capability
    // check ran before any open was attempted.
    await expect(
      openEncryptedStore({ port, secureStore, randomBytes: nodeRandomBytes, now: () => '2026-01-01T00:00:00.000Z' }),
    ).rejects.toThrow(/useSQLCipher/);
  });
});
