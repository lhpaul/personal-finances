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

describe('creditCardDetailsScript — currency is not derived from column count (CodeRabbit finding #46)', () => {
  it('does not mislabel an 8-column national table as international when it has no country column', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
    // Add an extra, unrelated national-table column — the exact regression the old
    // "more than 7 header cells" heuristic would have mislabeled as international.
    const table = document.querySelector('.bch-table');
    const headerRow = table?.querySelector('thead tr');
    const extraHeader = document.createElement('th');
    extraHeader.textContent = 'Referencia';
    headerRow?.appendChild(extraHeader);
    const bodyRow = table?.querySelector('tbody tr');
    const extraCell = document.createElement('td');
    extraCell.textContent = 'REF-001';
    bodyRow?.appendChild(extraCell);
    simulateInvoicedTab();

    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    const unbilledMovement = movements?.find((m) => m.rawDescription === 'Compra Farmacia');
    expect(unbilledMovement?.currencyCode).toBe('CLP');
  });
});

describe('creditCardDetailsScript — table selection when both tabs stay mounted (CodeRabbit finding #45)', () => {
  it('reads the last .bch-table for the billed pass instead of re-reading the first (unbilled) one', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
    // Simulate an Angular Material tab container that keeps the inactive tab's table mounted:
    // append a second, distinct .bch-table (the billed one) instead of replacing the first.
    const invoicedTab = document.querySelectorAll('.router-tab-link')[1];
    invoicedTab?.addEventListener('click', () => {
      const billedTable = document.createElement('table');
      billedTable.className = 'bch-table';
      billedTable.innerHTML = `
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
      document.body.appendChild(billedTable);
    });

    const { messages } = await runWithProduct(creditCardDetailsScript());
    const { movements } = lastStateChangeData(messages);
    const billedMovement = movements?.find((m) => m.extras && (m.extras as { billed?: string }).billed === 'true');
    expect(billedMovement).toMatchObject({ rawDescription: 'Compra Supermercado', outgoingText: '$33.000' });
    // The unbilled pass must still read the original (first) table, not the newly-appended one.
    const unbilledMovement = movements?.find((m) => m.extras && (m.extras as { billed?: string }).billed === 'false');
    expect(unbilledMovement).toMatchObject({ rawDescription: 'Compra Farmacia' });
  });
});

describe('creditCardDetailsScript — no invoiced tab link (CodeRabbit finding #42)', () => {
  it('traces that only unbilled transactions are being reported, instead of silently looking identical to "no billed movements"', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
    document.querySelectorAll('.router-tab-link').forEach((el) => el.remove());

    const { messages } = await runWithProduct(creditCardDetailsScript());
    const traceMessages = messages.filter((m) => m.eventType === 'trace');
    expect(
      traceMessages.some((m) => JSON.stringify((m as { data?: unknown }).data).includes('No invoiced tab link found')),
    ).toBe(true);
  });
});

describe('creditCardDetailsScript — no fabricated balance (CodeRabbit finding #44, Critical)', () => {
  it(
    'posts a parse_failed ERROR instead of a fabricated $0 balance when the national summary is missing',
    async () => {
      resetScriptGlobals();
      renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
      // Keep .bch-summary present (so the wait-for-element step still succeeds quickly) but
      // rename the section away from "Nacional" — extractBalanceDetails's own loop then finds no
      // matching section, which is the code path this finding targets.
      const title = document.querySelector('.summary-header-title');
      if (title) title.textContent = 'Internacional';
      simulateInvoicedTab();

      const { messages } = await runWithProduct(creditCardDetailsScript());
      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages.every((m) => (m as { data?: { code?: string } }).data?.code === 'parse_failed')).toBe(true);
      const { products } = lastStateChangeData(messages);
      expect(products ?? []).toEqual([]); // no product reported with a fabricated balance
      expect(JSON.stringify(messages)).not.toContain('"balanceText":"$0"');
    },
    10000,
  );
});

describe('creditCardDetailsScript — guarded extraction helpers (CodeRabbit finding #43)', () => {
  it('reports parse_failed with a descriptive cause when the card header is missing, instead of a bare TypeError', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
    document.querySelector('.card-header')?.remove();
    simulateInvoicedTab();

    const { messages, thrown } = await runWithProduct(creditCardDetailsScript());
    expect(thrown).toBeNull();
    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(JSON.stringify(messages)).toContain('.card-header not found');
  });
});

describe('creditCardDetailsScript — a transient billed-tab failure does not discard already-extracted data (CodeRabbit finding #6)', () => {
  it(
    'still reports the product and unbilled movements when the invoiced tab fails to load',
    async () => {
      resetScriptGlobals();
      renderFixture(loadFixtureHtml(FIXTURES_DIR, 'credit-card-details.html'));
      // Unlike simulateInvoicedTab(), the invoiced tab click here removes .bch-summary instead of
      // swapping in a billed table — wait-for-invoiced-tab's waitForBchSummaryElement exhausts its
      // retries and throws, exactly the transient failure this finding targets.
      const invoicedTab = document.querySelectorAll('.router-tab-link')[1];
      invoicedTab?.addEventListener('click', () => {
        document.querySelector('.bch-summary')?.remove();
      });

      const { messages, thrown } = await runWithProduct(creditCardDetailsScript());
      expect(thrown).toBeNull();
      const { products, movements } = lastStateChangeData(messages);
      // Header, national balance, and the unbilled movement were already extracted successfully
      // before the invoiced-tab failure — none of that must be discarded.
      expect(products).toHaveLength(1);
      expect(products?.[0]).toMatchObject({ displayName: 'Visa Nacional', balanceText: '$150.000' });
      expect(movements?.some((m) => m.rawDescription === 'Compra Farmacia')).toBe(true);
      // The billed pass failed, so only the unbilled movement is present.
      expect(movements).toHaveLength(1);
    },
    15000,
  );
});

describe('creditCardDetailsScript — no duplicate parse_failed overwriting the real attempts count (CodeRabbit finding #4)', () => {
  it(
    'posts exactly one error when the wrapped wait-for-page-to-be-ready step exhausts retries, with the real attempts count',
    async () => {
      resetScriptGlobals();
      // No .bch-summary at all: waitForBchSummaryElement (inside wait-for-page-to-be-ready)
      // exhausts its retries and throws. Without the alreadyReportedFailure guard, the outer
      // .catch() backstop would post a second error with no attempts field.
      renderFixture('<html><body></body></html>');
      const { messages } = await runWithProduct(creditCardDetailsScript());
      const errorMessages = messages.filter((m) => m.eventType === 'error');
      expect(errorMessages).toHaveLength(1);
      expect(errorMessages[0]?.data).toMatchObject({ code: 'parse_failed', step: 'wait-for-page-to-be-ready', attempts: 3 });
    },
    15000,
  );
});
