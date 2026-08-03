import type { FailureReasonCode, ReadOutcome } from './protocol.types';

/**
 * The shared vocabulary a read reports in (spec "Statuses / Enum Values" → Product type; V11).
 * `savings` and `credit_line` are enumerated for future banks; the bank ported in this item
 * reports only `checking`, `sight` and `credit_card` (spec Decision 15 — línea de crédito is not
 * reported as a product).
 */
export type ProductType = 'checking' | 'sight' | 'savings' | 'credit_card' | 'credit_line';

/** Spec "Movement direction" — replaces the sign the bank shows (Business Rule 10). */
export type MovementDirection = 'debit' | 'credit';

/**
 * What the in-page routine posts for one product, before RN-side parsing (Decision 1). Amounts
 * are raw bank-formatted strings; `kindKey` is the bank's own kind token, translated to
 * `ProductType` by that bank's normalizer. This shape crosses the bridge — it is the payload
 * `assertReportedProductShape` (engine/product-shape.ts) validates, and it must never carry a raw
 * account/card number or a list-position key (Decision 6).
 */
export interface RawProductPayload {
  instanceId: string; // Decision 6: opaque, 32 lowercase hex chars, computed in-page
  kindKey: string; // e.g. 'cuenta-corriente' — the bank's own token, never an enumerated type
  displayName: string; // the bank's own words, verbatim
  currencyCode: string;
  maskedIdentifier: string; // '••••1111'
  // Optional, not required (CodeRabbit finding #13): the home page does not expose a credit
  // card's real balance, only its own details page does. Omitting the key — rather than
  // fabricating a placeholder like '$0' — lets a card surface with no balance yet known,
  // distinguishable from a genuinely-zero balance.
  balanceText?: string; // raw, bank-formatted
  creditLimitText?: string;
  availableCreditText?: string;
  cardBrand?: string;
  cardCategory?: string;
  cardLast4?: string;
}

/**
 * What the in-page routine posts for one movement, before RN-side parsing (Decision 1). Dates and
 * amounts are raw bank-formatted strings; direction is read from which text field is populated,
 * never assumed from the product kind (Business Rule 10).
 */
export interface RawMovementPayload {
  productInstanceId: string;
  dateText: string; // 'DD/MM/YYYY'
  outgoingText: string | null; // populated -> direction is 'debit'
  incomingText: string | null; // populated -> direction is 'credit'
  currencyCode: string;
  rawDescription: string; // the bank's own words, verbatim
  bankSuppliedId: string | null; // ALWAYS null for a bank that supplies no identifier (spec Conflict 2, AC23)
  positionInReadSnapshot: number; // same-read tie-breaker ONLY (Business Rule 14)
  extras: Readonly<Record<string, string>>; // raw values; the normalizer resolves stable keys
}

/** The product, parsed (spec "What a read reports" → Per product; Decision 7). */
export interface ScrapedProduct {
  instanceId: string; // opaque, stable, 32 lowercase hex chars (Decision 6)
  kind: ProductType;
  displayName: string;
  currencyCode: string;
  maskedIdentifier: string;
  balanceMinorUnits?: number; // absent when the reporting page did not expose a balance (finding #13)
  creditLimitMinorUnits?: number;
  availableCreditMinorUnits?: number;
  cardBrand?: string;
  cardCategory?: string;
  cardLast4?: string;
}

/** The movement, parsed — the shape item #10 needs (Decision 7, Conflict 2). */
export interface ScrapedMovement {
  productInstanceId: string;
  dateLocal: string; // 'YYYY-MM-DD'
  amountMinorUnits: number; // positive safe integer
  direction: MovementDirection;
  currencyCode: string; // 'CLP' | 'USD'
  rawDescription: string; // verbatim from the bank
  bankSuppliedId: string | null; // ALWAYS null for a bank that supplies no identifier
  positionInReadSnapshot: number; // same-read tie-breaker ONLY — never a cross-read identity
  extras: Readonly<Record<string, string | number | boolean>>;
}

/** A failure scoped to one product (spec "Per read"; Decision 7). Always names its product. */
export interface ProductReadFailure {
  productInstanceId: string;
  reasonCode: FailureReasonCode;
  attempts: number;
}

/** One diagnostic entry, already redacted (Operational Visibility; Business Rules 3-4). */
export interface ScraperTrace {
  logGroup: string | undefined;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * One result per read (spec "What a read reports"; Decision 7). `readFailure` carries no product
 * on purpose: a read-level failure happens before any product is discovered (AC14).
 */
export interface ScrapeResult {
  outcome: ReadOutcome;
  countryCode: string;
  bankId: string;
  products: ScrapedProduct[];
  movements: ScrapedMovement[];
  readFailure: { reasonCode: FailureReasonCode } | null;
  productFailures: ProductReadFailure[];
  skippedProductKinds: string[]; // Business Rule 16's diagnostic
  traces: ScraperTrace[];
}
