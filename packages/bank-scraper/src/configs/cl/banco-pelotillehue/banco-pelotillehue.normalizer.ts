import type { BankNormalizer } from '../../../types/bank-config.types';
import type { MovementDirection, ProductType, RawMovementPayload } from '../../../types/scrape-result.types';

const KIND_KEY_TO_PRODUCT_TYPE: Readonly<Record<string, ProductType>> = {
  'cuenta-corriente': 'checking',
  'tarjeta-credito': 'credit_card',
};

export function mapProductKind(kindKey: string): ProductType | null {
  return Object.hasOwn(KIND_KEY_TO_PRODUCT_TYPE, kindKey) ? (KIND_KEY_TO_PRODUCT_TYPE[kindKey] ?? null) : null;
}

export function mapMovementDirection(payload: RawMovementPayload): MovementDirection {
  return payload.outgoingText !== null ? 'debit' : 'credit';
}

export function mapMovementExtras(payload: RawMovementPayload): Readonly<Record<string, string | number | boolean>> {
  const extras: Record<string, string | number | boolean> = {};
  if (payload.extras.billed !== undefined) extras.billed = payload.extras.billed === 'true';
  return extras;
}

export const bancoPelotillehueNormalizer: BankNormalizer = {
  mapProductKind,
  mapMovementDirection,
  mapMovementExtras,
};
