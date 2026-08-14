import type { SecureStorePort } from './types';

export function credentialsKeyFor(bankId: string): string {
  return `bank_creds.${bankId}`;
}

export function writeCredentials(
  port: SecureStorePort,
  bankId: string,
  credentials: Record<string, string>,
): Promise<void> {
  return port.setItem(credentialsKeyFor(bankId), JSON.stringify(credentials));
}

export async function readCredentials(
  port: SecureStorePort,
  bankId: string,
): Promise<Record<string, string> | null> {
  const raw = await port.getItem(credentialsKeyFor(bankId));
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.some(([, value]) => typeof value !== 'string')) return null;
    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    return null;
  }
}

export function deleteCredentials(port: SecureStorePort, bankId: string): Promise<void> {
  return port.deleteItem(credentialsKeyFor(bankId));
}
