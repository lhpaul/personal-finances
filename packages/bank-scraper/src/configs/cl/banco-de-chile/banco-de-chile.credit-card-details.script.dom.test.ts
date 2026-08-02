import { join } from 'node:path';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { creditCardDetailsScript } from './banco-de-chile.credit-card-details.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const PRODUCT_ID = 'b'.repeat(32);

interface StateChangeData {
  products?: Array<Record<string, unknown>>;
  movements?: Array<Record<string, unknown>>;
}

function lastStateChangeData(messages: Array<{ eventType: string; data?: unknown }>): StateChangeData {
  const stateChange = [...messages].reverse().find((m) => m.eventType === 'state-change');
  return (stateChange?.data as StateChangeData | undefined) ?? {};
}

function runWithProduct(source: string): ReturnType<typeof runInjectedScript> {
  return runInjectedScript(source, { productId: PRODUCT_ID });
}

/** Simulates the invoiced tab swapping in a billed table (with a Cuotas column). */
function simulateInvoicedTab(): void {
  const invoicedTab = document.querySelectorAll('.router-tab-link')[1];
  invoicedTab?.addEventListener('click', () => {
    const table = document.querySelector('.bch-table');
    if (!table) return;
    table.innerHTML = `
      <thead>
        <tr><th>Fecha</th><th>Tipo</th><th>Descripcion</th><th>Cuotas</th><th>Cargo</th><th>Abono</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>01/03/2026</td>
          <td>Nacional</td>
          <td>Compra Supermercado</td>
          <td>3/6</td>
          <td><span>$33.000</span></td>
          <td><span></span></td>
        </tr>
      </tbody>
    `;
  });
}

describe('creditCardDetailsScript — against credit-card-details.html (AC1, AC6, AC9)', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
    simulateInvoicedTab();
  });

  it('updates the product with the national balance and cupo, and the card header fields', async () => {
    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { products } = lastStateChangeData(messages);
    expect(products).toHaveLength(1);
    expect(products?.[0]).toMatchObject({
      instanceId: PRODUCT_ID,
      kindKey: 'tarjeta-credito',
      displayName: 'Visa Nacional',
      maskedIdentifier: '••••1111',
      balanceText: '$150.000',
      creditLimitText: '$1.000.000',
      cardBrand: 'visa',
      cardCategory: 'nacional',
      cardLast4: '1111',
    });
  });

  it('reports both the unbilled and the billed movement, each with a distinct position (AC9)', async () => {
    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    expect(movements).toHaveLength(2);
    expect(movements?.[0]).toMatchObject({ rawDescription: 'Compra Farmacia', outgoingText: '$12.000', incomingText: null });
    expect(movements?.[1]).toMatchObject({ rawDescription: 'Compra Supermercado', outgoingText: '$33.000', incomingText: null });
    expect(movements?.[0]?.positionInReadSnapshot).not.toBe(movements?.[1]?.positionInReadSnapshot);
  });

  it('keys extras by stable identifiers, never the bank\'s Spanish column headings, and marks billed correctly', async () => {
    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    expect(movements?.[0]?.extras).toMatchObject({ billed: 'false' });
    expect(movements?.[1]?.extras).toMatchObject({ billed: 'true', installments: '3/6' });
  });

  it('every movement here is CLP, positive-amount text, direction read from the populated column (AC9)', async () => {
    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    for (const movement of movements ?? []) {
      expect(movement.currencyCode).toBe('CLP');
      expect(movement.outgoingText === null || movement.incomingText === null).toBe(true);
    }
  });
});

describe('creditCardDetailsScript — against credit-card-details-international.html (AC10)', () => {
  it('reports the international movement in USD, unconverted, with no peso amount invented', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details-international.html'));
    simulateInvoicedTab();
    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    const internationalMovement = movements?.find((m) => m.rawDescription === 'Compra Streaming');
    expect(internationalMovement).toMatchObject({
      currencyCode: 'USD',
      outgoingText: 'US$ 1.111,00',
      incomingText: null,
    });
    expect(internationalMovement?.extras).toMatchObject({ country: 'Estados Unidos' });
  });
});
