import { assertReportedMovementShape, assertReportedProductShape } from './product-shape';

const VALID_INSTANCE_ID = 'a'.repeat(32);

describe('assertReportedProductShape', () => {
  const cleanPayload = {
    instanceId: VALID_INSTANCE_ID,
    kindKey: 'cuenta-corriente',
    displayName: 'Cuenta Corriente',
    currencyCode: 'CLP',
    maskedIdentifier: '••••1111',
    balanceText: '$1.234.567',
  };

  it('accepts a clean in-page payload with every legitimate field (does not over-fire)', () => {
    const result = assertReportedProductShape(cleanPayload);
    expect(result.ok).toBe(true);
  });

  it('rejects a payload containing elementIndex and names the offending key (Decision 6)', () => {
    const result = assertReportedProductShape({ ...cleanPayload, elementIndex: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violation).toEqual({ reason: 'forbidden_key', key: 'elementIndex' });
    }
  });

  it.each(['elementIdex', '__clickIndex', 'accountNumber', 'rawIdentifier', 'index', 'position'])(
    'rejects a payload containing the forbidden key %s',
    (key) => {
      const result = assertReportedProductShape({ ...cleanPayload, [key]: 'x' });
      expect(result.ok).toBe(false);
    },
  );

  it("rejects an instanceId of '0'", () => {
    const result = assertReportedProductShape({ ...cleanPayload, instanceId: '0' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.reason).toBe('invalid_instance_id');
  });

  it('rejects an instanceId that is a raw account number', () => {
    const result = assertReportedProductShape({ ...cleanPayload, instanceId: '12345678' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violation.reason).toBe('invalid_instance_id');
  });

  it('rejects a non-object payload', () => {
    expect(assertReportedProductShape('not an object').ok).toBe(false);
    expect(assertReportedProductShape(null).ok).toBe(false);
    expect(assertReportedProductShape(undefined).ok).toBe(false);
  });

  it('rejects a payload missing a required field', () => {
    const missingBalance: Record<string, unknown> = { ...cleanPayload };
    delete missingBalance.balanceText;
    const result = assertReportedProductShape(missingBalance);
    expect(result.ok).toBe(false);
  });
});

describe('assertReportedMovementShape', () => {
  const cleanPayload = {
    productInstanceId: VALID_INSTANCE_ID,
    dateText: '01/03/2026',
    outgoingText: '$1.000',
    incomingText: null,
    currencyCode: 'CLP',
    rawDescription: 'Compra',
    bankSuppliedId: null,
    positionInReadSnapshot: 0,
    extras: {},
  };

  it('accepts a clean movement payload', () => {
    expect(assertReportedMovementShape(cleanPayload).ok).toBe(true);
  });

  it('accepts a payload with only incomingText populated', () => {
    const result = assertReportedMovementShape({ ...cleanPayload, outgoingText: null, incomingText: '$2.000' });
    expect(result.ok).toBe(true);
  });

  it('rejects a payload with neither outgoing nor incoming text', () => {
    const result = assertReportedMovementShape({ ...cleanPayload, outgoingText: null, incomingText: null });
    expect(result.ok).toBe(false);
  });

  it('rejects a payload with a malformed productInstanceId', () => {
    const result = assertReportedMovementShape({ ...cleanPayload, productInstanceId: 'not-hex' });
    expect(result.ok).toBe(false);
  });

  it('rejects a payload with a non-numeric positionInReadSnapshot', () => {
    const result = assertReportedMovementShape({ ...cleanPayload, positionInReadSnapshot: '0' });
    expect(result.ok).toBe(false);
  });
});
