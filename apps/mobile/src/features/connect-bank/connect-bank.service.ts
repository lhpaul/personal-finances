import { normalizeRut } from '@finanzas/shared-utils';

import type { Now, NewId } from '../../db/ids';
import {
  deleteConnectionIfNeverSynced,
  getConnectionByInstitution,
  markConnectionSyncing,
  upsertConnection,
} from '../../db/repositories/institutions';
import type { AppDatabase } from '../../db/types';
import { credentialsKeyFor, readCredentials, writeCredentials } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { resolveLockedRut } from './rut-lock';

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

export type ConnectBankErrorReason = 'connection_write_failed' | 'rut_locked_mismatch';

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
 * Decision 7's ordered write sequence, plus two hardening steps added in review (CodeRabbit
 * PR #80):
 *
 * 0. Re-check Business Rule 13's RUT lock server-side, not only in the UI (`CredentialForm`'s
 *    `locked` prop already prevents editing the RUT field once any credential entry exists, but
 *    that is a presentation-layer guarantee — `resolveLockedRut` failing closed to `unlocked` on
 *    a transient secure-store read error would otherwise let a mismatched RUT reach this
 *    function with no other check in the way). Nothing has been written yet at this point, so a
 *    mismatch throws immediately with no compensation needed.
 * 1. Write the credential to the secure store — **before** anything reaches the database, so a
 *    retry after a failed sync never has to re-ask for it (spec Decision 2). The plaintext
 *    argument is never retained by this function; the caller (`use-connect-bank.ts`) is what
 *    drops its own copy once this promise settles (Business Rule 5). For an existing connection,
 *    the credential that was in place *before* this write is read and held first, so it can be
 *    restored if the database write below fails.
 * 2. Create or repair the connection and mark it `syncing`, in one transaction, so a crash
 *    between those two writes can never leave a connection claiming to sync when nothing started
 *    (Business Rule 17).
 * 3. On failure of step 2: for a *new* connection, compensate by deleting the connection row (a
 *    no-op if the transaction already rolled it back) and the just-written secure-store entry, so
 *    nothing is left behind. For an *existing* connection (a reconnect), restore the credential
 *    that was in place before step 1 overwrote it — the earlier version of this function left the
 *    unconfirmed new value in place on a database failure, which could strand a stale password
 *    disguised as the current one. Each compensation step is isolated in its own `try`/`catch` so
 *    a failure *during* cleanup can never replace the fixed `ConnectBankError` the caller expects
 *    with a raw provider error (which could carry implementation detail in its message).
 */
export async function connectBank(
  deps: ConnectBankDeps,
  input: ConnectBankInput,
): Promise<ConnectBankResult> {
  const { institutionId, rut, password } = input;
  const credentialsKey = credentialsKeyFor(institutionId);

  const existedBefore = getConnectionByInstitution(deps.db, institutionId) !== undefined;

  const lockedRut = await resolveLockedRut(deps.db, deps.secureStore);
  if (lockedRut !== null && normalizeRut(lockedRut) !== normalizeRut(rut)) {
    throw new ConnectBankError('rut_locked_mismatch');
  }

  const priorCredentials = existedBefore ? await readCredentials(deps.secureStore, institutionId) : null;

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
      // Item #10's canonical markConnectionSyncing (merged after this item's implementation
      // started) writes only sync_status — last_sync_at is written once by whichever exit
      // function (recordSyncOutcomeInTx / recordSyncOutcome / clearStuckSyncingConnections)
      // eventually resolves this attempt, from one shared `now` (Resolution R5 update).
      markConnectionSyncing(tx, upserted.id);
    });
  } catch {
    if (!existedBefore) {
      try {
        if (connectionId !== undefined) deleteConnectionIfNeverSynced(deps.db, connectionId);
      } catch {
        // Best-effort: the fixed failure reason below is what the caller sees either way.
      }
      try {
        await deps.secureStore.deleteItem(credentialsKey);
      } catch {
        // Same: never let a provider error replace the value-free ConnectBankError.
      }
    } else if (priorCredentials !== null) {
      try {
        await writeCredentials(deps.secureStore, institutionId, priorCredentials);
      } catch {
        // Same: best-effort restore; the caller still sees the fixed failure reason.
      }
    }
    throw new ConnectBankError('connection_write_failed');
  }

  return { userFinancialInstitutionId: connectionId as string, credentialsKey };
}
