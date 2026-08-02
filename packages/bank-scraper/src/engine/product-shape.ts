import { FORBIDDEN_PRODUCT_KEYS, INSTANCE_ID_PATTERN } from './constants';
import type { RawMovementPayload, RawProductPayload } from '../types/scrape-result.types';

/**
 * Never a list position — enforced, not merely intended (implementation plan Decision 6). An
 * inbound product carrying a forbidden key, or whose `instanceId` is not 32 lowercase hex
 * characters, is rejected outright rather than silently degraded.
 */
export interface ShapeViolation {
  reason: 'forbidden_key' | 'invalid_instance_id' | 'not_an_object' | 'missing_field';
  key?: string;
}

export type ShapeResult<T> = { ok: true; value: T } | { ok: false; violation: ShapeViolation };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rejects a payload carrying a forbidden key or a malformed `instanceId` (Decision 6). */
export function assertReportedProductShape(payload: unknown): ShapeResult<RawProductPayload> {
  if (!isPlainRecord(payload)) {
    return { ok: false, violation: { reason: 'not_an_object' } };
  }
  for (const key of FORBIDDEN_PRODUCT_KEYS) {
    if (key in payload) {
      return { ok: false, violation: { reason: 'forbidden_key', key } };
    }
  }
  const instanceId = payload.instanceId;
  if (typeof instanceId !== 'string' || !INSTANCE_ID_PATTERN.test(instanceId)) {
    return { ok: false, violation: { reason: 'invalid_instance_id' } };
  }
  for (const field of ['kindKey', 'displayName', 'currencyCode', 'maskedIdentifier'] as const) {
    if (typeof payload[field] !== 'string') {
      return { ok: false, violation: { reason: 'missing_field', key: field } };
    }
  }
  // `balanceText` and the card-only fields are optional (RawProductPayload) — the home page does
  // not expose a credit card's balance (finding #13), and account products never carry the
  // card-only fields at all. But when any of these fields IS present, it must still be a string:
  // an optional field is not a license to skip validation on it (finding #18).
  for (const field of ['balanceText', 'creditLimitText', 'availableCreditText', 'cardBrand', 'cardCategory', 'cardLast4'] as const) {
    if (payload[field] !== undefined && typeof payload[field] !== 'string') {
      return { ok: false, violation: { reason: 'missing_field', key: field } };
    }
  }
  return { ok: true, value: payload as unknown as RawProductPayload };
}

/**
 * Rejects a movement payload with no valid `productInstanceId`, no numeric
 * `positionInReadSnapshot`, or a shape that carries neither an outgoing nor an incoming amount.
 */
export function assertReportedMovementShape(payload: unknown): ShapeResult<RawMovementPayload> {
  if (!isPlainRecord(payload)) {
    return { ok: false, violation: { reason: 'not_an_object' } };
  }
  const productInstanceId = payload.productInstanceId;
  if (typeof productInstanceId !== 'string' || !INSTANCE_ID_PATTERN.test(productInstanceId)) {
    return { ok: false, violation: { reason: 'invalid_instance_id' } };
  }
  for (const field of ['dateText', 'currencyCode', 'rawDescription'] as const) {
    if (typeof payload[field] !== 'string') {
      return { ok: false, violation: { reason: 'missing_field', key: field } };
    }
  }
  // typeof === 'number' narrows the type but does not reject NaN or +/-Infinity (both have
  // typeof 'number'); Number.isFinite adds that check. A malformed positionInReadSnapshot must
  // not silently collide with another movement's map key (finding #19).
  const positionInReadSnapshot = payload.positionInReadSnapshot;
  if (typeof positionInReadSnapshot !== 'number' || !Number.isFinite(positionInReadSnapshot)) {
    return { ok: false, violation: { reason: 'missing_field', key: 'positionInReadSnapshot' } };
  }
  const outgoingText = typeof payload.outgoingText === 'string' ? payload.outgoingText : null;
  const incomingText = typeof payload.incomingText === 'string' ? payload.incomingText : null;
  if (outgoingText === null && incomingText === null) {
    return { ok: false, violation: { reason: 'missing_field', key: 'outgoingText/incomingText' } };
  }
  const bankSuppliedId = typeof payload.bankSuppliedId === 'string' ? payload.bankSuppliedId : null;
  // Every extras value must itself be a string — a plain-record check alone does not verify
  // this, so a non-string value (number, nested object, boolean) previously flowed through
  // unchanged into a type the compiler believed was guaranteed but the runtime never verified
  // (finding #20).
  if (payload.extras !== undefined && !isPlainRecord(payload.extras)) {
    return { ok: false, violation: { reason: 'missing_field', key: 'extras' } };
  }
  const extrasRecord = isPlainRecord(payload.extras) ? payload.extras : {};
  for (const value of Object.values(extrasRecord)) {
    if (typeof value !== 'string') {
      return { ok: false, violation: { reason: 'missing_field', key: 'extras' } };
    }
  }
  const extras = extrasRecord as Record<string, string>;
  return {
    ok: true,
    value: {
      productInstanceId,
      dateText: payload.dateText as string,
      outgoingText,
      incomingText,
      currencyCode: payload.currencyCode as string,
      rawDescription: payload.rawDescription as string,
      bankSuppliedId,
      positionInReadSnapshot,
      extras,
    },
  };
}
