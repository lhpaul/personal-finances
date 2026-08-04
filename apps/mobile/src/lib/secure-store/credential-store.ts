import type { SecureStorePort } from './types';

/**
 * The pure layer over {@link SecureStorePort} (implementation plan Layer-by-Layer, Decision 5).
 * Contains no `console.*` call and no error message that interpolates a value — every failure
 * this module can produce is a fixed constant string (AGENTS.md non-negotiable 1, Business
 * Rule 4).
 */

export interface BankCredentials {
  rut: string;
  password: string;
}

/**
 * `credentialsKeyFor('banco-de-chile') === 'bank_creds:banco-de-chile'`, exactly as
 * `docs/project/4-database-model.md` records for `user_financial_institutions.credentials_key`.
 * Deterministic by construction (Decision 5): reconnecting a bank always resolves to the same
 * key, so there is never a second secure-store entry for the same institution.
 */
export function credentialsKeyFor(institutionId: string): string {
  return `bank_creds:${institutionId}`;
}

/** Writes both credential values as one JSON object under one key per bank (Decision 4). */
export function writeCredentials(
  port: SecureStorePort,
  institutionId: string,
  credentials: BankCredentials,
): Promise<void> {
  return port.setItem(credentialsKeyFor(institutionId), JSON.stringify(credentials));
}

/**
 * Returns `null` when no entry exists, and also when the stored text is not a well-formed
 * `BankCredentials` object — a corrupted or foreign-shaped entry must never crash a screen or be
 * echoed back (mirrors `src/db/json.ts`'s JSON-guard philosophy for every other stored JSON
 * column). Never throws, and never includes the raw stored text in any diagnostic.
 */
export async function readCredentials(
  port: SecureStorePort,
  institutionId: string,
): Promise<BankCredentials | null> {
  const raw = await port.getItem(credentialsKeyFor(institutionId));
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    typeof (parsed as Record<string, unknown>).rut === 'string' &&
    typeof (parsed as Record<string, unknown>).password === 'string'
  ) {
    return parsed as BankCredentials;
  }
  return null;
}

export function deleteCredentials(port: SecureStorePort, institutionId: string): Promise<void> {
  return port.deleteItem(credentialsKeyFor(institutionId));
}
