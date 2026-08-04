import { getBankConnectionSummary, listBankConnections } from '../../../db/repositories/institutions';
import { listProductsForConnection } from '../../../db/repositories/products';
import { openBootstrappedMemoryDb } from '../../../db/testing/memory-db';
import { createTestConnection, createTestProduct, setConnectionFieldsForTest } from '../../../db/testing/product-fixture';

/**
 * Implementation plan (issue #20) Testing Strategy, Scenarios 1 and 13. Routed to the `db` Jest
 * project by its `.db.test.ts` suffix (Resolution R5).
 */
describe('listBankConnections / getBankConnectionSummary (issue #20, Scenario 1)', () => {
  it('lists an active connection with its product count, and hides a disconnected one', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();

    const activeId = createTestConnection(db, ports, 'banco-de-chile');
    createTestProduct(db, ports, activeId, { externalId: 'p1' });
    createTestProduct(db, ports, activeId, { externalId: 'p2', type: 'credit_card' });

    const disconnectedId = createTestConnection(db, ports, 'banco-estado');
    setConnectionFieldsForTest(db, disconnectedId, { status: 'disconnected' });

    const rows = listBankConnections(db);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: activeId,
      institutionId: 'banco-de-chile',
      status: 'active',
      productCount: 2,
    });
  });

  it('lists an inactive connection too (Assumption A7)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const inactiveId = createTestConnection(db, ports, 'banco-de-chile');
    setConnectionFieldsForTest(db, inactiveId, { status: 'inactive' });

    const rows = listBankConnections(db);

    expect(rows.map((row) => row.id)).toEqual([inactiveId]);
  });

  it('getBankConnectionSummary finds a connection regardless of status, and returns undefined when none exists', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const id = createTestConnection(db, ports, 'banco-de-chile');
    setConnectionFieldsForTest(db, id, { status: 'disconnected' });

    const found = getBankConnectionSummary(db, 'banco-de-chile');
    expect(found).toMatchObject({ id, status: 'disconnected' });

    const missing = getBankConnectionSummary(db, 'banco-estado');
    expect(missing).toBeUndefined();
  });

  it('carries the parsed institution metadata (short name, brand color) and zero products when none exist', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const id = createTestConnection(db, ports, 'banco-de-chile');

    const found = getBankConnectionSummary(db, 'banco-de-chile');
    expect(found).toMatchObject({
      id,
      shortName: 'BCH',
      brandColor: '#003da5',
      productCount: 0,
    });
  });

  it('surfaces a separate last-attempt and last-success timestamp (Scenario 13, Decision 9)', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const id = createTestConnection(db, ports, 'banco-de-chile');
    setConnectionFieldsForTest(db, id, {
      syncStatus: 'error',
      lastSuccessAt: '2026-02-01T10:00:00.000Z',
      lastSyncAt: '2026-02-02T10:00:00.000Z',
      lastErrorCode: 'invalid_credentials',
      lastErrorMessage: 'sync.errors.invalid_credentials',
    });

    const found = getBankConnectionSummary(db, 'banco-de-chile');
    expect(found?.lastSuccessAt).toBe('2026-02-01T10:00:00.000Z');
    expect(found?.lastSyncAt).toBe('2026-02-02T10:00:00.000Z');
    expect(found?.lastSuccessAt).not.toBe(found?.lastSyncAt);
  });
});

describe('listProductsForConnection (issue #20)', () => {
  it('returns the parsed metadata fields, and undefined (never 0) for an absent balance', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionId = createTestConnection(db, ports, 'banco-de-chile');
    const productId = createTestProduct(db, ports, connectionId, { externalId: 'checking-1' });

    const [product] = listProductsForConnection(db, connectionId);
    expect(product).toMatchObject({
      id: productId,
      type: 'checking',
      name: 'Cuenta corriente',
      mask: undefined,
      balanceMinorUnits: undefined,
      creditLimitMinorUnits: undefined,
      availableCreditMinorUnits: undefined,
    });
  });

  it('scopes to one connection only', async () => {
    const { db, ports } = await openBootstrappedMemoryDb();
    const connectionA = createTestConnection(db, ports, 'banco-de-chile');
    const connectionB = createTestConnection(db, ports, 'banco-estado');
    createTestProduct(db, ports, connectionA, { externalId: 'a-1' });
    createTestProduct(db, ports, connectionB, { externalId: 'b-1' });

    expect(listProductsForConnection(db, connectionA)).toHaveLength(1);
    expect(listProductsForConnection(db, connectionB)).toHaveLength(1);
  });
});
