import fs from 'node:fs';
import path from 'node:path';

import { fidelityTestId } from '../../../lib/fidelity-preview';

/**
 * `transaction-detail` (#16) implementation plan Testing Strategy, Scenario 23 (Decision 12).
 * The fidelity contract's actual validator (`scripts/mobile-ui/fidelity-contract.mjs`) accepts
 * either the literal `ready_test_id` string or the canonical `fidelityTestId(screenId)` call
 * with a matching `screen_id` — verified against the script source, not assumed from the plan's
 * illustrative code sample (which showed a hand-typed literal). This item follows the same
 * `fidelityTestId(screenId)` call convention every other route file in this codebase already
 * uses (`app/categorize/index.tsx`, `app/(tabs)/transactions.tsx`, …).
 */
const ROUTE_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'app',
  'transactions',
  '[transactionId].tsx',
);

describe('fidelity wiring (Scenario 23, Decision 12)', () => {
  it('fidelityTestId("transaction-detail") equals "fidelity-transaction-detail"', () => {
    expect(fidelityTestId('transaction-detail')).toBe('fidelity-transaction-detail');
  });

  it('the route file calls fidelityTestId("transaction-detail")', () => {
    expect(fs.existsSync(ROUTE_FILE)).toBe(true);
    const source = fs.readFileSync(ROUTE_FILE, 'utf8');
    expect(source).toMatch(/fidelityTestId\(\s*['"]transaction-detail['"]\s*\)/);
  });
});
