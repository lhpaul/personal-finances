import { mapMovementDirection, mapMovementExtras, mapProductKind } from './banco-de-chile.normalizer';
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
  it.each([
    ['cuenta-corriente', 'checking'],
    ['cuenta-vista', 'sight'],
    ['cuenta-fan', 'sight'],
    ['tarjeta-credito', 'credit_card'],
  ] as const)('%s -> %s', (kindKey, expected) => {
    expect(mapProductKind(kindKey)).toBe(expected);
  });

  it('linea-de-credito is not reported as a product (spec Decision 15)', () => {
    expect(mapProductKind('linea-de-credito')).toBeNull();
  });

  it('an unrecognized kind is not reported and does not throw', () => {
    expect(mapProductKind('cuenta-de-ahorro-a-plazo')).toBeNull();
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'the inherited Object.prototype key %s is not reported, rather than resolving through the prototype chain (CodeRabbit finding #47)',
    (kindKey) => {
      expect(() => mapProductKind(kindKey)).not.toThrow();
      expect(mapProductKind(kindKey)).toBeNull();
    },
  );
});

describe('mapMovementDirection', () => {
  it('debit when outgoingText is populated', () => {
    expect(mapMovementDirection(movement({ outgoingText: '$1.000', incomingText: null }))).toBe('debit');
  });

  it('credit when only incomingText is populated', () => {
    expect(mapMovementDirection(movement({ outgoingText: null, incomingText: '$2.000' }))).toBe('credit');
  });

  it('a card movement is not assumed to be one direction — reads the column like any other (AC9)', () => {
    expect(mapMovementDirection(movement({ outgoingText: '$500', incomingText: null }))).toBe('debit');
    expect(mapMovementDirection(movement({ outgoingText: null, incomingText: '$500' }))).toBe('credit');
  });

  it('an empty-string outgoingText is "populated" here too, matching the engine\'s nullish amount selection (CodeRabbit finding #48)', () => {
    // scrape-session.ts picks the amount text with `payload.outgoingText ?? payload.incomingText`
    // — a nullish check, not a truthiness check. An empty string is not null, so the engine
    // treats it as populated (and ultimately fails to parse it as an amount); this function must
    // agree, not report 'credit' for a movement the engine considers a debit attempt.
    expect(mapMovementDirection(movement({ outgoingText: '', incomingText: null }))).toBe('debit');
  });
});

describe('mapMovementExtras', () => {
  it('keys extras by stable identifiers, never the bank\'s Spanish column headings', () => {
    const extras = mapMovementExtras(
      movement({ extras: { movementKind: 'Compra Nacional', installments: '3', city: 'Santiago', country: 'Chile' } }),
    );
    expect(extras).toEqual({ movementKind: 'Compra Nacional', installments: '3', city: 'Santiago', country: 'Chile' });
    expect(Object.keys(extras)).not.toContain('Tipo de Movimiento');
    expect(Object.keys(extras)).not.toContain('Cuotas');
  });

  it('converts billed to a boolean and originalAmountMinorUnits to a number', () => {
    const extras = mapMovementExtras(
      movement({ extras: { billed: 'true', originalCurrencyCode: 'USD', originalAmountMinorUnits: '5000' } }),
    );
    expect(extras).toEqual({ billed: true, originalCurrencyCode: 'USD', originalAmountMinorUnits: 5000 });
  });

  it('omits keys the payload does not carry, rather than inventing empty values', () => {
    expect(mapMovementExtras(movement({ extras: {} }))).toEqual({});
  });

  it('omits originalAmountMinorUnits entirely when the raw value is not numeric, rather than storing NaN (CodeRabbit finding #49)', () => {
    const extras = mapMovementExtras(movement({ extras: { originalAmountMinorUnits: 'not-a-number' } }));
    expect(extras).toEqual({});
    expect(Object.keys(extras)).not.toContain('originalAmountMinorUnits');
  });
});
