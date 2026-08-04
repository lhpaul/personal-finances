import { deleteCredentials } from '../../lib/secure-store/credential-store';
import type { SecureStorePort } from '../../lib/secure-store/types';
import { disconnectInstitution } from '../../db/repositories/institutions';
import type { AppDatabase } from '../../db/types';

/**
 * Disconnecting a bank (implementation plan for issue #20, Decision 1, Decision 2; brief AC2;
 * BR3). **Never** a row deletion — `user_financial_products` and `transactions` both cascade from
 * `user_financial_institutions` (`ON DELETE cascade`), so a `DELETE` here would silently destroy
 * every movement the person owns. The only write is `disconnectInstitution`'s
 * `UPDATE … SET status = 'disconnected'` (issue #3, unchanged), preceded by a keychain delete.
 */
export type DisconnectOutcome =
  | { status: 'disconnected' }
  | { status: 'failed'; stage: 'credential' | 'connection' };

export interface DisconnectBankDeps {
  db: AppDatabase;
  secureStore: SecureStorePort;
}

export interface DisconnectBankInput {
  /** `user_financial_institutions.id` — the row `disconnectInstitution` updates. */
  connectionId: string;
  /** `financial_institutions.id` — what `credentialsKeyFor` derives the keychain key from. */
  institutionId: string;
}

/**
 * The credential is deleted **first** (Decision 2). If the status flip ran first and the
 * keychain delete then failed, the person would be shown "desconectado" while their credential
 * was still on the device — the one failure mode BR1 exists to prevent. With the credential
 * first, the worst residue is a connection still `'active'` whose credential is already gone:
 * the privacy promise is kept, the row stays visible with a failure `Note`, and the action is
 * re-runnable — `SecureStorePort.deleteItem` on an absent key is a no-op (Decision 2) and
 * `disconnectInstitution` is an idempotent `UPDATE`.
 */
export async function disconnectBank(
  deps: DisconnectBankDeps,
  input: DisconnectBankInput,
): Promise<DisconnectOutcome> {
  try {
    await deleteCredentials(deps.secureStore, input.institutionId);
  } catch {
    return { status: 'failed', stage: 'credential' };
  }

  try {
    disconnectInstitution(deps.db, input.connectionId);
  } catch {
    return { status: 'failed', stage: 'connection' };
  }

  return { status: 'disconnected' };
}
