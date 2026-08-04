import { deriveDateLocal } from '@finanzas/shared-utils';
import type { ScrapedMovement, ScrapedProduct, ScrapeResult } from '@finanzas/bank-scraper';

/**
 * `__DEV__`-only deterministic `ScrapeResult` builder for the `complete_with_data` stubbed script
 * (implementation plan for issue #22, Decision 8, Decision 9). Feeds the **real** sync engine
 * (`runSync` → `applySyncWrite`) so "sync → home with data" and "re-syncing is idempotent" are
 * genuine assertions, not staged ones.
 *
 * Every field that constitutes movement *identity* — product `instanceId`s, `rawDescription`s,
 * `amountMinorUnits`, `direction`, `currencyCode` — is a literal, frozen at module scope. Only
 * `dateLocal` is derived, as a fixed negative day-offset from an anchor
 * (`deriveDateLocal(new Date())`, memoised on first call) — a January-anchored fixture would make
 * every current-month assertion in flows 02/05 an assertion about zero (D9).
 */

const MS_PER_DAY = 86_400_000;

const CHECKING_INSTANCE_ID = `e2e1${'0'.repeat(28)}`;
const CREDIT_CARD_INSTANCE_ID = `e2e2${'0'.repeat(28)}`;

let anchorInstant: Date | null = null;

/** Memoised at module scope on first call (D9): every read within one app session shares one
 * anchor, so a re-sync inside a session is bit-identical — the property flow 06 asserts. */
function resolveAnchorInstant(): Date {
  if (anchorInstant === null) {
    anchorInstant = new Date();
  }
  return anchorInstant;
}

/** `offsetDays` is always `<= 0` — a negative day-offset from the anchor, never a future date. */
function dateLocalAtOffset(offsetDays: number): string {
  const anchor = resolveAnchorInstant();
  const shifted = new Date(anchor.getTime() + offsetDays * MS_PER_DAY);
  return deriveDateLocal(shifted);
}

function buildProducts(): ScrapedProduct[] {
  return [
    {
      instanceId: CHECKING_INSTANCE_ID,
      kind: 'checking',
      displayName: 'Cuenta Corriente E2E',
      currencyCode: 'CLP',
      maskedIdentifier: '••••2201',
      balanceMinorUnits: 850_000,
    },
    {
      instanceId: CREDIT_CARD_INSTANCE_ID,
      kind: 'credit_card',
      displayName: 'Tarjeta de Crédito E2E',
      currencyCode: 'CLP',
      maskedIdentifier: '••••7788',
      creditLimitMinorUnits: 1_500_000,
      availableCreditMinorUnits: 1_100_000,
    },
  ];
}

interface MovementSeed {
  productInstanceId: string;
  offsetDays: number;
  amountMinorUnits: number;
  direction: 'debit' | 'credit';
  rawDescription: string;
}

/** 5 debit + 1 credit (Seed Data table), spread across the current and previous local month by
 * construction for a mid-to-late-month anchor (`e2e-read-fixture.test.ts` freezes the clock to
 * assert this directly). */
const MOVEMENT_SEEDS: MovementSeed[] = [
  {
    productInstanceId: CHECKING_INSTANCE_ID,
    offsetDays: 0,
    amountMinorUnits: 1_450_000,
    direction: 'credit',
    rawDescription: 'TRANSFERENCIA RECIBIDA SUELDO E2E',
  },
  {
    productInstanceId: CHECKING_INSTANCE_ID,
    offsetDays: -1,
    amountMinorUnits: 35_000,
    direction: 'debit',
    rawDescription: 'COMPRA SUPERMERCADO LIDER E2E',
  },
  {
    productInstanceId: CHECKING_INSTANCE_ID,
    offsetDays: -3,
    amountMinorUnits: 12_500,
    direction: 'debit',
    rawDescription: 'UBER TRIP E2E',
  },
  {
    productInstanceId: CHECKING_INSTANCE_ID,
    offsetDays: -10,
    amountMinorUnits: 45_000,
    direction: 'debit',
    rawDescription: 'CUENTA DE LUZ E2E',
  },
  {
    productInstanceId: CREDIT_CARD_INSTANCE_ID,
    offsetDays: -20,
    amountMinorUnits: 28_990,
    direction: 'debit',
    rawDescription: 'COMPRA FARMACIA CRUZ VERDE E2E',
  },
  {
    productInstanceId: CREDIT_CARD_INSTANCE_ID,
    offsetDays: -32,
    amountMinorUnits: 15_000,
    direction: 'debit',
    rawDescription: 'CINE PLANETA E2E',
  },
];

function buildMovements(): ScrapedMovement[] {
  const positionByProduct = new Map<string, number>();
  return MOVEMENT_SEEDS.map((seed) => {
    const position = positionByProduct.get(seed.productInstanceId) ?? 0;
    positionByProduct.set(seed.productInstanceId, position + 1);
    return {
      productInstanceId: seed.productInstanceId,
      dateLocal: dateLocalAtOffset(seed.offsetDays),
      amountMinorUnits: seed.amountMinorUnits,
      direction: seed.direction,
      currencyCode: 'CLP',
      rawDescription: seed.rawDescription,
      bankSuppliedId: null,
      positionInReadSnapshot: position,
      extras: {},
    };
  });
}

/** The deterministic, non-empty `ScrapeResult` `complete_with_data` settles with (D8). Bit-
 * identical across repeated calls within one session — the anchor is memoised, and every other
 * field is a literal. */
export function buildE2eScrapeResult(): ScrapeResult {
  return {
    outcome: 'complete',
    countryCode: 'cl',
    bankId: 'banco-de-chile',
    products: buildProducts(),
    movements: buildMovements(),
    readFailure: null,
    productFailures: [],
    skippedProductKinds: [],
    traces: [],
  };
}

/** Test-only escape hatch, mirroring `scripted-runner.ts`'s `__resetScriptedRunnerForTests`. */
export function __resetE2eReadFixtureForTests(): void {
  anchorInstant = null;
}
