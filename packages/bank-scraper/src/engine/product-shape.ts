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
  for (const field of ['kindKey', 'displayName', 'currencyCode', 'maskedIdentifier', 'balanceText'] as const) {
    if (typeof payload[field] !== 'string') {
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
  if (typeof payload.positionInReadSnapshot !== 'number') {
    return { ok: false, violation: { reason: 'missing_field', key: 'positionInReadSnapshot' } };
  }
  const outgoingText = typeof payload.outgoingText === 'string' ? payload.outgoingText : null;
  const incomingText = typeof payload.incomingText === 'string' ? payload.incomingText : null;
  if (outgoingText === null && incomingText === null) {
    return { ok: false, violation: { reason: 'missing_field', key: 'outgoingText/incomingText' } };
  }
  const bankSuppliedId = typeof payload.bankSuppliedId === 'string' ? payload.bankSuppliedId : null;
  const extras = isPlainRecord(payload.extras) ? (payload.extras as Record<string, string>) : {};
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
      positionInReadSnapshot: payload.positionInReadSnapshot,
      extras,
    },
  };
}
