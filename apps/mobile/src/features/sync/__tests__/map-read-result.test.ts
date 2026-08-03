import type { ScrapedMovement } from '@finanzas/bank-scraper';

import { countForeignCurrencyMovements } from '../map-read-result';

/**
 * `countForeignCurrencyMovements` (implementation plan Decision 15; issue #10's CodeRabbit
 * finding on PR #78: currency-code canonicalization).
 */

function movement(overrides: Partial<ScrapedMovement>): ScrapedMovement {
  return {
    productInstanceId: 'p1',
    dateLocal: '2026-04-01',
    amountMinorUnits: 1000,
    direction: 'debit',
    currencyCode: 'CLP',
    rawDescription: 'TEST',
    bankSuppliedId: null,
    positionInReadSnapshot: 0,
    extras: {},
    ...overrides,
  };
}

describe('countForeignCurrencyMovements — canonicalization', () => {
  it('counts a canonical USD movement as foreign', () => {
    expect(countForeignCurrencyMovements({ movements: [movement({ currencyCode: 'USD' })] })).toBe(1);
  });

  it('does not count a canonical CLP movement as foreign', () => {
    expect(countForeignCurrencyMovements({ movements: [movement({ currencyCode: 'CLP' })] })).toBe(0);
  });

  it('a differently-cased or padded "CLP" is still recognised as peso, never counted as foreign (CodeRabbit finding on PR #78)', () => {
    const movements = [
      movement({ currencyCode: 'clp' }),
      movement({ currencyCode: ' Clp ' }),
      movement({ currencyCode: 'CLP' }),
    ];
    expect(countForeignCurrencyMovements({ movements })).toBe(0);
  });

  it('a mixed batch counts exactly the genuinely foreign movements', () => {
    const movements = [
      movement({ currencyCode: 'clp' }), // peso, differently cased
      movement({ currencyCode: 'USD' }),
      movement({ currencyCode: ' usd ' }), // foreign, padded/differently cased
      movement({ currencyCode: 'CLP' }),
    ];
    expect(countForeignCurrencyMovements({ movements })).toBe(2);
  });

  it('an empty movement list counts zero (degenerate input terminates)', () => {
    expect(countForeignCurrencyMovements({ movements: [] })).toBe(0);
  });
});
