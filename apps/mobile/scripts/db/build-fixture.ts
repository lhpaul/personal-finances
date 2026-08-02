/**
 * `db:seed` — rebuilds `src/db/__fixtures__/store-v1.sql` (implementation plan Decision 18, spec
 * Seed Data section). Builds an in-memory store at the current `schema_version` containing all
 * starter content (via the normal bootstrap path) plus a representative set of person-owned data
 * — one connected institution, two products, and movements covering every person-owned state —
 * then dumps it with the deterministic dumper (`scripts/db/dump.ts`).
 *
 * Every id and timestamp here comes from `createDeterministicPorts()` (the same port
 * implementation the Jest suite uses), so re-running this script with no source change produces a
 * byte-identical file (Implementation Order Step 8's verification: `db:seed` run twice, `git
 * status` clean the second time).
 */
import fs from 'node:fs';
import path from 'node:path';

import { transactions, userFinancialInstitutions, userFinancialProducts } from '../../src/db/schema';
import { openBootstrappedMemoryDb } from '../../src/db/testing/memory-db';
import { dumpDatabase } from './dump';

const OUTPUT_PATH = path.resolve(__dirname, '../../src/db/__fixtures__/store-v1.sql');

async function main(): Promise<void> {
  const { sqlite, db, ports } = await openBootstrappedMemoryDb();
  try {
    const connectionId = ports.newId();
    db.insert(userFinancialInstitutions)
      .values({
        id: connectionId,
        financialInstitutionId: 'banco-de-chile',
        status: 'active',
        credentialsKey: `secure-store-key-${connectionId}`,
        syncStatus: 'ok',
        lastSyncAt: ports.now(),
        lastSuccessAt: ports.now(),
        createdAt: ports.now(),
      })
      .run();

    const checkingId = ports.newId();
    db.insert(userFinancialProducts)
      .values({
        id: checkingId,
        userFinancialInstitutionId: connectionId,
        externalId: 'checking-001',
        type: 'checking',
        name: 'Cuenta Corriente',
        metadata: JSON.stringify({ balance: 452300, mask: '1234' }),
        updatedAt: ports.now(),
      })
      .run();

    const creditCardId = ports.newId();
    db.insert(userFinancialProducts)
      .values({
        id: creditCardId,
        userFinancialInstitutionId: connectionId,
        externalId: 'credit-card-001',
        type: 'credit_card',
        name: 'Tarjeta de Crédito',
        metadata: JSON.stringify({ credit_limit: 2000000, available_credit: 1550000, mask: '5678' }),
        updatedAt: ports.now(),
      })
      .run();

    // A dozen movements covering every person-owned state (implementation plan's Seed Data
    // section). Ids, dedup hashes and external ids are all deterministic and stable.
    db.insert(transactions)
      .values([
        {
          id: 'seed-movement-auto',
          userFinancialProductId: checkingId,
          externalId: 'ext-auto',
          dedupHash: 'seed-dedup-auto',
          amount: 4200,
          type: 'debit',
          occurredAt: '2026-01-05T12:00:00.000Z',
          dateLocal: '2026-01-05',
          rawDescription: 'LIDER',
          merchantId: 'lider',
          transactionCategoryId: 'supermercado',
          categorySource: 'auto',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-rule',
          userFinancialProductId: checkingId,
          externalId: 'ext-rule',
          dedupHash: 'seed-dedup-rule',
          amount: 3500,
          type: 'debit',
          occurredAt: '2026-01-06T09:00:00.000Z',
          dateLocal: '2026-01-06',
          rawDescription: 'UBER *TRIP',
          merchantId: 'uber',
          transactionCategoryId: 'transporte',
          categorySource: 'rule',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-user-noted',
          userFinancialProductId: checkingId,
          externalId: 'ext-user-noted',
          dedupHash: 'seed-dedup-user-noted',
          amount: 12000,
          type: 'debit',
          occurredAt: '2026-01-07T10:00:00.000Z',
          dateLocal: '2026-01-07',
          rawDescription: 'JUMBO',
          merchantId: 'jumbo',
          transactionCategoryId: 'supermercado',
          categorySource: 'user',
          note: 'Compra semanal',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-uncategorized',
          userFinancialProductId: checkingId,
          externalId: 'ext-uncategorized',
          dedupHash: 'seed-dedup-uncategorized',
          amount: 8990,
          type: 'debit',
          occurredAt: '2026-01-08T15:30:00.000Z',
          dateLocal: '2026-01-08',
          rawDescription: 'COPEC',
          merchantId: 'copec',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-review-later',
          userFinancialProductId: checkingId,
          externalId: 'ext-review-later',
          dedupHash: 'seed-dedup-review-later',
          amount: 6500,
          type: 'debit',
          occurredAt: '2026-01-09T11:00:00.000Z',
          dateLocal: '2026-01-09',
          rawDescription: 'COMPRA DESCONOCIDA',
          transactionCategoryId: 'entretenimiento',
          reviewFlag: 'review_later',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-uncertain',
          userFinancialProductId: checkingId,
          externalId: 'ext-uncertain',
          dedupHash: 'seed-dedup-uncertain',
          amount: 15990,
          type: 'debit',
          occurredAt: '2026-01-10T16:00:00.000Z',
          dateLocal: '2026-01-10',
          rawDescription: 'COMERCIO XYZ',
          reviewFlag: 'uncertain',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-excluded-personal-transfer',
          userFinancialProductId: checkingId,
          externalId: 'ext-excluded-personal-transfer',
          dedupHash: 'seed-dedup-excluded-personal-transfer',
          amount: 100000,
          type: 'debit',
          occurredAt: '2026-01-11T08:00:00.000Z',
          dateLocal: '2026-01-11',
          rawDescription: 'TRANSFERENCIA A CUENTA PROPIA',
          excludedAt: '2026-01-11T09:00:00.000Z',
          exclusionReason: 'personal_transfer',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-excluded-shared-expense',
          userFinancialProductId: checkingId,
          externalId: 'ext-excluded-shared-expense',
          dedupHash: 'seed-dedup-excluded-shared-expense',
          amount: 45000,
          type: 'debit',
          occurredAt: '2026-01-12T13:00:00.000Z',
          dateLocal: '2026-01-12',
          rawDescription: 'RESTAURANT LA MESA',
          excludedAt: '2026-01-12T14:00:00.000Z',
          exclusionReason: 'shared_expense',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-excluded-not-relevant',
          userFinancialProductId: checkingId,
          externalId: 'ext-excluded-not-relevant',
          dedupHash: 'seed-dedup-excluded-not-relevant',
          amount: 2500,
          type: 'debit',
          occurredAt: '2026-01-13T17:00:00.000Z',
          dateLocal: '2026-01-13',
          rawDescription: 'COMISION MANTENCION',
          excludedAt: '2026-01-13T18:00:00.000Z',
          exclusionReason: 'not_relevant',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-excluded-cash-withdrawal',
          userFinancialProductId: checkingId,
          externalId: 'ext-excluded-cash-withdrawal',
          dedupHash: 'seed-dedup-excluded-cash-withdrawal',
          amount: 50000,
          type: 'debit',
          occurredAt: '2026-01-14T10:00:00.000Z',
          dateLocal: '2026-01-14',
          rawDescription: 'GIRO CAJERO AUTOMATICO',
          excludedAt: '2026-01-14T10:05:00.000Z',
          exclusionReason: 'cash_withdrawal',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-excluded-other',
          userFinancialProductId: checkingId,
          externalId: 'ext-excluded-other',
          dedupHash: 'seed-dedup-excluded-other',
          amount: 9990,
          type: 'debit',
          occurredAt: '2026-01-15T12:30:00.000Z',
          dateLocal: '2026-01-15',
          rawDescription: 'NETFLIX.COM',
          merchantId: 'netflix',
          excludedAt: '2026-01-15T13:00:00.000Z',
          exclusionReason: 'other',
          exclusionNote: 'Cuenta compartida con un amigo, no la pago yo',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-partial',
          userFinancialProductId: creditCardId,
          externalId: 'ext-partial',
          dedupHash: 'seed-dedup-partial',
          amount: 60000,
          includedAmount: 30000,
          type: 'debit',
          occurredAt: '2026-01-16T19:00:00.000Z',
          dateLocal: '2026-01-16',
          rawDescription: 'SUPERMERCADO COMPARTIDO',
          transactionCategoryId: 'supermercado',
          categorySource: 'user',
          isManual: 0,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
        {
          id: 'seed-movement-manual',
          userFinancialProductId: creditCardId,
          externalId: null,
          dedupHash: 'seed-dedup-manual',
          amount: 5000,
          type: 'debit',
          occurredAt: '2026-01-17T20:00:00.000Z',
          dateLocal: '2026-01-17',
          rawDescription: 'Almuerzo con amigos',
          transactionCategoryId: 'comida',
          categorySource: 'user',
          isManual: 1,
          createdAt: ports.now(),
          updatedAt: ports.now(),
        },
      ])
      .run();

    const sqlText = dumpDatabase(sqlite);
    fs.writeFileSync(OUTPUT_PATH, sqlText);
    // eslint-disable-next-line no-console
    console.log(`Wrote ${OUTPUT_PATH} (${sqlText.split('\n').length - 1} lines).`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
