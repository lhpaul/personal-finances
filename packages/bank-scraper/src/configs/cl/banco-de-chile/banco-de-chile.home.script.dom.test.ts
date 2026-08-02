import { join } from 'node:path';
import { loadFixtureHtml, renderFixture } from '../../../test-utils/load-fixture';
import { resetScriptGlobals, runInjectedScript, withoutCryptoSubtle } from '../../../test-utils/run-injected-script';
import { homeScript } from './banco-de-chile.home.script';

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

describe('homeScript — discovery against home.html (AC1, AC6)', () => {
  beforeEach(() => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
  });

  it('posts a get-products-start state change before extraction, then get-transactions-start with the products', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const stepIds = messages.filter((m) => m.eventType === 'state-change').map((m) => m.stepId);
    expect(stepIds).toEqual(['get-products-start', 'get-transactions-start']);
  });

  it('extracts every account and every credit card with the right raw fields', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    expect(products).toHaveLength(7); // 5 accounts (including línea de crédito) + 2 cards

    const corriente = products.filter((p) => p.kindKey === 'cuenta-corriente');
    expect(corriente).toHaveLength(2);
    expect(corriente[0]?.balanceText).toBe('$1.111.000');
    expect(corriente[1]?.balanceText).toBe('$222.000');

    const vista = products.find((p) => p.kindKey === 'cuenta-vista');
    expect(vista?.balanceText).toBe('$33.000');

    const fan = products.find((p) => p.kindKey === 'cuenta-fan');
    expect(fan?.displayName).toBe('Cuenta FAN');

    const lineaDeCredito = products.find((p) => p.kindKey === 'linea-de-credito');
    expect(lineaDeCredito).toBeDefined(); // discovered, not filtered in-page (Business Rule 16 is the normalizer's job)

    const cards = products.filter((p) => p.kindKey === 'tarjeta-credito');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ cardBrand: 'visa', cardCategory: 'nacional', cardLast4: '1111' });
    expect(cards[1]).toMatchObject({ cardBrand: 'mastercard', cardCategory: 'internacional', cardLast4: '2222' });
  });

  it('every instanceId is 32 lowercase hex characters, and never the raw account number (Decision 6)', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(product.instanceId).toMatch(/^[0-9a-f]{32}$/u);
    }
    const serialized = JSON.stringify(products);
    expect(serialized).not.toContain('11111111');
    expect(serialized).not.toContain('22222222');
  });

  it('the outgoing product payload carries no internal key (__clickIndex, elementIndex, index, position)', async () => {
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(Object.keys(product)).not.toContain('__clickIndex');
      expect(Object.keys(product)).not.toContain('elementIndex');
      expect(Object.keys(product)).not.toContain('index');
      expect(Object.keys(product)).not.toContain('position');
    }
  });

  it('clicks the first account after discovery and sets window.productId', async () => {
    let firstAccountClicked = false;
    document
      .querySelectorAll('.bch-card.card-cuentas')[0]
      ?.querySelector('.clickable')
      ?.addEventListener('click', () => {
        firstAccountClicked = true;
      });
    await runInjectedScript(homeScript());
    expect(firstAccountClicked).toBe(true);
    expect(typeof (window as unknown as { productId?: string }).productId).toBe('string');
  });
});

describe('homeScript — whitespace-robust account-text split (CodeRabbit finding #10)', () => {
  it('extracts an account whose fields are separated by newline-and-indentation whitespace, not two literal spaces', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    // Overwrite the first account's markup with newline+indentation whitespace between fields —
    // the shape textContent produces from a real multi-line Angular template — instead of the
    // fixture's literal two-space separators.
    const firstAccount = document.querySelectorAll('.bch-card.card-cuentas')[0];
    const clickable = firstAccount?.querySelector('.clickable');
    if (clickable) {
      clickable.textContent = 'Cuenta Corriente\n      66666666\n      $666.000';
    }
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    const corriente = products.filter((p) => p.kindKey === 'cuenta-corriente');
    expect(corriente).toHaveLength(2);
    expect(corriente[0]?.balanceText).toBe('$666.000');
  });
});

describe('homeScript — AC24: two accounts of the same kind, stable across two independent reads', () => {
  it('produces two different instanceIds for the two Cuenta Corriente accounts, each identical across two separate runs', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    const firstRun = await runInjectedScript(homeScript());
    const firstProducts = productsFromMessages(firstRun.messages).filter((p) => p.kindKey === 'cuenta-corriente');

    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    const secondRun = await runInjectedScript(homeScript());
    const secondProducts = productsFromMessages(secondRun.messages).filter((p) => p.kindKey === 'cuenta-corriente');

    expect(firstProducts).toHaveLength(2);
    expect(secondProducts).toHaveLength(2);
    expect(firstProducts[0]?.instanceId).not.toBe(firstProducts[1]?.instanceId);
    expect(firstProducts[0]?.instanceId).toBe(secondProducts[0]?.instanceId);
    expect(firstProducts[1]?.instanceId).toBe(secondProducts[1]?.instanceId);
  });
});

describe('homeScript — go-to-next-product-page, revisiting home after a product page', () => {
  it('clicks the second account when the first has already been visited', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    await runInjectedScript(homeScript()); // discovery + click on account 0

    let secondAccountClicked = false;
    document
      .querySelectorAll('.bch-card.card-cuentas')[1]
      ?.querySelector('.clickable')
      ?.addEventListener('click', () => {
        secondAccountClicked = true;
      });
    await runInjectedScript(homeScript()); // globalVariables.products already set -> go to next
    expect(secondAccountClicked).toBe(true);
  });

  it('posts ready once every account and credit card has been visited', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    let lastResult = await runInjectedScript(homeScript());
    // 5 accounts + 2 credit cards = 7 products to click through before "ready".
    for (let i = 0; i < 7; i += 1) {
      // Each call depends on the previous one's globalVariables state, so this cannot be
      // parallelized with Promise.all.
      lastResult = await runInjectedScript(homeScript());
    }
    const readyMessages = lastResult.messages.filter((m) => m.eventType === 'state-change' && m.stepId === 'ready');
    expect(readyMessages).toHaveLength(1);
  });
});

describe('homeScript — Risk R4: crypto.subtle unavailable', () => {
  it('fails extraction with a diagnostic rather than falling back to a raw number or an index', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    const { messages } = await withoutCryptoSubtle(() => runInjectedScript(homeScript()));
    const products = productsFromMessages(messages);
    expect(products).toEqual([]); // no product ever reported with a raw-number or index fallback
    const errorTraces = messages.filter(
      (m) => m.eventType === 'trace' && (m.data as { type?: string } | undefined)?.type === 'error',
    );
    expect(errorTraces.length).toBeGreaterThan(0);
    expect(JSON.stringify(errorTraces)).toContain('crypto.subtle');
  });
});

describe('homeScript — a dropped product is reported, not silently swallowed (CodeRabbit finding #11)', () => {
  it('wires both extraction catch blocks to report a product-scoped failure, not only a trace', () => {
    const source = homeScript();
    const accountsCatch = source.slice(source.indexOf('async function extractAccounts'), source.indexOf('async function extractCreditCards'));
    const creditCardsCatch = source.slice(source.indexOf('async function extractCreditCards'), source.indexOf('function toReportedProduct'));
    expect(accountsCatch).toContain("reportExtractionFailure('account', index)");
    expect(creditCardsCatch).toContain("reportExtractionFailure('credit-card', index)");
    // The helper itself must actually post an ERROR (not just another trace) for the failure to
    // affect the read's outcome.
    expect(source).toContain("eventType: 'error'");
    expect(source).toContain('reportExtractionFailure(kindLabel, index)');
  });
});

describe('homeScript — goToNextProductPage guards a re-rendered product list (CodeRabbit finding #14)', () => {
  it('reports parse_failed for the missing account instead of throwing, when the account list shrinks between page loads', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home.html'));
    await runInjectedScript(homeScript()); // discovery + click on account 0

    // Simulate the product list re-rendering with fewer items than were discovered — the exact
    // scenario the finding describes (accountItems[currentAccount.__clickIndex] is undefined).
    // The next call looks for the account originally discovered at click index 1, so the list
    // must shrink to fewer than two items, not merely lose the element at that index.
    const accountItems = Array.from(document.querySelectorAll('.bch-card.card-cuentas'));
    accountItems.slice(1).forEach((el) => el.remove());

    const { messages, thrown } = await runInjectedScript(homeScript());
    expect(thrown).toBeNull();
    const errorMessages = messages.filter((m) => m.eventType === 'error');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]?.data).toMatchObject({ code: 'parse_failed' });
  });
});

describe('homeScript — AC25: a mixed supported/unsupported product list', () => {
  it('discovers the unsupported kind too, with a raw kindKey the normalizer will map to null', async () => {
    resetScriptGlobals();
    renderFixture(loadFixtureHtml(FIXTURES_DIR, 'home-unsupported-kind.html'));
    const { messages } = await runInjectedScript(homeScript());
    const products = productsFromMessages(messages);
    expect(products).toHaveLength(2);
    expect(products.some((p) => p.kindKey === 'cuenta-corriente')).toBe(true);
    expect(products.some((p) => p.kindKey?.toString().startsWith('unknown-'))).toBe(true);
  });
});
