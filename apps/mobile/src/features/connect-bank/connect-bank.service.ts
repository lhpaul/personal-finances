import type { Now, NewId } from '../../db/ids';
import {
  deleteConnectionIfNeverSynced,
  getConnectionByInstitution,
  markConnectionSyncing,
  upsertConnection,
} from '../../db/repositories/institutions';
import type { AppDatabase } from '../../db/types';
import { credentialsKeyFor, writeCredentials } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';

/**
 * The connect-a-bank write orchestration (implementation plan Decision 7). No React, no
 * module-level singleton — every dependency arrives through {@link ConnectBankDeps}, which is
 * what makes {@link connectBank} directly testable against a real in-memory SQLite store
 * (`credential-leak.db.test.ts`, `connect-bank.service.db.test.ts`) without mounting a screen.
 *
 * This module contains no `console.*` call (enforced by `no-console: 'error'` for
 * `src/features/connect-bank/**`) and no error message that interpolates a value — every failure
 * is the fixed, value-free {@link ConnectBankError} (AGENTS.md non-negotiable 1, Business Rule 4).
 */

export type ConnectBankErrorReason = 'connection_write_failed';

/** Deliberately carries no message built from `input` — only a fixed reason code. */
export class ConnectBankError extends Error {
  readonly reason: ConnectBankErrorReason;

  constructor(reason: ConnectBankErrorReason) {
    super(reason);
    this.name = 'ConnectBankError';
    this.reason = reason;
  }
}

export interface ConnectBankDeps {
  db: AppDatabase;
  secureStore: SecureStorePort;
  newId: NewId;
  now: Now;
}

export interface ConnectBankInput {
  institutionId: string;
  rut: string;
  password: string;
}

export interface ConnectBankResult {
  userFinancialInstitutionId: string;
  credentialsKey: string;
}

/**
 * Decision 7's ordered write sequence:
 *
 * 1. Write the credential to the secure store — **before** anything reaches the database, so a
 *    retry after a failed sync never has to re-ask for it (spec Decision 2). The plaintext
 *    argument is never retained by this function; the caller (`use-connect-bank.ts`) is what
 *    drops its own copy once this promise settles (Business Rule 5).
 * 2. Create or repair the connection and mark it `syncing`, in one transaction, so a crash
 *    between those two writes can never leave a connection claiming to sync when nothing started
 *    (Business Rule 17).
 * 3. On failure of step 2, and only when no connection existed for this bank before this call,
 *    compensate: delete the connection row (a no-op if the transaction already rolled it back)
 *    and delete the just-written secure-store entry, so a failed *new* connection leaves nothing
 *    behind. A failed *reconnect* attempt leaves the previous connection and its (now replaced)
 *    stored credential in place — never silently discarded (Business Rule 15, Business Rule 19).
 */
export async function connectBank(
  deps: ConnectBankDeps,
  input: ConnectBankInput,
): Promise<ConnectBankResult> {
  const { institutionId, rut, password } = input;
  const credentialsKey = credentialsKeyFor(institutionId);

  const existedBefore = getConnectionByInstitution(deps.db, institutionId) !== undefined;

  await writeCredentials(deps.secureStore, institutionId, { rut, password });

  let connectionId: string | undefined;
  try {
    deps.db.transaction((tx: AppDatabase) => {
      const upserted = upsertConnection(tx, {
        institutionId,
        credentialsKey,
        newId: deps.newId,
        now: deps.now,
      });
      connectionId = upserted.id;
      markConnectionSyncing(tx, upserted.id, deps.now());
    });
  } catch {
    if (!existedBefore) {
      if (connectionId !== undefined) deleteConnectionIfNeverSynced(deps.db, connectionId);
      await deps.secureStore.deleteItem(credentialsKey);
    }
    throw new ConnectBankError('connection_write_failed');
  }

  return { userFinancialInstitutionId: connectionId as string, credentialsKey };
}
