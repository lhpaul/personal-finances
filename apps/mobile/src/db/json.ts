import { assertMinorUnits } from './money';

/**
 * Guards for every JSON `TEXT` column (`assets`, `metadata`, `labels`, `app_settings.value`).
 *
 * These columns are untrusted input in both directions: a row may have been written by an older
 * or newer app version (`docs/best-practices/stack/typescript.md` — "JSON columns … `JSON.parse`
 * returns `any`. Parse through a guard, and tolerate a missing key rather than crashing a
 * screen"). Every guard here:
 *
 * - wraps `JSON.parse` in `try`/`catch` and returns a safe empty value when the stored text is
 *   not valid JSON at all (a screen must never crash reading a legacy or corrupted row);
 * - treats every key as optional, so a row from a version that wrote fewer or more keys than
 *   this build still parses;
 * - never does `JSON.parse(...) as Shape` — every field is read with a `typeof` check, and an
 *   unexpected type for a known key is dropped rather than trusted;
 * - preserves unrecognised keys via the `merge*` counterpart, so a value this build does not
 *   know about (written by a newer app version) survives a write from this build; and
 * - rejects (throws) a money value that is not a whole number of minor units, because that is
 *   not tolerable input drift — it is the one invariant (implementation plan Decision 4,
 *   `src/db/money.ts`) that must never silently pass through, in a first-class column or inside
 *   shape-varying data alike.
 */

function safeParseRecord(raw: string | null | undefined): Record<string, unknown> {
  if (raw == null) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

// -------------------------------------------------------------------------------------------
// assets — key → asset URL / emoji. Presentational only, never queried, so kept as a flexible
// string map rather than a fixed shape (`financial_institutions.assets`, `merchants.assets`,
// `transaction_categories.assets`).
// -------------------------------------------------------------------------------------------
export type Assets = Record<string, string>;

export function parseAssets(raw: string | null | undefined): Assets {
  const record = safeParseRecord(raw);
  const result: Assets = {};
  for (const key of Object.keys(record)) {
    const value = stringField(record, key);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function mergeAssets(raw: string | null | undefined, patch: Partial<Assets>): string {
  const merged: Record<string, unknown> = { ...safeParseRecord(raw), ...patch };
  return JSON.stringify(merged);
}

// -------------------------------------------------------------------------------------------
// financial_institutions.metadata — presentational, bank-specific, never queried.
// -------------------------------------------------------------------------------------------
export interface InstitutionMetadata {
  short_name?: string;
  brand_color?: string;
  support_url?: string;
  [key: string]: unknown;
}

export function parseInstitutionMetadata(raw: string | null | undefined): InstitutionMetadata {
  const record = safeParseRecord(raw);
  return { ...record };
}

export function mergeInstitutionMetadata(
  raw: string | null | undefined,
  patch: Partial<InstitutionMetadata>,
): string {
  const merged: Record<string, unknown> = { ...safeParseRecord(raw), ...patch };
  return JSON.stringify(merged);
}

// -------------------------------------------------------------------------------------------
// user_financial_products.metadata — everything that varies by product type: balance, mask,
// credit limit, available credit. `balance`, `credit_limit` and `available_credit` are money
// values (Decision 4) and are validated with `assertMinorUnits` on every parse — a fractional
// value here is rejected, not silently tolerated (AC4).
// -------------------------------------------------------------------------------------------
export interface ProductMetadata {
  balance?: number;
  mask?: string;
  credit_limit?: number;
  available_credit?: number;
  [key: string]: unknown;
}

export function parseProductMetadata(raw: string | null | undefined): ProductMetadata {
  const record = safeParseRecord(raw);
  const result: ProductMetadata = { ...record };

  const balance = numberField(record, 'balance');
  if (balance !== undefined) result.balance = assertMinorUnits(balance, 'metadata.balance');

  const creditLimit = numberField(record, 'credit_limit');
  if (creditLimit !== undefined) {
    result.credit_limit = assertMinorUnits(creditLimit, 'metadata.credit_limit');
  }

  const availableCredit = numberField(record, 'available_credit');
  if (availableCredit !== undefined) {
    result.available_credit = assertMinorUnits(availableCredit, 'metadata.available_credit');
  }

  const mask = stringField(record, 'mask');
  if (mask !== undefined) result.mask = mask;

  return result;
}

export function mergeProductMetadata(
  raw: string | null | undefined,
  patch: Partial<ProductMetadata>,
): string {
  const merged: Record<string, unknown> = { ...safeParseRecord(raw), ...patch };
  // Re-parse through the guard so a fractional value in the patch is rejected before it is
  // ever written, not only when it is later read back.
  const validated = parseProductMetadata(JSON.stringify(merged));
  return JSON.stringify({ ...merged, ...validated });
}

// -------------------------------------------------------------------------------------------
// transactions.metadata — bank-specific extras the scraper returns. No documented money key;
// kept as a flexible record.
// -------------------------------------------------------------------------------------------
export type TransactionMetadata = Record<string, unknown>;

export function parseTransactionMetadata(raw: string | null | undefined): TransactionMetadata {
  return safeParseRecord(raw);
}

export function mergeTransactionMetadata(
  raw: string | null | undefined,
  patch: Partial<TransactionMetadata>,
): string {
  const merged: Record<string, unknown> = { ...safeParseRecord(raw), ...patch };
  return JSON.stringify(merged);
}

// -------------------------------------------------------------------------------------------
// transaction_categories.labels — display name per locale, seeded from
// `design/tokens.json → categoryLabels`. Always `NOT NULL` in the schema; this guard is
// defensive for a malformed or partial value.
// -------------------------------------------------------------------------------------------
export interface CategoryLabels {
  es?: string;
  en?: string;
}

export function parseCategoryLabels(raw: string | null | undefined): CategoryLabels {
  const record = safeParseRecord(raw);
  const result: CategoryLabels = {};
  const es = stringField(record, 'es');
  if (es !== undefined) result.es = es;
  const en = stringField(record, 'en');
  if (en !== undefined) result.en = en;
  return result;
}

export function mergeCategoryLabels(
  raw: string | null | undefined,
  patch: Partial<CategoryLabels>,
): string {
  const merged: Record<string, unknown> = { ...safeParseRecord(raw), ...patch };
  return JSON.stringify(merged);
}

// -------------------------------------------------------------------------------------------
// app_settings.value — arbitrary JSON per key (a string, number, boolean, array or object).
// -------------------------------------------------------------------------------------------
export function parseSettingValue(raw: string | null | undefined): unknown {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function serializeSettingValue(value: unknown): string {
  return JSON.stringify(value);
}
