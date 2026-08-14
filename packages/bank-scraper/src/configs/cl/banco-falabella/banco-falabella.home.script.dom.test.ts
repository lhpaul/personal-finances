/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.bancofalabella.cl/web-clientes/techbank-client"}
 */
import { join } from 'node:path';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript } from '../../../test-utils/run-injected-script';
import { homeScript } from './banco-falabella.home.script';

const FIXTURES_DIR = join(__dirname, 'fixtures');

interface ProductMessageData {
  products: Array<Record<string, unknown>>;
}

function productsFromMessages(messages: Array<{ eventType: string; data?: unknown }>): Array<Record<string, unknown>> {
  const stateChange = messages.find(
    (m) => m.eventType === 'state-change' && (m.data as ProductMessageData | undefined)?.products,
  );
  return (stateChange?.data as ProductMessageData | undefined)?.products ?? [];
}

describe('homeScript — discovery against home.html', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
  });

  it('posts get-products-start then get-transactions-start with products, then ready', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const stepIds = messages.filter((m) => m.eventType === 'state-change').map((m) => m.stepId);
    expect(stepIds[0]).toBe('get-products-start');
    expect(stepIds).toContain('get-transactions-start');
    expect(stepIds[stepIds.length - 1]).toBe('ready');
  });

  it('extracts the checking account and credit card with raw fields and opaque instance ids', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    expect(products).toHaveLength(2);

    const corriente = products.find((p) => p.kindKey === 'cuenta-corriente');
    expect(corriente?.balanceText).toBe('$1.111.000');
    expect(corriente?.instanceId).toMatch(/^[0-9a-f]{32}$/u);

    const card = products.find((p) => p.kindKey === 'tarjeta-credito');
    expect(card?.cardLast4).toBe('2222');
    expect(card?.creditLimitText).toBe('$2.222.000');

    const serialized = JSON.stringify(products);
    expect(serialized).not.toContain('11111111');
    expect(serialized).not.toContain('__elementId');
  });
});
