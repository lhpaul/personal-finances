import type { BankNormalizer } from '../../../types/bank-config.types';
import type { MovementDirection, ProductType, RawMovementPayload } from '../../../types/scrape-result.types';

/**
 * Every Spanish-facing mapping for Banco de Chile lives here (spec Business Rules 16-17, Decision
 * 11; implementation plan Layer-by-Layer Changes → Banco de Chile).
 *
 * Product-type mapping (spec "Statuses / Enum Values" → Product type):
 *
 * | Bank's own wording | Reported type |
 * | --- | --- |
 * | Cuenta Corriente | `checking` |
 * | Cuenta Vista | `sight` |
 * | Cuenta FAN | `sight` |
 * | Tarjeta de crédito | `credit_card` |
 * | Línea de Crédito | not reported (spec Decision 15) |
 * | Anything else | not reported |
 */

const KIND_KEY_TO_PRODUCT_TYPE: Readonly<Record<string, ProductType>> = {
  'cuenta-corriente': 'checking',
  'cuenta-vista': 'sight',
  'cuenta-fan': 'sight',
  'tarjeta-credito': 'credit_card',
};

export function mapProductKind(kindKey: string): ProductType | null {
  // Object.hasOwn guards against an inherited Object.prototype key (e.g. kindKey ===
  // 'constructor' or 'toString'), which would otherwise resolve through the prototype chain to
  // an inherited function and defeat the `?? null` fallback below (CodeRabbit finding #47).
  return Object.hasOwn(KIND_KEY_TO_PRODUCT_TYPE, kindKey) ? (KIND_KEY_TO_PRODUCT_TYPE[kindKey] ?? null) : null;
}

/**
 * Read from which text field the bank populated — never assumed from the product kind (Business
 * Rule 10). Uses `!== null`, not truthiness, to stay aligned with the engine's own amount
 * selection (`payload.outgoingText ?? payload.incomingText` in `scrape-session.ts`) — a nullish
 * check, not a truthiness check (CodeRabbit finding #48). An empty-string `outgoingText` is
 * "populated but unparsable" in both places now, not "populated" here and "absent" there.
 */
export function mapMovementDirection(payload: RawMovementPayload): MovementDirection {
  return payload.outgoingText !== null ? 'debit' : 'credit';
}

/**
 * Bank-specific extras, keyed by stable identifiers (Decision 11) — never the bank's Spanish
 * column headings (the source's `'Tipo de Movimiento'`, `'Cuotas'`, `'Pais'` keys).
 */
export function mapMovementExtras(payload: RawMovementPayload): Readonly<Record<string, string | number | boolean>> {
  const extras: Record<string, string | number | boolean> = {};
  const raw = payload.extras;
  if (raw.movementKind !== undefined) extras.movementKind = raw.movementKind;
  if (raw.installments !== undefined) extras.installments = raw.installments;
  if (raw.city !== undefined) extras.city = raw.city;
  if (raw.country !== undefined) extras.country = raw.country;
  if (raw.billed !== undefined) extras.billed = raw.billed === 'true';
  if (raw.originalCurrencyCode !== undefined) extras.originalCurrencyCode = raw.originalCurrencyCode;
  if (raw.originalAmountMinorUnits !== undefined) {
    // A non-numeric raw value produces NaN, which serializes to null over the JSON bridge — a
    // silently missing amount rather than a reported failure (CodeRabbit finding #49). raw.extras
    // originates from page-supplied content, so this cannot be assumed well-formed. Omit the key
    // entirely rather than store a corrupted value.
    const parsedOriginalAmount = Number(raw.originalAmountMinorUnits);
    if (Number.isFinite(parsedOriginalAmount)) {
      extras.originalAmountMinorUnits = parsedOriginalAmount;
    }
  }
  return extras;
}

export const bancoDeChileNormalizer: BankNormalizer = {
  mapProductKind,
  mapMovementDirection,
  mapMovementExtras,
};
