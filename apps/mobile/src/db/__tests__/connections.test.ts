import { getConnectedBanksSummary } from '../repositories/connections';
import { disconnectInstitution } from '../repositories/institutions';
import { createTestConnection, createTestProduct } from '../testing/product-fixture';
import { openBootstrappedMemoryDb } from '../testing/memory-db';

/** Testing Strategy scenario 6: `onboarding-ready` reflects real state
 * (`apps/mobile/src/features/onboarding/use-onboarding-summary.ts` reads through this). */
describe('connections repository — getConnectedBanksSummary', () => {
  it('an empty store returns connectionCount: 0 and no institution names (Decision 7, Assumption A2)', async () => {
    const { sqlite, db } = await openBootstrappedMemoryDb();
    try {
      expect(getConnectedBanksSummary(db)).toEqual({
        connectionCount: 0,
        institutionNames: [],
        productCount: 0,
      });
    } finally {
      sqlite.close();
    }
  });

  it('one active connection with three products returns the exact drawn content (index.html:1101)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const connectionId = createTestConnection(db, ports, 'banco-de-chile');
      createTestProduct(db, ports, connectionId, { externalId: 'p1', name: 'Cuenta 1' });
      createTestProduct(db, ports, connectionId, { externalId: 'p2', name: 'Cuenta 2' });
      createTestProduct(db, ports, connectionId, { externalId: 'p3', name: 'Cuenta 3' });

      expect(getConnectedBanksSummary(db)).toEqual({
        connectionCount: 1,
        institutionNames: ['Banco de Chile'],
        productCount: 3,
      });
    } finally {
      sqlite.close();
    }
  });

  it('a disconnected institution is excluded from the summary (status must be "active", not "disconnected")', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const activeId = createTestConnection(db, ports, 'banco-de-chile');
      createTestProduct(db, ports, activeId);

      const disconnectedId = createTestConnection(db, ports, 'santander');
      createTestProduct(db, ports, disconnectedId);
      disconnectInstitution(db, disconnectedId);

      const summary = getConnectedBanksSummary(db);
      expect(summary.connectionCount).toBe(1);
      expect(summary.institutionNames).toEqual(['Banco de Chile']);
      expect(summary.productCount).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it('multiple active connections aggregate into one summary (Assumption A6)', async () => {
    const { sqlite, db, ports } = await openBootstrappedMemoryDb();
    try {
      const first = createTestConnection(db, ports, 'banco-de-chile');
      createTestProduct(db, ports, first);
      const second = createTestConnection(db, ports, 'santander');
      createTestProduct(db, ports, second);
      createTestProduct(db, ports, second);

      const summary = getConnectedBanksSummary(db);
      expect(summary.connectionCount).toBe(2);
      expect(summary.institutionNames.sort()).toEqual(['Banco Santander', 'Banco de Chile'].sort());
      expect(summary.productCount).toBe(3);
    } finally {
      sqlite.close();
    }
  });
});
