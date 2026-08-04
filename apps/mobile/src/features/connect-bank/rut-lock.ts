import { listConnectionsForCredentialLookup } from '../../db/repositories/institutions';
import type { AppDatabase } from '../../db/types';
import { readCredentials } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';

/**
 * The RUT-lock resolver (implementation plan Decision 6, spec Decision 3, Business Rule 13).
 * The lock is triggered by the existence of *any* stored credential entry, not by counting
 * connections — a keychain offers no "list every key" API, so this walks the connections table
 * (the deterministic key list `listConnectionsForCredentialLookup` provides, oldest first) and
 * asks the secure store for each one in turn. The first entry found wins; once every connection's
 * credential entry has been deleted (spec Assumption 4), nothing is found and the field is
 * editable again.
 */
export async function resolveLockedRut(
  db: AppDatabase,
  port: SecureStorePort,
): Promise<string | null> {
  for (const connection of listConnectionsForCredentialLookup(db)) {
    const stored = await readCredentials(port, connection.institutionId);
    if (stored !== null) return stored.rut;
  }
  return null;
}
