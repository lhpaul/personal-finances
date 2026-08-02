import { join } from 'node:path';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { accountTransactionsScript } from './banco-de-chile.account-transactions.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');
const PRODUCT_ID = 'a'.repeat(32);

interface MovementMessageData {
  movements: Array<Record<string, unknown>>;
}

function movementsFromMessages(messages: Array<{ eventType: string; data?: unknown }>): Array<Record<string, unknown>> {
  const stateChange = messages.find(
    (m) => m.eventType === 'state-change' && (m.data as MovementMessageData | undefined)?.movements,
  );
  return (stateChange?.data as MovementMessageData | undefined)?.movements ?? [];
}

function runWithProduct(source: string): ReturnType<typeof runInjectedScript> {
  return runInjectedScript(source, { productId: PRODUCT_ID });
}

/**
 * Simulates a second page of results: a static fixture has no live Angular router to page
 * through, and a `<script>` tag assigned via `innerHTML` does not execute (WHATWG DOM behavior),
 * so pagination is simulated here, in the test, rather than inside the fixture.
 */
function simulateSecondPage(): void {
  const nextButton = document.querySelector('.mat-paginator-navigation-next') as HTMLButtonElement | null;
  const body = document.getElementById('movements-body');
  if (!nextButton || !body) return;
  nextButton.addEventListener('click', () => {
    if (nextButton.disabled) return;
    body.innerHTML = `
      <tr>
        <td>01/03/2026</td>
        <td>Pago Servicio Basico</td>
        <td></td>
        <td><span>$22.000</span></td>
        <td><span></span></td>
      </tr>
      <tr>
        <td>28/02/2026</td>
        <td>Deposito Sueldo</td>
        <td></td>
        <td><span></span></td>
        <td><span>$500.000</span></td>
      </tr>
    `;
    nextButton.disabled = true;
  });
}

describe('accountTransactionsScript — against account-transactions.html (AC1, AC6)', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'account-transactions.html'));
    simulateSecondPage();
  });

  it('paginates across both pages and posts all four movements with correct raw fields', async () => {
    const { messages } = await runWithProduct(accountTransactionsScript());
    const movements = movementsFromMessages(messages);
    expect(movements).toHaveLength(4);
    expect(movements.map((m) => m.positionInReadSnapshot)).toEqual([0, 1, 2, 3]);
    expect(movements[0]).toMatchObject({ dateText: '03/03/2026', outgoingText: '$10.000', incomingText: null });
    expect(movements[1]).toMatchObject({ dateText: '02/03/2026', outgoingText: null, incomingText: '$50.000' });
    expect(movements.every((m) => m.productInstanceId === PRODUCT_ID)).toBe(true);
    expect(movements.every((m) => m.bankSuppliedId === null)).toBe(true);
  });

  it('posts no error when the read succeeds', async () => {
    const { messages } = await runWithProduct(accountTransactionsScript());
    expect(messages.filter((m) => m.eventType === 'error')).toEqual([]);
  });
});

describe('accountTransactionsScript — AC11: empty statement', () => {
  it('posts a successful read with zero movements, no failure', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'account-transactions-empty.html'));
    const { messages } = await runWithProduct(accountTransactionsScript());
    expect(movementsFromMessages(messages)).toEqual([]);
    expect(messages.filter((m) => m.eventType === 'error')).toEqual([]);
    expect(messages.some((m) => m.eventType === 'state-change' && m.stepId === 'get-transactions-start')).toBe(true);
  });
});

describe('accountTransactionsScript — AC12: stated count exceeds parsed rows', () => {
  it('posts parse_failed scoped to this product, not an empty success', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'account-transactions-count-mismatch.html'));
    const { messages } = await runWithProduct(accountTransactionsScript());
    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]?.data).toMatchObject({ code: 'parse_failed', productInstanceId: PRODUCT_ID });
    expect(messages.some((m) => m.eventType === 'state-change' && m.stepId === 'get-transactions-start')).toBe(false);
  });
});

describe('accountTransactionsScript — AC22: two identical-looking movements stay two', () => {
  it('reports both rows, distinguishable only by position', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'account-transactions-duplicate-rows.html'));
    const { messages } = await runWithProduct(accountTransactionsScript());
    const movements = movementsFromMessages(messages);
    expect(movements).toHaveLength(2);
    expect(movements[0]?.positionInReadSnapshot).toBe(0);
    expect(movements[1]?.positionInReadSnapshot).toBe(1);
    expect(movements[0]?.dateText).toBe(movements[1]?.dateText);
    expect(movements[0]?.rawDescription).toBe(movements[1]?.rawDescription);
    expect(movements[0]?.outgoingText).toBe(movements[1]?.outgoingText);
  });
});
