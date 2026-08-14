import { mapMovementDirection, mapMovementExtras, mapProductKind } from './banco-falabella.normalizer';
import type { RawMovementPayload } from '../../../types/scrape-result.types';

function movement(overrides: Partial<RawMovementPayload> = {}): RawMovementPayload {
  return {
    productInstanceId: 'a'.repeat(32),
    dateText: '01/03/2026',
    outgoingText: '$1.000',
    incomingText: null,
    currencyCode: 'CLP',
    rawDescription: 'Compra',
    bankSuppliedId: null,
    positionInReadSnapshot: 0,
    extras: {},
    ...overrides,
  };
}

describe('mapProductKind', () => {
  it('cuenta-corriente -> checking', () => {
    expect(mapProductKind('cuenta-corriente')).toBe('checking');
  });

  it('tarjeta-credito -> credit_card', () => {
    expect(mapProductKind('tarjeta-credito')).toBe('credit_card');
  });

  it('linea-de-credito is not reported as a product', () => {
    expect(mapProductKind('linea-de-credito')).toBeNull();
  });
});

describe('mapMovementDirection', () => {
  it('debit when outgoingText is populated', () => {
    expect(mapMovementDirection(movement({ outgoingText: '$1.000', incomingText: null }))).toBe('debit');
  });

  it('credit when only incomingText is populated', () => {
    expect(mapMovementDirection(movement({ outgoingText: null, incomingText: '$2.000' }))).toBe('credit');
  });
});

describe('mapMovementExtras', () => {
  it('converts billed to a boolean', () => {
    expect(mapMovementExtras(movement({ extras: { billed: 'true', installments: '1/1' } }))).toEqual({
      billed: true,
      installments: '1/1',
    });
  });
});
